import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, ShoppingCart, Utensils, ClipboardList, BarChart3, Settings, Search, Plus, Minus, Trash2, Printer, LogOut, Coffee, Menu as MenuIcon, X, CheckCircle2, MapPin, UserRound, Clock, Wallet, ShieldAlert, UserPlus, Users, Eye } from 'lucide-react';
import { supabase } from './supabase';
import './style.css';

const money = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } };

const getPrintBridge = () => read('z_print_url', 'http://localhost:9100');

const receiptText = (text, align = 'left', bold = false, size = 'normal') => ({ type: 'text', text: String(text ?? ''), align, bold, size });
const receiptDivider = () => ({ type: 'divider' });

// jumlah yang sudah terbayar untuk tagihan (uang diterima dikurangi kembalian)
const settledOf = o => o.payment === 'Belum Bayar' ? 0 : Math.max(0, (o.paid || 0) - (o.change || 0));
// sisa tagihan yang belum dibayar
const remainOf = o => Math.max(0, (o.total || 0) - settledOf(o));

const buildReceipt = (o, type) => {
  const kitchen = type === 'kitchen';
  const content = [receiptText('ZAYGA', 'center', true, 'large'), receiptText(o.isAddition ? 'MENU TAMBAHAN' : (kitchen ? 'TIKET PESANAN DAPUR' : 'STRUK PEMBAYARAN'), 'center', true), receiptDivider(), ...(o.isAddition ? [] : [receiptText(`No: ${o.id}`, 'left', true)]), receiptText(`Waktu: ${o.date} ${o.time}`), receiptText(`Kasir: ${o.cashier}`), receiptText(`Pelanggan: ${o.customer || '-'}`), receiptText(`Lokasi: ${o.location}`), receiptDivider()];
  for (const item of o.items) {
    if (kitchen) { content.push(receiptText(`${item.qty} x ${item.name}`, 'left', true)); }
    else { content.push(receiptText(item.name)); content.push({ type: 'row', left: `${item.qty} x ${money(item.price)}`, right: money(item.qty * item.price) }); }
  }
  content.push(receiptDivider());
  if (kitchen) { content.push(receiptText('CATATAN DAPUR', 'left', true)); content.push(receiptText(o.notes || '- Tidak ada catatan -')); content.push(receiptDivider()); content.push(receiptText('TOLONG YAA KAK :)', 'center', true)); }
  else {
    content.push({ type: 'row', left: 'TOTAL', right: money(o.total), bold: true });
    content.push({ type: 'row', left: `Bayar (${o.payment})`, right: money(o.paid) });
    content.push({ type: 'row', left: 'Kembali', right: money(o.change) });
    if (remainOf(o) > 0) content.push({ type: 'row', left: 'SISA BELUM BAYAR', right: money(remainOf(o)), bold: true });
    content.push(receiptDivider());
    content.push(receiptText('Terima kasih telah berkunjung!', 'center', true));
  }
  return content;
};

async function checkPrintBridge() {
  const url = getPrintBridge();
  const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('Aplikasi printer tidak merespons.');
  const data = await response.json();
  if (!data.printer?.connected) throw new Error(data.printer?.problem || 'Printer belum terhubung di aplikasi Cleanter.');
  return data;
}

