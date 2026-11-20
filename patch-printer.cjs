// Jalankan di folder proyek:  node patch-printer.cjs
// (opsional) node patch-printer.cjs src/main.jsx
const fs = require('fs');
const path = require('path');

function findTarget() {
  if (process.argv[2]) return process.argv[2];
  const dir = 'src';
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jsx|js|tsx)$/.test(f)) continue;
    const p = path.join(dir, f);
    const t = fs.readFileSync(p, 'utf8');
    if (t.includes('connectBluetoothPrinter') && t.includes('globalBleDevice')) return p;
  }
  throw new Error('File JSX utama tidak ditemukan. Jalankan: node patch-printer.cjs src/NAMA_FILE.jsx');
}

function rep(src, from, to, label) {
  const i = src.indexOf(from);
  if (i === -1) throw new Error('Bagian tidak ditemukan: ' + label);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

const target = findTarget();
let raw = fs.readFileSync(target, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');

if (s.includes('bleReconnectHook')) {
  console.log('Perbaikan sudah terpasang di ' + target + '. Tidak ada yang diubah.');
  process.exit(0);
}

fs.writeFileSync(target + '.bak', raw);

// 1. Global
s = rep(s,
`let globalBleDevice = null;
let globalBleCharacteristic = null;
`,
`let globalBleDevice = null;
let globalBleCharacteristic = null;
let bleReconnectHook = null; // diisi komponen App agar fungsi global bisa menyambung ulang

const BLE_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb'
];

// Sambung ke GATT dan cari karakteristik yang bisa ditulis
async function openPrinterChannel(device) {
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices().catch(() => []);
  for (const sv of services) {
    const chars = await sv.getCharacteristics().catch(() => []);
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  throw new Error('Karakteristik cetak tidak ditemukan pada printer ini.');
}
`, 'global');

// 2. sendPrintJob
s = rep(s,
`  const content = buildReceipt(order, type);
  // 1. Coba cetak langsung via Web Bluetooth (perangkat ini terhubung BT)`,
`  const content = buildReceipt(order, type);
  // 0. Printer pernah terhubung tetapi putus: coba sambung ulang dulu
  if (globalBleDevice && !globalBleDevice.gatt?.connected && bleReconnectHook) {
    await bleReconnectHook(2);
  }
  // 1. Coba cetak langsung via Web Bluetooth (perangkat ini terhubung BT)`, 'sendPrintJob');

// 3. Relay handler
s = rep(s,
`      if (!payload?.jobId || !Array.isArray(payload.bytesArr)) return;
      if (!globalBleCharacteristic || !globalBleDevice || !globalBleDevice.gatt?.connected) return;`,
`      if (!payload?.jobId || !Array.isArray(payload.bytesArr)) return;
      if (globalBleDevice && !globalBleDevice.gatt?.connected && bleReconnectHook) {
        await bleReconnectHook(2);
      }
      if (!globalBleCharacteristic || !globalBleDevice || !globalBleDevice.gatt?.connected) return;`, 'relay');

// 4. Refs
s = rep(s,
`  const [bleDeviceName, setBleDeviceName] = useState('');`,
`  const [bleDeviceName, setBleDeviceName] = useState('');
  const bleManualDisc = useRef(false);   // true = diputus sengaja oleh pengguna
  const bleReconnecting = useRef(false); // mencegah sambung ulang ganda`, 'refs');

// 5. Effects (sebelum renameDevice)
s = rep(s,
`  const renameDevice = (name) =>`,
`  // Sambung ulang otomatis saat aplikasi kembali dibuka
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && globalBleDevice && !globalBleDevice.gatt?.connected) {
        reconnectBluetoothPrinter(3);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Jaga layar tetap menyala selama printer terhubung
  useEffect(() => {
    if (!bleConnected || !('wakeLock' in navigator)) return;
    let lock;
    const get = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch {} };
    get();
    const re = () => { if (document.visibilityState === 'visible') get(); };
    document.addEventListener('visibilitychange', re);
    return () => { document.removeEventListener('visibilitychange', re); lock && lock.release && lock.release(); };
  }, [bleConnected]);

  const renameDevice = (name) =>`, 'effects');

// 6. Ganti connect + disconnect
const startMark = '  const connectBluetoothPrinter = async () => {';
const endMark = '  const refreshPrinter = async () => {';
const a = s.indexOf(startMark);
const b = s.indexOf(endMark);
if (a === -1 || b === -1 || b < a) throw new Error('Fungsi connect/refresh tidak ditemukan');

const newFns = `  const reconnectBluetoothPrinter = async (tries = 3) => {
    const dev = globalBleDevice;
    if (!dev || bleManualDisc.current) return false;
    if (dev.gatt && dev.gatt.connected && globalBleCharacteristic) return true;
    if (bleReconnecting.current) return false;
    bleReconnecting.current = true;
    setPrinterStatus('Menyambung ulang...');
    for (let i = 0; i < tries; i++) {
      try {
        globalBleCharacteristic = await openPrinterChannel(dev);
        const name = dev.name || 'Printer Bluetooth';
        setBleConnected(true);
        setBleDeviceName(name);
        setPrinterName(name);
        setPrinterStatus('Terhubung');
        bleReconnecting.current = false;
        return true;
      } catch (e) {
        await new Promise(r => setTimeout(r, 1200 * (i + 1)));
      }
    }
    bleReconnecting.current = false;
    globalBleCharacteristic = null;
    setBleConnected(false);
    setPrinterStatus('Tidak terhubung');
    return false;
  };
  bleReconnectHook = reconnectBluetoothPrinter;

  const connectBluetoothPrinter = async () => {
    if (!navigator.bluetooth) {
      flash('Browser belum mendukung Web Bluetooth. Pastikan buka lewat Google Chrome di HP Android.', 5000);
      return;
    }
    try {
      setPrinterStatus('Memeriksa...');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICE_UUIDS
      });
      bleManualDisc.current = false;
      const char = await openPrinterChannel(device);
      globalBleDevice = device;
      globalBleCharacteristic = char;
      const name = device.name || 'Printer Bluetooth';
      setBleConnected(true);
      setBleDeviceName(name);
      setPrinterStatus('Terhubung');
      setPrinterName(name);
      device.addEventListener('gattserverdisconnected', () => {
        globalBleCharacteristic = null; // device sengaja DIPERTAHANKAN untuk sambung ulang
        setBleConnected(false);
        setPrinterStatus('Tidak terhubung');
        if (!bleManualDisc.current) setTimeout(() => reconnectBluetoothPrinter(3), 800);
      });
      flash('✓ Berhasil terhubung ke ' + name + '!', 4000);
    } catch (err) {
      console.warn('Gagal sambung bluetooth:', err);
      if (err.name !== 'NotFoundError') {
        flash('Gagal menyambungkan printer: ' + err.message, 5000);
      }
      setPrinterStatus(bleConnected ? 'Terhubung' : 'Tidak terhubung');
    }
  };

  const disconnectBluetoothPrinter = () => {
    bleManualDisc.current = true;
    if (globalBleDevice && globalBleDevice.gatt && globalBleDevice.gatt.connected) {
      globalBleDevice.gatt.disconnect();
    }
    globalBleDevice = null;
    globalBleCharacteristic = null;
    setBleConnected(false);
    setBleDeviceName('');
    setPrinterStatus('Tidak terhubung');
    flash('Printer Bluetooth diputuskan.', 3000);
  };

`;
s = s.slice(0, a) + newFns + s.slice(b);

// 7. refreshPrinter
s = rep(s,
`  const refreshPrinter = async () => {
    if (globalBleDevice && globalBleDevice.gatt?.connected) {`,
`  const refreshPrinter = async () => {
    if (globalBleDevice && !globalBleDevice.gatt?.connected) {
      const ok = await reconnectBluetoothPrinter(2);
      if (ok) return;
    }
    if (globalBleDevice && globalBleDevice.gatt?.connected) {`, 'refreshPrinter');

fs.writeFileSync(target, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Berhasil! Perbaikan terpasang di ' + target);
console.log('Cadangan file lama: ' + target + '.bak');