async function sendPrintJob(order, type) {
  const url = getPrintBridge();
  const health = await checkPrintBridge();
  const response = await fetch(`${url}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperWidth: 58, cut: false, reference: `${order.id}-${type}`, content: buildReceipt(order, type) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.fix || data.detail || data.error || `Gagal mencetak (${response.status})`);
  return { job: data, printer: health.printer?.name || 'Printer Bluetooth' };
}

function App() {
  const [user, setUser] = useState(() => read('z_user', null));
  const [login, setLogin] = useState({ username: '', password: '' });
  const [usersList, setUsersList] = useState([]);

  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clearLogs, setClearLogs] = useState([]);

  const [page, setPage] = useState('Pesanan');
  const [category, setCategory] = useState('Semua');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState('Tunai');
  const [paid, setPaid] = useState('');
  const [paidRaw, setPaidRaw] = useState(''); // angka yang diketik kasir (singkatan ribuan: 10 = 10.000)
  const [showPay, setShowPay] = useState(false);
  const [notice, setNotice] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [addingToOrder, setAddingToOrder] = useState(null); // bon lama yang sedang ditambah itemnya
  const [settling, setSettling] = useState(null); // bon yang sedang dilunasi
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Kasir' });
  const [selectedItemForVariant, setSelectedItemForVariant] = useState(null);

  const [printUrl, setPrintUrl] = useState(() => getPrintBridge());
  const [printerStatus, setPrinterStatus] = useState('Memeriksa...');
  const [printerName, setPrinterName] = useState('');
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', category: 'Mie', price: '' });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetchDataFromSupabase();
  }, []);

  const fetchDataFromSupabase = async () => {
    try {
      const [resUsers, resMenu, resOrders, resLogs] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('menu_items').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('clear_logs').select('*')
      ]);

      if (resUsers.data) setUsersList(resUsers.data);
      if (resMenu.data) setItems(resMenu.data);
      if (resOrders.data) setOrders(resOrders.data);
      if (resLogs.data) setClearLogs(resLogs.data);
    } catch (err) {
      console.error('Gagal mengambil data dari Supabase:', err.message);
    }
  };

  useEffect(() => { if (page === 'Pengaturan') refreshPrinter(); }, [page, printUrl]);
  useEffect(() => { if (paid === '') setPaidRaw(''); }, [paid]);

  const allNavItems = [
    [LayoutDashboard, 'Dashboard', ['Admin']],
    [ShoppingCart, 'Pesanan', ['Admin', 'Kasir']],
    [ClipboardList, 'Riwayat', ['Admin', 'Kasir']],
    [BarChart3, 'Laporan', ['Admin']],
    [Utensils, 'Kelola Menu', ['Admin']],
    [Settings, 'Pengaturan', ['Admin', 'Kasir']]
  ];

  const visibleNavItems = allNavItems.filter(([_, __, roles]) => user && roles.includes(user.role));

  const categories = ['Semua', 'Snack', 'Mie', 'Popmie', 'Nasi', 'Minuman', 'Kopi', 'Soft Drink'];
  const filtered = useMemo(() => items.filter(x => x.active && (category === 'Semua' || x.category === category) && x.name.toLowerCase().includes(query.toLowerCase())), [items, category, query]);
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const today = new Date().toLocaleDateString('en-CA');
  const todays = orders.filter(o => o.date === today);
  const payDue = settling ? remainOf(settling) : total;

  const add = (item) => {
    if (item.category === 'Minuman' || item.category === 'Kopi') {
      setSelectedItemForVariant(item);
    } else {
      addToCartDirect(item, false);
    }
  };

  const addToCartDirect = (item, pakaiSusu = false) => {
    const finalPrice = pakaiSusu ? item.price + 3000 : item.price;
    const finalName = pakaiSusu ? `${item.name} + Susu` : item.name;
    const finalId = pakaiSusu ? `${item.id}-susu` : item.id;

    setCart(old => {
      const found = old.find(x => x.id === finalId);
      return found
        ? old.map(x => x.id === finalId ? { ...x, qty: x.qty + 1 } : x)
        : [...old, { ...item, id: finalId, name: finalName, price: finalPrice, qty: 1 }];
    });
    setSelectedItemForVariant(null);
  };

  const changeQty = (id, delta) => setCart(old => old.map(x => x.id === id ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0));

  const startAddToOrder = (order) => {
    setAddingToOrder(order);
    setCart([]);
    setNotes('');
    setSelectedOrder(null);
    setPage('Pesanan');
  };

  const cancelAddToOrder = () => {
    setAddingToOrder(null);
    setCart([]);
    setNotes('');
    setCartOpen(false);
    setPage('Riwayat');
  };

  const saveAdditionToOrder = async (method = 'Belum Bayar', tendered = 0) => {
    if (!addingToOrder || !cart.length) return;
    const base = orders.find(o => o.id === addingToOrder.id) || addingToOrder;

    // gabungkan item tambahan ke item lama
    const merged = [...base.items];
    for (const c of cart) {
      const i = merged.findIndex(x => x.id === c.id);
      if (i > -1) merged[i] = { ...merged[i], qty: merged[i].qty + c.qty };
      else merged.push(c);
    }
    const newTotal = merged.reduce((s, x) => s + x.price * x.qty, 0);
    const belumBayar = base.payment === 'Belum Bayar';

    const extraNote = notes.trim();

    // pembayaran untuk item tambahan (bon yang memang belum bayar tetap ditagih belakangan)
    const addTotal = total;
    const payNow = !belumBayar && method !== 'Belum Bayar';
    const amount = method === 'Tunai' ? Number(tendered || 0) : addTotal;
    const newPaid = payNow ? (base.paid || 0) + amount : base.paid;
    const newChange = payNow ? (base.change || 0) + Math.max(0, amount - addTotal) : base.change;
    const status = remainOf({ ...base, total: newTotal, paid: newPaid, change: newChange }) > 0 ? 'Belum Lunas' : 'Lunas';
    const payPatch = { paid: newPaid, change: newChange, status };
    const patch = {
      ...(extraNote ? { notes: base.notes ? `${base.notes} | Tambahan: ${extraNote}` : `Tambahan: ${extraNote}` } : {}),
      items: merged,
      total: newTotal,
      ...payPatch,
      kitchen_printed: false,
      customer_printed: false // struk perlu dicetak ulang karena total berubah
    };

    const { error } = await supabase.from('orders').update(patch).eq('id', base.id);
    if (error) {
      setNotice('Gagal menambahkan item: ' + error.message);
      setTimeout(() => setNotice(''), 5000);
      return;
    }

    let updated = { ...base, ...patch };

    if (!base.kitchen_printed) {
      // Tiket dapur bon ini belum pernah dicetak: JANGAN cetak tambahan duluan.
      // Item sudah digabung ke bon, jadi saat dicetak nanti semua item (lama + tambahan) keluar sekaligus.
      setNotice(`Tambahan meja ${base.location} tersimpan ke bon. Tiket dapur belum dicetak, cetak dari Riwayat (semua item keluar sekaligus).`);
    } else {
      // Tiket dapur lama sudah tercetak: cetak tiket HANYA untuk item tambahan
      try {
        await sendPrintJob({
          ...base,
          id: `${base.id}-T${Date.now().toString().slice(-4)}`,
          items: cart,
          isAddition: true,
          notes: extraNote
        }, 'kitchen');
        await supabase.from('orders').update({ kitchen_printed: true }).eq('id', base.id);
        updated = { ...updated, kitchen_printed: true };
        setNotice(`Tambahan untuk meja ${base.location} tersimpan & tiket dapur tercetak.`);
      } catch (err) {
        setNotice(`Tambahan meja ${base.location} tersimpan, tapi cetak dapur gagal: ${err.message}`);
      }
    }

    setOrders(prev => prev.map(o => o.id === base.id ? updated : o));
    setCart([]);
    setNotes('');
    setAddingToOrder(null);
    setCartOpen(false);
    setPage('Riwayat');
    setSelectedOrder(updated);
    setTimeout(() => setNotice(''), 6000);
  };

  const closePay = () => { setShowPay(false); setSettling(null); };

  const startSaveAddition = () => {
    if (!addingToOrder || !cart.length) return;
    const base = orders.find(o => o.id === addingToOrder.id) || addingToOrder;
    if (base.payment === 'Belum Bayar') { saveAdditionToOrder('Belum Bayar', 0); return; }
    setPayment('Tunai'); setPaid(''); setShowPay(true);
  };

  const confirmAdditionPayment = async () => {
    if (payment === 'Tunai' && Number(paid || 0) < total) { setNotice('Uang diterima masih kurang.'); return; }
    const method = payment;
    const tendered = Number(paid || 0);
    setShowPay(false); setPaid('');
    await saveAdditionToOrder(method, tendered);
  };

  const openSettle = (o) => { setSettling(o); setPayment('Tunai'); setPaid(''); setShowPay(true); };

  const confirmSettle = async () => {
    const o = settling;
    if (!o || payment === 'Belum Bayar') return;
    const due = remainOf(o);
    const amount = payment === 'Tunai' ? Number(paid || 0) : due;
    if (amount < due) { setNotice('Uang diterima masih kurang.'); return; }

    const wasUnpaid = o.payment === 'Belum Bayar';
    const patch = wasUnpaid
      ? { payment, paid: amount, change: Math.max(0, amount - due), status: 'Lunas', customer_printed: false }
      : { paid: (o.paid || 0) + amount, change: (o.change || 0) + Math.max(0, amount - due), status: 'Lunas', customer_printed: false };

    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (error) {
      setNotice('Gagal menyimpan pelunasan: ' + error.message);
      setTimeout(() => setNotice(''), 5000);
      return;
    }
    const updated = { ...o, ...patch };
    setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
    if (selectedOrder && selectedOrder.id === o.id) setSelectedOrder(updated);
    setShowPay(false); setSettling(null); setPaid('');
    setNotice(`Bon meja ${o.location} lunas (${money(due)}).`);
    setTimeout(() => setNotice(''), 5000);
  };

  const loginNow = (e) => {
    e.preventDefault();
    let uInput = login.username.trim().toLowerCase();
    let pInput = login.password.trim();

    const foundUser = usersList.find(usr => usr.username.toLowerCase() === uInput && usr.password === pInput);

    if (foundUser) {
      let next = { username: foundUser.username, role: foundUser.role };
      setUser(next);
      localStorage.setItem('z_user', JSON.stringify(next));
      if (foundUser.role === 'Kasir') {
        setPage('Pesanan');
      } else {
        setPage('Dashboard');
      }
    } else {
      setNotice('Username atau password salah.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (user.role !== 'Admin') return;
    const uname = newUser.username.trim();
    const pwd = newUser.password.trim();

    if (!uname || !pwd) {
      setNotice('Username dan password wajib diisi.');
      return;
    }

    if (usersList.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
      setNotice('Username sudah digunakan. Pilih nama lain.');
      return;
    }

    const newUserData = { username: uname, password: pwd, role: newUser.role };
    const { error } = await supabase.from('users').insert([newUserData]);

    if (!error) {
      setUsersList([...usersList, newUserData]);
      setNewUser({ username: '', password: '', role: 'Kasir' });
      setNotice(`Akun karyawan "${uname}" berhasil dibuat.`);
    } else {
      setNotice('Gagal membuat akun ke Supabase.');
    }
    setTimeout(() => setNotice(''), 4000);
  };

  const handleDeleteUser = async (targetUsername) => {
    if (user.role !== 'Admin') return;
    if (targetUsername.toLowerCase() === 'admin') {
      setNotice('Akun admin utama tidak dapat dihapus.');
      return;
    }
    if (window.confirm(`Yakin ingin menghapus akun "${targetUsername}"?`)) {
      const { error } = await supabase.from('users').delete().eq('username', targetUsername);
      if (!error) {
        setUsersList(usersList.filter(u => u.username !== targetUsername));
        setNotice(`Akun "${targetUsername}" berhasil dihapus.`);
      } else {
        setNotice('Gagal menghapus akun.');
      }
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const finish = async () => {
    if (!location.trim()) { setNotice('Lokasi meja perlu diisi agar pesanan mudah diantar.'); setShowPay(false); return; }
    if (!cart.length) return;

    const isBelumBayar = payment === 'Belum Bayar';
    const amount = isBelumBayar ? 0 : (payment === 'Tunai' ? Number(paid || 0) : total);

    if (!isBelumBayar && payment === 'Tunai' && amount < total) {
      setNotice('Uang diterima masih kurang.');
      return;
    }

    const order = {
      id: 'ZG' + Date.now().toString().slice(-7),
      date: today,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      customer: customer.trim() || '',
      location: location.trim(),
      notes,
      items: cart,
      total,
      payment,
      paid: amount,
      change: isBelumBayar ? 0 : Math.max(0, amount - total),
      status: isBelumBayar ? 'Belum Lunas' : 'Lunas',
      kitchen_printed: false,
      customer_printed: false,
      cashier: user.username
    };

    const { error } = await supabase.from('orders').insert([order]);
    if (!error) {
      setOrders([order, ...orders]);
      setCart([]); setCustomer(''); setLocation(''); setNotes(''); setPaid(''); setShowPay(false); setCartOpen(false); setPage('Riwayat');
      setNotice(isBelumBayar ? 'Pesanan dicatat (Belum Bayar).' : 'Transaksi berhasil disimpan ke Supabase.');
    } else {
      setNotice('Gagal menyimpan pesanan ke database: ' + error.message);
    }
    setTimeout(() => setNotice(''), 7500);
  };

  const clearAllOrders = async () => {
    if (user.role !== 'Admin') return;
    if (!orders.length) {
      setNotice('Tidak ada riwayat untuk dihapus.');
      return;
    }
    if (window.confirm('Yakin ingin menghapus seluruh riwayat pesanan di database?')) {
      const newLog = {
        id: Date.now(),
        who: user.username,
        role: user.role,
        time: new Date().toLocaleString('id-ID'),
        count: orders.length
      };

      await supabase.from('clear_logs').insert([newLog]);
      await supabase.from('orders').delete().neq('id', 'ALL');

      setClearLogs([newLog, ...clearLogs]);
      setOrders([]);
      setNotice(`Riwayat berhasil dibersihkan oleh ${user.username}.`);
      setTimeout(() => setNotice(''), 5000);
    }
  };

  const printOrder = async (o, type = 'customer') => {
    setPrinting(true);
    try {
      await sendPrintJob(o, type);

      const updateField = type === 'kitchen' ? { kitchen_printed: true } : { customer_printed: true };
      await supabase.from('orders').update(updateField).eq('id', o.id);

      const updatedOrders = orders.map(item => item.id === o.id ? { ...item, ...updateField } : item);
      setOrders(updatedOrders);
      if (selectedOrder && selectedOrder.id === o.id) {
        setSelectedOrder({ ...selectedOrder, ...updateField });
      }

      setNotice(`${type === 'kitchen' ? 'Tiket dapur' : 'Struk pelanggan'} ${o.id} berhasil dicetak.`);
    } catch (err) {
      setNotice(`Gagal mencetak: ${err.message}`);
    } finally {
      setPrinting(false);
      setTimeout(() => setNotice(''), 5000);
    }
  };

  const printAll = async (o) => {
    setPrinting(true);
    try {
      if (!o.kitchen_printed) await sendPrintJob(o, 'kitchen');
      if (!o.customer_printed) await sendPrintJob(o, 'customer');

      const updateFields = { kitchen_printed: true, customer_printed: true };
      await supabase.from('orders').update(updateFields).eq('id', o.id);

      const updatedOrders = orders.map(item => item.id === o.id ? { ...item, ...updateFields } : item);
      setOrders(updatedOrders);
      if (selectedOrder && selectedOrder.id === o.id) {
        setSelectedOrder({ ...selectedOrder, ...updateFields });
      }

      setNotice(`Tiket Dapur & Struk Kasir ${o.id} berhasil diproses.`);
    } catch (err) {
      setNotice(`Gagal mencetak: ${err.message}`);
    } finally {
      setPrinting(false);
      setTimeout(() => setNotice(''), 5000);
    }
  };

  const refreshPrinter = async () => { try { const data = await checkPrintBridge(); setPrinterStatus('Terhubung'); setPrinterName(data.printer?.name || 'Printer Bluetooth'); } catch (err) { setPrinterStatus('Tidak terhubung'); setPrinterName(err.message); } };

  const testPrinter = async () => {
    setPrinting(true);
    try {
      const content = [receiptText('ZAYGA', 'center', true, 'large'), receiptText('TES KONEKSI PRINTER', 'center', true), receiptDivider(), receiptText('Bluetooth Classic · 58 mm', 'center'), receiptText(new Date().toLocaleString('id-ID'), 'center'), { type: 'feed', lines: 3 }];
      const r = await fetch(`${printUrl}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperWidth: 58, cut: false, reference: 'ZAYGA-TEST-PRINTER', content }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.fix || data.detail || data.error || 'Gagal mencetak');
      setNotice('Tes printer berhasil.');
    } catch (err) {
      setNotice(`Tes printer gagal: ${err.message}`);
    } finally {
      setPrinting(false);
    }
  };

  const saveMenu = async () => {
    if (user.role !== 'Admin') return;
    if (!menuForm.name.trim() || Number(menuForm.price) <= 0) return;

    if (editing) {
      const { error } = await supabase.from('menu_items').update({ name: menuForm.name, category: menuForm.category, price: Number(menuForm.price) }).eq('id', editing);
      if (!error) {
        setItems(items.map(x => x.id === editing ? { ...x, ...menuForm, price: Number(menuForm.price) } : x));
      }
    } else {
      const newItem = { name: menuForm.name, category: menuForm.category, price: Number(menuForm.price), active: true };
      const { data, error } = await supabase.from('menu_items').insert([newItem]).select();
      if (!error && data) {
        setItems([...items, data[0]]);
      }
    }
    setEditing(null);
    setMenuForm({ name: '', category: 'Mie', price: '' });
  };

  const toggleMenuStatus = async (item) => {
    if (user.role !== 'Admin') return;
    const newStatus = !item.active;
    const { error } = await supabase.from('menu_items').update({ active: newStatus }).eq('id', item.id);
    if (!error) {
      setItems(items.map(m => m.id === item.id ? { ...m, active: newStatus } : m));
    }
  };

  const handlePageChange = (label) => {
    if (user.role === 'Kasir' && ['Dashboard', 'Laporan', 'Kelola Menu'].includes(label)) {
      setNotice('Akses ditolak. Fitur ini khusus untuk Admin.');
      setTimeout(() => setNotice(''), 3000);
      return;
    }
    setPage(label);
    // batalkan mode tambah item kalau pindah halaman
    if (label !== 'Pesanan' && addingToOrder) { setAddingToOrder(null); setCart([]); setNotes(''); }
    setSidebarOpen(false);
  };

  const handlePrintUrlChange = (e) => {
    const val = e.target.value;
    setPrintUrl(val);
    localStorage.setItem('z_print_url', JSON.stringify(val));
  };

  if (!user) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand-mark">Z</div>
          <p className="eyebrow">POINT OF SALE</p>
          <h1>Zayga POS</h1>
          <p className="muted">Masuk untuk mulai melayani pelanggan.</p>
          <form onSubmit={loginNow}>
            <label>Username</label>
            <input value={login.username} onChange={e => setLogin({ ...login, username: e.target.value })} placeholder="Masukkan username" />
            <label>Password</label>
            <input type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} placeholder="Masukkan password" />
            <button className="primary full">Masuk ke aplikasi</button>
          </form>
          {notice && <p className="error" style={{marginTop:'1rem', color:'#dc2626', fontSize:'0.85rem'}}>{notice}</p>}
          <p className="tiny">Mode Supabase Cloud · Terhubung secara real-time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)}></div>}
      {cartOpen && <div className="backdrop" onClick={() => setCartOpen(false)}></div>}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}><X /></button>
        <div className="logo"><span>Z</span><div><b>ZAYGA</b><small>POINT OF SALE</small></div></div>
        <div className="nav-label">MENU UTAMA</div>
        {visibleNavItems.map(([Icon, label]) => (
          <button key={label} className={'nav-item ' + (page === label ? 'active' : '')} onClick={() => handlePageChange(label)}><Icon size={18} />{label}</button>
        ))}
        <div className="side-bottom">
          <div className="user-chip">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <div className="user-info"><b>{user.username}</b><small>{user.role}</small></div>
            <button className="icon-btn" title="Keluar" onClick={() => { localStorage.removeItem('z_user'); setAddingToOrder(null); setCart([]); setNotes(''); setUser(null) }}><LogOut size={16} /></button>
          </div>
          <p className="tiny">Zayga POS · Supabase Cloud</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><MenuIcon size={24}/></button>
            <div><p className="eyebrow">OPERASIONAL KASIR</p><h2>{page}</h2></div>
          </div>
          <div className="top-right">
            <span className="live-dot"></span>
            <span className="hide-mobile">Supabase Online</span>
            <span className="date-pill">
              <Clock size={14} />
              <span className="hide-mobile">{new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </span>
          </div>
        </header>

        {page === 'Pesanan' && (
          <div className="pos-layout">
            <section className="catalog">
              <div className="section-head">
                <div>
                  <h3>{addingToOrder ? `Tambah Menu · Meja ${addingToOrder.location}` : 'Pilih Menu'}</h3>
                  <p className="muted">{addingToOrder ? 'Pilih menu tambahan, lalu simpan.' : 'Klik item untuk menambah ke pesanan.'}</p>
                </div>
                <span className="count-pill">{filtered.length} menu</span>
              </div>
              <div className="searchbox">
                <Search size={17} />
                <input placeholder="Cari nama menu..." value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="category-row">
                {categories.map(c => (
                  <button key={c} onClick={() => setCategory(c)} className={category === c ? 'selected' : ''}>{c}</button>
                ))}
              </div>
              <div className="menu-grid">
                {filtered.map(x => (
                  <button className="menu-card" key={x.id} onClick={() => add(x)}>
                    <div className="food-icon"><Coffee size={24} /></div>
                    <div className="menu-card-content">
                      <span className="food-cat">{x.category}</span>
                      <b>{x.name}</b>
                      <strong>{money(x.price)}</strong>
                    </div>
                    <span className="add-icon"><Plus size={16} /></span>
                  </button>
                ))}
              </div>
            </section>

            {(cart.length > 0 || addingToOrder) && (
              <div className="mobile-cart-fab" onClick={() => setCartOpen(true)}>
                <div className="fab-info"><ShoppingCart size={20} /><span>{cart.reduce((s, x) => s + x.qty, 0)} item</span></div>
                <b>{money(total)}</b>
              </div>
            )}

            <aside className={`order-panel ${cartOpen ? 'open' : ''}`}>
              <div className="order-title">
                <div>
                  <h3>{addingToOrder ? `Tambahan Meja ${addingToOrder.location}` : 'Pesanan Baru'}</h3>
                  <p className="muted">{addingToOrder ? `${addingToOrder.customer || 'Umum'} · Menu ini akan ditambahkan ke pesanan meja tersebut` : 'Detail pelanggan & keranjang'}</p>
                </div>
                <button className="cart-close-btn hide-desktop" onClick={() => setCartOpen(false)}><X size={20}/></button>
              </div>

              {!addingToOrder && (
                <div className="customer-fields">
                  <div className="input-group">
                    <label><UserRound size={14} /> Nama pelanggan <em>Opsional</em></label>
                    <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Masukkan nama..." />
                  </div>
                  <div className="input-group">
                    <label><MapPin size={14} /> Lokasi meja <i>wajib</i></label>
                    <div className="table-picker">
                      <div className="table-picker-head"><span>Pilih dari 01–40</span></div>
                      <div className="table-grid">
                        {Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0')).map(n => (
                          <button type="button" key={n} className={'table-number ' + (location === n ? 'chosen' : '')} onClick={() => setLocation(n)}>{n}</button>
                        ))}
                      </div>
                      <input value={location.length === 2 && /^\d{2}$/.test(location) && Number(location) >= 1 && Number(location) <= 40 ? '' : location} onChange={e => setLocation(e.target.value)} placeholder="Atau ketik manual (misal: Bawa pulang)" />
                      {location && (
                        <div className="location-selected">
                          Terpilih: <b>{location}</b>
                          <button type="button" onClick={() => setLocation('')}>Hapus</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Catatan khusus</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: tidak pedas, es sedikit..." rows="2" />
                  </div>
                </div>
              )}

              {addingToOrder && (
                <div className="customer-fields">
                  <div className="input-group">
                    <label>Catatan tambahan</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: tidak pedas, es sedikit..." rows="2" />
                  </div>
                </div>
              )}

              <div className="cart-head">
                <b>{addingToOrder ? 'Item Tambahan' : 'Item Keranjang'}</b>
                <span className="cart-count">{cart.length} jenis</span>
              </div>

              <div className="cart-list">
                {!cart.length ? (
                  <div className="empty-cart">
                    <ShoppingCart size={32} />
                    <b>Keranjang Kosong</b>
                    <span>Pilih menu di sebelah kiri.</span>
                  </div>
                ) : (
                  cart.map(x => (
                    <div className="cart-item" key={x.id}>
                      <div className="cart-item-info">
                        <b>{x.name}</b>
                        <small>{money(x.price)} / porsi</small>
                        <strong>{money(x.price * x.qty)}</strong>
                      </div>
                      <div className="cart-item-actions">
                        <div className="qty-control">
                          <button onClick={() => changeQty(x.id, -1)}><Minus size={14} /></button>
                          <b>{x.qty}</b>
                          <button onClick={() => changeQty(x.id, 1)}><Plus size={14} /></button>
                        </div>
                        <button className="remove-btn" onClick={() => changeQty(x.id, -x.qty)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="order-bottom">
                <div className="total-line">
                  <span>{addingToOrder ? 'Total Tambahan' : 'Total Pembayaran'}</span>
                  <strong>{money(total)}</strong>
                </div>
                {addingToOrder ? (
                  <>
                    <button className="primary full" disabled={!cart.length} onClick={startSaveAddition}>Simpan Tambahan</button>
                    <button className="secondary full" style={{ marginTop: 8 }} onClick={cancelAddToOrder}>Batal</button>
                  </>
                ) : (
                  <button className="primary full" disabled={!cart.length} onClick={() => setShowPay(true)}>Lanjut Pembayaran</button>
                )}
              </div>
            </aside>
          </div>
        )}

        {page === 'Dashboard' && user.role === 'Admin' && (
          <div className="content">
            <div className="stats-grid">
              <Stat icon={<Wallet />} label="Penjualan hari ini" value={money(todays.reduce((s, o) => s + o.total, 0))} />
              <Stat icon={<ClipboardList />} label="Transaksi hari ini" value={todays.length} />
              <Stat icon={<Utensils />} label="Menu tersedia" value={items.filter(x => x.active).length} />
              <Stat icon={<ShoppingCart />} label="Rata-rata transaksi" value={money(todays.length ? Math.round(todays.reduce((s, o) => s + o.total, 0) / todays.length) : 0)} />
            </div>
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Transaksi terbaru</h3>
                  <p className="muted">Aktivitas pesanan terakhir.</p>
                </div>
                <button className="text-btn" onClick={() => setPage('Riwayat')}>Lihat semua</button>
              </div>
              <OrdersTable orders={orders.slice(0, 6)} printOrder={printOrder} onSelectOrder={setSelectedOrder} />
            </div>
          </div>
        )}

        {page === 'Riwayat' && (
          <div className="content">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Riwayat transaksi</h3>
                  <p className="muted">Klik salah satu transaksi untuk melihat detail pesanan.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="count-pill">{orders.length} transaksi</span>
                  {orders.length > 0 && user.role === 'Admin' && (
                    <button
                      onClick={clearAllOrders}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={14}/> Bersihkan Riwayat
                    </button>
                  )}
                </div>
              </div>
              <OrdersTable orders={orders} printOrder={printOrder} onSelectOrder={setSelectedOrder} />
            </div>
          </div>
        )}

        {page === 'Laporan' && user.role === 'Admin' && (
          <div className="content">
            <div className="stats-grid">
              <Stat icon={<Wallet />} label="Total penjualan" value={money(orders.reduce((s, o) => s + o.total, 0))} />
              <Stat icon={<ClipboardList />} label="Total transaksi" value={orders.length} />
              <Stat icon={<BarChart3 />} label="Penjualan hari ini" value={money(todays.reduce((s, o) => s + o.total, 0))} />
              <Stat icon={<Clock />} label="Transaksi hari ini" value={todays.length} />
            </div>
            <div className="panel">
              <h3>Ringkasan penjualan</h3>
              <p className="muted">Rekap berdasarkan metode pembayaran.</p>
              <div className="report-wrap">
                <div className="report-row"><span>Sisa belum dibayar (semua bon)</span><b>{money(orders.reduce((s, o) => s + remainOf(o), 0))}</b></div>
                {['Tunai', 'QRIS', 'Transfer', 'Belum Bayar'].map(m => (
                  <div key={m} className="report-row">
                    <span>{m}</span>
                    <b>{money(orders.filter(o => o.payment === m).reduce((s, o) => s + o.total, 0))}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === 'Kelola Menu' && user.role === 'Admin' && (
          <div className="content">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Kelola menu</h3>
                  <p className="muted">Tambah, ubah harga, atau status menu.</p>
                </div>
              </div>

              <div className="menu-editor">
                <input placeholder="Nama menu" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} />
                <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}>
                  {categories.slice(1).map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="number" placeholder="Harga" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} />
                <button className="primary" onClick={saveMenu}>{editing ? 'Simpan' : 'Tambah'}</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama menu</th>
                      <th>Kategori</th>
                      <th>Harga</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(x => (
                      <tr key={x.id}>
                        <td><b>{x.name}</b></td>
                        <td><span className="cat-badge">{x.category}</span></td>
                        <td>{money(x.price)}</td>
                        <td><span className={x.active ? 'status-done' : 'status-off'}>{x.active ? 'Aktif' : 'Nonaktif'}</span></td>
                        <td>
                          <div className="action-cell">
                            <button className="text-btn" onClick={() => { setEditing(x.id); setMenuForm({ name: x.name, category: x.category, price: x.price }) }}>Edit</button>
                            <button className="text-btn" onClick={() => toggleMenuStatus(x)}>{x.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {page === 'Pengaturan' && (
          <div className="content">
            <div className="panel settings-panel">

              <h3>Pengaturan Printer</h3>
              <p className="muted">Hubungkan aplikasi POS ini dengan server Cleanter.</p>

              <div className="input-group" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                <label>Alamat IP Server Cleanter</label>
                <input
                  value={printUrl}
                  onChange={handlePrintUrlChange}
                  placeholder="http://localhost:9100"
                />
                <small className="muted">
                  • <b>Jika buka di HP:</b> Biarkan `http://localhost:9100`<br/>
                  • <b>Jika buka di Laptop:</b> Masukkan IP HP Anda. Contoh: `http://192.168.1.6:9100`
                </small>
              </div>

              <div className="printer-card">
                <div className="printer-card-head">
                  <div>
                    <b>Status Koneksi Bluetooth</b>
                    <small>Via Cleanter App</small>
                  </div>
                  <span className={'printer-state ' + (printerStatus === 'Terhubung' ? 'online' : 'offline')}>{printerStatus}</span>
                </div>
                <p className="muted">{printerName || 'Pastikan Cleanter aktif dan Server sudah dinyalakan.'}</p>
                <div className="printer-actions">
                  <button className="secondary" onClick={refreshPrinter}>Cek Koneksi</button>
                  <button className="primary" disabled={printing} onClick={testPrinter}><Printer size={16} /> {printing ? 'Memproses...' : 'Cetak Tes'}</button>
                </div>
              </div>

              {user.role === 'Admin' && (
                <div style={{ marginTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <Users size={18} color="#2563eb"/>
                    <h3 style={{ margin: 0 }}>Kelola Akun Karyawan</h3>
                  </div>
                  <p className="muted" style={{ marginBottom: '1rem' }}>Buat atau hapus akun kasir baru untuk karyawan.</p>

                  <form onSubmit={handleCreateUser} className="menu-editor" style={{ marginBottom: '1rem' }}>
                    <input
                      placeholder="Username baru"
                      value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="Kasir">Kasir</option>
                      <option value="Admin">Admin</option>
                    </select>
                    <button className="primary" type="submit"><UserPlus size={16}/> Tambah Akun</button>
                  </form>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Peran (Role)</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map(u => (
                          <tr key={u.username}>
                            <td><b>{u.username}</b></td>
                            <td><span className="cat-badge">{u.role}</span></td>
                            <td>
                              {u.username.toLowerCase() !== 'admin' ? (
                                <button className="text-btn" style={{ color: '#dc2626' }} onClick={() => handleDeleteUser(u.username)}>Hapus</button>
                              ) : (
                                <span className="muted" style={{ fontSize: '0.8rem' }}>Utama</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {user.role === 'Admin' && (
                <div style={{ marginTop: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <ShieldAlert size={18} color="#dc2626"/>
                    <h3 style={{ margin: 0 }}>Log Riwayat Yang Dihapus</h3>
                  </div>
                  <p className="muted" style={{ marginBottom: '1rem' }}>Catatan aktivitas akun yang melakukan pembersihan/penghapusan riwayat transaksi.</p>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Waktu Hapus</th>
                          <th>Pelaku (User)</th>
                          <th>Peran</th>
                          <th>Jumlah Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clearLogs.map(log => (
                          <tr key={log.id}>
                            <td><span className="mono">{log.time}</span></td>
                            <td><b>{log.who}</b></td>
                            <td><span className="cat-badge">{log.role}</span></td>
                            <td><b style={{ color: '#dc2626' }}>{log.count} transaksi</b></td>
                          </tr>
                        ))}
                        {!clearLogs.length && (
                          <tr>
                            <td colSpan="4" className="empty-table" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                              Belum ada catatan penghapusan riwayat.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <h3 style={{marginTop: '2.5rem'}}>Akun & Sistem</h3>
              <div className="account-info">
                <div className="avatar large">{user.username[0].toUpperCase()}</div>
                <div>
                  <b>{user.username}</b>
                  <p className="muted">Login sebagai {user.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DETAIL PESANAN */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <button className="modal-close" onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>

            <p className="eyebrow" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', letterSpacing: '0.05em', marginBottom: '4px' }}>DETAIL PESANAN</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{selectedOrder.id}</h2>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: selectedOrder.kitchen_printed ? '#dcfce7' : '#fef9c3', color: selectedOrder.kitchen_printed ? '#166534' : '#854d0e' }}>
                  {selectedOrder.kitchen_printed ? '✓ Dapur' : '⚡ Dapur (Belum)'}
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: selectedOrder.customer_printed ? '#dcfce7' : '#fef9c3', color: selectedOrder.customer_printed ? '#166534' : '#854d0e' }}>
                  {selectedOrder.customer_printed ? '✓ Kasir' : '⚡ Kasir (Belum)'}
                </span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 16px 0' }}>{selectedOrder.date} · {selectedOrder.time} · Kasir: <b>{selectedOrder.cashier}</b></p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Pelanggan:</span>
                <b>{selectedOrder.customer || 'Umum'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Lokasi Meja:</span>
                <span className="cat-badge" style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem' }}>{selectedOrder.location}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Metode Bayar:</span>
                <b>{selectedOrder.payment}</b>
              </div>
            </div>

            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Daftar Item</span>
              <button
                className="text-btn"
                style={{ fontSize: '0.8rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px' }}
                onClick={() => startAddToOrder(selectedOrder)}
              >
                <Plus size={14} /> Tambah Item ke Bon Ini
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', marginBottom: '16px', background: '#fff' }}>
              {selectedOrder.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div>
                    <b style={{ fontSize: '0.9rem', display: 'block', color: '#1e293b' }}>{it.name}</b>
                    <small style={{ color: '#64748b' }}>{it.qty} x {money(it.price)}</small>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{money(it.qty * it.price)}</strong>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>Total Tagihan</span>
              <strong style={{ fontSize: '1.25rem', color: '#2563eb' }}>{money(selectedOrder.total)}</strong>
            </div>

            {remainOf(selectedOrder) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                <div>
                  <small style={{ color: '#991b1b', display: 'block' }}>Sisa belum dibayar</small>
                  <b style={{ color: '#991b1b', fontSize: '1.05rem' }}>{money(remainOf(selectedOrder))}</b>
                </div>
                <button className="primary" style={{ padding: '8px 14px', borderRadius: '8px', fontWeight: 600 }} onClick={() => openSettle(selectedOrder)}>Bayar Sisa</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="primary"
                style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: (selectedOrder.kitchen_printed && selectedOrder.customer_printed) ? '#64748b' : '#16a34a' }}
                onClick={() => printAll(selectedOrder)}
              >
                <Printer size={18} /> {(selectedOrder.kitchen_printed && selectedOrder.customer_printed) ? 'Cetak Ulang Keduanya' : 'Cetak Sisa yang Belum (Dapur & Kasir)'}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="secondary" style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }} onClick={() => printOrder(selectedOrder, 'kitchen')}>
                  {selectedOrder.kitchen_printed ? 'Cetak Ulang Dapur' : 'Cetak Dapur Saja'}
                </button>
                <button className="secondary" style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }} onClick={() => printOrder(selectedOrder, 'customer')}>
                  {selectedOrder.customer_printed ? 'Cetak Ulang Kasir' : 'Cetak Kasir Saja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItemForVariant && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '360px', textAlign: 'center' }}>
            <p className="eyebrow">PILIH VARIAN</p>
            <h2>{selectedItemForVariant.name}</h2>
            <p className="muted">Apakah minuman ini menggunakan susu tambahan?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '1.5rem 0' }}>
              <button
                className="secondary"
                onClick={() => addToCartDirect(selectedItemForVariant, false)}
                style={{ padding: '0.75rem', fontWeight: 600 }}
              >
                Normal ({money(selectedItemForVariant.price)})
              </button>
              <button
                className="primary"
                onClick={() => addToCartDirect(selectedItemForVariant, true)}
                style={{ padding: '0.75rem', fontWeight: 600 }}
              >
                Pakai Susu (+{money(3000)}) → {money(selectedItemForVariant.price + 3000)}
              </button>
            </div>
            <button className="text-btn" onClick={() => setSelectedItemForVariant(null)}>Batal</button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="modal-close" onClick={closePay}><X /></button>
            <p className="eyebrow">CHECKOUT</p>
            <h2>{settling ? 'Pelunasan' : addingToOrder ? 'Pembayaran Tambahan' : 'Pembayaran'}</h2>
            <div className="pay-total">
              <span>{settling ? 'Sisa tagihan' : addingToOrder ? 'Total tambahan' : 'Total tagihan'}</span>
              <b>{money(payDue)}</b>
            </div>
            <label className="modal-label">Pilih Metode</label>
            <div className="payment-options">
              {['Tunai', 'QRIS', 'Transfer', 'Belum Bayar'].map(m => (
                (settling && m === 'Belum Bayar') ? null : <button key={m} className={payment === m ? 'chosen' : ''} onClick={() => setPayment(m)}>{m}</button>
              ))}
            </div>
            {payment === 'Tunai' && (
              <>
                <label className="modal-label">Uang diterima</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="pay-input"
                    autoFocus
                    style={{ flex: 1, minWidth: 0 }}
                    value={paidRaw}
                    onChange={e => {
                      const d = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPaidRaw(d);
                      setPaid(d ? String(Number(d) * 1000) : '');
                    }}
                    placeholder="Ketik 10 = Rp10.000"
                  />
                  <button
                    type="button"
                    className={Number(paid) === payDue ? 'primary' : 'secondary'}
                    style={{ padding: '0 14px', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}
                    onClick={() => { setPaid(String(payDue)); setPaidRaw(''); }}
                  >
                    Uang Pas
                  </button>
                </div>
                {Number(paid) > 0 && (
                  <small className="muted" style={{ display: 'block', marginTop: '6px' }}>Diterima: <b>{money(paid)}</b></small>
                )}
                <div className="change-line">
                  <span>Kembalian</span>
                  <b>{money(Math.max(0, Number(paid || 0) - payDue))}</b>
                </div>
              </>
            )}
            {payment === 'Belum Bayar' && (
              <div className="notice-box" style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '8px', fontSize: '0.85rem', color: '#92400e' }}>
                <b>Catatan:</b> Pesanan akan dicatat dengan status <b>Belum Lunas</b> (Bon).
              </div>
            )}
            <button className="primary full large" onClick={settling ? confirmSettle : addingToOrder ? confirmAdditionPayment : finish}>{settling ? 'Lunasi Tagihan' : addingToOrder ? 'Simpan Tambahan' : 'Selesaikan Transaksi'}</button>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
    </div>
  );
}

function OrdersTable({ orders, printOrder, onSelectOrder }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status Cetak</th>
            <th>Pelanggan</th>
            <th>Lokasi</th>
            <th>Waktu</th>
            <th>Total</th>
            <th>Metode</th>
            <th>Aksi / Cetak</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const isFullyPrinted = o.kitchen_printed && o.customer_printed;
            return (
              <tr key={o.id} style={{ cursor: 'pointer', background: isFullyPrinted ? 'transparent' : '#fefce8' }} onClick={() => onSelectOrder(o)}>
                <td><b className="mono">{o.id}</b></td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.kitchen_printed ? '#dcfce7' : '#fef08a', color: o.kitchen_printed ? '#166534' : '#854d0e' }}>
                      {o.kitchen_printed ? 'Dap✓' : 'Dap!'}
                    </span>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.customer_printed ? '#dcfce7' : '#fef08a', color: o.customer_printed ? '#166534' : '#854d0e' }}>
                      {o.customer_printed ? 'Kas✓' : 'Kas!'}
                    </span>
                  </div>
                </td>
                <td>{o.customer || '-'}</td>
                <td><span className="cat-badge">{o.location}</span></td>
                <td>
                  <div className="time-cell">
                    <span>{o.date}</span>
                    <small>{o.time}</small>
                  </div>
                </td>
                <td><b>{money(o.total)}</b></td>
                <td>
                  <span className={remainOf(o) > 0 ? 'cat-badge' : ''} style={remainOf(o) > 0 ? {background: '#fee2e2', color: '#991b1b'} : {}}>
                    {remainOf(o) > 0 ? (o.payment === 'Belum Bayar' ? 'Belum Bayar' : `${o.payment} · Sisa ${money(remainOf(o))}`) : o.payment}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="print-actions">
                    <button className="print-btn" onClick={() => onSelectOrder(o)} title="Lihat Detail"><Eye size={14} /> Detail</button>
                    <button className="print-btn" onClick={() => printOrder(o, 'kitchen')}><Printer size={14} /> Dapur</button>
                    <button className="print-btn" onClick={() => printOrder(o, 'customer')}><Printer size={14} /> Kasir</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!orders.label && orders.length === 0 && <tr><td colSpan="8" className="empty-table" style={{textAlign: 'center', padding: '2rem'}}>Belum ada transaksi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
