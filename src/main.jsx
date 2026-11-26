import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronRight, LayoutDashboard, ShoppingCart, Utensils, ClipboardList, BarChart3, Settings, Search, Plus, Minus, Trash2, Printer, LogOut, Coffee, Menu as MenuIcon, X, CheckCircle2, MapPin, UserRound, Clock, Wallet, ShieldAlert, UserPlus, Users, Eye, EyeOff, Flame, Snowflake, Check, ArrowRightLeft, Server, Smartphone, RefreshCw, Save, Pencil, LayoutGrid, ChefHat, Lock, WifiOff, Percent, Scissors, RotateCcw, Bell, TrendingUp, TrendingDown, Crown, Package, AlertTriangle, Volume2, Maximize2, Minimize2, CheckCheck, Radio, List, Rows3, Umbrella, Bluetooth, ArrowLeft, Music } from 'lucide-react';
import { supabase } from './supabase';
import './app.css';
// import './dash.css';

/* ===================== Helper & konstanta ===================== */
const money = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const moneyShort = n => {
  n = Number(n || 0);
  if (n >= 1e9) return 'Rp' + (n / 1e9).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1e6) return 'Rp' + (n / 1e6).toFixed(1).replace('.', ',') + 'jt';
  if (n >= 1e3) return 'Rp' + Math.round(n / 1e3) + 'rb';
  return 'Rp' + n;
};
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };

// Penyimpanan file alarm per perangkat menggunakan IndexedDB (tidak membebani localStorage).
const ALARM_DB_NAME = 'zayga-pos-media';
const ALARM_DB_STORE = 'sounds';
const openAlarmDB = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('Browser tidak mendukung penyimpanan file audio.'));
  const request = indexedDB.open(ALARM_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(ALARM_DB_STORE)) db.createObjectStore(ALARM_DB_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan audio.'));
});
const alarmStorageKey = (deviceId) => `kitchen-alarm:${deviceId || getDeviceId()}`;
const saveAlarmFile = async (file, deviceId) => {
  const db = await openAlarmDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALARM_DB_STORE, 'readwrite');
    tx.objectStore(ALARM_DB_STORE).put({ blob: file, name: file.name, type: file.type || 'audio/mpeg', deviceId }, alarmStorageKey(deviceId));
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan file audio.'));
  });
  db.close();
};
const loadAlarmFile = async (deviceId) => {
  const db = await openAlarmDB();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(ALARM_DB_STORE, 'readonly');
    const request = tx.objectStore(ALARM_DB_STORE).get(alarmStorageKey(deviceId));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Gagal membaca file audio.'));
  });
  db.close(); return value;
};
const deleteAlarmFile = async (deviceId) => {
  const db = await openAlarmDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ALARM_DB_STORE, 'readwrite');
    tx.objectStore(ALARM_DB_STORE).delete(alarmStorageKey(deviceId));
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Gagal menghapus file audio.'));
  });
  db.close();
};

const BAKSO_ID = 'bakso-custom';

// Tambahan dihitung sebagai bagian dari harga item, bukan menu terpisah.
// Harga Telur mengikuti rancangan: +Rp3.000. Level pedas tidak dikenakan biaya.
const MENU_ADDONS = [
  { id: 'telur', label: 'Telur', price: 3000, categories: ['Mie', 'Popmie', 'Nasi'] }
];
const SPICE_LEVELS = ['Tidak pedas', 'Normal', 'Pedas', 'Extra pedas'];

// Harga suhu untuk menu yang sekarang hanya memiliki satu nama di daftar menu.
// Harga Hangat mengikuti harga Panas; harga Dingin mengikuti data menu lama.
const MENU_TEMPERATURES = [
  { category: 'Minuman', name: 'Teh', prices: { panas: 5000, hangat: 5000, dingin: 5000 }, aliases: ['Teh Panas', 'Teh Dingin'] },
  { category: 'Kopi', name: 'Espresso', prices: { panas: 10000, hangat: 10000, dingin: 13000 }, aliases: ['Espresso Panas', 'Espresso Dingin'] },
  { category: 'Kopi', name: 'Sanger', prices: { panas: 12000, hangat: 12000, dingin: 15000 }, aliases: ['Sanger Panas', 'Sanger Dingin'] }
];
const LEGACY_TOPPING_NAME = /\s\+\s*telur$/i;
// Menu lama yang sebenarnya merupakan varian susu dari menu dasar.
// Jika menu dasarnya tersedia, varian lama disembunyikan agar kasir memilih
// menu dasar lalu mengaktifkan opsi Pakai susu (harga khusus Teh Hijau +Rp2.000).
const LEGACY_MILK_VARIANTS = [
  { category: 'Minuman', name: 'Teh Hijau Susu', baseName: 'Teh Hijau' }
];
const isLegacyMilkVariant = (item, allItems = []) => {
  const config = LEGACY_MILK_VARIANTS.find(x =>
    x.category === item?.category && normalizeMenuText(x.name) === normalizeMenuText(item?.name)
  );
  if (!config) return false;
  return (allItems || []).some(x =>
    x.category === config.category && normalizeMenuText(x.name) === normalizeMenuText(config.baseName)
  );
};
const normalizeMenuText = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');


const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'Admin' },
  { username: 'bima', password: 'bima123', role: 'Kasir' },
  { username: 'agam', password: 'agam123', role: 'Kasir' },
  { username: 'ariel', password: 'ariel123', role: 'Kasir' }
];

const DEFAULT_MENU_ITEMS = [
  { id: 1, name: 'Mie Soto Medan', category: 'Mie', price: 10000, active: true },
  { id: 3, name: 'Mie Sedaap Goreng', category: 'Mie', price: 10000, active: true },
  { id: 5, name: 'Kentang Goreng', category: 'Snack', price: 15000, active: true },
  { id: 6, name: 'Risol', category: 'Snack', price: 10000, active: true },
  { id: 7, name: 'Tempe Goreng', category: 'Snack', price: 10000, active: true },
  { id: 8, name: 'Tahu Goreng', category: 'Snack', price: 10000, active: true },
  { id: 9, name: 'Nugget', category: 'Snack', price: 10000, active: true },
  { id: 10, name: 'Sosis Goreng', category: 'Snack', price: 10000, active: true },
  { id: 11, name: 'Popmie Rasa Ayam', category: 'Popmie', price: 8000, active: true },
  { id: 12, name: 'Popmie Rasa Kari', category: 'Popmie', price: 8000, active: true },
  { id: 13, name: 'Popmie Rasa Soto', category: 'Popmie', price: 8000, active: true },
  { id: 14, name: 'Nasi Ayam Geprek', category: 'Nasi', price: 15000, active: true },
  { id: 15, name: 'Nasi Putih', category: 'Nasi', price: 10000, active: true },
  { id: 16, name: 'Nasi Goreng Telur', category: 'Nasi', price: 13000, active: true },
  { id: 17, name: 'Nasi Goreng Ayam', category: 'Nasi', price: 15000, active: true },
  { id: 18, name: 'Ayam Geprek', category: 'Nasi', price: 10000, active: true },
  { id: 19, name: 'Es Kosong', category: 'Minuman', price: 2000, active: true },
  { id: 20, name: 'Blue Squash', category: 'Minuman', price: 12000, active: true },
  { id: 21, name: 'Orange Squash', category: 'Minuman', price: 12000, active: true },
  { id: 22, name: 'Teh Hijau', category: 'Minuman', price: 8000, active: true },
  { id: 24, name: 'Teh', category: 'Minuman', price: 5000, active: true },
  { id: 26, name: 'Teh Tarek', category: 'Minuman', price: 5000, active: true },
  { id: 27, name: 'Lemon Tea', category: 'Minuman', price: 5000, active: true },
  { id: 28, name: 'Milo', category: 'Minuman', price: 5000, active: true },
  { id: 29, name: 'Sirup Kurnia', category: 'Minuman', price: 5000, active: true },
  { id: 30, name: 'Sirup Orange', category: 'Minuman', price: 5000, active: true },
  { id: 31, name: 'Sirup Melon', category: 'Minuman', price: 5000, active: true },
  { id: 32, name: 'Nutrisari', category: 'Minuman', price: 5000, active: true },
  { id: 33, name: 'Jeruk Peras', category: 'Minuman', price: 5000, active: true },
  { id: 34, name: 'Jeruk Kasturi', category: 'Minuman', price: 5000, active: true },
  { id: 35, name: 'Espresso', category: 'Kopi', price: 10000, active: true },
  { id: 37, name: 'Sanger', category: 'Kopi', price: 12000, active: true },
  { id: 39, name: 'Cappucino', category: 'Kopi', price: 5000, active: true },
  { id: 40, name: 'Nescafe', category: 'Kopi', price: 5000, active: true },
  { id: 41, name: 'Nescafe Susu', category: 'Kopi', price: 8000, active: true },
  { id: 42, name: 'Kopi Ulee Kareng', category: 'Kopi', price: 5000, active: true },
  { id: 43, name: 'Luwak White Coffee', category: 'Kopi', price: 5000, active: true },
  { id: 44, name: 'Air Mineral Botol', category: 'Soft Drink', price: 5000, active: true },
  { id: 45, name: 'Air Mineral Gelas', category: 'Soft Drink', price: 1000, active: true },
  { id: 46, name: 'Teh Botol', category: 'Soft Drink', price: 5000, active: true },
  { id: 47, name: 'Teh Pucuk Harum', category: 'Soft Drink', price: 5000, active: true },
  { id: 48, name: 'Fanta', category: 'Soft Drink', price: 5000, active: true },
  { id: 49, name: 'Sprite', category: 'Soft Drink', price: 5000, active: true },
  { id: 50, name: 'Nipis Madu', category: 'Soft Drink', price: 5000, active: true }
];

// Pilihan awal dipisahkan berdasarkan karakter menu.
// Riwayat rekomendasi selanjutnya disimpan per menu, bukan global.
const NOTE_PRESETS_BY_TYPE = {
  mie: ['Tidak pedas', 'Pedas', 'Extra pedas', 'Kuah dipisah', 'Tidak pakai sayur', 'Tidak pakai bawang', 'Mie lembek', 'Mie kering'],
  nasi: ['Tidak pedas', 'Pedas', 'Extra pedas', 'Tidak pakai acar', 'Tidak pakai sayur', 'Telur dadar', 'Telur mata sapi'],
  bakso: ['Tidak pedas', 'Pedas', 'Extra pedas', 'Kuah dipisah', 'Kuah sedikit', 'Tanpa seledri', 'Tanpa bawang goreng', 'Mie dipisah'],
  snack: ['Saus dipisah', 'Sambal dipisah', 'Tidak pedas', 'Extra pedas', 'Jangan terlalu matang', 'Dibungkus'],
  coffee: ['Panas', 'Hangat', 'Dingin', 'Kurang manis', 'Normal manis', 'Extra manis', 'Tanpa gula', 'Es sedikit', 'Tanpa es', 'Susu terpisah'],
  drink: ['Panas', 'Hangat', 'Dingin', 'Kurang manis', 'Normal manis', 'Extra manis', 'Tanpa gula', 'Es sedikit', 'Tanpa es', 'Es terpisah'],
  generalFood: ['Tidak pedas', 'Pedas', 'Tanpa sayur', 'Tanpa bawang', 'Saus dipisah', 'Sambal dipisah', 'Dibungkus']
};

const getNoteMenuKey = item => {
  const menuId = item?.menuId ?? item?.id;
  if (menuId != null && String(menuId) !== BAKSO_ID) return `menu:${String(menuId).split('~')[0].replace(/-(panas|hangat|dingin)(-susu)?$/i, '')}`;
  return `custom:${String(item?.category || '').toLowerCase()}:${String(item?.name || '').toLowerCase().trim()}`;
};

const getNotePresetType = item => {
  const category = String(item?.category || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  if (/kopi|coffee|espresso|americano|cappuccino|latte/.test(`${category} ${name}`)) return 'coffee';
  if (/minuman|drink|beverage|jus|juice|teh|tea|susu|soda|lemon|cokelat|chocolate|matcha|thai tea|sirup/.test(`${category} ${name}`)) return 'drink';
  if (/bakso|soto|sop|sup|kuah/.test(`${category} ${name}`)) return 'bakso';
  if (/mie|mi |noodle/.test(`${category} ${name}`)) return 'mie';
  if (/nasi|rice|goreng/.test(`${category} ${name}`)) return 'nasi';
  if (/snack|cemilan|gorengan|roti|kentang|pisang|tahu|tempe/.test(`${category} ${name}`)) return 'snack';
  if (/makanan|food|main course/.test(category)) return 'generalFood';
  return 'generalFood';
};

const getNotePresets = item => NOTE_PRESETS_BY_TYPE[getNotePresetType(item)] || NOTE_PRESETS_BY_TYPE.generalFood;
const STATUSES = ['Baru', 'Dimasak', 'Siap', 'Diantar'];
const ITEM_STATUSES = ['Baru', 'Dimasak', 'Siap'];
const STATUS_STYLE = { Baru: ['#fef9c3', '#854d0e'], Dimasak: ['#dbeafe', '#1d4ed8'], Siap: ['#dcfce7', '#166534'], Diantar: ['#f1f5f9', '#64748b'] };
const statusOf = o => o?.order_status || 'Diantar';
const NEXT_LABEL = { Baru: 'Mulai masak', Dimasak: 'Tandai siap', Siap: 'Sudah diantar' };
const itemSt = i => i?.item_status || 'Baru';
const deriveStatus = its => {
  if (!Array.isArray(its) || !its.length) return 'Baru';
  if (its.every(i => itemSt(i) === 'Diantar')) return 'Diantar';
  if (its.every(i => ['Siap', 'Diantar'].includes(itemSt(i)))) return 'Siap';
  if (its.some(i => ['Dimasak', 'Siap', 'Diantar'].includes(itemSt(i)))) return 'Dimasak';
  return 'Baru';
};
// [FIX #8] `force` dipakai saat Admin memundurkan pesanan dari "Diantar":
// semua item ikut dikembalikan, supaya status pesanan dan status item tidak saling bertentangan.
const syncItems = (its, st, force = false) => (its || []).map(i => {
  if (st === 'Diantar') return { ...i, item_status: 'Diantar' };
  if (!force && itemSt(i) === 'Diantar') return i;
  return { ...i, item_status: st };
});

const normLoc = v => String(v ?? '').trim().toLowerCase();
const locLabel = v => /^\d+$/.test(String(v).trim()) ? 'Meja ' + String(v).trim() : String(v).trim();
const PAYUNG_NUMS = [1, 2, 37, 38, 39, 40];
const sumItems = a => (a || []).reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0);
const calcTotal = (items, d = 0, r = 0) => Math.max(0, sumItems(items) - (d || 0) + (r || 0));
const baseName = n => String(n || '').replace(/ \((Panas|Hangat|Dingin)\)/, '').replace(/ \+ Susu$/, '');
const nowTime = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const ledger = (m, a, by) => ({ m, a, by, t: new Date().toISOString(), d: new Date().toLocaleDateString('en-CA') });
const isNetErr = e => !navigator.onLine || /fetch|network|failed to|timeout|load failed/i.test(e?.message || '');
const isDupErr = e => /duplicate|23505/i.test(String(e?.message || '') + String(e?.code || ''));
const buzz = (ms = 25) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} };
const getDeviceId = () => {
  let id = read('z_device_id', null);
  if (!id) { id = 'DV' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); write('z_device_id', id); }
  return id;
};
const guessDeviceName = () => {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Perangkat';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
};

// ID order: ZYG- diikuti 6 angka acak, contoh ZYG-482913.
const genOrderId = () => {
  let n;
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    n = a[0] % 1000000;
  } catch {
    n = Math.floor(Math.random() * 1000000);
  }
  return 'ZYG-' + String(n).padStart(6, '0');
};

// Nomor antrian harian: urutan pesanan pada tanggal yang sama berdasarkan waktu dibuat (001, 002, ...).
const computeQueueNo = (o, list) => {
  if (!o) return 0;
  const t = Date.parse(o.created_at || '') || 0;
  let n = 1;
  for (const x of (list || [])) {
    if (x.id === o.id || x.date !== o.date) continue;
    const tx = Date.parse(x.created_at || '') || 0;
    if (tx < t || (tx === t && String(x.id) < String(o.id))) n++;
  }
  return n;
};
const fmtQueue = n => String(n || 0).padStart(3, '0');
// Peta nomor antrian untuk SEMUA pesanan sekaligus (id -> nomor).
// Aturannya sama persis dengan computeQueueNo, jadi nomor di Riwayat = nomor di tiket dapur.
const buildQueueMap = (list) => {
  const byDate = {};
  for (const o of (list || [])) (byDate[o.date] = byDate[o.date] || []).push(o);
  const map = new Map();
  Object.values(byDate).forEach(arr => {
    arr.slice().sort((a, b) => {
      const ta = Date.parse(a.created_at || '') || 0, tb = Date.parse(b.created_at || '') || 0;
      return ta - tb || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
    }).forEach((o, i) => map.set(o.id, i + 1));
  });
  return map;
};

const queueBadgeStyle = { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, background: '#111827', color: '#fff', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// Gabungkan hasil server dengan pesanan yang masih menunggu di antrean offline
const withQueue = (data) => {
  const q = read('z_queue', []);
  return [...q.filter(x => !data.some(d => d.id === x.id)), ...data];
};

// [FIX #6] Hitung ulang bon setelah ada item tambahan.
const computeAddition = (base, addCart) => {
  const merged = [...(base.items || [])];
  for (const c of addCart) {
    const i = merged.findIndex(x => x.id === c.id && itemSt(x) === 'Baru');
    if (i > -1) merged[i] = { ...merged[i], qty: merged[i].qty + c.qty };
    else merged.push({ ...c, item_status: 'Baru' });
  }
  const sub = sumItems(merged);
  let disc = base.discount || 0;
  if (disc > 0) {
    if (base.discount_type === 'pct') disc = Math.min(sub, Math.round(sub * Math.min(Number(base.discount_value) || 0, 100) / 100));
    else disc = Math.min(disc, sub);
  }
  const newTotal = calcTotal(merged, disc, base.rounding);
  return { merged, disc, newTotal, addDue: Math.max(0, newTotal - (base.total || 0)) };
};

let audioCtx;
const beep = (freq = 880, dur = 0.2, times = 2) => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + i * (dur + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    }
  } catch {}
};

const kitchenChime = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Nada ganda bel dapur (D5 -> A5)
    [587.33, 880].forEach((freq, idx) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + idx * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.38);
    });
  } catch (e) {
    beep(880, 0.2, 2);
  }
};

const newDraft = () => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cart: [], customer: '', location: '', notes: '', discount: { type: 'rp', value: '' } });
const getLocalPrintBridge = () => read('z_local_print_url', 'http://localhost:9100');

// Baris awal split bill (dipakai di pembayaran pesanan baru)
const newSplitRows = () => [
  { name: '', method: 'Tunai', amount: '', received: '' },
  { name: '', method: 'QRIS', amount: '', received: '' }
];

/* ===================== Struk & printer ===================== */
const receiptText = (text, align = 'left', bold = false, size = 'normal') => ({ type: 'text', text: String(text ?? ''), align, bold, size });
const receiptDivider = () => ({ type: 'divider' });

const settledOf = o => o?.payment === 'Belum Bayar' ? 0 : Math.max(0, (o?.paid || 0) - (o?.change || 0));
const remainOf = o => Math.max(0, (o?.total || 0) - settledOf(o));

const buildReceipt = (o, type) => {
  const kitchen = type === 'kitchen';
  // Nomor antrian: hanya di tiket dapur, satu baris saja agar tata letak struk tidak berubah.
  const queueLine = kitchen && o?.queueNo ? [receiptText(`ANTRIAN ${fmtQueue(o.queueNo)}`, 'center', true, 'large'), receiptDivider()] : [];
  const content = [receiptText('ZAYGA', 'center', true, 'large'), receiptText(o?.isAddition ? 'MENU TAMBAHAN' : (kitchen ? 'TIKET PESANAN DAPUR' : 'STRUK PEMBAYARAN'), 'center', true), receiptDivider(), ...queueLine, ...(o?.isAddition ? [] : [receiptText(`No: ${o?.id}`, 'left', true)]), receiptText(`Waktu: ${o?.date} ${o?.time}`), receiptText(`Kasir: ${o?.cashier}`), receiptText(`Pelanggan: ${o?.customer || '-'}`), receiptText(`Lokasi: ${o?.location}`), receiptDivider()];
  for (const item of (o?.items || [])) {
    if (kitchen) {
      content.push(receiptText(`${item.qty} x ${item.name}`, 'left', true));
      if (item.optionNote) content.push(receiptText(`    >> ${item.optionNote}`, 'left', true));
      if (item.customNote || (!item.optionNote && item.note)) content.push(receiptText(`    >> ${item.customNote || item.note}`, 'left', true));
    } else { content.push(receiptText(item.name)); content.push({ type: 'row', left: `${item.qty} x ${money(item.price)}`, right: money(item.qty * item.price) }); }
  }
  content.push(receiptDivider());
  if (kitchen) { content.push(receiptText('CATATAN DAPUR', 'left', true)); content.push(receiptText(o?.notes || '- Tidak ada catatan -')); content.push(receiptDivider()); content.push(receiptText('TERIMA KASIH', 'center', true)); }
  else {
    if ((o?.discount || 0) > 0 || (o?.rounding || 0) > 0) {
      content.push({ type: 'row', left: 'Subtotal', right: money(sumItems(o?.items)) });
      if (o?.discount > 0) content.push({ type: 'row', left: 'Diskon', right: '-' + money(o?.discount) });
      if (o?.rounding > 0) content.push({ type: 'row', left: 'Pembulatan', right: money(o?.rounding) });
    }
    content.push({ type: 'row', left: 'TOTAL', right: money(o?.total), bold: true });
    // Split bill: tampilkan rincian per pembayar
    if (o?.payment === 'Split' && Array.isArray(o?.payments) && o.payments.length) {
      content.push(receiptText('Rincian pembayaran:', 'left', true));
      o.payments.forEach(p => content.push({ type: 'row', left: `${p.payer || 'Pembayar'} (${p.m})`, right: money(p.a) }));
    }
    content.push({ type: 'row', left: `Bayar (${o?.payment})`, right: money(o?.paid) });
    content.push({ type: 'row', left: 'Kembali', right: money(o?.change) });
    if (remainOf(o) > 0) content.push({ type: 'row', left: 'SISA BELUM BAYAR', right: money(remainOf(o)), bold: true });
    content.push(receiptDivider());
    content.push(receiptText('Terima kasih telah berkunjung!', 'center', true));
  }
  return content;
};

async function checkPrintBridge(urlEndpoint) {
  const url = urlEndpoint || 'http://localhost:9100';
  const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('Aplikasi printer tidak merespons.');
  const data = await response.json();
  if (!data.printer?.connected) throw new Error(data.printer?.problem || 'Printer belum terhubung di aplikasi Cleanter.');
  return data;
}

async function postPrint(content, reference, urlEndpoint) {
  const url = urlEndpoint || 'http://localhost:9100';
  const health = await checkPrintBridge(url);
  const response = await fetch(`${url}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperWidth: 58, cut: false, reference, content }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.fix || data.detail || data.error || `Gagal mencetak (${response.status})`);
  return { job: data, printer: health.printer?.name || 'Printer Bluetooth' };
}

// ============ Web Bluetooth ESC/POS Driver Langsung ============
let globalBleDevice = null;
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

// ============ Supabase Print Relay Channel ============
// Pengirim baru dianggap berhasil setelah menerima ACK dari perangkat Bluetooth.
let printRelayChannel = null;
let printRelayReady = false;
const pendingPrintJobs = new Map();
const PRINT_RELAY_CHANNEL = 'print-relay-v1';
const PRINT_RELAY_ACK_TIMEOUT = 20000;

const waitForPrintRelayAck = (jobId) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    pendingPrintJobs.delete(jobId);
    reject(new Error('Tidak ada konfirmasi dari perangkat printer. Pastikan HP server tetap membuka Zayga POS, Bluetooth terhubung, dan kedua perangkat online.'));
  }, PRINT_RELAY_ACK_TIMEOUT);
  pendingPrintJobs.set(jobId, {
    resolve: result => { clearTimeout(timer); pendingPrintJobs.delete(jobId); result?.ok ? resolve(result) : reject(new Error(result?.error || 'Perangkat printer gagal mencetak.')); },
    reject: error => { clearTimeout(timer); pendingPrintJobs.delete(jobId); reject(error); }
  });
});

const receiptToEscPosBytes = (content) => {
  const bytes = [];
  const add = (...b) => bytes.push(...b);
  const textEncoder = new TextEncoder();
  const addText = (str) => {
    const enc = textEncoder.encode(str || '');
    for (let i = 0; i < enc.length; i++) bytes.push(enc[i]);
  };

  // ESC @: Inisialisasi printer
  add(0x1b, 0x40);

  for (const item of (content || [])) {
    if (item.type === 'text') {
      const align = item.align === 'center' ? 1 : item.align === 'right' ? 2 : 0;
      add(0x1b, 0x61, align);
      add(0x1b, 0x45, item.bold ? 1 : 0);
      add(0x1d, 0x21, item.size === 'large' ? 0x11 : 0x00);
      addText(item.text || '');
      add(0x0a);
    } else if (item.type === 'divider') {
      add(0x1b, 0x61, 0);
      add(0x1b, 0x45, 0);
      add(0x1d, 0x21, 0);
      addText('--------------------------------\n');
    } else if (item.type === 'row') {
      add(0x1b, 0x61, 0);
      add(0x1b, 0x45, item.bold ? 1 : 0);
      add(0x1d, 0x21, 0);
      const left = String(item.left || '');
      const right = String(item.right || '');
      const totalWidth = 32;
      const spaces = Math.max(1, totalWidth - left.length - right.length);
      addText(left + ' '.repeat(spaces) + right + '\n');
    }
  }

  // Feed 3 baris & potong kertas (cut)
  add(0x0a, 0x0a, 0x0a);
  add(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
};

const printViaWebBluetooth = async (uint8Data) => {
  if (!globalBleCharacteristic || !globalBleDevice || !globalBleDevice.gatt?.connected) {
    throw new Error('Printer Bluetooth belum terhubung.');
  }
  // Chunk 512 byte — lebih cepat dari 64 byte, masih aman untuk sebagian besar printer BT
  const CHUNK_SIZE = 512;
  for (let i = 0; i < uint8Data.length; i += CHUNK_SIZE) {
    const chunk = uint8Data.slice(i, i + CHUNK_SIZE);
    // writeValueWithoutResponse = tidak perlu menunggu ACK dari printer → lebih cepat
    if (globalBleCharacteristic.properties?.writeWithoutResponse) {
      await globalBleCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await globalBleCharacteristic.writeValue(chunk);
    }
    // Delay minimal hanya jika ada lebih dari satu chunk
    if (i + CHUNK_SIZE < uint8Data.length) {
      await new Promise(r => setTimeout(r, 5));
    }
  }
};

const sendPrintJob = async (order, type, url) => {
  const content = buildReceipt(order, type);
  // 0. Printer pernah terhubung tetapi putus: coba sambung ulang dulu
  if (globalBleDevice && !globalBleDevice.gatt?.connected && bleReconnectHook) {
    await bleReconnectHook(2);
  }
  // 1. Coba cetak langsung via Web Bluetooth (perangkat ini terhubung BT)
  if (globalBleCharacteristic && globalBleDevice && globalBleDevice.gatt?.connected) {
    const bytes = receiptToEscPosBytes(content);
    await printViaWebBluetooth(bytes);
    return { job: { ok: true }, printer: globalBleDevice.name || 'Printer Bluetooth (Langsung)' };
  }
  // 2. Relay jaringan: wajib menunggu ACK dari HP yang benar-benar mencetak.
  if (printRelayChannel) {
    if (!printRelayReady) {
      throw new Error('Koneksi Print Relay belum siap. Tunggu beberapa detik lalu coba cetak kembali.');
    }
    const bytes = receiptToEscPosBytes(content);
    const jobId = `${order?.id || 'order'}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ackPromise = waitForPrintRelayAck(jobId);
    try {
      const status = await printRelayChannel.send({
        type: 'broadcast',
        event: 'print_job',
        payload: { bytesArr: Array.from(bytes), jobId }
      });
      if (status !== 'ok') throw new Error(`Pesan cetak gagal dikirim melalui jaringan (${status || 'status tidak diketahui'}).`);
    } catch (err) {
      pendingPrintJobs.get(jobId)?.reject(err);
    }
    const ack = await ackPromise;
    return { job: { ok: true, relayed: true, ack }, printer: ack.printer || 'Printer Bluetooth (Relay)' };
  }
  // 3. Fallback ke Cleanter bridge lokal/server jika diatur
  return postPrint(content, `${order?.id}-${type}`, url);
};

/* ===================== Komponen Pendukung ===================== */
function OrdersTable({ orders, printOrder, onSelectOrder, onDelete, queueMap }) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Antrian</th><th>ID</th><th>Status</th><th>Cetak</th><th>Pelanggan</th><th>Lokasi</th><th>Waktu</th><th>Total</th><th>Metode</th><th>Aksi / Cetak</th>
          </tr>
        </thead>
        <tbody>
          {safeOrders.map(o => {
            const isFullyPrinted = o.kitchen_printed && o.customer_printed;
            const st = statusOf(o);
            return (
              <tr key={o.id} style={{ cursor: 'pointer', background: isFullyPrinted ? 'transparent' : '#fefce8' }} onClick={() => onSelectOrder(o)}>
                <td data-label="Antrian"><span style={queueBadgeStyle}>{queueMap?.get(o.id) ? fmtQueue(queueMap.get(o.id)) : '-'}</span></td>
                <td data-label="ID"><b className="mono">{o.id}</b>{o._queued && <span className="cat-badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>Antre</span>}</td>
                <td data-label="Status"><span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, background: STATUS_STYLE[st][0], color: STATUS_STYLE[st][1] }}>{st}</span></td>
                <td data-label="Cetak">
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.kitchen_printed ? '#dcfce7' : '#fef08a', color: o.kitchen_printed ? '#166534' : '#854d0e' }}>{o.kitchen_printed ? 'Dap✓' : 'Dap!'}</span>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.customer_printed ? '#dcfce7' : '#fef08a', color: o.customer_printed ? '#166534' : '#854d0e' }}>{o.customer_printed ? 'Kas✓' : 'Kas!'}</span>
                  </div>
                </td>
                <td data-label="Pelanggan">{o.customer || '-'}</td>
                <td data-label="Lokasi"><span className="cat-badge loc-badge" title={locLabel(o.location)}>{locLabel(o.location)}</span></td>
                <td data-label="Waktu"><div className="time-cell"><span>{o.date}</span><small>{o.time}</small></div></td>
                <td data-label="Total"><b>{money(o.total)}</b></td>
                <td data-label="Metode">
                  <span className={remainOf(o) > 0 ? 'cat-badge' : ''} style={remainOf(o) > 0 ? { background: '#fee2e2', color: '#991b1b' } : {}}>
                    {remainOf(o) > 0 ? (o.payment === 'Belum Bayar' ? 'Belum Bayar' : `${o.payment} · Sisa ${money(remainOf(o))}`) : o.payment}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="print-actions">
                    <button className="print-btn" onClick={() => onSelectOrder(o)} title="Lihat Detail"><Eye size={14} /> Detail</button>
                    <button className="print-btn" onClick={() => printOrder(o, 'kitchen')}><Printer size={14} /> Dapur</button>
                    <button className="print-btn" onClick={() => printOrder(o, 'customer')}><Printer size={14} /> Struk Kasir</button>
                    {onDelete && <button className="print-btn" title="Hapus transaksi" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }} onClick={() => onDelete(o)}><Trash2 size={14} /> Hapus</button>}
                  </div>
                </td>
              </tr>
            );
          })}
          {safeOrders.length === 0 && <tr><td colSpan="10" className="empty-table" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada transaksi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Donut chart SVG untuk metode bayar ---------- */
function DonutChart({ slices, colors }) {
  const size = 100, r = 38, cx = 50, cy = 50, stroke = 12;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, v) => s + v, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="db-donut" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {slices.map((v, i) => {
        const dash = (v / total) * circ;
        const gap = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={colors[i]} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform="rotate(-90 50 50)"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

function Delta({ cur, prev }) {
  if (!prev && !cur) return <span className="db-delta flat">–</span>;
  if (!prev) return <span className="db-delta up"><TrendingUp size={13} />Baru</span>;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return <span className="db-delta flat">0%</span>;
  return <span className={'db-delta ' + (p > 0 ? 'up' : 'down')}>{p > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{p > 0 ? '+' : ''}{p}%</span>;
}

// ===================== Komponen Pengaturan: Perangkat =====================
function DeviceNameRow({ myName, onRename }) {
  const [draft, setDraft] = useState(myName);
  useEffect(() => setDraft(myName), [myName]);
  const dirty = draft.trim() && draft.trim() !== myName;
  return (
    <div className="ms-row">
      <div className="ms-row-start">
        <div className="ms-icon-box blue"><Smartphone size={20} /></div>
        <div className="ms-row-text">
          <span className="ms-row-label">Nama perangkat ini</span>
          <input className="ms-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Contoh: HP Kasir / Tablet Dapur" />
        </div>
      </div>
      {dirty && <button type="button" className="ms-btn-action primary" onClick={() => onRename(draft.trim())}>Simpan</button>}
    </div>
  );
}

function DevicesList({ peers, myId }) {
  if (!peers.length) return <div className="ms-row"><span className="ms-row-sub">Belum ada perangkat online.</span></div>;
  return peers.map(p => (
    <div className="ms-row" key={p.deviceId}>
      <div className="ms-row-start">
        <span className="ms-dot ok"></span>
        <div className="ms-row-text">
          <span className="ms-row-label">{p.deviceName || 'Perangkat'}{p.deviceId === myId ? ' (ini)' : ''}</span>
          <span className="ms-row-sub">{p.username || '?'} · {p.role}</span>
        </div>
      </div>
      <div className="ms-row-end">
        {p.printer && <span className="ms-chip">🖨 Printer</span>}
        {p.audio && <span className="ms-chip">🔊 Suara</span>}
      </div>
    </div>
  ));
}
/* ===================== Dashboard (Admin) ===================== */
function DashboardView({ orders, items, onOpenHistory, onOpenQueue }) {
  const [range, setRange] = useState(7);

  const d = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const ymd = dt => dt.toLocaleDateString('en-CA');
    const back = n => { const x = new Date(); x.setDate(x.getDate() - n); return ymd(x); };
    const curDates = Array.from({ length: range }, (_, i) => back(i));
    const cur = new Set(curDates);
    const prv = new Set(Array.from({ length: range }, (_, i) => back(i + range)));
    const curO = list.filter(o => cur.has(o.date));
    const prvO = list.filter(o => prv.has(o.date));
    const sum = (l, f) => l.reduce((s, o) => s + f(o), 0);
    const porsi = o => (o.items || []).reduce((s, i) => s + (i.qty || 0), 0);
    const hourOf = o => { const h = parseInt(String(o.time || ''), 10); return isNaN(h) ? null : h; };

    const sales = sum(curO, o => o.total || 0), prevSales = sum(prvO, o => o.total || 0);
    const tx = curO.length, prevTx = prvO.length;
    const avg = tx ? Math.round(sales / tx) : 0, prevAvg = prevTx ? Math.round(prevSales / prevTx) : 0;
    const qty = sum(curO, porsi), prevQty = sum(prvO, porsi);
    const disc = sum(curO, o => o.discount || 0);

    let breakdown = [];
    if (range === 1) {
      const hrs = Array.from({ length: 16 }, (_, i) => i + 8);
      const allHrs = hrs.map(h => {
        const matching = curO.filter(o => hourOf(o) === h);
        const s = sum(matching, o => o.total || 0);
        return {
          id: `jam-${h}`,
          title: `Pukul ${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
          subDate: '',
          sales: s,
          tx: matching.length,
          avg: matching.length ? Math.round(s / matching.length) : 0,
        };
      });
      const active = allHrs.filter(x => x.tx > 0);
      breakdown = active.length ? active : allHrs.slice(0, 8);
    } else {
      breakdown = curDates.map((ds, idx) => {
        const matching = curO.filter(o => o.date === ds);
        const s = sum(matching, o => o.total || 0);
        const [yr, mo, dy] = ds.split('-').map(Number);
        const dt = new Date(yr, mo - 1, dy);
        const dayLabel = idx === 0 ? 'Hari ini' : idx === 1 ? 'Kemarin' : dt.toLocaleDateString('id-ID', { weekday: 'long' });
        const dateFormatted = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        return {
          id: ds,
          title: dayLabel,
          subDate: dateFormatted,
          sales: s,
          tx: matching.length,
          avg: matching.length ? Math.round(s / matching.length) : 0,
          isToday: idx === 0,
        };
      });
    }

    const maxBreakdownSales = Math.max(...breakdown.map(b => b.sales), 1);
    const bestBreakdown = breakdown.find(b => b.sales === maxBreakdownSales && b.sales > 0);

    const tally = l => {
      const m = {};
      l.forEach(o => (o.items || []).forEach(i => {
        const n = baseName(i.name);
        const e = m[n] || (m[n] = { qty: 0, rev: 0, cat: i.category || 'Lainnya' });
        e.qty += i.qty || 0; e.rev += (i.qty || 0) * (i.price || 0);
      }));
      return m;
    };
    const tc = tally(curO), tp = tally(prvO);
    const top = Object.entries(tc).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8)
      .map(([name, v]) => {
        const prev = tp[name]?.qty || 0;
        return { name, ...v, prev, hot: v.qty >= 3 && (prev === 0 || v.qty / prev >= 1.3) };
      });

    const catMap = {};
    Object.values(tc).forEach(v => { catMap[v.cat] = (catMap[v.cat] || 0) + v.rev; });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const hrs = Array.from({ length: 16 }, (_, i) => i + 8);
    const peak = hrs.map(h => curO.filter(o => hourOf(o) === h).length);
    const peakMax = Math.max(...peak, 1);

    const pay = { Tunai: 0, QRIS: 0, Transfer: 0 };
    list.forEach(o => {
      if (Array.isArray(o.payments)) o.payments.forEach(p => { if (cur.has(p.d)) pay[p.m] = (pay[p.m] || 0) + (p.a || 0); });
      else if (cur.has(o.date) && o.payment !== 'Belum Bayar') pay[o.payment] = (pay[o.payment] || 0) + settledOf(o);
    });
    const payTotal = Object.values(pay).reduce((s, v) => s + v, 0);

    const cm = {};
    curO.forEach(o => { const c = o.cashier || 'Lainnya'; const e = cm[c] || (cm[c] = { amt: 0, n: 0 }); e.amt += o.total || 0; e.n++; });
    const cashiers = Object.entries(cm).sort((a, b) => b[1].amt - a[1].amt);

    const bonOrders = list.filter(o => remainOf(o) > 0);
    const bon = sum(bonOrders, remainOf);
    const todayStr = ymd(new Date());
    const act = list.filter(o => o.date === todayStr && statusOf(o) !== 'Diantar');
    const live = { Baru: 0, Dimasak: 0, Siap: 0 };
    act.forEach(o => { const s = statusOf(o); if (live[s] !== undefined) live[s]++; });

    const low = (items || []).filter(m => m.active && (m.sold_out || (m.stock != null && m.stock <= 5)))
      .sort((a, b) => (b.sold_out ? 1 : 0) - (a.sold_out ? 1 : 0) || (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 6);

    return { sales, prevSales, tx, prevTx, avg, prevAvg, qty, prevQty, disc, breakdown, maxBreakdownSales, bestBreakdown, top, cats, peak, peakMax, hrs, pay, payTotal, cashiers, bon, bonN: bonOrders.length, live, liveN: act.length, low };
  }, [orders, items, range]);

  const rangeName = range === 1 ? 'Hari ini' : range === 7 ? '7 hari terakhir' : '30 hari terakhir';
  const prevName = range === 1 ? 'kemarin' : `${range} hari sebelumnya`;
  const topMax = d.top[0]?.qty || 1;
  const catMax = d.cats[0]?.[1] || 1;
  // Palet Warna: Bersih, Netral, Tidak Kontras
  const PAYC_HEX = { Tunai: '#2563eb', QRIS: '#059669', Transfer: '#7c3aed' };
  const LIVEC = { Baru: ['#fef3c7', '#92400e'], Dimasak: ['#eff6ff', '#1d4ed8'], Siap: ['#dcfce7', '#166534'] };

  return (
    <div className="content">
      <div className="db">

        {/* Ringkasan & filter rentang waktu */}
        <section className="db-hero">
          <div className="db-hero-copy">
            <span className="db-hero-kicker">ANALITIK &amp; PERFORMA</span>
            <h3>Ringkasan Penjualan</h3>
            <p>Performa penjualan · {rangeName} dibanding {prevName}.</p>
          </div>
          <div className="db-hero-side">
            <div className="db-seg" role="tablist">
              {[[1, 'Hari ini'], [7, '7 Hari'], [30, '30 Hari']].map(([v, l]) => (
                <button key={v} type="button" className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="db-label"><span>RINGKASAN UTAMA</span><i></i><small>Pembaruan langsung</small></div>

        {/* 4 KPI utama */}
        <div className="db-kpis">
          <div className="db-kpi db-kpi-blue">
            <div className="db-kpi-top">
              <span className="db-kpi-ico"><TrendingUp size={18} /></span>
              <Delta cur={d.sales} prev={d.prevSales} />
            </div>
            <span className="l">Total Omzet</span>
            <b>{moneyShort(d.sales)}</b>
            <span className="db-kpi-prev">vs {prevName}: {moneyShort(d.prevSales)}</span>
          </div>
          <div className="db-kpi db-kpi-green">
            <div className="db-kpi-top">
              <span className="db-kpi-ico"><ShoppingCart size={18} /></span>
              <Delta cur={d.tx} prev={d.prevTx} />
            </div>
            <span className="l">Transaksi</span>
            <b>{d.tx}</b>
            <span className="db-kpi-prev">Rata-rata: {moneyShort(d.avg)}</span>
          </div>
          <div className="db-kpi db-kpi-amber">
            <div className="db-kpi-top">
              <span className="db-kpi-ico"><Package size={18} /></span>
              <Delta cur={d.qty} prev={d.prevQty} />
            </div>
            <span className="l">Porsi terjual</span>
            <b>{d.qty}</b>
            <span className="db-kpi-prev">Diskon: {moneyShort(d.disc)}</span>
          </div>
          <div className={'db-kpi db-kpi-red' + (d.bon > 0 ? ' alert' : '')}>
            <div className="db-kpi-top">
              <span className="db-kpi-ico"><AlertTriangle size={18} /></span>
              {d.bonN > 0 && <span className="db-delta down">{d.bonN} bon</span>}
            </div>
            <span className="l">Tagihan belum lunas</span>
            <b>{money(d.bon)}</b>
            {d.bonN > 0
              ? <button type="button" onClick={onOpenHistory} className="db-kpi-link">Lihat bon ›</button>
              : <span className="db-kpi-prev">Semua lunas ✓</span>}
          </div>
        </div>

        {/* Rincian penjualan */}
        <section className="ui-card db-breakdown-card">
          <div className="ui-title">
            <div>
              <h3>Rincian Penjualan {range === 1 ? 'Hari Ini' : range === 7 ? '7 Hari Terakhir' : '30 Hari Terakhir'}</h3>
              <p>Performa omzet dan jumlah transaksi {range === 1 ? 'per jam' : 'tiap hari'}.</p>
            </div>
            {d.bestBreakdown && (
              <span className="db-peak-badge">
                <Crown size={14} /> Puncak: {d.bestBreakdown.title} {d.bestBreakdown.subDate ? `(${d.bestBreakdown.subDate})` : ''} · {moneyShort(d.bestBreakdown.sales)}
              </span>
            )}
          </div>
          {d.breakdown.some(b => b.sales > 0 || b.tx > 0) ? (
            <div className="db-breakdown-list">
              {d.breakdown.map(item => {
                const isBest = d.bestBreakdown && item.id === d.bestBreakdown.id;
                const pct = Math.max(0, Math.min(100, Math.round((item.sales / d.maxBreakdownSales) * 100)));
                return (
                  <div key={item.id} className={'db-breakdown-row' + (isBest ? ' best' : '') + (item.isToday ? ' today' : '')}>
                    <div className="db-bd-date">
                      <div className="db-bd-day">
                        <b>{item.title}</b>
                        {item.subDate && <span className="db-bd-subdate">{item.subDate}</span>}
                        {item.isToday && <span className="db-bd-tag today">Hari ini</span>}
                        {isBest && <span className="db-bd-tag best"><Crown size={11} /> Tertinggi</span>}
                      </div>
                      <div className="db-bd-meta">
                        <span>{item.tx} transaksi</span>
                        {item.tx > 0 && <span>· Rata-rata {moneyShort(item.avg)}/nota</span>}
                      </div>
                    </div>
                    <div className="db-bd-progress">
                      <div className="db-track">
                        <div className={'db-fill' + (isBest ? ' db-fill-best' : '')} style={{ width: `${item.sales > 0 ? Math.max(5, pct) : 0}%` }} />
                      </div>
                    </div>
                    <div className="db-bd-val">
                      <strong>{money(item.sales)}</strong>
                      <small className="db-bd-pct">{item.sales > 0 ? `${pct}% dari puncak` : '0 transaksi'}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="ui-empty">Belum ada data penjualan pada periode ini.</div>}
        </section>

        <div className="db-label"><span>WAWASAN &amp; OPERASIONAL</span><i></i></div>

        <div className="db-grid">
          {/* Menu terlaris */}
          <section className="ui-card db-span2">
            <div className="ui-title">
              <div><h3>Hidangan Terlaris</h3><p>Peringkat porsi terjual, dibandingkan {prevName}.</p></div>
              <Flame size={20} color="#a77a19" />
            </div>
            {d.top.length ? (
              <div className="db-rank">
                {d.top.map((m, i) => (
                  <div className="db-rank-row" key={m.name}>
                    <div className="db-no">{i === 0 ? <Crown size={16} /> : i + 1}</div>
                    <div className="db-rank-main">
                      <b><span className="n">{m.name}</span>{m.hot && <span className="db-hot"><Flame size={11} />Trending</span>}</b>
                      <small>{m.cat} · {moneyShort(m.rev)}</small>
                      <div className="db-track"><div className="db-fill" style={{ width: Math.max(4, Math.round((m.qty / topMax) * 100)) + '%' }}></div></div>
                    </div>
                    <div className="db-rank-end"><strong>{m.qty} porsi</strong><Delta cur={m.qty} prev={m.prev} /></div>
                  </div>
                ))}
              </div>
            ) : <div className="ui-empty">Belum ada penjualan pada periode ini.</div>}
          </section>

          {/* Jam sibuk */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Jam Ramai</h3><p>Transaksi per jam · {rangeName.toLowerCase()}.</p></div>
              <Clock size={20} color="#a77a19" />
            </div>
            {d.peak.some(v => v > 0) ? (
              <div className="db-cols">
                {d.peak.map((v, i) => (
                  <div key={i} className={'db-col ' + (v === d.peakMax && v > 0 ? 'hi' : '')} title={`${d.hrs[i]}:00 · ${v} transaksi`}>
                    <i style={{ height: Math.max(4, Math.round((v / d.peakMax) * 100)) + '%' }}></i>
                    <span>{d.hrs[i] % 2 === 0 ? d.hrs[i] : ''}</span>
                  </div>
                ))}
              </div>
            ) : <div className="ui-empty">Belum ada data jam.</div>}
          </section>

          {/* Metode bayar */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Metode Pembayaran</h3><p>Distribusi uang masuk.</p></div>
              <Wallet size={20} color="#a77a19" />
            </div>
            {d.payTotal > 0 ? (
              <div className="db-pay-wrap">
                <DonutChart slices={Object.values(d.pay)} colors={Object.keys(d.pay).map(k => PAYC_HEX[k] || '#94a3b8')} />
                <div className="db-pay-legend">
                  {Object.entries(d.pay).map(([k, v]) => (
                    <div key={k} className="db-pay-row">
                      <span className="db-pay-dot" style={{ background: PAYC_HEX[k] }}></span>
                      <span className="db-pay-name">{k}</span>
                      <span className="db-pay-pct">{d.payTotal ? Math.round(v / d.payTotal * 100) : 0}%</span>
                      <b className="db-pay-amt">{moneyShort(v)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="ui-empty">Belum ada pembayaran masuk.</div>}
          </section>

          {/* Kategori */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Penjualan per Kategori</h3><p>Kontribusi omzet tiap kategori.</p></div>
              <BarChart3 size={20} color="#a77a19" />
            </div>
            {d.cats.length ? (
              <div className="db-hb">
                {d.cats.map(([c, v]) => {
                  const pct = Math.round(v / catMax * 100);
                  return (
                    <div className="db-hb-row" key={c}>
                      <div className="top"><b>{c}</b><span>{moneyShort(v)}</span></div>
                      <div className="db-track-wrap">
                        <div className="db-track"><div className="db-fill db-fill-violet" style={{ width: Math.max(4, pct) + '%' }}></div></div>
                        <span className="db-pct-lbl">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="ui-empty">Belum ada data kategori.</div>}
          </section>

          {/* Rekap kasir */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Rekap Kasir</h3><p>Penjualan per akun kasir.</p></div>
              <Users size={20} color="#a77a19" />
            </div>
            {d.cashiers.length ? (
              <div className="db-cash">
                {d.cashiers.map(([n, v]) => (
                  <div className="db-cash-row" key={n}>
                    <div className="db-av">{String(n)[0].toUpperCase()}</div>
                    <div className="m">
                      <b><span>{n}</span><span>{moneyShort(v.amt)}</span></b>
                      <small>{v.n} transaksi · avg {moneyShort(d.cashiers[0][1].n ? Math.round(v.amt / v.n) : 0)}</small>
                      <div className="db-track"><div className="db-fill" style={{ width: Math.max(4, Math.round(v.amt / d.cashiers[0][1].amt * 100)) + '%' }}></div></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="ui-empty">Belum ada data kasir.</div>}
          </section>

          {/* Dapur & stok */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Status Dapur Hari Ini</h3><p>{d.liveN} pesanan aktif sekarang.</p></div>
              <ChefHat size={20} color="#a77a19" />
            </div>
            <div className="db-live">
              {['Baru', 'Dimasak', 'Siap'].map(s => (
                <button key={s} type="button" onClick={onOpenQueue} style={{ background: LIVEC[s][0], color: LIVEC[s][1] }}>
                  <b>{d.live[s]}</b><span>{s}</span>
                </button>
              ))}
            </div>
            <p className="db-sub">Stok menipis / habis</p>
            <div className="db-stock">
              {d.low.map(m => (
                <div key={m.id} className={'db-stock-row ' + (m.sold_out ? 'out' : '')}><b>{m.name}</b><span>{m.sold_out ? 'HABIS' : `Sisa ${m.stock}`}</span></div>
              ))}
              {!d.low.length && <div className="ui-empty" style={{ padding: '10px 0' }}>Semua stok aman ✓</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ===================== Aplikasi Utama ===================== */
export default function App() {
  const init = useRef(null);
  if (!init.current) {
    const s = read('z_drafts', null);
    const ds = s?.drafts?.length ? s.drafts : [newDraft()];
    init.current = { ds, cur: ds.find(d => d.id === s?.draftId) || ds[0] };
  }
  const cur0 = init.current.cur;

  const [user, setUser] = useState(() => read('z_user', null));
  const [login, setLogin] = useState({ username: '', password: '' });
  const [usersList, setUsersList] = useState(() => read('z_users_cache', DEFAULT_USERS));

  const [items, setItems] = useState(() => read('z_items_cache', DEFAULT_MENU_ITEMS));
  const [orders, setOrders] = useState([]);
  const [clearLogs, setClearLogs] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [page, setPage] = useState('Pesanan');
  const [category, setCategory] = useState('Semua');
  const [query, setQuery] = useState('');

  const [drafts, setDrafts] = useState(init.current.ds);
  const [draftId, setDraftId] = useState(cur0.id);
  const [cart, setCart] = useState(cur0.cart || []);
  const [customer, setCustomer] = useState(cur0.customer || '');
  const [location, setLocation] = useState(cur0.location || '');
  const [notes, setNotes] = useState(cur0.notes || '');
  const [discount, setDiscount] = useState(cur0.discount || { type: 'rp', value: '' });
  const stash = useRef(null);

  const [payment, setPayment] = useState('Tunai');
  const [paid, setPaid] = useState('');
  const [paidRaw, setPaidRaw] = useState('');
  const [partialAmt, setPartialAmt] = useState('');
  const [roundTo, setRoundTo] = useState(() => Number(localStorage.getItem('z_round')) || 0);
  const [showPay, setShowPay] = useState(false);
  const [saving, setSaving] = useState(false);
  // Split bill pada pembayaran pesanan baru
  const [newSplitPayRows, setNewSplitPayRows] = useState(() => newSplitRows());
  // Popup split bill per menu (pesanan baru)
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [splitManual, setSplitManual] = useState(false);
  const [splitMenuPayers, setSplitMenuPayers] = useState(() => [{ name: '', method: 'Tunai', received: '' }, { name: '', method: 'QRIS', received: '' }]);
  const [splitMenuAssign, setSplitMenuAssign] = useState({}); // { [indexItemKeranjang]: { [indexPembayar]: qty } }

  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queueCount, setQueueCount] = useState(() => read('z_queue', []).length);
  const flushing = useRef(false);

  const [notifPerm, setNotifPerm] = useState(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  // Pusat audio hanya aktif pada perangkat yang ditandai secara lokal (mis. HP/tablet dapur).
  const [centralAudioDevice, setCentralAudioDevice] = useState(() => read('z_central_audio_device', false));
  const [centralAudioReady, setCentralAudioReady] = useState(false);
  const kitchenAudioRef = useRef(null);
  const alarmAudioUrlRef = useRef(null);
  const alarmAudioNameRef = useRef('kitchen-alarm.mp3');
  const alarmFileInputRef = useRef(null);
  const [customAlarmName, setCustomAlarmName] = useState('kitchen-alarm.mp3');
  const [alarmFileBusy, setAlarmFileBusy] = useState(false);
  // ---- Status perangkat (presence) ----
  const [deviceId] = useState(() => getDeviceId());
  const [deviceName, setDeviceName] = useState(() => read('z_device_name', '') || guessDeviceName());
  const [devicePeers, setDevicePeers] = useState([]);
  const presenceChRef = useRef(null);
  const presenceReadyRef = useRef(false);
  const liveChannelRef = useRef(null); // channel realtime, dipakai untuk mengirim sinyal alarm dapur
  const seenKitchenAudioOrders = useRef(new Set());

  // Peran sebagai Pusat Cetak Kasir (hanya HP kasir yang tersambung ke printer Bluetooth yang mengaktifkannya)
  const [isPrintStation, setIsPrintStation] = useState(() => read('z_is_print_station', user?.role === 'Kasir' || user?.role === 'Admin'));
  const isPrintStationRef = useRef(isPrintStation);
  isPrintStationRef.current = isPrintStation;
  const centralAudioDeviceRef = useRef(centralAudioDevice);
  centralAudioDeviceRef.current = centralAudioDevice;
  const seenAutoPrintedOrders = useRef(new Set());

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [addingToOrder, setAddingToOrder] = useState(null);
  const [settling, setSettling] = useState(null);
  const [splitPayOrder, setSplitPayOrder] = useState(null);
  const [splitPayRows, setSplitPayRows] = useState([{ name: '', method: 'Tunai', amount: '', received: '' }]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Kasir' });
  const [editingUser, setEditingUser] = useState(null);
  const [selectedItemForVariant, setSelectedItemForVariant] = useState(null);
  const [variantTemp, setVariantTemp] = useState(''); // dipertahankan untuk kompatibilitas state lama
  const [variantQty, setVariantQty] = useState({
    Panas: { biasa: 0, susu: 0 },
    Hangat: { biasa: 0, susu: 0 },
    Dingin: { biasa: 0, susu: 0 }
  });
  const [variantMilk, setVariantMilk] = useState(false);
  const [variantNum, setVariantNum] = useState(1);
  const [variantAdded, setVariantAdded] = useState([]); // ringkasan yang sudah ditambahkan di popup ini
  const [variantToppings, setVariantToppings] = useState([]);
  const [variantSpice, setVariantSpice] = useState('Normal');

  const [moveOrder, setMoveOrder] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [movePayungOpen, setMovePayungOpen] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveConfirm, setMoveConfirm] = useState(null);

  const [splitOrder, setSplitOrder] = useState(null);
  const [splitQty, setSplitQty] = useState({});
  const [splitLoc, setSplitLoc] = useState('');

  const [infoOpen, setInfoOpen] = useState(false);
  const [payungOpen, setPayungOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);

  const [baksoOpen, setBaksoOpen] = useState(false);
  const [baksoPrice, setBaksoPrice] = useState('');
  const [baksoName, setBaksoName] = useState('');

  const [localPrintUrl, setLocalPrintUrl] = useState(() => getLocalPrintBridge());
  const [serverPrintUrl, setServerPrintUrl] = useState('http://localhost:9100');

  const [printerStatus, setPrinterStatus] = useState('Tidak terhubung');
  const [printerName, setPrinterName] = useState('');
  const [bleConnected, setBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState('');
  const bleManualDisc = useRef(false);   // true = diputus sengaja oleh pengguna
  const bleReconnecting = useRef(false); // mencegah sambung ulang ganda
  const [mobileSettingsView, setMobileSettingsView] = useState('main'); // 'main', 'akun', 'log'
  const [showAdvancedPrint, setShowAdvancedPrint] = useState(false);
  const [showSpeakerGuide, setShowSpeakerGuide] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', category: 'Mie', price: '' });

  const [cartOpen, setCartOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [setTab, setSetTab] = useState('printer');
  const [serverDraft, setServerDraft] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [noteItem, setNoteItem] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  // Format: { "menu:<id>": { "Kurang manis": 4, ... }, ... }
  // Tidak menggunakan statistik global agar rekomendasi satu menu tidak bocor ke menu lain.
  const [noteStats, setNoteStats] = useState(() => read('z_note_stats_by_menu', {}));

  const [stockItem, setStockItem] = useState(null);
  const [stockDraft, setStockDraft] = useState('');
  const [tableSheet, setTableSheet] = useState(null);
  const [qTab, setQTab] = useState('Semua');
  const [kdsStation, setKdsStation] = useState('Semua'); // 'Semua', 'Makanan', 'Minuman'
  const [kdsSyncing, setKdsSyncing] = useState(false);
  const [kdsFullscreen, setKdsFullscreen] = useState(false);
  const [kdsTime, setKdsTime] = useState(() => new Date());
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [adminQueueMode, setAdminQueueMode] = useState(() => read('z_admin_queue_mode', 'dapur')); // 'dapur' | 'kasir'
  const [cashierTab, setCashierTab] = useState('Siap'); // 'Siap' | 'Dimasak' | 'Baru' | 'Semua'
  const [cashierLayout, setCashierLayout] = useState(() => read('z_cashier_layout', 'cards')); // 'cards' | 'compact'
  const [histFilter, setHistFilter] = useState('Hari ini');
  const [histQuery, setHistQuery] = useState('');
  const [shiftWho, setShiftWho] = useState('');
  const [shiftForm, setShiftForm] = useState({ opening: '', counted: '', note: '' });
  const [, setTick] = useState(0);

  const searchRef = useRef(null);
  const lp = useRef({ t: null, fired: false });
  const userRef = useRef(user); userRef.current = user;
  const ordersRef = useRef(orders); ordersRef.current = orders;
  const localStatus = useRef({});

  const today = new Date().toLocaleDateString('en-CA');

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      flash('Browser ini tidak mendukung notifikasi latar belakang.', 4000);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifPerm(permission);
      if (permission === 'granted') {
        flash({ title: 'Notifikasi aktif', body: 'Zayga POS siap mengirim pemberitahuan saat aplikasi berada di latar belakang.', type: 'success' }, 4500);
      } else {
        flash('Izin notifikasi ditolak oleh browser.', 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const testNotification = () => {
    try {
      // Tes memakai kartu notifikasi khusus Zayga di dalam aplikasi, bukan pop-up sistem.
    } catch {}
    flash({ title: 'Tes notifikasi berhasil', body: 'Tampilan notifikasi Zayga POS sudah aktif di dalam aplikasi.', type: 'success' }, 3500);
  };

  // Muat file alarm pilihan dari penyimpanan lokal perangkat. File tidak diunggah ke server.
  useEffect(() => {
    let alive = true;
    loadAlarmFile(deviceId).then(saved => {
      if (!alive || !saved?.blob) return;
      const url = URL.createObjectURL(saved.blob);
      if (alarmAudioUrlRef.current) URL.revokeObjectURL(alarmAudioUrlRef.current);
      alarmAudioUrlRef.current = url;
      alarmAudioNameRef.current = saved.name || 'Suara kustom';
      setCustomAlarmName(alarmAudioNameRef.current);
      if (kitchenAudioRef.current) {
        kitchenAudioRef.current.pause(); kitchenAudioRef.current.src = url; kitchenAudioRef.current.load();
      }
    }).catch(err => console.warn('File alarm kustom belum dapat dimuat:', err));
    return () => { alive = false; };
  }, []);

  const getKitchenAlarmSource = () => alarmAudioUrlRef.current || '/kitchen-alarm.mp3';
  const ensureKitchenAudio = () => {
    const src = getKitchenAlarmSource();
    if (!kitchenAudioRef.current) {
      const a = new Audio(src); a.preload = 'auto'; a.volume = 1; kitchenAudioRef.current = a;
    } else if (kitchenAudioRef.current.src !== new URL(src, window.location.href).href) {
      kitchenAudioRef.current.pause(); kitchenAudioRef.current.src = src; kitchenAudioRef.current.load();
    }
    return kitchenAudioRef.current;
  };

  const playCentralKitchenAlarm = () => {
    if (!read('z_central_audio_device', false) && userRef.current?.role !== 'Dapur') return;
    try {
      const audio = ensureKitchenAudio(); audio.pause(); audio.currentTime = 0;
      audio.play().catch(err => console.warn('Audio dapur tidak dapat diputar:', err));
    } catch (err) { console.warn('Gagal memutar alarm dapur:', err); }
  };

  const previewKitchenAlarm = async () => {
    try {
      const audio = ensureKitchenAudio(); audio.pause(); audio.currentTime = 0;
      await audio.play();
    } catch (err) { flash('Suara belum bisa diputar. Coba aktifkan pusat audio terlebih dahulu.', 4500); }
  };

  const handleAlarmFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const audioExtensionOk = /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name || '');
    if (!(file.type || '').startsWith('audio/') && !audioExtensionOk) { flash('Pilih file audio seperti MP3, WAV, atau OGG.', 4000); return; }
    if (file.size > 15 * 1024 * 1024) { flash('Ukuran file suara maksimal 15 MB.', 4000); return; }
    setAlarmFileBusy(true);
    try {
      await saveAlarmFile(file, deviceId);
      const url = URL.createObjectURL(file);
      if (alarmAudioUrlRef.current) URL.revokeObjectURL(alarmAudioUrlRef.current);
      alarmAudioUrlRef.current = url; alarmAudioNameRef.current = file.name;
      setCustomAlarmName(file.name);
      if (kitchenAudioRef.current) { kitchenAudioRef.current.pause(); kitchenAudioRef.current.src = url; kitchenAudioRef.current.load(); }
      flash('File suara berhasil disimpan di perangkat ini.', 4000);
    } catch (err) { flash('Gagal menyimpan suara: ' + (err?.message || 'kesalahan penyimpanan'), 5000); }
    finally { setAlarmFileBusy(false); }
  };

  const resetAlarmFile = async () => {
    setAlarmFileBusy(true);
    try {
      await deleteAlarmFile(deviceId);
      if (alarmAudioUrlRef.current) URL.revokeObjectURL(alarmAudioUrlRef.current);
      alarmAudioUrlRef.current = null; alarmAudioNameRef.current = 'kitchen-alarm.mp3';
      setCustomAlarmName('kitchen-alarm.mp3');
      if (kitchenAudioRef.current) { kitchenAudioRef.current.pause(); kitchenAudioRef.current.src = '/kitchen-alarm.mp3'; kitchenAudioRef.current.load(); }
      flash('Suara dikembalikan ke alarm bawaan.', 3500);
    } catch (err) { flash('Gagal mengembalikan suara bawaan: ' + (err?.message || ''), 4500); }
    finally { setAlarmFileBusy(false); }
  };

  // Bunyikan alarm dapur: lokal (jika perangkat ini pusat audio) + kirim sinyal ke perangkat pusat audio.
  const signalKitchenPrint = () => {
    playCentralKitchenAlarm();
    try {
      liveChannelRef.current?.send({
        type: 'broadcast',
        event: 'kitchen-print',
        payload: { at: Date.now(), by: userRef.current?.username || null }
      });
    } catch (e) { console.warn('Gagal mengirim sinyal alarm dapur:', e); }
  };

  // Semua cetak TIKET DAPUR lewat sini: bunyi dikirim bersamaan dengan perintah cetak.
  const sendPrint = (order, type, url) => {
    if (type === 'kitchen') signalKitchenPrint();
    return sendPrintJob(order, type, url);
  };

  const activateCentralAudio = async () => {
    try {
      const audio = ensureKitchenAudio();
      // Pemutaran dari klik pengguna membuka izin audio browser untuk sesi ini.
      await audio.play();
      setCentralAudioReady(true);
      setCentralAudioDevice(true);
      write('z_central_audio_device', true);
      flash('Perangkat berhasil diaktifkan sebagai pusat audio dapur.', 4500);
    } catch (err) {
      setCentralAudioReady(false);
      flash('Audio belum bisa diputar. Periksa file suara dan volume perangkat, lalu coba lagi.', 6500);
      console.error(err);
    }
  };

  const disableCentralAudio = () => {
    setCentralAudioDevice(false);
    setCentralAudioReady(false);
    write('z_central_audio_device', false);
    if (kitchenAudioRef.current) kitchenAudioRef.current.pause();
    flash('Perangkat ini tidak lagi menjadi pusat audio.', 3000);
  };

  const flash = (msg, ms = 5000, action = null) => {
    clearTimeout(toastTimer.current);
    const payload = typeof msg === 'string'
      ? { title: msg, body: '', type: 'info' }
      : { title: msg?.title || 'Informasi Zayga POS', body: msg?.body || '', type: msg?.type || 'info' };
    setToast({ ...payload, action });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  // [FIX #8] Catatan audit: siapa mengubah apa. Gagal mencatat tidak boleh menghalangi kerja kasir.
  const logAudit = (orderId, action, detail = {}) => {
    const u = userRef.current;
    supabase.from('order_audit')
      .insert([{ order_id: orderId, action, detail, by_user: u?.username || null, role: u?.role || null }])
      .then(({ error }) => { if (error) console.error('Audit gagal dicatat:', error.message); });
  };

  const fetchData = async () => {
    try {
      const [resUsers, resMenu, resOrders, resLogs, resSettings, resShifts] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('menu_items').select('*'),
        supabase.from('orders').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('clear_logs').select('*'),
        supabase.from('app_settings').select('*').eq('key', 'print_url').maybeSingle(),
        supabase.from('shift_closings').select('*').order('id', { ascending: false }).limit(60)
      ]);
      if (resUsers.data && resUsers.data.length > 0) {
        setUsersList(resUsers.data);
        write('z_users_cache', resUsers.data);
      }
      // Sinkronisasi aman data menu standar:
      // - Tidak menghapus menu yang sudah ada.
      // - Tidak menimpa harga/stok/status menu yang sudah ada.
      // - Mengembalikan menu standar yang tidak sengaja terhapus dari Supabase.
      // - Menu varian suhu (Panas/Dingin) tetap disimpan sebagai data sumber agar
      //   harga masing-masing suhu dapat digabungkan di tampilan Pesanan.
      if (!resMenu.error) {
        const remoteMenu = Array.isArray(resMenu.data) ? resMenu.data : [];
        const normMenuName = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const existingNames = new Set(remoteMenu.map(x => normMenuName(x.name)));
        const missingDefaults = DEFAULT_MENU_ITEMS.filter(x => !existingNames.has(normMenuName(x.name)));

        let restoredMenu = [];
        if (missingDefaults.length > 0) {
          const payload = missingDefaults.map(({ name, category, price, active }) => ({
            name, category, price, active: active !== false
          }));
          const { data: inserted, error: insertError } = await supabase
            .from('menu_items').insert(payload).select('*');
          if (!insertError && Array.isArray(inserted)) {
            restoredMenu = inserted;
          } else if (insertError) {
            console.error('Pemulihan sebagian menu standar gagal:', insertError.message);
          }
        }

        const combinedMenu = [...remoteMenu, ...restoredMenu];
        // Bila tabel benar-benar kosong dan proses insert gagal, tampilkan data
        // standar dari konstanta agar halaman kasir tetap dapat dibuka.
        const finalMenu = combinedMenu.length ? combinedMenu : DEFAULT_MENU_ITEMS;
        setItems(finalMenu);
        write('z_items_cache', finalMenu);
      } else {
        console.error('Gagal membaca menu Supabase:', resMenu.error.message);
      }
      if (resOrders.data) setOrders(withQueue(resOrders.data));
      if (resLogs.data) setClearLogs(resLogs.data);
      if (resShifts.data) setShifts(resShifts.data);
      if (resSettings.data && resSettings.data.value) setServerPrintUrl(resSettings.data.value);
    } catch (err) {
      console.error('Gagal mengambil data dari Supabase:', err.message);
    }
  };

  const queueOrder = (o) => { const q = read('z_queue', []); q.push(o); write('z_queue', q); setQueueCount(q.length); };

  // [FIX #5] Antrean offline.
  const flushQueue = async () => {
    const q = read('z_queue', []);
    if (!q.length || flushing.current || !navigator.onLine) return;
    flushing.current = true;
    const left = [];
    const readyToPrint = [];
    const idChanges = {};
    let sent = 0;
    for (const o of q) {
      const { _queued, ...row0 } = o;
      let row = row0, ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        const { error } = await supabase.from('orders').insert([row]);
        if (!error) { ok = true; break; }
        if (isDupErr(error)) {
          const { data: ex, error: exErr } = await supabase.from('orders').select('id,created_at,cashier').eq('id', row.id).maybeSingle();
          if (exErr) break; // belum bisa memastikan, biarkan di antrean
          if (ex && ex.cashier === row.cashier && Date.parse(ex.created_at) === Date.parse(row.created_at)) { ok = true; break; } // memang pesanan yang sama
          row = { ...row, id: genOrderId() }; // ID bentrok dengan pesanan lain: ganti ID
          continue;
        }
        break; // error lain: biarkan di antrean
      }
      if (ok) {
        sent++;
        readyToPrint.push(row);
        if (row.id !== row0.id) idChanges[row0.id] = row.id;
        consumeStock(row.items || []);
      } else left.push(o);
    }
    write('z_queue', left); setQueueCount(left.length); flushing.current = false;
    if (sent) {
      flash(`${sent} pesanan offline berhasil terkirim. Mencetak tiket dapur...`);
      setOrders(prev => prev.map(x => {
        if (!x._queued) return x;
        if (left.some(l => l.id === x.id)) return x;
        const { _queued, ...r } = x;
        return idChanges[x.id] ? { ...r, id: idChanges[x.id] } : r;
      }));
      for (const order of readyToPrint) await autoPrint(order);
    }
  };

  useEffect(() => {
    fetchData(); flushQueue();
    const on = () => { setOnline(true); flushQueue(); fetchData(); };
    const off = () => setOnline(false);
    const vis = () => { if (document.visibilityState === 'visible') fetchData(); };
    window.addEventListener('online', on); window.addEventListener('offline', off); document.addEventListener('visibilitychange', vis);
    const iv = setInterval(() => { if (read('z_queue', []).length) flushQueue(); }, 20000);
    const tk = setInterval(() => setTick(t => t + 1), 30000);
    const clockTimer = setInterval(() => setKdsTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', vis);
      clearInterval(iv); clearInterval(tk); clearInterval(clockTimer);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('zayga-live', { config: { broadcast: { self: false } } })
      // Sinyal alarm dari perangkat yang sedang mencetak tiket dapur
      .on('broadcast', { event: 'kitchen-print' }, () => {
        playCentralKitchenAlarm();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => {
        if (p.eventType === 'INSERT') {
          const n = p.new;
          if (n.deleted_at) return;
          const exists = ordersRef.current.some(x => x.id === n.id);
          setOrders(o => o.some(x => x.id === n.id) ? o : [n, ...o]);

          // Bunyikan alarm di HP Dapur atau perangkat Pusat Audio
          if (centralAudioDeviceRef.current || userRef.current?.role === 'Dapur') {
            playCentralKitchenAlarm();
          }

          // Otomatis cetak tiket dapur jika HP ini adalah Pusat Cetak Kasir
          if (isPrintStationRef.current && !n.kitchen_printed) {
            autoPrint(n);
          }

          // Notifikasi visual tetap boleh tampil pada perangkat lain
          if (!exists && n.cashier !== userRef.current?.username) {
            const msgTitle = userRef.current?.role === 'Dapur' ? 'PESANAN BARU MASUK!' : `Pesanan baru ${locLabel(n.location)}`;
            const msgBody = `${locLabel(n.location)} · Oleh: ${n.cashier} · ${(n.items || []).length} item`;
            flash({ title: msgTitle, body: msgBody, type: 'order' }, 8000);
            try {
              if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(msgTitle, { body: msgBody, tag: `zayga-new-${n.id}`, renotify: true });
              }
            } catch (e) {
              console.error('Gagal menampilkan push notification:', e);
            }
          }
        } else if (p.eventType === 'UPDATE') {
          const n = p.new;
          // [FIX #2] Soft delete datang sebagai UPDATE: keluarkan dari daftar lokal
          if (n.deleted_at) {
            setOrders(o => o.filter(x => x.id !== n.id));
            return;
          }
          const prev = ordersRef.current.find(x => x.id === n.id);
          setOrders(o => o.map(x => x.id === n.id ? { ...x, ...n } : x));

          // Otomatis cetak tiket menu tambahan di Pusat Cetak jika ada penambahan item baru
          if (isPrintStationRef.current && !n.kitchen_printed && prev && (n.items || []).length > (prev.items || []).length) {
            const addedItems = (n.items || []).slice((prev.items || []).length);
            if (addedItems.length > 0) {
              const additionOrder = {
                ...n,
                id: `${n.id}-T${Date.now().toString().slice(-4)}`,
                items: addedItems,
                isAddition: true,
                queueNo: computeQueueNo(n, ordersRef.current)
              };
              autoPrint(additionOrder);
            }
          }

          const isFrontStaff = userRef.current?.role !== 'Dapur';
          if (isFrontStaff) {
            const prevItems = prev?.items || [];
            const newlyReady = (n.items || []).filter((it, i) => itemSt(it) === 'Siap' && itemSt(prevItems[i] || {}) !== 'Siap');
            const isFullReady = n.order_status === 'Siap' && prev?.order_status !== 'Siap';

            if (isFullReady || newlyReady.length > 0) {
              beep(660, 0.22, 3);
              buzz([150, 80, 150, 80, 250]);
              const itemNames = newlyReady.length ? newlyReady.map(i => i.name).join(', ') : 'Seluruh menu';
              const readyMsg = `🔔 SIAP DIANTAR: ${locLabel(n.location)} · ${itemNames} (${n.customer || 'Umum'})`;
              flash({ title: 'Pesanan siap diantar', body: `${locLabel(n.location)} · ${itemNames} · ${n.customer || 'Umum'}`, type: 'ready' }, 10000);

              try {
                if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(`Pesanan Siap Diantar! · ${locLabel(n.location)}`, {
                    body: `Menu: ${itemNames} · Pelanggan: ${n.customer || 'Umum'}`,
                    tag: `zayga-ready-${n.id}`,
                    renotify: true
                  });
                }
              } catch {}
            }
          }
          delete localStatus.current[n.id];
        } else if (p.eventType === 'DELETE') {
          setOrders(o => o.filter(x => x.id !== p.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, p => {
        if (p.eventType === 'DELETE') {
          setItems(it => {
            const next = it.filter(x => x.id !== p.old.id);
            write('z_items_cache', next);
            return next;
          });
        } else {
          setItems(it => {
            const next = it.some(x => x.id === p.new.id) ? it.map(x => x.id === p.new.id ? { ...x, ...p.new } : x) : [...it, p.new];
            write('z_items_cache', next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, p => {
        if (p.eventType === 'DELETE') {
          setUsersList(ul => {
            const next = ul.filter(x => x.username !== p.old.username);
            write('z_users_cache', next);
            return next;
          });
        } else {
          setUsersList(ul => {
            const next = ul.some(x => x.username === p.new.username)
              ? ul.map(x => x.username === p.new.username ? { ...x, ...p.new } : x)
              : [...ul, p.new];
            write('z_users_cache', next);
            return next;
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
        }
      });
    liveChannelRef.current = ch;
    return () => { liveChannelRef.current = null; supabase.removeChannel(ch); };
  }, [user?.username]);

  // Fallback polling periodik
  useEffect(() => {
    if (!user) return;
    const pollId = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        const { data } = await supabase.from('orders').select('*').is('deleted_at', null).order('created_at', { ascending: false });
        if (data) {
          setOrders(prev => {
            const prevMap = new Map(prev.map(p => [p.id, p]));
            const isKitchen = userRef.current?.role === 'Dapur';
            const isFrontStaff = !isKitchen;

            // 1. Pesanan baru yang terdeteksi lewat polling (alarm dapur kini dipicu saat cetak tiket dapur).
            const freshOrders = data.filter(d => !prevMap.has(d.id));
            if (isKitchen && freshOrders.length > 0) {
              flash(`PESANAN BARU MASUK (${freshOrders.length})`, 6000);
            }

            // 2. Kasir/Depan: deteksi pesanan atau item yang baru saja siap
            if (isFrontStaff) {
              const newlyReadyOrder = data.find(d => {
                const old = prevMap.get(d.id);
                if (!old) return false;
                const oldItems = old.items || [];
                const hasNewReadyItem = (d.items || []).some((it, i) => itemSt(it) === 'Siap' && itemSt(oldItems[i] || {}) !== 'Siap');
                const wasNotReady = old.order_status !== 'Siap' && d.order_status === 'Siap';
                return wasNotReady || hasNewReadyItem;
              });

              if (newlyReadyOrder) {
                beep(660, 0.22, 3);
                buzz([150, 80, 150, 80, 250]);
                flash(`🔔 SIAP DIANTAR: ${locLabel(newlyReadyOrder.location)} (${newlyReadyOrder.customer || 'Umum'})`, 10000);
              }
            }

            // Pesanan yang masih di antrean offline tidak boleh hilang dari tampilan
            return withQueue(data);
          });
          setRealtimeConnected(true);
        }
      } catch (e) {
        // silent
      }
    }, 9000);
    return () => clearInterval(pollId);
  }, [user?.username]);

  useEffect(() => {
    if (!selectedOrder) return;
    const f = orders.find(o => o.id === selectedOrder.id);
    if (!f) setSelectedOrder(null); else if (f !== selectedOrder) setSelectedOrder(f);
  }, [orders]);

  useEffect(() => {
    if (user?.role === 'Dapur' && page !== 'Antrian' && page !== 'Pengaturan') setPage('Antrian');
    if (user?.role === 'Kasir' && ['Dashboard', 'Kelola Menu'].includes(page)) setPage('Pesanan');
  }, [user?.role]);

  useEffect(() => { setServerDraft(serverPrintUrl); }, [serverPrintUrl]);
  const activePrintUrl = serverPrintUrl.trim() || localPrintUrl.trim() || 'http://localhost:9100';
  // Ref agar fungsi yang dipanggil dari effect lama (antrean offline) tidak memakai URL basi
  const printUrlRef = useRef(activePrintUrl); printUrlRef.current = activePrintUrl;

  useEffect(() => { if (page === 'Pengaturan') refreshPrinter(); }, [page, activePrintUrl]);
  useEffect(() => { if (paid === '') setPaidRaw(''); }, [paid]);
  useEffect(() => { localStorage.setItem('z_round', String(roundTo)); }, [roundTo]);
  useEffect(() => {
    const calc = () => {
      const el = document.querySelector('.topbar');
      if (!el) return setStickyTop(0);
      const pos = getComputedStyle(el).position;
      setStickyTop(pos === 'sticky' || pos === 'fixed' ? Math.round(el.getBoundingClientRect().height) : 0);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [user, page]);

  // ============ Setup Print Relay via Supabase Broadcast ============
  // Semua perangkat bergabung ke channel yang sama.
  // Perangkat yang punya BT aktif: mencetak job yang dikirim perangkat lain.
  // Perangkat tanpa BT: hanya mengirim job, tidak mencetak.
  useEffect(() => {
    if (!user) return;

    // Tutup channel lama jika ada
    if (printRelayChannel) {
      supabase.removeChannel(printRelayChannel);
      printRelayChannel = null;
    }

    const ch = supabase.channel(PRINT_RELAY_CHANNEL, {
      config: { broadcast: { self: false } }
    });

    ch.on('broadcast', { event: 'print_job' }, async ({ payload }) => {
      // Hanya perangkat yang benar-benar memiliki koneksi Bluetooth yang boleh mengambil job.
      if (!payload?.jobId || !Array.isArray(payload.bytesArr)) return;
      if (globalBleDevice && !globalBleDevice.gatt?.connected && bleReconnectHook) {
        await bleReconnectHook(2);
      }
      if (!globalBleCharacteristic || !globalBleDevice || !globalBleDevice.gatt?.connected) return;

      try {
        await printViaWebBluetooth(new Uint8Array(payload.bytesArr));
        await ch.send({
          type: 'broadcast',
          event: 'print_done',
          payload: {
            jobId: payload.jobId,
            ok: true,
            printer: globalBleDevice?.name || 'Printer Bluetooth'
          }
        });
      } catch (err) {
        console.error('Relay print gagal:', err);
        await ch.send({
          type: 'broadcast',
          event: 'print_done',
          payload: { jobId: payload.jobId, ok: false, error: err?.message || 'Gagal mencetak melalui Bluetooth.' }
        });
      }
    });

    ch.on('broadcast', { event: 'print_done' }, ({ payload }) => {
      if (!payload?.jobId) return;
      const pending = pendingPrintJobs.get(payload.jobId);
      if (pending) pending.resolve(payload);
    });

    printRelayChannel = ch;
    printRelayReady = false;
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        printRelayReady = true;
        console.info('Zayga Print Relay siap.');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        printRelayReady = false;
        console.warn('Zayga Print Relay tidak siap:', status);
      }
    });

    return () => {
      printRelayReady = false;
      for (const [jobId, pending] of pendingPrintJobs.entries()) {
        pending.reject(new Error('Koneksi Print Relay terputus. Silakan coba cetak kembali.'));
        pendingPrintJobs.delete(jobId);
      }
      supabase.removeChannel(ch);
      if (printRelayChannel === ch) printRelayChannel = null;
    };
  }, [user]);

  useEffect(() => {
    if (addingToOrder) return;
    write('z_drafts', { draftId, drafts: drafts.map(d => d.id === draftId ? { id: draftId, cart, customer, location, notes, discount } : d) });
  }, [cart, customer, location, notes, discount, drafts, draftId, addingToOrder]);

  // ============ Presence: siapa yang terhubung ke printer & suara ============
  const deviceInfo = {
    deviceId, deviceName,
    username: user?.username || null, role: user?.role || null,
    printer: bleConnected ? (bleDeviceName || 'Printer Bluetooth') : null,
    audio: !!centralAudioDevice || user?.role === 'Dapur',
  };
  const deviceInfoRef = useRef(deviceInfo); deviceInfoRef.current = deviceInfo;

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('zayga-devices', { config: { presence: { key: deviceId } } });
    ch.on('presence', { event: 'sync' }, () => {
      const list = Object.values(ch.presenceState()).map(a => a[a.length - 1]).filter(Boolean);
      setDevicePeers(list);
    }).subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        presenceReadyRef.current = true;
        try { await ch.track({ ...deviceInfoRef.current, at: Date.now() }); } catch {}
      } else presenceReadyRef.current = false;
    });
    presenceChRef.current = ch;
    return () => { presenceReadyRef.current = false; presenceChRef.current = null; supabase.removeChannel(ch); setDevicePeers([]); };
  }, [user?.username, deviceId]);

  // Kirim ulang status saat printer / audio / nama berubah
  useEffect(() => {
    if (presenceReadyRef.current && presenceChRef.current) {
      Promise.resolve(presenceChRef.current.track({ ...deviceInfoRef.current, at: Date.now() })).catch(() => {});
    }
  }, [deviceName, bleConnected, bleDeviceName, centralAudioDevice, user?.role, user?.username]);

  // Sambung ulang otomatis saat aplikasi kembali dibuka
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

  const renameDevice = (name) => { setDeviceName(name); write('z_device_name', name); flash('Nama perangkat disimpan.', 2500); };
  const allNavItems = [
    [LayoutDashboard, 'Dashboard', ['Admin']],
    [ShoppingCart, 'Pesanan', ['Admin', 'Kasir']],
    [LayoutGrid, 'Denah', ['Admin', 'Kasir']],
    [ChefHat, 'Antrian', ['Admin', 'Kasir', 'Dapur']],
    [ClipboardList, 'Riwayat', ['Admin', 'Kasir']],
    [Lock, 'Tutup Kasir', ['Admin']],
    [Utensils, 'Kelola Menu', ['Admin']],
    [Settings, 'Pengaturan', ['Admin', 'Kasir', 'Dapur']]
  ];
  const visibleNavItems = allNavItems.filter(([_, __, roles]) => user && roles.includes(user.role));
  const categories = ['Semua', 'Snack', 'Mie', 'Popmie', 'Nasi', 'Minuman', 'Kopi', 'Soft Drink'];

  const todays = orders.filter(o => o?.date === today);
  const siapCount = todays.filter(o => statusOf(o) !== 'Diantar' && (o?.items || []).some(i => itemSt(i) === 'Siap')).length;
  const queueMap = useMemo(() => buildQueueMap(orders), [orders]);
  const qLabel = o => fmtQueue(queueMap.get(o?.id) || computeQueueNo(o, orders));

  const favNames = useMemo(() => {
    const c = {};
    (orders || []).forEach(o => (o?.items || []).forEach(i => { const n = baseName(i.name); if (i.category !== 'Bakso') c[n] = (c[n] || 0) + i.qty; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  }, [orders]);
  const menuTabs = [...(favNames.length ? ['Favorit'] : []), ...categories, 'Bakso'];

  const filtered = useMemo(() => {
    const active = (items || []).filter(x => x.active && (category === 'Semua' || category === 'Favorit' || x.category === category));
    // Menu lama yang berupa topping tidak lagi menjadi item terpisah.
    const clean = active.filter(x => !LEGACY_TOPPING_NAME.test(String(x.name || '').trim()) && !isLegacyMilkVariant(x, items));
    const consumed = new Set();
    const merged = [];

    MENU_TEMPERATURES.forEach(config => {
      const names = [config.name, ...config.aliases].map(normalizeMenuText);
      const members = clean.filter(x => x.category === config.category && names.includes(normalizeMenuText(x.name)));
      if (!members.length) return;
      members.forEach(x => consumed.add(String(x.id)));
      const canonical = members.find(x => normalizeMenuText(x.name) === normalizeMenuText(config.name));
      const base = canonical || members.find(x => / panas$/i.test(x.name)) || members[0];
      const prices = { ...config.prices };
      members.forEach(x => {
        const suffix = String(x.name).match(/\s+(Panas|Hangat|Dingin)$/i);
        if (suffix) prices[suffix[1].toLowerCase()] = Number(x.price || 0);
      });
      merged.push({ ...base, name: config.name, price: prices.panas ?? base.price, _temperaturePrices: prices, _temperatureMembers: members, _isGroupedMenu: true });
    });

    clean.forEach(x => {
      if (!consumed.has(String(x.id))) merged.push(x);
    });
    let result = merged.filter(x => String(x.name || '').toLowerCase().includes(query.toLowerCase()));
    if (category === 'Favorit') result = result.filter(x => favNames.includes(x.name) || favNames.includes(baseName(x.name))).sort((a, b) => favNames.indexOf(a.name) - favNames.indexOf(b.name));
    return result;
  }, [items, category, query, favNames]);

  // Tampilan Kelola Menu: satukan varian suhu dan sembunyikan menu topping lama.
  // Data asli tetap disimpan sampai Admin memilih Hapus pada grup terkait.
  const adminMenuItems = useMemo(() => {
    const source = [...(items || [])];
    const clean = source.filter(x => !LEGACY_TOPPING_NAME.test(String(x.name || '').trim()) && !isLegacyMilkVariant(x, source));
    const consumed = new Set();
    const result = [];

    MENU_TEMPERATURES.forEach(config => {
      const names = [config.name, ...config.aliases].map(normalizeMenuText);
      const members = clean.filter(x => x.category === config.category && names.includes(normalizeMenuText(x.name)));
      if (!members.length) return;
      members.forEach(x => consumed.add(String(x.id)));
      const canonical = members.find(x => normalizeMenuText(x.name) === normalizeMenuText(config.name));
      const base = canonical || members.find(x => / panas$/i.test(x.name)) || members[0];
      const prices = { ...config.prices };
      members.forEach(x => {
        const suffix = String(x.name).match(/\s+(Panas|Hangat|Dingin)$/i);
        if (suffix) prices[suffix[1].toLowerCase()] = Number(x.price || 0);
      });
      result.push({ ...base, name: config.name, price: prices.panas ?? base.price, _temperaturePrices: prices, _temperatureMembers: members, _legacyIds: members.map(x => x.id), _isGroupedMenu: true });
    });

    clean.forEach(x => {
      if (!consumed.has(String(x.id))) result.push(x);
    });
    return result.sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)));
  }, [items]);

  const showBakso = (category === 'Semua' || category === 'Bakso') && 'bakso'.includes(query.trim().toLowerCase());

  const tableInfo = useMemo(() => {
    const m = {};
    todays.forEach(o => { const k = normLoc(o?.location); (m[k] = m[k] || []).push(o); });
    return m;
  }, [orders, today]);

  const noteChips = useMemo(() => {
    if (!noteItem) return [];
    const menuKey = getNoteMenuKey(noteItem);
    const defaults = getNotePresets(noteItem);
    const learned = Object.entries(noteStats[menuKey] || {})
      .filter(([label]) => label && !defaults.includes(label))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label]) => label);
    return [...new Set([...defaults, ...learned])];
  }, [noteItem, noteStats]);

  const subtotal = sumItems(cart);
  const discNum = Number(discount.value) || 0;
  const discAmt = addingToOrder ? 0 : Math.min(subtotal, discount.type === 'pct' ? Math.round(subtotal * Math.min(discNum, 100) / 100) : discNum);
  const netTotal = subtotal - discAmt;
  const roundAmt = (showPay && !settling && !addingToOrder && payment === 'Tunai' && roundTo) ? Math.ceil(netTotal / roundTo) * roundTo - netTotal : 0;
  const grand = netTotal + roundAmt;

  // [FIX #6] Saat menambah item ke bon lama, tagihan tambahan = total baru - total lama
  const additionBase = addingToOrder ? (orders.find(o => o.id === addingToOrder.id) || addingToOrder) : null;
  const additionCalc = additionBase ? computeAddition(additionBase, cart) : null;
  const addDue = additionCalc ? additionCalc.addDue : 0;
  const payDue = settling ? remainOf(settling) : addingToOrder ? addDue : grand;
  const shownTotal = addingToOrder ? addDue : netTotal;

  const qtyOf = (item) => cart.filter(x => {
    const id = String(x.id), base = String(item.id);
    return id === base || id.startsWith(base + '-') || id.startsWith(base + '~');
  }).reduce((sum, x) => sum + x.qty, 0);
  const baksoQty = cart.filter(x => String(x.id).startsWith(BAKSO_ID + '-')).reduce((sum, x) => sum + x.qty, 0);
  const cartQty = cart.reduce((sum, x) => sum + x.qty, 0);

  const snapshot = () => ({ id: draftId, cart, customer, location, notes, discount });
  const view = drafts.map(d => d.id === draftId ? snapshot() : d);
  const loadDraft = d => { setCart(d.cart); setCustomer(d.customer); setLocation(d.location); setNotes(d.notes); setDiscount(d.discount || { type: 'rp', value: '' }); setDraftId(d.id); };
  const switchDraft = id => {
    if (id === draftId || addingToOrder) return;
    const t = drafts.find(d => d.id === id); if (!t) return;
    setDrafts(view); loadDraft(t);
  };
  const addDraft = () => {
    if (addingToOrder) return;
    const d = newDraft();
    setDrafts([...view, d]); loadDraft(d); setInfoOpen(true);
  };
  const closeDraft = () => {
    const rest = view.filter(d => d.id !== draftId);
    if (rest.length) { setDrafts(rest); loadDraft(rest[0]); }
    else { const d = newDraft(); setDrafts([d]); loadDraft(d); }
  };
  const removeDraft = () => {
    if (cart.length && !window.confirm('Hapus draf pesanan ini beserta isinya?')) return;
    closeDraft();
  };
  const draftLabel = (d, i) => d.location.trim() ? locLabel(d.location) : `Draf ${i + 1}`;

  const startNewAt = (loc) => {
    setTableSheet(null);
    const cur = snapshot();
    if (!cur.cart.length && !cur.location.trim()) setLocation(loc);
    else { const d = { ...newDraft(), location: loc }; setDrafts([...view, d]); loadDraft(d); }
    setPage('Pesanan');
  };

  const goPay = () => {
    if (!location.trim()) { flash('Pilih meja dulu sebelum membayar.', 3000); setInfoOpen(true); return; }
    setPayment('Tunai'); setPaid(''); setNewSplitPayRows(newSplitRows()); setSplitManual(false);
    setSplitMenuPayers([{ name: '', method: 'Tunai', received: '' }, { name: '', method: 'QRIS', received: '' }]); setSplitMenuAssign({});
    setShowPay(true);
  };
  const openSplitMenu = () => setShowSplitMenu(true);

  const add = (item) => {
    if (item.sold_out) { flash(`${item.name} sedang habis.`, 2500); return; }
    if (item.stock != null && qtyOf(item) >= item.stock) { flash(`Stok ${item.name} tinggal ${item.stock}.`, 3000); return; }
    const isDrink = ['Minuman', 'Kopi'].includes(item.category) || !!item._temperaturePrices;
    const isMie = /mie|mi /i.test(`${item.category} ${item.name}`);
    const hasAddons = MENU_ADDONS.some(a => a.categories.includes(item.category));
    if (isDrink || isMie || hasAddons) {
      setVariantTemp(''); setVariantMilk(false); setVariantNum(1); setVariantAdded([]);
      setVariantToppings([]); setVariantSpice('Normal');
      setSelectedItemForVariant(item);
    } else addToCartDirect(item, false);
  };

  const addToCartDirect = (item, pakaiSusu = false, suhu = '', qty = 1, toppings = [], spice = '') => {
    const amount = Math.max(0, Number(qty) || 0);
    if (!amount) return;
    const addonTotal = (toppings || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
    const milkExtra = pakaiSusu ? (normalizeMenuText(item.name) === 'teh hijau' ? 2000 : 3000) : 0;
    const finalPrice = Number((suhu && item._temperaturePrices?.[suhu.toLowerCase()] != null)
      ? item._temperaturePrices[suhu.toLowerCase()]
      : item.price) + milkExtra + addonTotal;
    const addonLabels = (toppings || []).map(a => a.label);
    if (spice && spice !== 'Normal' && /mie|mi /i.test(`${item.category} ${item.name}`)) addonLabels.push(spice);
    const note = [
      suhu ? `Suhu: ${suhu}` : '',
      pakaiSusu ? 'Pakai susu' : '',
      addonLabels.length ? `Tambahan: ${addonLabels.join(', ')}` : ''
    ].filter(Boolean).join(' · ');
    const optionKey = [suhu, pakaiSusu ? 'susu' : '', ...(toppings || []).map(a => a.id), spice && spice !== 'Normal' ? spice : ''].filter(Boolean).join('-');
    const finalId = `${item.id}${optionKey ? `~${optionKey.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}` : ''}`;
    buzz();
    setCart(old => {
      const found = old.find(x => x.id === finalId);
      return found
        ? old.map(x => x.id === finalId ? { ...x, qty: x.qty + amount } : x)
        : [...old, {
            id: finalId, menuId: item.id, name: item.name, category: item.category,
            price: finalPrice, qty: amount, item_status: 'Baru',
            ...(note ? { optionNote: note } : {}),
            ...(toppings?.length ? { addons: toppings.map(a => ({ id: a.id, label: a.label, price: a.price })) } : {}),
            ...(suhu ? { temperature: suhu } : {}),
            ...(pakaiSusu ? { milk: true } : {})
          }];
    });
  };

  const addVariantOne = () => {
    const item = selectedItemForVariant;
    if (!item) return;
    const isDrink = ['Minuman', 'Kopi'].includes(item.category) || !!item._temperaturePrices;
    if (isDrink && !variantTemp) { flash('Pilih suhu dulu: Panas, Hangat, atau Dingin.', 2500); return; }
    const qty = Math.max(1, Number(variantNum) || 1);
    if (item.stock != null && qtyOf(item) + qty > item.stock) {
      flash(`Stok ${item.name} hanya tersisa ${Math.max(0, item.stock - qtyOf(item))}.`, 3500);
      return;
    }
    const toppings = MENU_ADDONS.filter(a => variantToppings.includes(a.id));
    addToCartDirect(item, variantMilk, variantTemp, qty, toppings, variantSpice);
    const desc = [
      variantTemp,
      variantMilk ? 'Susu' : '',
      ...toppings.map(a => `${a.label} +${money(a.price)}`),
      variantSpice !== 'Normal' ? variantSpice : ''
    ].filter(Boolean).join(' · ');
    setVariantAdded(list => [...list, `${qty}× ${desc || item.name}`]);
    setVariantTemp(''); setVariantMilk(false); setVariantNum(1);
    setVariantToppings([]); setVariantSpice('Normal');
  };

  const openBakso = () => { setBaksoPrice(''); setBaksoName(''); setBaksoOpen(true); };
  const addBakso = () => {
    const price = Number(baksoPrice);
    if (!price || price <= 0) { flash('Harga bakso wajib diisi.', 3000); return; }
    const ket = baksoName.trim();
    const name = ket ? `Bakso ${ket}` : 'Bakso';
    const id = `${BAKSO_ID}-${price}-${name.toLowerCase().replace(/\s+/g, '_')}`;
    buzz();
    setCart(old => {
      const found = old.find(x => x.id === id);
      return found
        ? old.map(x => x.id === id ? { ...x, qty: x.qty + 1 } : x)
        : [...old, { id, name, category: 'Bakso', price, qty: 1, custom: true, item_status: 'Baru' }];
    });
    setBaksoOpen(false);
  };

  const changeQty = (id, delta) => {
    const curItem = cart.find(x => x.id === id);
    if (!curItem) return;
    if (curItem.qty + delta <= 0) {
      const idx = cart.findIndex(x => x.id === id);
      setCart(old => old.filter(x => x.id !== id));
      flash(`${curItem.name} dihapus.`, 5000, { label: 'Urungkan', fn: () => setCart(old => { if (old.some(x => x.id === id)) return old; const n = [...old]; n.splice(Math.min(idx, n.length), 0, curItem); return n; }) });
    } else setCart(old => old.map(x => x.id === id ? { ...x, qty: x.qty + delta } : x));
  };

  const decOne = (item) => {
    const base = String(item.id);
    const line = [...cart].reverse().find(c => { const id = String(c.id); return id === base || id.startsWith(base + '-') || id.startsWith(base + '~'); });
    if (line) changeQty(line.id, -1);
  };

  const pressStart = (item) => {
    lp.current.fired = false; clearTimeout(lp.current.t);
    lp.current.t = setTimeout(() => { lp.current.fired = true; buzz(30); setStockItem(item); setStockDraft(item.stock == null ? '' : String(item.stock)); }, 550);
  };
  const pressEnd = () => clearTimeout(lp.current.t);
  const tap = (item) => { if (lp.current.fired) { lp.current.fired = false; return; } add(item); };

  const saveStock = async (item, patch) => {
    const { error } = await supabase.from('menu_items').update(patch).eq('id', item.id);
    if (error) { flash('Gagal mengubah stok: ' + error.message); return; }
    setItems(prev => {
      const updated = prev.map(m => m.id === item.id ? { ...m, ...patch } : m);
      write('z_items_cache', updated);
      return updated;
    });
    setStockItem(null);
    flash(patch.sold_out ? `${item.name} ditandai habis.` : `Stok ${item.name} diperbarui.`, 3000);
  };

  // [FIX #1] Pengurangan stok dilakukan ATOMIK di server (RPC consume_stock).
  const consumeStock = async (cartItems) => {
    const used = {};
    (cartItems || []).forEach(c => { if (c.menuId != null) used[c.menuId] = (used[c.menuId] || 0) + (c.qty || 0); });
    const payload = Object.entries(used).map(([menu_id, qty]) => ({ menu_id: String(menu_id), qty }));
    if (!payload.length) return;
    const { data, error } = await supabase.rpc('consume_stock', { p_items: payload });
    if (error) { console.error('consume_stock gagal:', error.message); flash('Stok gagal diperbarui di server: ' + error.message, 6000); return; }
    if (Array.isArray(data) && data.length) {
      setItems(prev => prev.map(m => {
        const r = data.find(x => String(x.id) === String(m.id));
        return r ? { ...m, stock: r.stock, sold_out: r.sold_out } : m;
      }));
    }
  };

  const openItemNote = (x) => { setNoteItem(x); setNoteDraft(x.customNote || (!x.optionNote ? x.note : '') || ''); };
  const toggleNoteChip = (p) => setNoteDraft(d => {
    const parts = d.split(',').map(s => s.trim()).filter(Boolean);
    return (parts.includes(p) ? parts.filter(s => s !== p) : [...parts, p]).join(', ');
  });
  const saveItemNote = () => {
    const x = noteItem;
    if (!x) return;
    const text = noteDraft.trim();
    const stableId = String(x.id).split('~note-')[0];
    const newId = text ? `${stableId}~note-${text.toLowerCase().replace(/\s+/g, '_')}` : stableId;

    // Catat pilihan hanya pada menu yang sedang diedit.
    if (text) {
      const menuKey = getNoteMenuKey(x);
      const st = {
        ...noteStats,
        [menuKey]: { ...(noteStats[menuKey] || {}) }
      };
      text.split(',').map(s => s.trim()).filter(Boolean).forEach(p => {
        st[menuKey][p] = (st[menuKey][p] || 0) + 1;
      });
      setNoteStats(st);
      write('z_note_stats_by_menu', st);
    }

    setCart(old => {
      const c0 = old.find(c => c.id === x.id);
      if (!c0) return old;
      const rest = old.filter(c => c.id !== x.id);
      const dup = rest.find(c => c.id === newId);
      if (dup) return rest.map(c => c.id === newId ? { ...c, qty: c.qty + c0.qty } : c);
      return old.map(c => c.id === x.id ? { ...c0, id: newId, customNote: text } : c);
    });
    setNoteItem(null);
  };

  const startAddToOrder = (order) => {
    if (!stash.current) stash.current = snapshot();
    setAddingToOrder(order); setCart([]); setNotes('');
    setSelectedOrder(null); setTableSheet(null); setPage('Pesanan');
  };
  const exitAddition = () => {
    const s = stash.current; stash.current = null;
    setAddingToOrder(null);
    if (s) { setCart(s.cart); setCustomer(s.customer); setLocation(s.location); setNotes(s.notes); setDiscount(s.discount || { type: 'rp', value: '' }); }
    else { setCart([]); setNotes(''); }
  };
  const cancelAddToOrder = () => { exitAddition(); setCartOpen(false); setPage('Riwayat'); };

  const saveAdditionToOrder = async (method = 'Belum Bayar', tendered = 0) => {
    if (!addingToOrder || !cart.length) return;
    const base = orders.find(o => o.id === addingToOrder.id) || addingToOrder;
    // [FIX #6] diskon & total dihitung ulang dari subtotal baru
    const { merged, disc: newDisc, newTotal, addDue: due } = computeAddition(base, cart);
    const belumBayar = base.payment === 'Belum Bayar';
    const extraNote = notes.trim();
    const payNow = !belumBayar && method !== 'Belum Bayar';
    const amount = method === 'Tunai' ? Number(tendered || 0) : due;
    const newPaid = payNow ? (base.paid || 0) + amount : base.paid;
    const newChange = payNow ? (base.change || 0) + Math.max(0, amount - due) : base.change;
    const status = remainOf({ ...base, total: newTotal, paid: newPaid, change: newChange }) > 0 ? 'Belum Lunas' : 'Lunas';
    const patch = {
      ...(extraNote ? { notes: base.notes ? `${base.notes} | Tambahan: ${extraNote}` : `Tambahan: ${extraNote}` } : {}),
      items: merged, subtotal: sumItems(merged), discount: newDisc, total: newTotal,
      paid: newPaid, change: newChange, status,
      ...(payNow ? { payments: [...(base.payments || []), ledger(method, Math.min(amount, due), user.username)] } : {}),
      order_status: ['Siap', 'Diantar'].includes(statusOf(base)) ? 'Baru' : statusOf(base),
      kitchen_printed: false, customer_printed: false
    };
    const { error } = await supabase.from('orders').update(patch).eq('id', base.id);
    if (error) { flash('Gagal menambahkan item: ' + error.message, 5000); return; }

    let updated = { ...base, ...patch };
    const addedCart = cart;

    if (isPrintStation) {
      try {
        // Tiket tambahan memakai nomor antrian bon aslinya agar dapur tahu ini milik antrian yang mana
        await sendPrint(
          { ...base, id: `${base.id}-T${Date.now().toString().slice(-4)}`, items: addedCart, isAddition: true, notes: extraNote, queueNo: computeQueueNo(base, ordersRef.current) },
          'kitchen',
          activePrintUrl
        );
        const { error: printStatusError } = await supabase.from('orders').update({ kitchen_printed: true }).eq('id', base.id);
        if (printStatusError) throw new Error(`Tiket tercetak, tetapi status database gagal diperbarui: ${printStatusError.message}`);
        updated = { ...updated, kitchen_printed: true };
        flash(`Tambahan ${locLabel(base.location)} tersimpan & tiket dapur tercetak.`, 6000);
      } catch (err) {
        flash(`Tambahan ${locLabel(base.location)} tersimpan, tapi cetak dapur gagal: ${err.message}`, 8000);
      }
    } else {
      flash(`Tambahan ${locLabel(base.location)} tersimpan & dikirim ke kasir/dapur.`, 4000);
    }
    consumeStock(addedCart);
    setOrders(prev => prev.map(o => o.id === base.id ? updated : o));
    exitAddition(); setCartOpen(false); setPage('Riwayat'); setSelectedOrder(updated);
  };

  const closePay = () => { setShowPay(false); setSettling(null); };

  const startSaveAddition = () => {
    if (!addingToOrder || !cart.length) return;
    const base = orders.find(o => o.id === addingToOrder.id) || addingToOrder;
    if (base.payment === 'Belum Bayar') { saveAdditionToOrder('Belum Bayar', 0); return; }
    setPayment('Tunai'); setPaid(''); setShowPay(true);
  };
  const confirmAdditionPayment = async () => {
    if (payment === 'Tunai' && Number(paid || 0) < addDue) { flash('Uang diterima masih kurang.', 3000); return; }
    const method = payment, tendered = Number(paid || 0);
    setShowPay(false); setPaid('');
    await saveAdditionToOrder(method, tendered);
  };

  const openSettle = (o) => { setSettling(o); setPayment('Tunai'); setPaid(''); setPartialAmt(''); setShowPay(true); };
  const confirmSettle = async () => {
    const o = settling;
    if (!o || payment === 'Belum Bayar') return;
    const due = remainOf(o);
    let received, applied;
    if (payment === 'Tunai') {
      received = Number(paid || 0);
      if (received <= 0) { flash('Masukkan uang yang diterima.', 3000); return; }
      applied = Math.min(received, due);
    } else {
      applied = Math.min(Number(partialAmt) || due, due);
      if (applied <= 0) { flash('Nominal pembayaran tidak valid.', 3000); return; }
      received = applied;
    }
    const chg = received - applied;
    const wasUnpaid = o.payment === 'Belum Bayar';
    const left = due - applied;
    const patch = {
      ...(wasUnpaid ? { payment } : {}),
      paid: (wasUnpaid ? 0 : (o.paid || 0)) + received,
      change: (wasUnpaid ? 0 : (o.change || 0)) + chg,
      status: left > 0 ? 'Belum Lunas' : 'Lunas',
      bill_requested: left > 0 ? !!o.bill_requested : false,
      bill_requested_at: left > 0 ? (o.bill_requested_at || null) : null,
      payments: [...(o.payments || []), ledger(payment, applied, user.username)],
      customer_printed: false
    };
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (error) { flash('Gagal menyimpan pembayaran: ' + error.message, 5000); return; }
    const updated = { ...o, ...patch };
    setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
    setShowPay(false); setSettling(null); setPaid(''); setPartialAmt('');
    flash(left > 0 ? `Dibayar ${money(applied)}, sisa ${money(left)} (${locLabel(o.location)}).` : `Bon ${locLabel(o.location)} lunas (${money(applied)}).`, 5000);
  };

  const openSplitPayment = (o) => {
    setSplitPayOrder(orders.find(x => x.id === o.id) || o);
    setSplitPayRows([
      { name: '', method: 'Tunai', amount: '', received: '' },
      { name: '', method: 'QRIS', amount: '', received: '' }
    ]);
    setSelectedOrder(null);
  };
  const updateSplitPayRow = (index, patch) => setSplitPayRows(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  const addSplitPayRow = () => setSplitPayRows(rows => [...rows, { name: '', method: 'Tunai', amount: '', received: '' }]);
  const confirmSplitPayment = async () => {
    if (!splitPayOrder || saving) return;
    const o = orders.find(x => x.id === splitPayOrder.id) || splitPayOrder;
    const due = remainOf(o);
    const rows = splitPayRows.map(r => ({
      ...r,
      name: String(r.name || '').trim(),
      amount: Math.max(0, Number(r.amount) || 0),
      received: r.method === 'Tunai' ? Math.max(0, Number(r.received || r.amount) || 0) : Math.max(0, Number(r.amount) || 0)
    })).filter(r => r.amount > 0);
    if (!rows.length) { flash('Isi nominal minimal satu pembayar.', 3500); return; }
    if (rows.some(r => !['Tunai', 'QRIS', 'Transfer'].includes(r.method))) { flash('Metode pembayaran tidak valid.', 3500); return; }
    const applied = rows.reduce((a, r) => a + r.amount, 0);
    if (applied > due) { flash(`Total pembayaran ${money(applied)} melebihi sisa tagihan ${money(due)}.`, 4500); return; }
    if (rows.some(r => r.method === 'Tunai' && r.received < r.amount)) { flash('Uang diterima salah satu pembayar masih kurang dari bagiannya.', 4500); return; }
    const receivedTotal = rows.reduce((a, r) => a + r.received, 0);
    const changeTotal = receivedTotal - applied;
    const left = Math.max(0, due - applied);
    const newPayments = rows.map(r => ({ ...ledger(r.method, r.amount, user.username), payer: r.name || 'Pembayar' }));
    const allPayments = [...(o.payments || []), ...newPayments];
    const methodsUsed = [...new Set(allPayments.map(p => p.m).filter(Boolean))];
    if (!methodsUsed.length && settledOf(o) > 0 && o.payment && o.payment !== 'Belum Bayar') methodsUsed.push(o.payment);
    const summaryMethod = methodsUsed.length > 1 ? 'Split' : (methodsUsed[0] || o.payment);
    const patch = {
      payment: summaryMethod,
      paid: (o.payment === 'Belum Bayar' ? 0 : Number(o.paid || 0)) + receivedTotal,
      change: (o.payment === 'Belum Bayar' ? 0 : Number(o.change || 0)) + changeTotal,
      status: left > 0 ? 'Belum Lunas' : 'Lunas',
      bill_requested: left > 0 ? !!o.bill_requested : false,
      bill_requested_at: left > 0 ? (o.bill_requested_at || null) : null,
      payments: allPayments,
      customer_printed: false
    };
    setSaving(true);
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    setSaving(false);
    if (error) { flash('Gagal menyimpan split bill: ' + error.message, 6000); return; }
    const updated = { ...o, ...patch };
    setOrders(prev => prev.map(x => x.id === o.id ? updated : x));
    setSplitPayOrder(null);
    setSplitPayRows([{ name: '', method: 'Tunai', amount: '', received: '' }]);
    flash(left > 0 ? `Pembayaran ${money(applied)} tersimpan dari ${rows.length} pembayar. Sisa ${money(left)}.` : `Split bill berhasil. Tagihan ${locLabel(o.location)} lunas.`, 5500);
  };

  // ---- Split bill pada pembayaran pesanan baru (setelah "Lanjut Pembayaran") ----
  const updateNewSplitRow = (index, patch) => setNewSplitPayRows(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  const addNewSplitRow = () => setNewSplitPayRows(rows => [...rows, { name: '', method: 'Tunai', amount: '', received: '' }]);
  const removeNewSplitRow = (index) => setNewSplitPayRows(rows => rows.length > 1 ? rows.filter((_, i) => i !== index) : rows);
  // Bagi rata total tagihan ke semua baris pembayar; sisa pembulatan masuk ke pembayar pertama.
  const splitEvenly = (total) => setNewSplitPayRows(rows => {
    const n = rows.length || 1;
    const base = Math.floor(total / n);
    const rest = total - base * n;
    return rows.map((r, i) => ({ ...r, amount: String(base + (i === 0 ? rest : 0)), received: '' }));
  });
  // Isi bagian suatu pembayar dengan sisa tagihan yang belum terbagi.
  const fillNewSplitRest = (index, total) => setNewSplitPayRows(rows => {
    const others = rows.reduce((a, r, i) => a + (i === index ? 0 : (Number(r.amount) || 0)), 0);
    const rest = Math.max(0, total - others);
    return rows.map((r, i) => i === index ? { ...r, amount: String(rest), received: '' } : r);
  });

  const requestBillForTable = async (tableKey) => {
    const list = (tableInfo[tableKey] || []).filter(o => remainOf(o) > 0);
    if (!list.length) { flash('Tidak ada bon yang menunggu pembayaran di meja ini.', 3500); return; }
    const ids = list.map(o => o.id);
    const requestedAt = new Date().toISOString();
    const { error } = await supabase.from('orders').update({ bill_requested: true, bill_requested_at: requestedAt }).in('id', ids);
    if (error) { flash('Gagal menandai minta bill: ' + error.message + '. Pastikan migrasi database sudah dijalankan.', 6500); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, bill_requested: true, bill_requested_at: requestedAt } : o));
    flash(`${tableSheet?.label || locLabel(tableKey)} ditandai siap membayar.`, 4500);
  };

  const loginNow = (e) => {
    e.preventDefault();
    const uInput = login.username.trim().toLowerCase();
    const pInput = login.password.trim();
    const foundUser = usersList.find(usr => usr.username.toLowerCase() === uInput && usr.password === pInput);
    if (foundUser) {
      const next = { username: foundUser.username, role: foundUser.role };
      setUser(next); localStorage.setItem('z_user', JSON.stringify(next));
      setPage(foundUser.role === 'Dapur' ? 'Antrian' : foundUser.role === 'Kasir' ? 'Pesanan' : 'Dashboard');
    } else flash('Username atau password salah.', 3500);
  };
  const logoutNow = () => {
    localStorage.removeItem('z_user');
    if (addingToOrder) exitAddition();
    setUser(null);
  };

  const handleCreateUser = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (user?.role !== 'Admin') {
      flash('Akses ditolak. Hanya Admin yang dapat mengelola akun.', 3500);
      return;
    }
    const uname = (newUser.username || '').trim();
    const pwd = (newUser.password || '').trim();
    if (!uname || !pwd) {
      flash('Username dan password wajib diisi.', 3500);
      return;
    }

    if (editingUser) {
      let dbOk = false;
      let errMsg = '';
      try {
        const { error } = await supabase.from('users').update({ password: pwd, role: newUser.role || 'Kasir' }).eq('username', uname);
        if (!error) dbOk = true;
        else errMsg = error.message;
      } catch (err) {
        errMsg = err.message;
      }
      const updated = usersList.map(u => u.username.toLowerCase() === uname.toLowerCase() ? { ...u, password: pwd, role: newUser.role || 'Kasir' } : u);
      setUsersList(updated);
      write('z_users_cache', updated);
      setEditingUser(null);
      setNewUser({ username: '', password: '', role: 'Kasir' });
      if (dbOk) {
        flash(`Akun "${uname}" berhasil diperbarui.`, 4000);
      } else {
        flash(`Akun "${uname}" diperbarui secara lokal (${errMsg || 'Supabase offline'}).`, 4500);
      }
      return;
    }

    if (usersList.some(u => (u.username || '').toLowerCase() === uname.toLowerCase())) {
      flash('Username sudah digunakan. Pilih nama lain.', 3500);
      return;
    }

    const newUserData = { username: uname, password: pwd, role: newUser.role || 'Kasir' };
    let dbOk = false;
    let errMsg = '';
    try {
      const { error } = await supabase.from('users').insert([newUserData]);
      if (!error) dbOk = true;
      else errMsg = error.message;
    } catch (err) {
      errMsg = err.message;
    }

    const updated = [...usersList, newUserData];
    setUsersList(updated);
    write('z_users_cache', updated);
    setNewUser({ username: '', password: '', role: 'Kasir' });
    if (dbOk) {
      flash(`Akun ${newUserData.role} "${uname}" berhasil dibuat.`, 4000);
    } else {
      flash(`Akun "${uname}" dibuat secara lokal (${errMsg || 'Supabase offline/RLS'}).`, 5000);
    }
  };

  const handleDeleteUser = async (targetUsername) => {
    if (user?.role !== 'Admin') return;
    if ((targetUsername || '').toLowerCase() === 'admin') { flash('Akun admin utama tidak dapat dihapus.', 3500); return; }
    if (window.confirm(`Yakin ingin menghapus akun "${targetUsername}"?`)) {
      try {
        const { error } = await supabase.from('users').delete().eq('username', targetUsername);
        if (error) console.warn('Gagal menghapus user di Supabase:', error.message);
      } catch (err) {
        console.warn('Network error delete user:', err);
      }
      const updated = usersList.filter(u => u.username !== targetUsername);
      setUsersList(updated);
      write('z_users_cache', updated);
      if (editingUser && editingUser.username === targetUsername) {
        setEditingUser(null);
        setNewUser({ username: '', password: '', role: 'Kasir' });
      }
      flash(`Akun "${targetUsername}" berhasil dihapus.`, 4000);
    }
  };

  // Tambahkan nomor antrian ke data cetak (hanya dipakai tiket dapur)
  const forPrint = (o, type) => type === 'kitchen' ? { ...o, queueNo: computeQueueNo(o, ordersRef.current) } : o;

  // Cetak tiket dapur otomatis (pesanan baru, bon belum bayar, antrean offline): lewat sendPrint agar berbunyi.
  const autoPrint = async (o) => {
    if (!o || !o.id) return false;
    if (seenAutoPrintedOrders.current.has(o.id)) return true;
    seenAutoPrintedOrders.current.add(o.id);
    try {
      await sendPrint(forPrint(o, 'kitchen'), 'kitchen', printUrlRef.current);
      const fields = { kitchen_printed: true };
      const { error: updateError } = await supabase.from('orders').update(fields).eq('id', o.id);
      if (updateError) throw new Error(`Tiket tercetak, tetapi status database gagal diperbarui: ${updateError.message}`);
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...fields } : x));
      return true;
    } catch (err) {
      seenAutoPrintedOrders.current.delete(o.id);
      flash(
        `Pesanan tersimpan, tetapi tiket dapur gagal dicetak: ${err.message}`,
        9000,
        { label: 'Coba cetak tiket dapur', fn: () => printOrder(o, 'kitchen') }
      );
      return false;
    }
  };

  // Tiket dapur berbunyi; struk kasir (type 'customer') tetap senyap.
  const printOrder = async (o, type = 'customer') => {
    setPrinting(true);
    try {
      await sendPrint(forPrint(o, type), type, printUrlRef.current);
      const updateField = type === 'kitchen' ? { kitchen_printed: true } : { customer_printed: true };
      const { error: updateError } = await supabase.from('orders').update(updateField).eq('id', o.id);
      if (updateError) throw new Error(`Tiket tercetak, tetapi status database gagal diperbarui: ${updateError.message}`);
      setOrders(prev => prev.map(item => item.id === o.id ? { ...item, ...updateField } : item));
      flash(`${type === 'kitchen' ? 'Tiket dapur' : 'Struk pelanggan'} ${o.id} berhasil dicetak.`);
    } catch (err) {
      flash(`Gagal mencetak: ${err.message}`, 7000, { label: 'Coba lagi', fn: () => printOrder(o, type) });
    } finally { setPrinting(false); }
  };

  const reconnectBluetoothPrinter = async (tries = 3) => {
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

  const refreshPrinter = async () => {
    if (globalBleDevice && !globalBleDevice.gatt?.connected) {
      const ok = await reconnectBluetoothPrinter(2);
      if (ok) return;
    }
    if (globalBleDevice && globalBleDevice.gatt?.connected) {
      setBleConnected(true);
      setPrinterStatus('Terhubung');
      setPrinterName(globalBleDevice.name || 'Printer Bluetooth (Web)');
      return;
    }
    setPrinterStatus('Memeriksa...');
    try {
      const data = await checkPrintBridge(activePrintUrl);
      setPrinterStatus('Terhubung'); setPrinterName(data.printer?.name || 'Printer Bluetooth (Bridge)');
    } catch (err) { setPrinterStatus('Tidak terhubung'); setPrinterName(err.message); }
  };

  const testPrinter = async () => {
    setPrinting(true);
    try {
      const dummyOrder = {
        id: 'TES-' + Math.floor(1000 + Math.random() * 9000),
        date: today,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        cashier: user?.username || 'Kasir',
        customer: 'Tes Koneksi Printer',
        location: 'Kasir',
        items: [{ id: 1, name: 'Tes Cetak Bluetooth', qty: 1, price: 10000 }],
        total: 10000,
        paid: 10000,
        change: 0,
        payment: 'Tunai',
        status: 'Lunas',
        notes: 'Printer Siap Digunakan'
      };
      await sendPrintJob(dummyOrder, 'customer', activePrintUrl);
      flash('✓ Tes printer berhasil dicetak!', 3500);
    } catch (err) {
      flash(`Tes printer gagal: ${err.message}`, 6000);
    } finally {
      setPrinting(false);
    }
  };

  // rowsOverride: daftar pembayar dari popup split bill per menu (opsional)
  const finish = async (rowsOverride) => {
    if (saving) return;
    if (!location.trim()) { flash('Lokasi meja perlu diisi agar pesanan mudah diantar.', 4000); setShowPay(false); return; }
    if (!cart.length) return;
    const isBon = payment === 'Belum Bayar';
    const useOverride = Array.isArray(rowsOverride);
    const isSplit = useOverride || payment === 'Split';

    // ---- Validasi & hitung split bill ----
    let splitRows = [];
    if (isSplit) {
      splitRows = (useOverride ? rowsOverride : newSplitPayRows).map(r => {
        const amount = Math.max(0, Number(r.amount) || 0);
        return {
          name: String(r.name || '').trim(),
          method: r.method,
          amount,
          received: r.method === 'Tunai' ? Math.max(0, Number(r.received) || amount) : amount
        };
      }).filter(r => r.amount > 0);
      if (!splitRows.length) { flash('Isi nominal minimal satu pembayar, atau pilih Belum Bayar.', 3500); return; }
      if (splitRows.some(r => !['Tunai', 'QRIS', 'Transfer'].includes(r.method))) { flash('Metode pembayaran tidak valid.', 3500); return; }
      const appliedCheck = splitRows.reduce((a, r) => a + r.amount, 0);
      if (appliedCheck > grand) { flash(`Total pembayaran ${money(appliedCheck)} melebihi tagihan ${money(grand)}.`, 4500); return; }
      if (splitRows.some(r => r.method === 'Tunai' && r.received < r.amount)) { flash('Uang diterima salah satu pembayar masih kurang dari bagiannya.', 4500); return; }
    }
    const splitApplied = splitRows.reduce((a, r) => a + r.amount, 0);
    const splitReceived = splitRows.reduce((a, r) => a + r.received, 0);
    const splitMethods = [...new Set(splitRows.map(r => r.method))];
    const payMethod = isSplit ? (splitMethods.length > 1 ? 'Split' : splitMethods[0]) : payment;

    const received = isBon ? 0 : isSplit ? splitReceived : (payment === 'Tunai' ? Number(paid || 0) : grand);
    if (!isBon && !isSplit && payment === 'Tunai' && received < grand) { flash('Uang diterima masih kurang.', 3000); return; }

    setSaving(true);
    const orderItems = cart.map(item => ({ ...item, item_status: 'Baru' }));
    const order = {
      id: genOrderId(), // [FIX #4]
      date: today, time: nowTime(), created_at: new Date().toISOString(),
      customer: customer.trim() || '', location: location.trim(), notes,
      items: orderItems, subtotal, discount: discAmt, rounding: roundAmt, total: grand,
      // [FIX #6] simpan jenis & nilai diskon asli agar bisa dihitung ulang saat ada tambahan item
      discount_type: discAmt > 0 ? discount.type : null,
      discount_value: discAmt > 0 ? (discount.type === 'pct' ? Math.min(discNum, 100) : discNum) : 0,
      payment: payMethod, paid: received,
      change: isBon ? 0 : isSplit ? Math.max(0, splitReceived - splitApplied) : Math.max(0, received - grand),
      status: isBon ? 'Belum Lunas' : isSplit ? (splitApplied >= grand ? 'Lunas' : 'Belum Lunas') : 'Lunas',
      order_status: 'Baru',
      payments: isBon
        ? []
        : isSplit
          ? splitRows.map(r => ({ ...ledger(r.method, r.amount, user.username), payer: r.name || 'Pembayar' }))
          : [ledger(payment, grand, user.username)],
      kitchen_printed: false, customer_printed: false, bill_requested: false, bill_requested_at: null, cashier: user.username
    };

    let queued = false;
    let { error } = await supabase.from('orders').insert([order]);
    // Jika ID kebetulan bentrok, buat ID baru lalu coba sekali lagi
    if (error && isDupErr(error)) {
      order.id = genOrderId();
      ({ error } = await supabase.from('orders').insert([order]));
    }
    if (error) {
      if (isNetErr(error)) { queueOrder({ ...order, _queued: true }); queued = true; }
      else { setSaving(false); flash('Gagal menyimpan pesanan ke database: ' + error.message, 7500); return; }
    }
    const local = queued ? { ...order, _queued: true } : order;
    setOrders(prev => prev.some(x => x.id === order.id) ? prev : [local, ...prev]);
    const sold = cart;
    closeDraft(); setPaid(''); setNewSplitPayRows(newSplitRows()); setSplitMenuAssign({}); setShowSplitMenu(false); setShowPay(false); setCartOpen(false); setSaving(false);

    if (queued) { flash('Tidak ada internet: pesanan diantre dan dikirim otomatis saat online.', 7000); return; }
    consumeStock(sold);
    if (isPrintStation) {
      flash('Pesanan tersimpan. Mencetak tiket dapur...', 3000);
      const ok = await autoPrint(order);
      if (ok) flash(`${locLabel(order.location)} tersimpan & tiket dapur tercetak.`, 4000);
    } else {
      flash(`Pesanan ${locLabel(order.location)} tersimpan & dikirim ke kasir/dapur.`, 4000);
    }
  };

  // [FIX #2] "Bersihkan riwayat" kini soft delete (kolom deleted_at), bukan DELETE permanen.
  const clearAllOrders = async () => {
    if (user.role !== 'Admin') return;
    if (!orders.length) { flash('Tidak ada riwayat untuk dihapus.'); return; }
    if (!window.confirm('Yakin ingin membersihkan seluruh riwayat pesanan? Data diarsipkan (soft delete) dan masih bisa dipulihkan lewat database.')) return;

    const { data, error } = await supabase.from('orders')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.username })
      .is('deleted_at', null)
      .select('id');
    if (error) { flash('Gagal membersihkan riwayat: ' + error.message, 7000); return; }

    const count = Array.isArray(data) ? data.length : orders.length;
    const newLog = { id: Date.now(), who: user.username, role: user.role, time: new Date().toLocaleString('id-ID'), count };
    const { error: logError } = await supabase.from('clear_logs').insert([newLog]);
    if (logError) { console.error('Log hapus gagal disimpan:', logError.message); flash('Riwayat dibersihkan, tetapi log gagal disimpan: ' + logError.message, 6000); }
    else setClearLogs(prev => [newLog, ...prev]);

    logAudit(null, 'clear_all', { count });
    setOrders(prev => prev.filter(x => x._queued)); // pesanan yang masih antre offline tetap ada
    if (!logError) flash(`Riwayat (${count} transaksi) diarsipkan oleh ${user.username}.`);
  };

  const syncKdsNow = async () => {
    setKdsSyncing(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (data && !error) {
        setOrders(withQueue(data));
        setRealtimeConnected(true);
        flash('Data antrian berhasil disinkronkan!', 2500);
      }
    } catch (e) {
      flash('Gagal menyinkronkan data: ' + e.message, 3000);
    } finally {
      setTimeout(() => setKdsSyncing(false), 500);
    }
  };

  const toggleKdsFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setKdsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setKdsFullscreen(false)).catch(() => {});
    }
  };

  const changeAdminQueueMode = (m) => { setAdminQueueMode(m); write('z_admin_queue_mode', m); };
  const changeCashierLayout = (l) => { setCashierLayout(l); write('z_cashier_layout', l); };

  const setStatus = async (o, st) => {
    const current = statusOf(o);
    const role = user?.role;
    const allowed = role === 'Admin'
      ? STATUSES
      : role === 'Dapur'
        ? ['Baru', 'Dimasak', 'Siap']
        : role === 'Kasir'
          ? ['Diantar']
          : [];
    if (!allowed.includes(st)) {
      flash('Akun ' + (role || '') + ' tidak memiliki izin untuk mengubah status ini.', 3000);
      return;
    }
    if (role === 'Dapur' && !(current === 'Baru' && st === 'Dimasak' || current === 'Dimasak' && (st === 'Siap' || st === 'Baru') || current === 'Siap' && st === 'Dimasak')) {
      flash('Dapur hanya dapat memproses pesanan Baru, Dimasak, dan Siap.', 3000);
      return;
    }
    if (role === 'Kasir' && !(current === 'Siap' && st === 'Diantar')) {
      flash('Kasir hanya dapat menandai pesanan Siap menjadi Diantar.', 3000);
      return;
    }
    if (statusOf(o) === st) return;

    // [FIX #8] Memundurkan pesanan dari "Diantar" harus disengaja (konfirmasi) dan dicatat.
    const reverting = current === 'Diantar' && st !== 'Diantar';
    if (reverting && !window.confirm(`Pesanan ${o.id} sudah diantar. Yakin mengembalikan status ke "${st}"? Semua menu akan ikut dikembalikan dan perubahan ini dicatat atas nama ${user.username}.`)) return;

    localStatus.current[o.id] = st;
    const patch = { order_status: st, items: syncItems(o.items, st, reverting) };
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (error) { delete localStatus.current[o.id]; flash('Gagal mengubah status: ' + error.message); return; }
    logAudit(o.id, reverting ? 'status_revert' : 'status_change', { from: current, to: st });
    setOrders(p => p.map(x => x.id === o.id ? { ...x, ...patch } : x));
    if (st === 'Siap') flash(`${locLabel(o.location)} siap diantar.`, 3000);
  };

  const setItemStatus = async (o, itemIndex, newSt) => {
    const role = user?.role;
    const cur = itemSt((o?.items || [])[itemIndex] || {});
    if (role === 'Kasir' && !(cur === 'Siap' && newSt === 'Diantar')) {
      flash('Kasir hanya dapat mengantar menu yang sudah Siap.', 3000);
      return;
    }
    if (role === 'Dapur' && (cur === 'Diantar' || newSt === 'Diantar')) {
      flash('Menu yang sudah diantar tidak dapat diubah oleh dapur.', 3000);
      return;
    }

    const updatedItems = (o?.items || []).map((it, idx) =>
      idx === itemIndex ? { ...it, item_status: newSt } : { ...it, item_status: itemSt(it) }
    );
    const newOrderStatus = deriveStatus(updatedItems);

    const patch = { items: updatedItems, order_status: newOrderStatus };
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (error) {
      flash('Gagal memperbarui status item: ' + error.message);
      return;
    }
    if (newSt === 'Diantar' || cur === 'Diantar') logAudit(o.id, 'item_status', { item: (o.items[itemIndex] || {}).name, from: cur, to: newSt });
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x));
  };

  const deliverReady = async (o) => {
    if (user?.role !== 'Kasir' && user?.role !== 'Admin') return;
    const updatedItems = (o?.items || []).map(it => itemSt(it) === 'Siap' ? { ...it, item_status: 'Diantar' } : { ...it, item_status: itemSt(it) });
    const n = updatedItems.filter((it, i) => itemSt(it) === 'Diantar' && itemSt((o?.items || [])[i]) !== 'Diantar').length;
    if (!n) return;
    const patch = { items: updatedItems, order_status: deriveStatus(updatedItems) };
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (error) { flash('Gagal menandai diantar: ' + error.message); return; }
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...patch } : x));
    flash(`${n} menu ${locLabel(o.location)} ditandai sudah diantar.`, 3000);
  };

  const openMove = (o) => { setMoveOrder(o); setMoveTarget(''); setMovePayungOpen(false); };
  const closeMove = () => { if (!moveBusy) { setMoveOrder(null); setMoveTarget(''); setMovePayungOpen(false); } };

  // Konfirmasi khusus Zayga, bukan dialog bawaan browser.
  const doMove = (o, destRaw) => {
    const dest = String(destRaw || '').trim();
    if (!dest || normLoc(dest) === normLoc(o.location)) return;
    setMoveConfirm({ type: 'move', order: o, destination: dest });
  };

  const doMerge = (src, tgt) => {
    if (!src || !tgt || src.id === tgt.id) return;
    setMoveConfirm({ type: 'merge', source: src, target: tgt });
  };

  const confirmMoveAction = async () => {
    if (!moveConfirm || moveBusy) return;
    const action = moveConfirm;
    setMoveConfirm(null);
    if (action.type === 'move') await executeMove(action.order, action.destination);
    else if (action.type === 'merge') await executeMerge(action.source, action.target);
  };

  const executeMove = async (o, destRaw) => {
    const dest = destRaw.trim();
    if (!dest || normLoc(dest) === normLoc(o.location)) return;
    setMoveBusy(true);
    const { error } = await supabase.from('orders').update({ location: dest }).eq('id', o.id);
    setMoveBusy(false);
    if (error) { flash('Gagal memindahkan meja: ' + error.message); return; }
    logAudit(o.id, 'move', { from: o.location, to: dest });
    // [FIX #7] pakai state terbaru (x), bukan salinan lama (o), supaya perubahan realtime tidak tertimpa
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, location: dest } : x));
    setMoveOrder(null); setMoveTarget('');
    flash(`Pesanan ${o.id} dipindah dari ${locLabel(o.location)} ke ${locLabel(dest)}.`);
  };

  // [FIX #3] Gabung bon dijalankan lewat RPC merge_orders (satu transaksi database).
  const executeMerge = async (srcIn, tgtIn) => {
    const src = orders.find(x => x.id === srcIn.id) || srcIn;
    const tgt = orders.find(x => x.id === tgtIn.id) || tgtIn;
    if (src.id === tgt.id) return;

    const its = (tgt.items || []).map(x => ({ ...x }));
    for (const c of (src.items || [])) {
      const i = its.findIndex(x => x.id === c.id && itemSt(x) === itemSt(c));
      if (i > -1) its[i] = { ...its[i], qty: its[i].qty + c.qty };
      else its.push({ ...c });
    }
    const disc = (tgt.discount || 0) + (src.discount || 0);
    const rnd = (tgt.rounding || 0) + (src.rounding || 0);
    const mergedTotal = calcTotal(its, disc, rnd);
    const settled = settledOf(src) + settledOf(tgt);
    const method = settledOf(tgt) > 0 ? tgt.payment : (settledOf(src) > 0 ? src.payment : 'Belum Bayar');
    const status = remainOf({ total: mergedTotal, payment: method, paid: settled, change: 0 }) > 0 ? 'Belum Lunas' : 'Lunas';
    const stIdx = Math.min(STATUSES.indexOf(statusOf(tgt)), STATUSES.indexOf(statusOf(src)));
    const patch = {
      items: its, subtotal: sumItems(its), discount: disc, rounding: rnd, total: mergedTotal,
      payment: method, paid: method === 'Belum Bayar' ? 0 : settled, change: 0, status,
      payments: (tgt.payments || src.payments) ? [...(tgt.payments || []), ...(src.payments || [])] : null,
      bill_requested: !!(tgt.bill_requested || src.bill_requested), bill_requested_at: tgt.bill_requested_at || src.bill_requested_at || null,
      order_status: STATUSES[stIdx],
      customer: tgt.customer || src.customer || '',
      notes: [tgt.notes, src.notes].filter(Boolean).join(' | '),
      kitchen_printed: !!(tgt.kitchen_printed && src.kitchen_printed), customer_printed: false,
      // dua diskon digabung jadi nominal tetap
      discount_type: disc > 0 ? 'rp' : null, discount_value: disc
    };

    setMoveBusy(true);
    const { error } = await supabase.rpc('merge_orders', { p_src: src.id, p_tgt: tgt.id, p_patch: patch });
    setMoveBusy(false);
    if (error) { flash('Gagal menggabungkan bon (tidak ada data yang berubah): ' + error.message, 6000); return; }

    logAudit(tgt.id, 'merge', { source: src.id, source_location: src.location, total: mergedTotal });
    const updated = { ...tgt, ...patch };
    setOrders(prev => prev.filter(x => x.id !== src.id).map(x => x.id === tgt.id ? updated : x));
    setSelectedOrder(updated); setMoveOrder(null); setMoveTarget('');
    flash(`Bon ${locLabel(src.location)} digabung ke ${locLabel(tgt.location)} (${money(mergedTotal)}).`, 6000);
  };

  const openSplit = (o) => { setSplitOrder(o); setSplitQty({}); setSplitLoc(o.location); setSelectedOrder(null); };

  // [FIX #3] Pisah bon lewat RPC split_order (satu transaksi database).
  const doSplit = async () => {
    const src = orders.find(x => x.id === splitOrder.id) || splitOrder;
    const moved = [], kept = [];
    (src.items || []).forEach((it, i) => {
      const q = Math.min(splitQty[i] || 0, it.qty);
      if (q > 0) moved.push({ ...it, qty: q });
      if (it.qty - q > 0) kept.push({ ...it, qty: it.qty - q });
    });
    if (!moved.length || !kept.length) { flash('Pilih sebagian item untuk dipisah dan sisakan minimal satu di bon asal.', 4500); return; }
    const total1 = calcTotal(kept, src.discount, src.rounding);
    const total2 = sumItems(moved);
    const S = settledOf(src);
    const paid1 = Math.min(S, total1);
    const R = S - paid1;
    const srcPatch = {
      items: kept, subtotal: sumItems(kept), total: total1,
      paid: src.payment === 'Belum Bayar' ? 0 : paid1, change: 0
    };
    srcPatch.status = remainOf({ ...src, ...srcPatch }) > 0 ? 'Belum Lunas' : 'Lunas';
    const newPayment = R > 0 ? src.payment : 'Belum Bayar';
    const nb = {
      id: genOrderId(), date: src.date, time: nowTime(), created_at: new Date().toISOString(),
      customer: src.customer || '', location: (splitLoc || src.location).trim(), notes: '',
      items: moved, subtotal: total2, discount: 0, rounding: 0, total: total2,
      discount_type: null, discount_value: 0,
      payment: newPayment, paid: R > 0 ? R : 0, change: 0,
      payments: [], order_status: statusOf(src), bill_requested: !!src.bill_requested, bill_requested_at: src.bill_requested_at || null,
      kitchen_printed: true, customer_printed: false, cashier: src.cashier
    };
    nb.status = remainOf(nb) > 0 ? 'Belum Lunas' : 'Lunas';

    setMoveBusy(true);
    const { error } = await supabase.rpc('split_order', { p_src: src.id, p_src_patch: srcPatch, p_new: nb });
    setMoveBusy(false);
    if (error) { flash('Gagal memisahkan bon (tidak ada data yang berubah): ' + error.message, 6000); return; }

    logAudit(src.id, 'split', { new_order: nb.id, moved_total: total2 });
    setOrders(prev => [nb, ...prev.map(x => x.id === src.id ? { ...x, ...srcPatch } : x)].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i));
    setSplitOrder(null);
    flash(`Bon dipisah: ${money(total2)} jadi bon baru di ${locLabel(nb.location)}.`, 6000);
  };

  // [FIX #2] Hapus satu transaksi = soft delete + dicatat di audit
  const deleteOrder = async (o) => {
    if (user.role !== 'Admin') return;
    if (!window.confirm(`Yakin ingin menghapus transaksi ${o.id} (meja ${o.location}, ${money(o.total)})? Data diarsipkan dan hanya bisa dipulihkan lewat database.`)) return;
    const { error } = await supabase.from('orders')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.username })
      .eq('id', o.id);
    if (error) { flash('Gagal menghapus transaksi: ' + error.message); return; }
    const newLog = { id: Date.now(), who: user.username, role: user.role, time: new Date().toLocaleString('id-ID'), count: 1 };
    const { error: logError } = await supabase.from('clear_logs').insert([newLog]);
    if (!logError) setClearLogs(prev => [newLog, ...prev]);
    logAudit(o.id, 'delete', { total: o.total, location: o.location });
    setOrders(prev => prev.filter(x => x.id !== o.id));
    if (selectedOrder && selectedOrder.id === o.id) setSelectedOrder(null);
    flash(`Transaksi ${o.id} berhasil dihapus.`);
  };

  const reorder = (o) => {
    const ok = (o?.items || []).filter(i => { const m = items.find(x => String(x.id) === String(i.menuId)); return !(m && m.sold_out); });
    setCart(old => { const m = [...old]; ok.forEach(i => { const k = m.findIndex(x => x.id === i.id); if (k > -1) m[k] = { ...m[k], qty: m[k].qty + i.qty }; else m.push({ ...i, item_status: 'Baru' }); }); return m; });
    setSelectedOrder(null); setPage('Pesanan');
    flash(ok.length < (o?.items || []).length ? 'Sebagian item habis dan dilewati. Sisanya masuk keranjang.' : `${ok.length} menu dimasukkan ke keranjang.`, 3500);
  };

  const saveMenu = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (user?.role !== 'Admin') {
      flash('Akses ditolak. Hanya Admin yang dapat mengelola menu.', 3500);
      return;
    }
    const name = (menuForm.name || '').trim();
    if (!name) {
      flash('Nama menu wajib diisi.', 3500);
      return;
    }
    const priceNum = Number(menuForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      flash('Harga harus berupa angka valid lebih dari 0.', 3500);
      return;
    }

    if (editing) {
      let dbOk = false;
      let errMsg = '';
      try {
        const { error } = await supabase.from('menu_items').update({
          name,
          category: menuForm.category,
          price: priceNum
        }).eq('id', editing);
        if (!error) dbOk = true;
        else errMsg = error.message;
      } catch (err) {
        errMsg = err.message;
      }

      setItems(prev => {
        const updated = prev.map(x => x.id === editing ? { ...x, name, category: menuForm.category, price: priceNum } : x);
        write('z_items_cache', updated);
        return updated;
      });
      setEditing(null);
      setMenuForm({ name: '', category: 'Mie', price: '' });
      if (dbOk) {
        flash(`Menu "${name}" berhasil diperbarui.`, 3500);
      } else {
        flash(`Menu "${name}" diperbarui secara lokal (${errMsg || 'Supabase offline'}).`, 4500);
      }
    } else {
      const maxId = items.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0);
      const nextId = maxId > 0 ? maxId + 1 : 1;
      const newItem = {
        id: nextId,
        name,
        category: menuForm.category || 'Mie',
        price: priceNum,
        active: true
      };

      let dbOk = false;
      let savedItem = newItem;
      let errMsg = '';

      try {
        // Coba insert dengan ID eksplisit terlebih dahulu (mengatasi sequence id yang belum disetval di PostgreSQL)
        const { data, error } = await supabase.from('menu_items').insert([newItem]).select();
        if (!error && data && data.length > 0) {
          dbOk = true;
          savedItem = data[0];
        } else if (error) {
          console.warn('Gagal insert menu dengan id eksplisit, mencoba tanpa id:', error.message);
          const { data: data2, error: error2 } = await supabase.from('menu_items').insert([{
            name,
            category: menuForm.category || 'Mie',
            price: priceNum,
            active: true
          }]).select();
          if (!error2 && data2 && data2.length > 0) {
            dbOk = true;
            savedItem = data2[0];
          } else {
            errMsg = error2?.message || error.message;
          }
        }
      } catch (err) {
        errMsg = err.message;
      }

      setItems(prev => {
        const exists = prev.some(x => x.id === savedItem.id);
        const nextList = exists ? prev.map(x => x.id === savedItem.id ? savedItem : x) : [...prev, savedItem];
        write('z_items_cache', nextList);
        return nextList;
      });

      setMenuForm({ name: '', category: 'Mie', price: '' });
      if (dbOk) {
        flash(`Menu "${name}" berhasil ditambahkan.`, 3500);
      } else {
        flash(`Menu "${name}" ditambahkan secara lokal (${errMsg || 'Supabase offline'}).`, 4500);
      }
    }
  };

  const toggleMenuStatus = async (item) => {
    if (user?.role !== 'Admin') return;
    const newStatus = !item.active;
    const ids = Array.isArray(item._legacyIds) && item._legacyIds.length ? item._legacyIds : [item.id];
    try {
      const { error } = await supabase.from('menu_items').update({ active: newStatus }).in('id', ids);
      if (error) console.warn('Gagal update status di Supabase:', error.message);
    } catch (err) {
      console.warn('Network error update menu status:', err);
    }
    setItems(prev => {
      const updated = prev.map(m => ids.some(id => String(id) === String(m.id)) ? { ...m, active: newStatus } : m);
      write('z_items_cache', updated);
      return updated;
    });
    flash(`Menu "${item.name}" ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`, 3000);
  };

  const deleteMenu = async (item) => {
    if (user?.role !== 'Admin') return;
    const ids = Array.isArray(item._legacyIds) && item._legacyIds.length ? item._legacyIds : [item.id];
    const description = item._isGroupedMenu ? `semua varian suhu menu \"${item.name}\" (${ids.length} data)` : item._isLegacyToppingGroup ? `semua menu topping lama \"${item.name}\" (${ids.length} data)` : `menu \"${item.name}\"`;
    if (!window.confirm(`Yakin ingin menghapus ${description} dari database? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const { error } = await supabase.from('menu_items').delete().in('id', ids);
      if (error) {
        flash('Gagal menghapus menu dari Supabase: ' + error.message, 4500);
        return;
      }
    } catch (err) {
      flash('Gagal menghapus menu: ' + (err?.message || 'Koneksi bermasalah'), 4500);
      return;
    }
    setItems(prev => {
      const updated = prev.filter(m => !ids.some(id => String(id) === String(m.id)));
      write('z_items_cache', updated);
      return updated;
    });
    if (ids.some(id => String(id) === String(editing))) {
      setEditing(null);
      setMenuForm({ name: '', category: 'Mie', price: '' });
    }
    flash(`${item._isGroupedMenu ? 'Semua varian' : item._isLegacyToppingGroup ? 'Menu topping lama' : 'Menu'} \"${item.name}\" berhasil dihapus.`, 3500);
  };

  const handlePageChange = (label) => {
    const allowed = {
      Admin: ['Dashboard', 'Pesanan', 'Denah', 'Antrian', 'Riwayat', 'Tutup Kasir', 'Kelola Menu', 'Pengaturan'],
      Kasir: ['Pesanan', 'Denah', 'Antrian', 'Riwayat', 'Tutup Kasir', 'Pengaturan'],
      Dapur: ['Antrian', 'Pengaturan']
    };
    if (!allowed[user?.role]?.includes(label)) {
      flash('Akses ditolak. Halaman ini tidak tersedia untuk akun ' + (user?.role || '') + '.', 3000);
      return;
    }
    if (label !== 'Pesanan' && addingToOrder) exitAddition();
    if (label === 'Pengaturan') setMobileSettingsView('main');
    setPage(label);
  };

  const saveServerPrintUrl = async () => {
    if (user.role !== 'Admin') return;
    const val = serverDraft.trim();
    const { error } = await supabase.from('app_settings').upsert({ key: 'print_url', value: val }, { onConflict: 'key' });
    if (error) flash('Gagal menyimpan alamat server: ' + error.message, 3000);
    else { setServerPrintUrl(val); flash('Alamat server pusat tersimpan.', 3000); }
  };
  const handleLocalPrintUrlChange = (e) => { const val = e.target.value; setLocalPrintUrl(val); localStorage.setItem('z_local_print_url', JSON.stringify(val)); };

  const who = user?.role === 'Admin' ? (shiftWho || user.username) : user?.username;
  const calcShift = (name) => {
    const by = { Tunai: 0, QRIS: 0, Transfer: 0 };
    (orders || []).forEach(o => {
      if (Array.isArray(o.payments)) o.payments.forEach(p => { if (p.d === today && p.by === name) by[p.m] = (by[p.m] || 0) + p.a; });
      else if (o.date === today && o.cashier === name && o.payment !== 'Belum Bayar') by[o.payment] = (by[o.payment] || 0) + settledOf(o);
    });
    const mine = todays.filter(o => o.cashier === name);
    return { by, count: mine.length, sales: mine.reduce((s, o) => s + o.total, 0), disc: mine.reduce((s, o) => s + (o.discount || 0), 0), bon: mine.reduce((s, o) => s + remainOf(o), 0) };
  };
  const digits = v => v.replace(/\D/g, '').slice(0, 9);

  const shiftContent = (name, sh, opening, counted, diff) => [
    receiptText('ZAYGA', 'center', true, 'large'), receiptText('TUTUP KASIR', 'center', true), receiptDivider(),
    receiptText(`Kasir: ${name}`), receiptText(`Tanggal: ${today} ${nowTime()}`), receiptDivider(),
    { type: 'row', left: 'Transaksi', right: String(sh.count) }, { type: 'row', left: 'Penjualan', right: money(sh.sales) },
    { type: 'row', left: 'Diskon', right: money(sh.disc) }, receiptDivider(),
    { type: 'row', left: 'Tunai', right: money(sh.by.Tunai) }, { type: 'row', left: 'QRIS', right: money(sh.by.QRIS) },
    { type: 'row', left: 'Transfer', right: money(sh.by.Transfer) }, { type: 'row', left: 'Bon belum bayar', right: money(sh.bon) }, receiptDivider(),
    { type: 'row', left: 'Modal awal', right: money(opening) }, { type: 'row', left: 'Seharusnya di laci', right: money(opening + sh.by.Tunai) },
    { type: 'row', left: 'Uang di laci', right: money(counted), bold: true }, { type: 'row', left: 'Selisih', right: (diff > 0 ? '+' : '') + money(diff), bold: true },
    { type: 'feed', lines: 3 }
  ];

  const saveShift = async (print = false) => {
    const sh = calcShift(who);
    const opening = Number(shiftForm.opening) || 0, counted = Number(shiftForm.counted) || 0;
    const expected = opening + sh.by.Tunai, diff = counted - expected;
    if (print) {
      setPrinting(true);
      try { await postPrint(shiftContent(who, sh, opening, counted, diff), `SHIFT-${who}-${Date.now()}`, activePrintUrl); flash('Laporan tutup kasir tercetak.', 3000); }
      catch (err) { flash('Gagal mencetak: ' + err.message, 6000); }
      finally { setPrinting(false); }
      return;
    }
    if (shiftForm.counted === '') { flash('Isi dulu uang tunai yang ada di laci.', 3500); return; }
    const row = { id: Date.now(), cashier: who, date: today, time: nowTime(), opening_cash: opening, expected_cash: expected, counted_cash: counted, diff, totals: sh, note: shiftForm.note.trim() };
    const { error } = await supabase.from('shift_closings').insert([row]);
    if (error) { flash('Gagal menyimpan: ' + error.message + ' (pastikan tabel shift_closings sudah dibuat)', 7000); return; }
    setShifts(prev => [row, ...prev]); setShiftForm({ opening: '', counted: '', note: '' });
    flash(diff === 0 ? 'Kasir ditutup. Uang laci pas.' : `Kasir ditutup. Selisih ${diff > 0 ? '+' : ''}${money(diff)}.`, 6000);
  };

  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = ['input', 'textarea', 'select'].includes(tag);
      if (e.key === 'Escape') {
        if (noteItem) setNoteItem(null); else if (stockItem) setStockItem(null); else if (discOpen) setDiscOpen(false);
        else if (infoOpen) setInfoOpen(false); else if (showSplitMenu) setShowSplitMenu(false); else if (showPay) closePay(); else if (baksoOpen) setBaksoOpen(false);
        else if (selectedItemForVariant) setSelectedItemForVariant(null); else if (splitPayOrder) setSplitPayOrder(null); else if (splitOrder) setSplitOrder(null);
        else if (moveOrder) closeMove(); else if (tableSheet) setTableSheet(null); else if (selectedOrder) setSelectedOrder(null);
        else if (cartOpen) setCartOpen(false);
        return;
      }
      if (typing || !user) return;
      const anyOverlay = infoOpen || showPay || noteItem || selectedOrder || moveOrder || splitOrder || splitPayOrder || tableSheet || stockItem || discOpen || baksoOpen || selectedItemForVariant;
      if (e.key === '/' && page === 'Pesanan') { e.preventDefault(); searchRef.current && searchRef.current.focus(); }
      if (e.key === 'Enter' && page === 'Pesanan' && !anyOverlay && cart.length && !addingToOrder) goPay();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const toastTone = toast?.type === 'ready'
    ? { accent: '#16a34a', soft: '#f0fdf4', icon: '✓', eyebrow: 'DAPUR · SIAP DIANTAR' }
    : toast?.type === 'order'
      ? { accent: '#d97706', soft: '#fffbeb', icon: '＋', eyebrow: 'PESANAN BARU' }
      : toast?.type === 'success'
        ? { accent: '#16a34a', soft: '#f0fdf4', icon: '✓', eyebrow: 'BERHASIL' }
        : { accent: '#475569', soft: '#f8fafc', icon: 'i', eyebrow: 'ZAYGA POS' };

  const toastEl = toast && (
    <>
      <style>{`
        @keyframes zaygaToastIn { from { opacity: 0; transform: translate3d(24px,-8px,0) scale(.98); } to { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
        @keyframes zaygaToastProgress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .zayga-toast-card { position:fixed; z-index:12000; top:18px; right:18px; width:min(390px,calc(100vw - 28px)); overflow:hidden; display:flex; gap:13px; padding:16px 17px 17px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; color:#111827; box-shadow:0 18px 55px rgba(15,23,42,.18); animation:zaygaToastIn .24s ease-out; font-family:inherit; }
        @media(max-width:600px){ .zayga-toast-card { top:10px; right:10px; width:calc(100vw - 20px); border-radius:14px; } }
      `}</style>
      <div className="zayga-toast-card" role="status" aria-live="polite">
        <div style={{ width:40, height:40, flex:'0 0 40px', borderRadius:13, display:'grid', placeItems:'center', background:toastTone.soft, color:toastTone.accent, fontSize:22, fontWeight:800 }}>
          {toastTone.icon}
        </div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ color:toastTone.accent, fontSize:10, fontWeight:800, letterSpacing:'.11em', marginBottom:5 }}>{toastTone.eyebrow}</div>
          <div style={{ fontSize:14, lineHeight:1.35, fontWeight:800, color:'#111827' }}>{toast.title}</div>
          {toast.body && <div style={{ marginTop:5, fontSize:12, lineHeight:1.5, color:'#64748b', overflowWrap:'anywhere' }}>{toast.body}</div>}
          {toast.action && <button type="button" onClick={() => { toast.action.fn(); setToast(null); }} style={{ marginTop:10, border:0, borderRadius:8, padding:'7px 11px', background:'#111827', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>{toast.action.label}</button>}
        </div>
        <button type="button" aria-label="Tutup notifikasi" onClick={() => setToast(null)} style={{ alignSelf:'flex-start', border:0, background:'transparent', color:'#94a3b8', fontSize:20, lineHeight:1, cursor:'pointer', padding:0 }}>×</button>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'#f1f5f9' }}><div style={{ height:'100%', width:'100%', transformOrigin:'left', background:toastTone.accent, animation:`zaygaToastProgress ${Math.max(1000, toast.type === 'ready' ? 10000 : toast.type === 'order' ? 8000 : 5000)}ms linear forwards` }} /></div>
      </div>
    </>
  );

  /* ===================== Layar login ===================== */
  if (!user) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand-mark"><img src="/icon.svg" alt="Logo Zayga" /></div>
          <p className="eyebrow">POINT OF SALE</p>
          <h1>Zayga POS</h1>
          <p className="muted">Masuk untuk mulai melayani pelanggan.</p>
          <form onSubmit={loginNow}>
            <label>Username</label>
            <input value={login.username} onChange={e => setLogin({ ...login, username: e.target.value })} placeholder="Masukkan username" autoCapitalize="none" autoCorrect="off" />
            <label>Password</label>
            <input type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} placeholder="Masukkan password" />
            <button className="primary full">Masuk ke aplikasi</button>
          </form>
          <p className="tiny">Mode Supabase Cloud · Terhubung secara real-time</p>
        </div>
        {toastEl}
      </div>
    );
  }

  const moreItems = user.role === 'Admin'
  ? [[LayoutGrid, 'Denah'], [Lock, 'Tutup Kasir'], [Utensils, 'Kelola Menu'], [Settings, 'Pengaturan']]
  : [[Lock, 'Tutup Kasir'], [Settings, 'Pengaturan']];
  const moreActive = moreItems.some(([, l]) => l === page);

  /* ===================== Aplikasi utama ===================== */
  return (
    <div className="app-shell">
      {/* [FIX] kelas main--overlay menaikkan z-index <main> saat sheet meja/catatan/diskon terbuka,
          supaya sheet tampil di DEPAN keranjang & navigasi bawah (bukan tertimpa). */}
      <main className={'main' + ((infoOpen || noteItem || discOpen) ? ' main--overlay' : '')}>
        {(!online || queueCount > 0) && (
          <div className="offline"><WifiOff size={16} />{!online ? 'Offline.' : 'Menyambungkan ulang.'} {queueCount > 0 ? `${queueCount} pesanan menunggu dikirim.` : 'Pesanan baru akan diantre.'}</div>
        )}
        {page !== 'Antrian' && (
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-logo"><img src="/icon.svg" alt="Logo Zayga" /></div>
              <div><p className="eyebrow">{user.role === 'Admin' ? 'PANEL ADMIN' : user.role === 'Dapur' ? 'AREA DAPUR' : 'AREA KASIR'}</p><h2>{page}</h2></div>
            </div>
            <div className="top-right">
              {(() => {
                const pr = devicePeers.find(p => p.printer);
                const au = devicePeers.find(p => p.audio);
                const nm = p => p ? (p.deviceId === deviceId ? 'HP ini' : p.deviceName) : 'tidak ada';
                return (
                  <button type="button" className="hide-mobile" onClick={() => handlePageChange('Pengaturan')}
                    title="Status perangkat printer & suara"
                    style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: pr && au ? '#166534' : '#b45309' }}>
                    🖨 {nm(pr)} · 🔊 {nm(au)}
                  </button>
                );
              })()}
              <span className="live-dot"></span>
              <span className="date-pill">
                <Clock size={14} />
                <span className="hide-mobile">{new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </span>
              <button className="icon-btn topbar-logout" title="Keluar" onClick={logoutNow}><LogOut size={18} /></button>
            </div>
          </header>
        )}

        {/* ================= PESANAN ================= */}
        {page === 'Pesanan' && user.role !== 'Dapur' && (
          <div className="po-wrap" style={{ '--po-top': stickyTop + 'px' }}>
            <section className="po-menu">
              <div className="po-top">
                {addingToOrder ? (
                  <div className="po-ctx add">
                    <div><small>Menambah ke bon</small><b>Meja {addingToOrder.location} · {addingToOrder.customer || 'Umum'}</b></div>
                    <button type="button" onClick={cancelAddToOrder}>Batal</button>
                  </div>
                ) : (
                  <>
                    <div className="dr">
                      {view.map((d, i) => {
                        const on = d.id === draftId;
                        const q = d.cart.reduce((s, x) => s + x.qty, 0);
                        return (
                          <div key={d.id} role="button" tabIndex={0} className={'dr-chip ' + (on ? 'on' : '')} onClick={() => switchDraft(d.id)}>
                            {draftLabel(d, i)}{q > 0 && <em>{q}</em>}
                            {on && (view.length > 1 || q > 0) && <span className="dr-x" role="button" aria-label="Hapus draf" onClick={e => { e.stopPropagation(); removeDraft(); }}><X size={13} /></span>}
                          </div>
                        );
                      })}
                      <button type="button" className="dr-add" onClick={addDraft} aria-label="Pesanan baru"><Plus size={16} /> Baru</button>
                    </div>
                    <button type="button" className={'po-ctx ' + (location.trim() ? 'set' : 'empty')} onClick={() => setInfoOpen(true)}>
                      <MapPin size={18} />
                      <span className="po-ctx-text">
                        {location.trim() ? <><b>{locLabel(location)}</b>{customer.trim() && <small> · {customer.trim()}</small>}</> : <b>Pilih meja dulu</b>}
                      </span>
                      <em>{location.trim() ? 'Ubah' : 'Atur'}</em>
                    </button>
                  </>
                )}
                <div className="po-search">
                  <Search size={17} />
                  <input ref={searchRef} placeholder="Cari menu..." value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <div className="po-cats">
                  {menuTabs.map(c => (
                    <button key={c} type="button" className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>{c === 'Favorit' ? '★ Favorit' : c}</button>
                  ))}
                </div>
              </div>

              <div className="po-list">
                {showBakso && (
                  <div className={'po-item ' + (baksoQty > 0 ? 'on' : '')} role="button" tabIndex={0} onClick={openBakso} onKeyDown={e => { if (e.key === 'Enter') openBakso(); }}>
                    <div className="po-info"><b>Bakso</b><small>Bakso</small><strong>Harga custom</strong></div>
                    <div className="po-act">
                      {baksoQty > 0 && <span className="po-badge">{baksoQty}</span>}
                      <span className="po-plus"><Plus size={18} /></span>
                    </div>
                  </div>
                )}
                {filtered.map(x => {
                  const q = qtyOf(x);
                  const variant = x.category === 'Minuman' || x.category === 'Kopi' || !!x._temperaturePrices;
                  return (
                    <div key={x.id} className={'po-item ' + (q > 0 ? 'on ' : '') + (x.sold_out ? 'off' : '')} role="button" tabIndex={0}
                      onPointerDown={() => pressStart(x)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
                      onContextMenu={e => e.preventDefault()} onClick={() => tap(x)} onKeyDown={e => { if (e.key === 'Enter') add(x); }}>
                      <div className="po-info">
                        <b>{x.name}{x.sold_out && <span className="po-tag">Habis</span>}{!x.sold_out && x.stock != null && <span className="po-tag stock">Sisa {x.stock}</span>}</b>
                        <small>{x.category}</small><strong>{money(x.price)}</strong>
                      </div>
                      <div className="po-act">
                        {q > 0 && !variant ? (
                          <div className="po-step">
                            <button type="button" aria-label="Kurangi" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); decOne(x); }}><Minus size={16} /></button>
                            <b>{q}</b>
                            <button type="button" aria-label="Tambah" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); add(x); }}><Plus size={16} /></button>
                          </div>
                        ) : (
                          <>
                            {q > 0 && <span className="po-badge">{q}</span>}
                            <span className="po-plus"><Plus size={18} /></span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!showBakso && !filtered.length && <div className="po-empty">Menu tidak ditemukan.</div>}
                {filtered.length > 0 && <div className="po-hint">Tahan lama pada menu untuk tandai habis atau atur stok harian.</div>}
              </div>
            </section>

            {(cart.length > 0 || addingToOrder) && (
              <button type="button" className="po-bar" onClick={() => setCartOpen(true)}>
                <div><small>{cartQty} item{discAmt > 0 ? ' · diskon' : ''}</small><b>{money(shownTotal)}</b></div>
                <span>Lihat Pesanan ›</span>
              </button>
            )}

            <div className={'po-cart-wrap ' + (cartOpen ? 'open' : '')}>
              <div className="po-backdrop" onClick={() => setCartOpen(false)}></div>
              <aside className="po-cart">
                <div className="po-handle"></div>
                <div className="po-cart-head">
                  <div>
                    <h3>{addingToOrder ? `Tambahan Meja ${addingToOrder.location}` : 'Pesanan Baru'}</h3>
                    <p>{cartQty} item · {cart.length} jenis</p>
                  </div>
                  <button type="button" className="po-x mob" onClick={() => setCartOpen(false)} aria-label="Tutup"><X size={18} /></button>
                </div>

                <div className="po-cart-body">
                  <button type="button" className={'po-ctx po-ctx-row ' + (addingToOrder ? (notes.trim() ? 'set' : '') : (location.trim() ? 'set' : 'empty'))} onClick={() => setInfoOpen(true)}>
                    {addingToOrder ? <ClipboardList size={18} /> : <MapPin size={18} />}
                    <span className="po-ctx-text">
                      {addingToOrder
                        ? (notes.trim() ? <b>{notes.trim()}</b> : <b>Tambah catatan</b>)
                        : (location.trim() ? <><b>{locLabel(location)}</b>{customer.trim() && <small> · {customer.trim()}</small>}</> : <b>Pilih meja dulu</b>)}
                    </span>
                    <em>{addingToOrder ? (notes.trim() ? 'Ubah' : 'Isi') : (location.trim() ? 'Ubah' : 'Atur')}</em>
                  </button>

                  {!cart.length ? (
                    <div className="po-none">Keranjang masih kosong.<br />Pilih menu di daftar.</div>
                  ) : (
                    cart.map(x => (
                      <div className="po-ci" key={x.id}>
                        <div>
                          <b>{x.name}</b>
                          <small>{money(x.price)} / porsi</small>
                          <button type="button" onClick={() => openItemNote(x)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 10px', borderRadius: 8, border: `1.5px dashed ${x.note ? '#f59e0b' : '#cbd5e1'}`, background: x.note ? '#fffbeb' : '#fff', color: x.note ? '#92400e' : '#64748b', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', maxWidth: '100%', textAlign: 'left' }}>
                            <Pencil size={13} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[x.optionNote, x.customNote || (!x.optionNote ? x.note : '')].filter(Boolean).join(' · ') || 'Catatan'}</span>
                          </button>
                        </div>
                        <strong>{money(x.price * x.qty)}</strong>
                        <div className="po-step">
                          <button type="button" aria-label="Kurangi" onClick={() => changeQty(x.id, -1)}><Minus size={16} /></button>
                          <b>{x.qty}</b>
                          <button type="button" aria-label="Tambah" onClick={() => changeQty(x.id, 1)}><Plus size={16} /></button>
                        </div>
                        <div className="po-ci-r" style={{ justifyContent: 'flex-end' }}>
                          <button type="button" className="po-del" aria-label="Hapus item" onClick={() => changeQty(x.id, -x.qty)}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="po-cart-foot">
                  {!addingToOrder && cart.length > 0 && (
                    <button type="button" className={'po-disc ' + (discAmt > 0 ? 'on' : '')} onClick={() => setDiscOpen(true)}>
                      <Percent size={15} />{discAmt > 0 ? `Diskon −${money(discAmt)}` : 'Tambah diskon'}<em>{discAmt > 0 ? 'Ubah' : ''}</em>
                    </button>
                  )}
                  {discAmt > 0 && !addingToOrder && <div className="po-sub"><span>Subtotal</span><span>{money(subtotal)}</span></div>}
                  <div className="po-total">
                    <span>{addingToOrder ? 'Total tambahan' : 'Total'}</span>
                    <strong>{money(shownTotal)}</strong>
                  </div>
                  {addingToOrder ? (
                    <>
                      <button type="button" className="po-go" disabled={!cart.length} onClick={startSaveAddition}>Simpan Tambahan</button>
                      <button type="button" className="po-go alt" onClick={cancelAddToOrder}>Batal</button>
                    </>
                  ) : (
                    <button type="button" className="po-go" disabled={!cart.length} onClick={goPay}>Lanjut Pembayaran</button>
                  )}
                </div>
              </aside>
            </div>

            {infoOpen && (
              <div className="po-ov" onClick={() => setInfoOpen(false)}>
                <div className="po-sheet" onClick={e => e.stopPropagation()}>
                  <div className="po-handle"></div>
                  <div className="po-cart-head">
                    <div>
                      <h3>{addingToOrder ? 'Catatan tambahan' : 'Detail pesanan'}</h3>
                      <p>{addingToOrder ? `Untuk bon meja ${addingToOrder.location}` : 'Meja wajib diisi agar pesanan mudah diantar'}</p>
                    </div>
                    <button type="button" className="po-x" onClick={() => setInfoOpen(false)} aria-label="Tutup"><X size={18} /></button>
                  </div>
                  <div className="po-sheet-body">
                    {!addingToOrder && (
                      <>
                        <span className="po-lbl" style={{ marginTop: 4 }}>Meja</span>
                        <div className="po-tg">
                          {Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0')).map(n => (
                            <button type="button" key={n} className={'po-tn ' + (location === n ? 'on' : '')} onClick={() => { setLocation(n); setPayungOpen(false); }}>{n}</button>
                          ))}
                        </div>
                        <div className="po-quick">
                          {['Bawa pulang', 'Meja belakang'].map(q => (
                            <button type="button" key={q} className={location === q ? 'on' : ''} onClick={() => { setLocation(q); setPayungOpen(false); }}>{q}</button>
                          ))}
                          <button
                            type="button"
                            className={'po-payung-trigger ' + (/^payung\s+/i.test(location) ? 'on' : '')}
                            onClick={() => {
                              if (/^payung\s+/i.test(location)) {
                                setPayungOpen(!payungOpen);
                              } else {
                                setLocation('Payung 1');
                                setPayungOpen(true);
                              }
                            }}>
                            <Umbrella size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {/^payung\s+/i.test(location) ? location : 'Payung'}
                          </button>
                          {location && <button type="button" onClick={() => { setLocation(''); setPayungOpen(false); }}>Hapus pilihan</button>}
                        </div>

                        {(payungOpen || /^payung\s+/i.test(location)) && (
                          <div className="po-payung-sub">
                            <div className="po-payung-head">
                              <span><Umbrella size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Pilih Meja Payung:</span>
                              <small>Otomatis tercetak Payung [Nomor]</small>
                            </div>
                            <div className="po-payung-grid">
                              {PAYUNG_NUMS.map(num => {
                                const val = `Payung ${num}`;
                                const active = (location || '').toLowerCase() === val.toLowerCase();
                                return (
                                  <button
                                    type="button"
                                    key={num}
                                    className={active ? 'on' : ''}
                                    onClick={() => {
                                      setLocation(val);
                                      setPayungOpen(true);
                                    }}>
                                    Payung {num}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <input className="po-in" style={{ marginTop: 8 }}
                          value={/^\d{2}$/.test(location) && Number(location) >= 1 && Number(location) <= 40 ? '' : location}
                          onChange={e => setLocation(e.target.value)} placeholder="Atau ketik lokasi lain..." />

                        <span className="po-lbl">Nama pelanggan <em>opsional</em></span>
                        <input className="po-in" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Masukkan nama..." />
                      </>
                    )}
                    <span className="po-lbl" style={addingToOrder ? { marginTop: 4 } : {}}>{addingToOrder ? 'Catatan tambahan' : 'Catatan khusus'} <em>opsional</em></span>
                    <textarea className="po-in" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: tidak pedas, es sedikit..." />
                  </div>
                  <div className="po-cart-foot">
                    <button type="button" className="po-go" onClick={() => setInfoOpen(false)}>Selesai</button>
                  </div>
                </div>
              </div>
            )}

            {noteItem && (
              <div className="po-ov" onClick={() => setNoteItem(null)}>
                <div className="po-sheet" onClick={e => e.stopPropagation()}>
                  <div className="po-handle"></div>
                  <div className="po-cart-head">
                    <div><h3>Catatan untuk dapur</h3><p>{noteItem.name}</p></div>
                    <button type="button" className="po-x" onClick={() => setNoteItem(null)} aria-label="Tutup"><X size={18} /></button>
                  </div>
                  <div className="po-sheet-body">
                    <p style={{ margin: '0 0 8px', fontSize: '.76rem', color: '#64748b', fontWeight: 600 }}>
                      Pilihan khusus {getNotePresetType(noteItem) === 'coffee' ? 'kopi' : getNotePresetType(noteItem) === 'drink' ? 'minuman' : 'makanan'} ini
                    </p>
                    <div className="po-quick" style={{ marginTop: 0 }}>
                      {noteChips.map(p => (
                        <button type="button" key={p} className={noteDraft.split(',').map(s => s.trim()).includes(p) ? 'on' : ''} onClick={() => toggleNoteChip(p)}>{p}</button>
                      ))}
                    </div>
                    <input className="po-in" style={{ marginTop: 10 }} value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveItemNote(); }} placeholder="Tambahkan catatan khusus untuk menu ini..." />
                    {noteItem.qty > 1 && (
                      <p style={{ margin: '10px 0 0', fontSize: '.78rem', color: '#64748b' }}>
                        Catatan berlaku untuk semua {noteItem.qty} porsi. Kalau tiap porsi beda, tambahkan menunya lagi sebagai baris baru.
                      </p>
                    )}
                  </div>
                  <div className="po-cart-foot">
                    <button type="button" className="po-go" onClick={saveItemNote}>{noteDraft.trim() ? 'Simpan catatan' : 'Hapus catatan'}</button>
                  </div>
                </div>
              </div>
            )}

            {discOpen && (
              <div className="po-ov" onClick={() => setDiscOpen(false)}>
                <div className="po-sheet" onClick={e => e.stopPropagation()}>
                  <div className="po-handle"></div>
                  <div className="po-cart-head">
                    <div><h3>Diskon</h3><p>Subtotal {money(subtotal)}</p></div>
                    <button type="button" className="po-x" onClick={() => setDiscOpen(false)} aria-label="Tutup"><X size={18} /></button>
                  </div>
                  <div className="po-sheet-body">
                    <div className="po-seg">
                      {[['rp', 'Rupiah (Rp)'], ['pct', 'Persen (%)']].map(([t, l]) => (
                        <button type="button" key={t} className={discount.type === t ? 'on' : ''} onClick={() => setDiscount({ type: t, value: '' })}>{l}</button>
                      ))}
                    </div>
                    <input className="po-in" style={{ marginTop: 12 }} inputMode="numeric" autoFocus
                      value={discount.value} onChange={e => setDiscount({ ...discount, value: e.target.value.replace(/\D/g, '').slice(0, discount.type === 'pct' ? 3 : 7) })}
                      placeholder={discount.type === 'pct' ? 'Contoh: 10' : 'Contoh: 5000'} />
                    <div className="po-quick">
                      {(discount.type === 'pct' ? [5, 10, 15, 20] : [1000, 2000, 5000, 10000]).map(v => (
                        <button type="button" key={v} className={String(discount.value) === String(v) ? 'on' : ''} onClick={() => setDiscount({ ...discount, value: String(v) })}>{discount.type === 'pct' ? v + '%' : money(v)}</button>
                      ))}
                    </div>
                    <div className="po-prev"><span>Total setelah diskon</span><b>{money(netTotal)}</b></div>
                  </div>
                  <div className="po-cart-foot">
                    <button type="button" className="po-go" onClick={() => setDiscOpen(false)}>Terapkan</button>
                    {discAmt > 0 && <button type="button" className="po-go warn" onClick={() => { setDiscount({ type: 'rp', value: '' }); setDiscOpen(false); }}>Hapus diskon</button>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= DENAH MEJA ================= */}
        {page === 'Denah' && user.role !== 'Dapur' && (() => {
          const nums = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0'));
          const stateOf = k => { const l = tableInfo[k] || []; if (!l.length) return 'free'; if (l.some(o => o.bill_requested && remainOf(o) > 0)) return 'requested'; if (l.some(o => remainOf(o) > 0)) return 'due'; if (l.some(o => statusOf(o) !== 'Diantar')) return 'busy'; return 'free'; };
          const pretty = {
            'bawa pulang': 'Bawa pulang',
            'meja belakang': 'Meja belakang',
            ...Object.fromEntries(PAYUNG_NUMS.map(n => [`payung ${n}`, `Payung ${n}`]))
          };
          const extras = [...new Set([...Object.keys(pretty), ...Object.keys(tableInfo).filter(k => !/^\d{2}$/.test(k))])];
          const stText = { free: 'Kosong', busy: 'Terisi', due: 'Belum lunas', requested: 'Minta bill' };
          const cnt = s => nums.filter(n => stateOf(n) === s).length;
          const cell = (k, label, loc) => {
            const st = stateOf(k), n = (tableInfo[k] || []).length;
            return (
              <button type="button" key={k} className={'tb-cell tb-' + st} style={st === 'requested' ? { background: '#fbf1d4', borderColor: '#c49a43', color: '#76591c', boxShadow: '0 0 0 2px rgba(196,154,67,.14)' } : undefined} onClick={() => setTableSheet({ key: k, label, loc })}>
                <span className="tb-seat-number">{label.replace('Meja ', '')}</span>
                <small>{stText[st]}{n > 1 ? ` · ${n} bon` : ''}</small>
              </button>
            );
          };
          return (
            <div className="content">
              <div className="tb">
                <div className="tb-header">
                  <div className="tb-header-info">
                    <h3>Denah Meja</h3>
                    <p>Status keterisian meja dan kelola pesanan pelanggan</p>
                  </div>
                </div>
                <div className="tb-legend-wrap">
                  <div className="tb-legend-title"><span>STATUS MEJA</span><i></i><small>Pembaruan langsung</small></div>
                  <div className="tb-sum">
                    <span className="tb-pill"><i style={{ background: '#16a34a' }}></i>Kosong {cnt('free')}</span>
                    <span className="tb-pill"><i style={{ background: '#2563eb' }}></i>Terisi {cnt('busy')}</span>
                    <span className="tb-pill"><i style={{ background: '#dc2626' }}></i>Belum lunas {cnt('due')}</span>
                    <span className="tb-pill"><i style={{ background: '#d97706' }}></i>Minta bill {cnt('requested')}</span>
                  </div>
                </div>
                <div className="tb-floor">
                  <div className="tb-floor-top"><span>AREA UTAMA</span><span>{nums.length} Meja</span></div>
                  <div className="tb-grid">{nums.map(n => cell(n, 'Meja ' + n, n))}</div>
                  <div className="tb-ex">{extras.map(k => cell(k, pretty[k] || tableInfo[k]?.[0]?.location || k, pretty[k] || tableInfo[k]?.[0]?.location || k))}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================= ANTRIAN (BERBEDA PER HAK AKSES) ================= */}
        {page === 'Antrian' && (() => {
          const role = user.role;
          const isAdmin = role === 'Admin';
          const queueView = role === 'Dapur' ? 'dapur' : role === 'Kasir' ? 'kasir' : adminQueueMode;
          const canCook = role === 'Dapur' || isAdmin;      // boleh mengubah Baru/Dimasak/Siap
          const canDeliver = role === 'Kasir' || isAdmin;   // boleh menandai Diantar

          const act = todays.filter(o => statusOf(o) !== 'Diantar').sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
          const isDrinkItem = it => ['Minuman', 'Kopi', 'Soft Drink'].includes(it.category) || /(es|teh|jeruk|kopi|susu|jus|air|drink)/i.test(it.name);
          const hasReady = o => (o?.items || []).some(i => itemSt(i) === 'Siap');
          const readyCount = o => (o?.items || []).filter(i => itemSt(i) === 'Siap').length;

          const getElapsed = o => {
            if (!o.created_at) return { mins: 0, text: '0m', alertLevel: 'safe' };
            const diffSec = Math.max(0, Math.floor((kdsTime.getTime() - Date.parse(o.created_at)) / 1000));
            const mins = Math.floor(diffSec / 60);
            const secs = diffSec % 60;
            const text = mins >= 60 ? `${Math.floor(mins / 60)}j ${mins % 60}m` : `${mins}m ${String(secs).padStart(2, '0')}s`;
            const alertLevel = mins >= 20 ? 'critical' : mins >= 10 ? 'warning' : 'safe';
            return { mins, secs, text, alertLevel };
          };

          // Toggle tampilan khusus Admin
          const adminToggle = isAdmin && (
            <div className="exp-admin-toggle" role="tablist" title="Pilih tampilan antrian">
              <button type="button" className={queueView === 'dapur' ? 'on' : ''} onClick={() => changeAdminQueueMode('dapur')}>👨‍🍳 Dapur</button>
              <button type="button" className={queueView === 'kasir' ? 'on' : ''} onClick={() => changeAdminQueueMode('kasir')}>🧾 Kasir</button>
            </div>
          );

          const syncBtn = (
            <button type="button" className="kds-action-btn" onClick={syncKdsNow} disabled={kdsSyncing} title="Sinkronkan data dengan database">
              <RefreshCw size={15} className={kdsSyncing ? 'anim-spin' : ''} /> <span className="btn-text-desktop">{kdsSyncing ? 'Menyinkronkan...' : 'Sinkron'}</span>
            </button>
          );

          const emptyBox = (title, text) => (
            <div className="ui-empty" style={{ padding: '48px 16px', background: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
              <ChefHat size={36} color="#94a3b8" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#1e293b' }}>{title}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem' }}>{text}</p>
            </div>
          );

          /* ============ TAMPILAN DAPUR (KDS) ============ */
          if (queueView === 'dapur') {
            const cnt = s => act.filter(o => statusOf(o) === s).length;
            let list = qTab === 'Semua' ? act : act.filter(o => statusOf(o) === qTab);
            if (kdsStation === 'Makanan') list = list.filter(o => (o.items || []).some(it => !isDrinkItem(it) && itemSt(it) !== 'Diantar'));
            else if (kdsStation === 'Minuman') list = list.filter(o => (o.items || []).some(it => isDrinkItem(it) && itemSt(it) !== 'Diantar'));

            // Ringkasan batch memasak
            const cookingBatch = (() => {
              const tally = {};
              act.forEach(o => (o.items || []).forEach(it => {
                const st = itemSt(it);
                if (st !== 'Baru' && st !== 'Dimasak') return;
                if (kdsStation === 'Makanan' && isDrinkItem(it)) return;
                if (kdsStation === 'Minuman' && !isDrinkItem(it)) return;
                const key = it.name;
                if (!tally[key]) tally[key] = { name: it.name, qty: 0 };
                tally[key].qty += (it.qty || 1);
              }));
              return Object.values(tally).sort((a, b) => b.qty - a.qty);
            })();

            const tabs = ['Semua', 'Baru', 'Dimasak', 'Siap'];

            return (
              <div className="kds-content">
                <div className="kds-container">
                  <div className="kds-topbar">
                    <div className="kds-topbar-left">
                      <div className="kds-brand">
                        <div className="kds-brand-ico"><ChefHat size={20} /></div>
                        <div>
                          <h2>Antrian Dapur</h2>
                          <p>{act.length} pesanan aktif · {user.username}</p>
                        </div>
                      </div>
                      <span className={'kds-live-tag ' + (realtimeConnected ? '' : 'reconnecting')}>
                        <span className="kds-pulse-dot"></span>
                        {realtimeConnected ? 'Real-time Sinkron' : 'Menghubungkan...'}
                      </span>
                    </div>
                    <div className="kds-topbar-right">
                      {adminToggle}
                      <div className="kds-clock" title="Waktu lokal">
                        <Clock size={15} />
                        {kdsTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <button type="button" className="kds-action-btn" onClick={playCentralKitchenAlarm} title="Uji alarm pusat audio">
                        <Bell size={15} /> <span className="btn-text-desktop">Tes </span>Bel
                      </button>
                      {syncBtn}
                      <button type="button" className="kds-action-btn" onClick={toggleKdsFullscreen} title="Layar penuh untuk monitor dapur">
                        {kdsFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        <span className="btn-text-desktop">{kdsFullscreen ? 'Kecilkan' : 'Layar Penuh'}</span>
                      </button>
                    </div>
                  </div>

                  {cookingBatch.length > 0 && (
                    <div className="kds-batch-bar">
                      <span className="kds-batch-title"><Flame size={16} /> Perlu Dimasak:</span>
                      <div className="kds-batch-items">
                        {cookingBatch.slice(0, 10).map((b, i) => (
                          <span key={i} className="kds-batch-pill"><b>{b.qty}×</b> {b.name}</span>
                        ))}
                        {cookingBatch.length > 10 && (
                          <span className="kds-batch-pill" style={{ background: 'var(--warn-s)', color: 'var(--warn)' }}>+{cookingBatch.length - 10} menu lain</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="kds-controls">
                    <div className="kds-seg-scroll">
                      <div className="kds-seg" role="tablist">
                        {tabs.map(t => (
                          <button key={t} type="button" className={(qTab === t ? 'on ' : '') + (qTab === t ? `tab-${t.toLowerCase()}` : '')} onClick={() => setQTab(t)}>
                            {t} ({t === 'Semua' ? act.length : cnt(t)})
                          </button>
                        ))}
                      </div>
                      <div className="kds-seg">
                        {[['Semua', 'Semua Pos'], ['Makanan', '🍜 Makanan'], ['Minuman', '🥤 Minuman']].map(([stn, lbl]) => (
                          <button key={stn} type="button" className={kdsStation === stn ? 'on' : ''} onClick={() => setKdsStation(stn)}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="kds-grid">
                    {list.map(o => {
                      const st = statusOf(o);
                      const { text: elapsedText, alertLevel } = getElapsed(o);
                      const allItems = o?.items || [];
                      const orderItems = allItems.filter(it => kdsStation === 'Semua' || (kdsStation === 'Makanan' ? !isDrinkItem(it) : isDrinkItem(it)));
                      const siapItems = readyCount(o);

                      return (
                        <div key={o.id} className={'kds-ticket ' + st}>
                          <div className="kds-ticket-head">
                            <div className="kds-meja-badge">{locLabel(o.location)}</div>
                            <div className="kds-ticket-meta">
                              <b>{o.customer || 'Pelanggan Umum'}</b>
                              <small>No.{fmtQueue(computeQueueNo(o, orders))} · {o.time} · {o.cashier ? `Kasir: ${o.cashier}` : o.id}</small>
                            </div>
                            <div className={'kds-timer ' + alertLevel} title={alertLevel === 'critical' ? 'Pesanan sudah lewat 20 menit!' : 'Waktu berjalan sejak pesanan dibuat'}>
                              <Clock size={12} />{elapsedText}
                            </div>
                          </div>

                          {o.notes && (
                            <div className="kds-ticket-notes">
                              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>CATATAN: {o.notes}</span>
                            </div>
                          )}

                          <div className="kds-ticket-body">
                            {orderItems.map((it, idx) => {
                              const ist0 = itemSt(it);
                              const actualIndex = allItems.indexOf(it);
                              return (
                                <div key={idx} className={'kds-item-row ' + (ist0 === 'Siap' ? 'item-siap' : ist0 === 'Dimasak' ? 'item-dimasak' : '')} style={ist0 === 'Diantar' ? { opacity: .55 } : undefined}>
                                  <div className="kds-item-info">
                                    <div className="kds-item-name">
                                      <span className="kds-item-qty">{it.qty}×</span>
                                      <span className="kds-item-title">{it.name}</span>
                                    </div>
                                    {(it.optionNote || it.customNote || it.note) && <span className="kds-item-note">» {[it.optionNote, it.customNote || (!it.optionNote ? it.note : '')].filter(Boolean).join(' · ')}</span>}
                                  </div>

                                  {canCook && ist0 !== 'Diantar' ? (
                                    <div className="kds-item-actions">
                                      {ist0 === 'Baru' && (
                                        <button type="button" onClick={() => setItemStatus(o, actualIndex, 'Dimasak')} className="kds-action-pill btn-start" title="Mulai memasak menu ini">
                                          <Flame size={13} /> Masak
                                        </button>
                                      )}
                                      {ist0 === 'Dimasak' && (
                                        <button type="button" onClick={() => setItemStatus(o, actualIndex, 'Siap')} className="kds-action-pill btn-ready" title="Menu sudah siap disajikan">
                                          <Check size={13} /> Siap ✓
                                        </button>
                                      )}
                                      {ist0 === 'Siap' && (
                                        <>
                                          <button type="button" onClick={() => setItemStatus(o, actualIndex, 'Dimasak')} className="kds-action-pill badge-done" title="Klik untuk mengembalikan ke Dimasak">
                                            <CheckCheck size={13} /> Siap ✓
                                          </button>
                                          {isAdmin && (
                                            <button type="button" onClick={() => setItemStatus(o, actualIndex, 'Diantar')} className="kds-action-pill btn-ready" title="Tandai sudah diantar">
                                              Antar
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, background: STATUS_STYLE[ist0][0], color: STATUS_STYLE[ist0][1] }}>{ist0}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="kds-ticket-foot">
                            {canCook && st === 'Baru' && (
                              <button type="button" className="kds-btn-cook" onClick={() => setStatus(o, 'Dimasak')}>
                                <Flame size={16} /> Mulai Masak Semua
                              </button>
                            )}
                            {canCook && st === 'Dimasak' && (
                              <>
                                <button type="button" className="kds-btn-ready" onClick={() => setStatus(o, 'Siap')}>
                                  <CheckCheck size={16} /> Tandai Siap Semua
                                </button>
                                <button type="button" className="kds-btn-ghost" onClick={() => setStatus(o, 'Baru')}>Kembalikan ke Baru</button>
                              </>
                            )}
                            {canCook && st === 'Siap' && (
                              <>
                                <button type="button" className="kds-btn-ghost" style={{ flex: 1 }} onClick={() => setStatus(o, 'Dimasak')}>Kembalikan ke Dimasak</button>
                                {isAdmin && (
                                  <button type="button" className="kds-btn-ready" onClick={() => setStatus(o, 'Diantar')}>
                                    <CheckCircle2 size={16} /> Sudah Diantar
                                  </button>
                                )}
                              </>
                            )}
                            {isAdmin && st !== 'Siap' && siapItems > 0 && (
                              <button type="button" className="kds-btn-ghost" onClick={() => deliverReady(o)}>Antar {siapItems} siap</button>
                            )}
                            <button type="button" className="kds-btn-ghost" onClick={() => printOrder(o, 'kitchen')} title="Cetak ulang tiket dapur">
                              <Printer size={15} /> Cetak
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!list.length && emptyBox('Semua Pesanan Selesai!', 'Tidak ada pesanan pada filter ini. Layar akan otomatis berbunyi ketika ada pesanan baru dari kasir.')}
                </div>
              </div>
            );
          }

          /* ============ TAMPILAN KASIR / PENYAJIAN (EXPEDITER) ============ */
          const tabOf = o => hasReady(o) ? 'Siap' : (statusOf(o) === 'Dimasak' ? 'Dimasak' : 'Baru');
          const cntTab = t => t === 'Semua' ? act.length : act.filter(o => tabOf(o) === t).length;
          const readyOrders = act.filter(hasReady);
          const totalReadyMenus = readyOrders.reduce((s, o) => s + readyCount(o), 0);
          let kList = cashierTab === 'Semua' ? act : act.filter(o => tabOf(o) === cashierTab);
          if (cashierTab === 'Semua') {
            kList = [...kList].sort((a, b) => (hasReady(b) ? 1 : 0) - (hasReady(a) ? 1 : 0) || Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
          }
          const kTabs = [['Siap', 'Siap Antar'], ['Dimasak', 'Dimasak'], ['Baru', 'Baru'], ['Semua', 'Semua']];

          const bannerOf = o => {
            const its = (o?.items || []).filter(i => itemSt(i) !== 'Diantar');
            const siap = its.filter(i => itemSt(i) === 'Siap').length;
            if (its.length && siap === its.length) return ['ready', `✅ Semua ${siap} menu siap diantar`];
            if (siap > 0) return ['partial', `🔔 ${siap} dari ${its.length} menu siap diantar`];
            if (its.some(i => itemSt(i) === 'Dimasak')) return ['cooking', '🔥 Sedang dimasak dapur'];
            return ['waiting', '⏳ Menunggu dapur'];
          };

          const payTag = o => remainOf(o) > 0
            ? <button type="button" className="exp-pay-tag exp-pay-unpaid" onClick={() => openSettle(o)} title="Klik untuk menerima pembayaran">
                <Wallet size={12} /> {o.payment === 'Belum Bayar' ? 'Belum bayar' : 'Sisa'} {money(remainOf(o))}
              </button>
            : <span className="exp-pay-tag exp-pay-paid"><Check size={12} /> Lunas</span>;

          const isTakeaway = o => /bawa|pulang/i.test(String(o.location || ''));

          return (
            <div className="exp-content">
              <div className="exp-container">
                <div className="exp-topbar">
                  <div className="exp-topbar-left">
                    <div className="exp-brand">
                      <div className="exp-brand-ico"><Radio size={22} /></div>
                      <div>
                        <h2>PENYAJIAN & ANTRIAN</h2>
                        <p>{act.length} pesanan aktif · {user.username}</p>
                      </div>
                    </div>
                    <span className={'kds-live-tag ' + (realtimeConnected ? '' : 'reconnecting')}>
                      <span className="kds-pulse-dot"></span>
                      {realtimeConnected ? 'Real-time' : 'Menghubungkan...'}
                    </span>
                  </div>
                  <div className="exp-topbar-right">
                    {adminToggle}
                    <button type="button" className="kds-action-btn" onClick={() => { beep(660, 0.22, 2); buzz(60); }} title="Uji bunyi notifikasi pesanan siap">
                      <Bell size={15} /> <span className="btn-text-desktop">Tes </span>Bunyi
                    </button>
                    {syncBtn}
                  </div>
                </div>

                {totalReadyMenus > 0 && (
                  <div className="exp-ready-banner">
                    <div className="exp-ready-banner-left">
                      <div className="exp-ready-ico"><Bell size={18} /></div>
                      <div>
                        <b>{totalReadyMenus} menu siap diantar</b>
                        <span>dari {readyOrders.length} pesanan · ketuk meja untuk melihat</span>
                      </div>
                    </div>
                    <div className="exp-ready-pills">
                      {readyOrders.map(o => (
                        <button key={o.id} type="button" className="exp-ready-chip" onClick={() => setCashierTab('Siap')}>
                          {locLabel(o.location)} · {readyCount(o)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="exp-controls">
                  <div className="exp-tabs">
                    {kTabs.map(([t, lbl]) => (
                      <button key={t} type="button" className={'exp-tab-btn ' + (cashierTab === t ? `on tab-${t.toLowerCase()}` : '')} onClick={() => setCashierTab(t)}>
                        {lbl}
                        <span className={'exp-badge-count ' + (t === 'Siap' && cntTab(t) > 0 ? 'siap' : 'neutral')}>{cntTab(t)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="exp-layout-toggle">
                    <button type="button" className={cashierLayout === 'cards' ? 'on' : ''} onClick={() => changeCashierLayout('cards')}><LayoutGrid size={14} /> Kartu</button>
                    <button type="button" className={cashierLayout === 'compact' ? 'on' : ''} onClick={() => changeCashierLayout('compact')}><List size={14} /> Ringkas</button>
                  </div>
                </div>

                {/* ---- Mode Kartu ---- */}
                {cashierLayout === 'cards' && (
                  <div className="exp-grid">
                    {kList.map(o => {
                      const [bk, bt] = bannerOf(o);
                      const { text: elapsedText } = getElapsed(o);
                      const allItems = o?.items || [];
                      const nReady = readyCount(o);
                      const cls = hasReady(o) ? 'has-ready' : statusOf(o) === 'Dimasak' ? 'is-cooking' : 'is-new';
                      return (
                        <div key={o.id} className={'exp-card ' + cls}>
                          <div className="exp-card-head">
                            <div className={'exp-meja-badge ' + (isTakeaway(o) ? 'takeaway' : '')}>{locLabel(o.location)}</div>
                            <div className="exp-card-meta">
                              <b>{o.customer || 'Pelanggan Umum'}</b>
                              <small>{o.time} · {elapsedText} lalu</small>
                            </div>
                            {payTag(o)}
                          </div>

                          <div className={'exp-status-banner ' + bk}>{bt}</div>

                          {o.notes && (
                            <div className="kds-ticket-notes">
                              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>{o.notes}</span>
                            </div>
                          )}

                          <div className="exp-card-body">
                            {allItems.map((it, idx) => {
                              const s = itemSt(it);
                              return (
                                <div key={idx} className={'exp-item-row ' + (s === 'Siap' ? 'is-ready' : s === 'Diantar' ? 'is-delivered' : '')}>
                                  <div className="exp-item-info">
                                    <div className="exp-item-name">
                                      <span className="exp-item-qty">{it.qty}×</span>
                                      <span className="exp-item-title">{it.name}</span>
                                    </div>
                                    {(it.optionNote || it.customNote || it.note) && <span className="exp-item-note">» {[it.optionNote, it.customNote || (!it.optionNote ? it.note : '')].filter(Boolean).join(' · ')}</span>}
                                  </div>
                                  {s === 'Siap' && canDeliver ? (
                                    <button type="button" className="exp-item-btn-deliver" onClick={() => setItemStatus(o, idx, 'Diantar')}>
                                      <Check size={14} /> Antar
                                    </button>
                                  ) : (
                                    <span className="exp-item-status-tag" style={{ background: STATUS_STYLE[s][0], color: STATUS_STYLE[s][1] }}>{s === 'Siap' ? 'Siap ✓' : s}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="exp-card-foot">
                            {nReady > 0 && (
                              <button type="button" className="exp-btn-deliver-all" onClick={() => deliverReady(o)}>
                                <CheckCircle2 size={17} /> {nReady === allItems.filter(i => itemSt(i) !== 'Diantar').length ? 'Antar Semua' : `Antar ${nReady} Menu yang Siap`}
                              </button>
                            )}
                            <div className="exp-card-actions">
                              <button type="button" className="exp-btn-sub" onClick={() => setSelectedOrder(o)}><Eye size={14} /> Detail</button>
                              {remainOf(o) > 0
                                ? <button type="button" className="exp-btn-sub" style={{ color: '#991b1b', borderColor: '#fca5a5' }} onClick={() => openSettle(o)}><Wallet size={14} /> Bayar</button>
                                : <button type="button" className="exp-btn-sub" onClick={() => startAddToOrder(o)}><Plus size={14} /> Tambah</button>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ---- Mode Ringkas ---- */}
                {cashierLayout === 'compact' && (
                  <div className="exp-list">
                    {kList.map(o => {
                      const [bk, bt] = bannerOf(o);
                      const { text: elapsedText } = getElapsed(o);
                      const nReady = readyCount(o);
                      const summary = (o.items || []).filter(i => itemSt(i) !== 'Diantar').map(i => `${i.qty}× ${i.name}`).join(', ');
                      return (
                        <div key={o.id} className={'exp-list-row ' + (hasReady(o) ? 'has-ready' : '')}>
                          <div className="exp-list-left">
                            <div className={'exp-meja-badge ' + (isTakeaway(o) ? 'takeaway' : '')}>{locLabel(o.location)}</div>
                            <div className="exp-card-meta">
                              <b>{o.customer || 'Pelanggan Umum'}</b>
                              <small>{elapsedText} lalu · {summary.length > 70 ? summary.slice(0, 70) + '…' : summary}</small>
                            </div>
                          </div>
                          <div className="exp-list-mid">
                            <span className={'exp-status-banner ' + bk} style={{ padding: '4px 10px', borderRadius: 6, border: 0 }}>{bt}</span>
                            {payTag(o)}
                          </div>
                          <div className="exp-list-right">
                            {nReady > 0 && (
                              <button type="button" className="exp-item-btn-deliver" style={{ minHeight: 38 }} onClick={() => deliverReady(o)}>
                                <Check size={14} /> Antar {nReady}
                              </button>
                            )}
                            <button type="button" className="exp-btn-sub" style={{ padding: '0 12px' }} onClick={() => setSelectedOrder(o)}><Eye size={14} /> Detail</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!kList.length && emptyBox(
                  cashierTab === 'Siap' ? 'Belum ada menu yang siap' : 'Tidak ada pesanan',
                  cashierTab === 'Siap' ? 'Layar akan berbunyi otomatis saat dapur menandai menu siap diantar.' : 'Tidak ada pesanan aktif pada filter ini.'
                )}
              </div>
            </div>
          );
        })()}

        {/* ================= DASHBOARD (KHUSUS ADMIN) ================= */}
        {page === 'Dashboard' && user.role === 'Admin' && (
          <DashboardView orders={orders} items={items} onOpenHistory={() => setPage('Riwayat')} onOpenQueue={() => setPage('Antrian')} />
        )}

        {/* ================= RIWAYAT ================= */}
        {page === 'Riwayat' && user.role !== 'Dapur' && (() => {
          const baseList = histFilter === 'Hari ini' ? todays : histFilter === 'Belum lunas' ? orders.filter(o => remainOf(o) > 0) : orders;
          const hq = histQuery.trim().toLowerCase().replace(/^(no\.?|antrian|#)\s*/, '');
          const list = !hq ? baseList : baseList.filter(o => {
            if (/^\d+$/.test(hq)) return (queueMap.get(o.id) || 0) === Number(hq) || normLoc(o.location) === hq || (hq.length >= 4 && String(o.id).includes(hq)); // angka pendek = antrian/meja, angka 4+ digit juga mencari kode struk
            return [o.id, o.customer, locLabel(o.location), o.payment].some(v => String(v || '').toLowerCase().includes(hq));
          });
          return (
            <div className="content history-page">
              <div className="panel history-panel">
                <div className="section-head">
                  <div><h3>Riwayat Transaksi</h3><p className="muted">Daftar pesanan dan transaksi kasir. Ketuk transaksi untuk melihat detail.</p></div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="count-pill">{list.length} transaksi</span>
                    {orders.length > 0 && user.role === 'Admin' && (
                      <button className="danger-btn" onClick={clearAllOrders}
                        style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={14} /> Bersihkan Riwayat
                      </button>
                    )}
                  </div>
                </div>
                <div className="po-search" style={{ marginBottom: 10 }}>
                  <Search size={17} />
                  <input placeholder="Cari no. antrian (mis. 12), ID, pelanggan, meja..." value={histQuery} onChange={e => setHistQuery(e.target.value)} />
                </div>
                <div className="po-cats" style={{ marginBottom: 12 }}>
                  {['Hari ini', 'Belum lunas', 'Semua'].map(f => <button key={f} type="button" className={histFilter === f ? 'on' : ''} onClick={() => setHistFilter(f)}>{f}</button>)}
                </div>
                <div className="history-mobile-list">
                  {list.map(o => {
                    const st = statusOf(o);
                    const remain = remainOf(o);
                    const qty = (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);
                    return (
                      <article className="history-order-card" key={o.id} onClick={() => setSelectedOrder(o)}>
                        <div className="history-card-top">
                          <div className="history-card-top-left">
                            <span style={queueBadgeStyle} title="Nomor antrian (sama dengan tiket dapur)">No. {qLabel(o)}</span>
                            <span className="history-loc-badge" title={locLabel(o.location)}>
                              <MapPin size={12} />
                              <span className="history-loc-text">{locLabel(o.location)}</span>
                            </span>
                            <span className="history-card-date"><Clock size={12} /> {o.date} · {o.time}</span>
                          </div>
                          <span className={'history-payment-state ' + (remain > 0 ? 'unpaid' : 'paid')}>{remain > 0 ? 'Belum lunas' : 'Lunas'}</span>
                        </div>
                        <div className="history-card-main">
                          <div className="history-card-info">
                            <b className="history-card-customer">{o.customer || 'Pelanggan umum'}</b>
                            <div className="history-card-meta">
                              <span className="mono">{o.id}</span>
                              <span>·</span>
                              <span><Utensils size={12} /> {qty} item</span>
                              <span>·</span>
                              <span className="history-status-badge">{st}</span>
                            </div>
                          </div>
                          <div className="history-card-total"><small>Total</small><b>{money(o.total)}</b></div>
                        </div>
                        <div className="history-card-bottom">
                          <span className="history-card-payment-info">{o.payment === 'Split' ? 'Split bill' : o.payment} {remain > 0 ? `· Sisa ${money(remain)}` : ''}</span>
                          <span className="history-open-detail">Lihat detail <ChevronRight size={14} /></span>
                        </div>
                      </article>
                    );
                  })}
                  {!list.length && <div className="history-empty"><ClipboardList size={32} /><b>Belum ada catatan transaksi</b><small>Transaksi yang masuk akan tersimpan di sini.</small></div>}
                </div>
                <div className="history-desktop-table">
                  <OrdersTable orders={list} printOrder={printOrder} onSelectOrder={setSelectedOrder} onDelete={user.role === 'Admin' ? deleteOrder : null} queueMap={queueMap} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================= TUTUP KASIR ================= */}
        {page === 'Tutup Kasir' && user.role !== 'Dapur' && (() => {
          const sh = calcShift(who);
          const opening = Number(shiftForm.opening) || 0, counted = Number(shiftForm.counted) || 0;
          const expected = opening + sh.by.Tunai, diff = counted - expected;
          const names = [...new Set([user.username, ...todays.map(o => o.cashier)])];
          const hist = shifts.filter(s => user.role === 'Admin' || s.cashier === user.username).slice(0, 10);
          return (
            <div className="content">
              <div className="st">
                <div className="st-grid">
                  <div className="st-card">
                    <div className="st-card-head">
                      <span className="st-ico"><Lock size={20} /></span>
                      <div><h3>Rekap shift hari ini</h3><p>Uang yang diterima {who} sejak pagi.</p></div>
                    </div>
                    {user.role === 'Admin' && (
                      <div className="st-field" style={{ marginBottom: 12 }}>
                        <label className="st-label">Kasir</label>
                        <select className="st-input" value={who} onChange={e => setShiftWho(e.target.value)}>
                          {names.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="sh-row"><span>Jumlah transaksi</span><b>{sh.count}</b></div>
                    <div className="sh-row"><span>Penjualan</span><b>{money(sh.sales)}</b></div>
                    <div className="sh-row"><span>Diskon diberikan</span><b>{money(sh.disc)}</b></div>
                    <div className="sh-row"><span>Tunai diterima</span><b>{money(sh.by.Tunai)}</b></div>
                    <div className="sh-row"><span>QRIS</span><b>{money(sh.by.QRIS)}</b></div>
                    <div className="sh-row"><span>Transfer</span><b>{money(sh.by.Transfer)}</b></div>
                    <div className="sh-row"><span>Bon belum bayar</span><b>{money(sh.bon)}</b></div>
                  </div>

                  <div className="st-card">
                    <div className="st-card-head">
                      <span className="st-ico"><Wallet size={20} /></span>
                      <div><h3>Hitung uang di laci</h3><p>Isi modal awal dan uang tunai yang ada sekarang.</p></div>
                    </div>
                    <div className="st-field">
                      <label className="st-label">Modal awal laci (Rp)</label>
                      <input className="st-input" inputMode="numeric" placeholder="0" value={shiftForm.opening} onChange={e => setShiftForm({ ...shiftForm, opening: digits(e.target.value) })} />
                      {opening > 0 && <span className="st-hint">{money(opening)}</span>}
                    </div>
                    <div className="st-field">
                      <label className="st-label">Uang tunai di laci (Rp)</label>
                      <input className="st-input" inputMode="numeric" placeholder="0" value={shiftForm.counted} onChange={e => setShiftForm({ ...shiftForm, counted: digits(e.target.value) })} />
                      {counted > 0 && <span className="st-hint">{money(counted)}</span>}
                    </div>
                    <div className="st-field">
                      <label className="st-label">Catatan <span style={{ fontWeight: 500, color: '#94a3b8' }}>opsional</span></label>
                      <input className="st-input" value={shiftForm.note} onChange={e => setShiftForm({ ...shiftForm, note: e.target.value })} placeholder="Contoh: ada kembalian kurang" />
                    </div>
                    <div className="sh-row" style={{ marginTop: 10 }}><span>Seharusnya di laci</span><b>{money(expected)}</b></div>
                    {shiftForm.counted !== '' && (
                      <div className={'sh-diff ' + (diff === 0 ? 'ok' : 'bad')}>
                        <span>{diff === 0 ? 'Uang laci pas' : diff > 0 ? 'Lebih' : 'Kurang'}</span><b>{diff === 0 ? money(0) : money(Math.abs(diff))}</b>
                      </div>
                    )}
                    <div className="st-actions">
                      <button type="button" className="st-btn" disabled={printing} onClick={() => saveShift(true)}><Printer size={16} /> Cetak</button>
                      <button type="button" className="st-btn primary" onClick={() => saveShift(false)}><Save size={16} /> Tutup kasir</button>
                    </div>
                  </div>
                </div>

                <div className="st-card">
                  <div className="st-card-head">
                    <span className="st-ico"><ClipboardList size={20} /></span>
                    <div><h3>Riwayat tutup kasir</h3><p>10 penutupan terakhir.</p></div>
                  </div>
                  <div className="st-list">
                    {hist.map(s => (
                      <div className="st-li" key={s.id}>
                        <div className="st-av">{String(s.cashier || '?')[0].toUpperCase()}</div>
                        <div className="st-li-main"><b>{s.cashier} · {s.date}</b><small>{s.time} · laci {money(s.counted_cash)}{s.note ? ` · ${s.note}` : ''}</small></div>
                        <span className="st-log-n" style={{ color: s.diff === 0 ? '#16a34a' : '#dc2626' }}>{s.diff === 0 ? 'Pas' : (s.diff > 0 ? '+' : '−') + money(Math.abs(s.diff))}</span>
                      </div>
                    ))}
                    {!hist.length && <div className="st-empty">Belum ada penutupan kasir.</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ================= KELOLA MENU ================= */}
        {page === 'Kelola Menu' && user?.role === 'Admin' && (
          <div className="content">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Kelola menu</h3>
                  <p className="muted">Tambah, ubah harga, atau status menu. Menu Bakso berdiri sendiri dengan harga custom, jadi tidak perlu diatur di sini.</p>
                </div>
              </div>
              <form className="menu-editor" onSubmit={saveMenu}>
                <input placeholder="Nama menu" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} />
                <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}>
                  {Array.from(new Set([...categories.slice(1), menuForm.category].filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" inputMode="numeric" placeholder="Harga" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="primary">{editing ? 'Simpan' : 'Tambah'}</button>
                  {editing && (
                    <button type="button" className="print-btn" onClick={() => { setEditing(null); setMenuForm({ name: '', category: 'Mie', price: '' }); }}>Batal</button>
                  )}
                </div>
              </form>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nama menu</th><th>Kategori</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {adminMenuItems.map(x => (
                      <tr key={String(x.id)}>
                        <td data-label="Nama menu"><b>{x.name}</b>{x._isGroupedMenu && <div className="muted" style={{ fontSize: '11px' }}>Varian digabung: {x._temperatureMembers.map(v => v.name.replace(new RegExp('\s+(Panas|Hangat|Dingin)$', 'i'), '') === x.name ? v.name.slice(x.name.length).trim() : v.name).join(', ')}</div>}</td>
                        <td data-label="Kategori"><span className="cat-badge">{x.category}</span></td>
                        <td data-label="Harga">{x._isGroupedMenu ? Object.entries(x._temperaturePrices).map(([temp, price]) => <div key={temp}>{temp[0].toUpperCase() + temp.slice(1)}: {money(price)}</div>) : x._isLegacyToppingGroup ? x._legacyMembers.map(v => <div key={v.id}>{money(v.price)}</div>) : money(x.price)}</td>
                        <td data-label="Status"><span className={x.active ? 'status-done' : 'status-off'}>{!x.active ? 'Nonaktif' : x.sold_out ? 'Habis' : x.stock != null ? `Stok ${x.stock}` : 'Aktif'}</span></td>
                        <td>
                          <div className="action-cell">
                            <button className="text-btn" onClick={() => { setEditing(x.id); setMenuForm({ name: x.name, category: x.category, price: x.price }) }}>Edit</button>
                            <button className="text-btn" onClick={() => toggleMenuStatus(x)}>{x.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                            <button className="text-btn" style={{ color: '#dc2626' }} onClick={() => deleteMenu(x)}>{x._isGroupedMenu ? 'Hapus menu' : 'Hapus'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!items.length && <tr><td colSpan={5} className="empty-table">Belum ada menu terdaftar.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= PENGATURAN (MOBILE STYLE) ================= */}
        {page === 'Pengaturan' && (() => {
          const isAdmin = user.role === 'Admin';
          const isDapur = user.role === 'Dapur';
          const view = mobileSettingsView;
          const go = v => setMobileSettingsView(v);
          const roleCls = r => r === 'Admin' ? 'admin' : r === 'Dapur' ? 'dapur' : 'kasir';
          const checking = printerStatus === 'Memeriksa...';
          const serverDirty = serverDraft.trim() !== serverPrintUrl.trim();
          const otherPrinter = devicePeers.find(p => p.printer && p.deviceId !== deviceId);
          const otherAudio = devicePeers.find(p => p.audio && p.deviceId !== deviceId);
          const audioOnHere = centralAudioDevice || isDapur;
          const printerOk = bleConnected || !!otherPrinter;
          const printerSub = bleConnected ? `Terhubung · ${bleDeviceName}` : otherPrinter ? `Cetak lewat ${otherPrinter.deviceName}` : checking ? 'Memeriksa...' : 'Belum terhubung';
          const audioSub = audioOnHere ? 'Aktif di HP ini' : otherAudio ? `Aktif di ${otherAudio.deviceName}` : 'Nonaktif';
          const notifLabel = notifPerm === 'granted' ? 'Diizinkan' : notifPerm === 'denied' ? 'Ditolak' : 'Belum diizinkan';

          const back = (title) => (
            <>
              <div className="ms-back-bar">
                <button type="button" className="ms-back-btn" onClick={() => go('main')}><ArrowLeft size={18} /> Pengaturan</button>
              </div>
              <h2 className="ms-page-title">{title}</h2>
            </>
          );
          const navRow = (key, Icon, color, label, sub, onClick, dot) => (
            <div key={key} className="ms-row clickable" onClick={onClick}>
              <div className="ms-row-start">
                <div className={'ms-icon-box ' + color}><Icon size={20} /></div>
                <div className="ms-row-text">
                  <span className="ms-row-label">{label}</span>
                  <span className="ms-row-sub">{sub}</span>
                </div>
              </div>
              <div className="ms-row-end">
                {dot && <span className={'ms-dot ' + dot}></span>}
                <ChevronRight size={18} color="var(--mut)" />
              </div>
            </div>
          );
          const wrap = (children) => <div className="content"><div className="ms-container">{children}</div></div>;

          /* ---------- Sub: Printer ---------- */
          if (view === 'printer' && !isDapur) {
            return wrap(<>
              {back('Printer')}
              <div className="ms-group">
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className={'ms-icon-box ' + (bleConnected ? 'green' : 'blue')}><Bluetooth size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Printer Bluetooth</span>
                      <span className="ms-row-sub">{bleConnected ? `✓ Terhubung: ${bleDeviceName}` : checking ? 'Memeriksa koneksi...' : 'Belum terhubung'}</span>
                    </div>
                  </div>
                  {bleConnected
                    ? <button type="button" className="ms-btn-action danger" onClick={disconnectBluetoothPrinter}>Putuskan</button>
                    : <button type="button" className="ms-btn-action primary" onClick={connectBluetoothPrinter}><Bluetooth size={14} /> Sambungkan</button>}
                </div>
                {!bleConnected && otherPrinter && (
                  <div className="ms-row">
                    <div className="ms-row-start">
                      <div className="ms-icon-box green"><Radio size={19} /></div>
                      <div className="ms-row-text">
                        <span className="ms-row-label">Aktif di {otherPrinter.deviceName}</span>
                        <span className="ms-row-sub">Perangkat itu sudah tersambung ke printer, jadi HP ini bisa mencetak lewat jaringan.</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box amber"><Printer size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Auto-print tiket dapur</span>
                      <span className="ms-row-sub">Otomatis mencetak tiket setiap ada pesanan masuk</span>
                    </div>
                  </div>
                  <label className="ms-switch">
                    <input type="checkbox" checked={isPrintStation} onChange={e => {
                      const next = e.target.checked;
                      setIsPrintStation(next); write('z_is_print_station', next);
                      flash(next ? 'Auto-print aktif di HP ini.' : 'Auto-print dimatikan di HP ini.', 3000);
                    }} />
                    <span className="ms-slider"></span>
                  </label>
                </div>
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box slate"><RefreshCw size={19} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Tes cetak</span>
                      <span className="ms-row-sub">Periksa kertas dan tulisan printer</span>
                    </div>
                  </div>
                  <button type="button" className="ms-btn-action secondary" disabled={printing || !printerOk} onClick={testPrinter}>{printing ? 'Mencetak...' : 'Cetak tes'}</button>
                </div>
              </div>
              <p className="ms-footnote">Jika HP ini tersambung ke printer, HP kasir lain otomatis bisa mencetak lewat sini selama aplikasi tetap terbuka.</p>

              <div className="ms-group" style={{ marginTop: 18 }}>
                <div className="ms-row clickable" onClick={() => setShowAdvancedPrint(v => !v)}>
                  <div className="ms-row-start">
                    <div className="ms-icon-box slate"><Server size={19} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Cleanter (opsional)</span>
                      <span className="ms-row-sub">Hanya jika memakai aplikasi Cleanter</span>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--mut)" style={{ transform: showAdvancedPrint ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                </div>
                {showAdvancedPrint && (
                  <div className="ms-expand">
                    <label className="sx-label"><Server size={14} /> Server pusat (semua kasir)</label>
                    <div className="sx-row" style={{ marginTop: 6, marginBottom: 14 }}>
                      <input className="sx-input" inputMode="url" value={serverDraft} onChange={e => setServerDraft(e.target.value)} placeholder="http://192.168.1.100:9100" disabled={!isAdmin} />
                      {isAdmin && <button type="button" className="sx-btn primary" disabled={!serverDirty} onClick={saveServerPrintUrl}><Save size={14} /> Simpan</button>}
                    </div>
                    <label className="sx-label"><Smartphone size={14} /> Khusus HP ini</label>
                    <input className="sx-input" style={{ marginTop: 6 }} inputMode="url" value={localPrintUrl} onChange={handleLocalPrintUrlChange} placeholder="http://localhost:9100" />
                  </div>
                )}
              </div>
            </>);
          }

          /* ---------- Sub: Suara & Notifikasi ---------- */
          if (view === 'suara') {
            const isCustomAlarm = customAlarmName !== 'kitchen-alarm.mp3';
            return wrap(<>
              {back('Suara & Notifikasi')}
              <div className="ms-group">
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className={'ms-icon-box ' + (audioOnHere ? 'green' : 'amber')}><Volume2 size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Alarm pesanan</span>
                      <span className="ms-row-sub">{audioOnHere ? '✓ Aktif di HP ini' : otherAudio ? `Aktif di ${otherAudio.deviceName}` : 'Nonaktif'}</span>
                    </div>
                  </div>
                  {isDapur
                    ? <span className="ms-chip">Selalu aktif</span>
                    : (
                      <label className="ms-switch" aria-label="Aktifkan alarm pesanan">
                        <input type="checkbox" checked={centralAudioDevice} onChange={e => e.target.checked ? activateCentralAudio() : disableCentralAudio()} />
                        <span className="ms-slider"></span>
                      </label>
                    )}
                </div>
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box blue"><Music size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Suara alarm</span>
                      <span className="ms-row-sub" style={{ overflowWrap: 'anywhere' }}>{isCustomAlarm ? customAlarmName : 'Suara bawaan'}</span>
                    </div>
                  </div>
                  <button type="button" className="ms-btn-action primary" disabled={alarmFileBusy} onClick={() => alarmFileInputRef.current?.click()}>
                    {alarmFileBusy ? 'Memproses...' : 'Pilih file'}
                  </button>
                  <input ref={alarmFileInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" onChange={handleAlarmFileChange} style={{ display: 'none' }} />
                </div>
                {isCustomAlarm && (
                  <div className="ms-row">
                    <div className="ms-row-start">
                      <div className="ms-icon-box red"><RotateCcw size={19} /></div>
                      <div className="ms-row-text">
                        <span className="ms-row-label">Suara bawaan</span>
                        <span className="ms-row-sub">Hapus file pilihan dan pakai alarm awal</span>
                      </div>
                    </div>
                    <button type="button" className="ms-btn-action danger" disabled={alarmFileBusy} onClick={resetAlarmFile}>Reset</button>
                  </div>
                )}
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box slate"><RefreshCw size={19} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Tes suara</span>
                      <span className="ms-row-sub">Periksa bunyi dan volume alarm</span>
                    </div>
                  </div>
                  <button type="button" className="ms-btn-action secondary" disabled={alarmFileBusy} onClick={previewKitchenAlarm}>Putar tes</button>
                </div>
                {audioOnHere && (
                  <div className="ms-row">
                    <div className="ms-row-start">
                      <div className="ms-icon-box amber"><Bell size={20} /></div>
                      <div className="ms-row-text">
                        <span className="ms-row-label">Tes alarm pesanan</span>
                        <span className="ms-row-sub">Bunyikan alarm seperti saat pesanan masuk</span>
                      </div>
                    </div>
                    <button type="button" className="ms-btn-action secondary" onClick={playCentralKitchenAlarm}>Putar</button>
                  </div>
                )}
              </div>
              <p className="ms-footnote">File suara hanya disimpan di perangkat ini (maksimal 15 MB). Biarkan aplikasi tetap terbuka agar alarm dapat berbunyi.</p>

              <div className="ms-group" style={{ marginTop: 18 }}>
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className={'ms-icon-box ' + (notifPerm === 'granted' ? 'green' : 'amber')}><Bell size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Notifikasi</span>
                      <span className="ms-row-sub">{notifPerm === 'granted' ? '✓ Diizinkan' : notifLabel}</span>
                    </div>
                  </div>
                  {notifPerm !== 'granted'
                    ? <button type="button" className="ms-btn-action primary" onClick={requestNotificationPermission}>Izinkan</button>
                    : <button type="button" className="ms-btn-action secondary" onClick={testNotification}>Tes</button>}
                </div>
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box blue"><Bluetooth size={20} /></div>
                    <div className="ms-row-text">
                      <span className="ms-row-label">Speaker Bluetooth</span>
                      <span className="ms-row-sub">Disambungkan lewat Pengaturan HP</span>
                    </div>
                  </div>
                  <button type="button" className="ms-btn-action primary" aria-expanded={showSpeakerGuide} onClick={() => setShowSpeakerGuide(v => !v)}>
                    <Bluetooth size={14} /> {showSpeakerGuide ? 'Tutup' : 'Sambungkan'}
                  </button>
                </div>
                {showSpeakerGuide && (
                  <div className="ms-expand">
                    <ol className="ms-row-sub" style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.7 }}>
                      <li>Nyalakan speaker dan aktifkan mode pairing.</li>
                      <li>Di HP, buka Pengaturan → Bluetooth.</li>
                      <li>Pilih nama speaker sampai statusnya tersambung.</li>
                      <li>Kembali ke sini, lalu tekan Putar tes.</li>
                    </ol>
                    <button type="button" className="ms-btn-action secondary full" disabled={alarmFileBusy} onClick={previewKitchenAlarm}>Putar tes</button>
                  </div>
                )}
              </div>
            </>);
          }

          /* ---------- Sub: Perangkat Online ---------- */
          if (view === 'perangkat') {
            return wrap(<>
              {back('Perangkat Online')}
              <div className="ms-group"><DeviceNameRow myName={deviceName} onRename={renameDevice} /></div>
              <div className="ms-section-title" style={{ marginTop: 18 }}>{devicePeers.length} perangkat online</div>
              <div className="ms-group"><DevicesList peers={devicePeers} myId={deviceId} /></div>
            </>);
          }

          /* ---------- Sub: Kelola Akun (Admin) ---------- */
          if (view === 'akun' && isAdmin) {
            return wrap(<>
              {back('Kelola Akun')}
              <div className="sx-grid">
                <div className="ui-card">
                  <div className="sx-head">
                    <span className="sx-ico"><UserPlus size={20} /></span>
                    <div><h3>{editingUser ? 'Ubah akun' : 'Tambah akun'}</h3><p>{editingUser ? `Perbarui akun "${editingUser.username}".` : 'Buat akun baru untuk karyawan.'}</p></div>
                  </div>
                  <form onSubmit={handleCreateUser}>
                    <div className="sx-field">
                      <label className="sx-label">Username</label>
                      <input className="sx-input" autoComplete="off" placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} disabled={!!editingUser} />
                    </div>
                    <div className="sx-field">
                      <label className="sx-label">Password</label>
                      <div className="sx-pass">
                        <input className="sx-input" autoComplete="new-password" type={showPwd ? 'text' : 'password'} placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                        <button type="button" className="sx-eye" onClick={() => setShowPwd(v => !v)} aria-label="Tampilkan password">{showPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </div>
                    </div>
                    <div className="sx-seg">
                      {['Kasir', 'Dapur', 'Admin'].map(r => <button key={r} type="button" className={newUser.role === r ? 'on' : ''} onClick={() => setNewUser({ ...newUser, role: r })}>{r}</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="sx-btn primary" style={{ flex: 1 }} type="submit"><UserPlus size={16} /> {editingUser ? 'Simpan' : 'Tambah akun'}</button>
                      {editingUser && <button type="button" className="sx-btn" onClick={() => { setEditingUser(null); setNewUser({ username: '', password: '', role: 'Kasir' }); }}>Batal</button>}
                    </div>
                  </form>
                </div>
                <div className="ui-card">
                  <div className="sx-head">
                    <span className="sx-ico green"><Users size={20} /></span>
                    <div><h3>Daftar akun</h3><p>{usersList.length} akun terdaftar.</p></div>
                  </div>
                  <div className="sx-list">
                    {usersList.map(u => (
                      <div className="sx-li" key={u.username}>
                        <div className="sx-av">{(u.username || '?')[0].toUpperCase()}</div>
                        <div className="sx-li-main">
                          <b>{u.username}</b>
                          <small><span className={'sx-badge ' + roleCls(u.role)}>{u.role}</span></small>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" className="sx-del" style={{ background: '#fef3c7', color: '#92400e' }} onClick={() => { setEditingUser(u); setNewUser({ username: u.username, password: u.password, role: u.role }); }}><Pencil size={13} /> Edit</button>
                          {(u.username || '').toLowerCase() !== 'admin'
                            ? <button type="button" className="sx-del" onClick={() => handleDeleteUser(u.username)}><Trash2 size={13} /> Hapus</button>
                            : <span className="sx-tag">Akun utama</span>}
                        </div>
                      </div>
                    ))}
                    {!usersList.length && <div className="ui-empty">Belum ada akun.</div>}
                  </div>
                </div>
              </div>
            </>);
          }

          /* ---------- Sub: Log Hapus (Admin) ---------- */
          if (view === 'log' && isAdmin) {
            return wrap(<>
              {back('Log Hapus Transaksi')}
              <div className="ui-card">
                <div className="sx-list">
                  {clearLogs.map(log => (
                    <div className="sx-li" key={log.id}>
                      <div className="sx-av">{String(log.who || '?')[0].toUpperCase()}</div>
                      <div className="sx-li-main">
                        <b>{log.who} <span className={'sx-badge ' + roleCls(log.role)} style={{ marginLeft: 4 }}>{log.role}</span></b>
                        <small>{log.time}</small>
                      </div>
                      <span className="sx-count">{log.count} transaksi</span>
                    </div>
                  ))}
                  {!clearLogs.length && <div className="ui-empty">Belum ada riwayat yang dihapus.</div>}
                </div>
              </div>
            </>);
          }

          /* ---------- Halaman utama ---------- */
          return wrap(<>
            <div className="ms-profile">
              <div className="ms-avatar">{user.username[0].toUpperCase()}</div>
              <div className="ms-profile-info">
                <div className="ms-profile-name">{user.username}</div>
                <div className="ms-profile-meta">
                  <span className={'ms-badge ' + roleCls(user.role)}>{user.role}</span>
                  <span className={'ms-badge ' + (online ? 'kasir' : 'dapur')}>{online ? 'Online' : 'Offline'}</span>
                  {queueCount > 0 && <span className="ms-badge dapur">{queueCount} antrean</span>}
                </div>
              </div>
            </div>

            <div className="ms-section">
              <div className="ms-section-title">Perangkat</div>
              <div className="ms-group">
                {!isDapur && navRow('printer', Printer, 'blue', 'Printer', printerSub, () => go('printer'), printerOk ? 'ok' : 'warn')}
                {navRow('suara', Volume2, 'amber', 'Suara & Notifikasi', audioSub, () => go('suara'), (audioOnHere || otherAudio) ? 'ok' : 'warn')}
                {navRow('perangkat', Smartphone, 'slate', 'Perangkat Online', `${devicePeers.length} perangkat · ${deviceName}`, () => go('perangkat'))}
              </div>
            </div>

            {isAdmin && (
              <div className="ms-section">
                <div className="ms-section-title">Admin</div>
                <div className="ms-group">
                  {navRow('akun', Users, 'purple', 'Kelola Akun', `${usersList.length} akun terdaftar`, () => go('akun'))}
                  {navRow('log', ShieldAlert, 'red', 'Log Hapus Transaksi', `${clearLogs.length} catatan`, () => go('log'))}
                </div>
              </div>
            )}

            <div className="ms-section">
              <div className="ms-section-title">Aplikasi</div>
              <div className="ms-group">
                <div className="ms-row">
                  <div className="ms-row-start">
                    <div className="ms-icon-box slate"><Coffee size={20} /></div>
                    <div className="ms-row-text"><span className="ms-row-label">Zayga POS</span></div>
                  </div>
                  <span className="ms-value">v1.4</span>
                </div>
              </div>
            </div>

            <button type="button" className="ms-btn-action danger full" onClick={logoutNow}>
              <LogOut size={17} /> Keluar ({user.username})
            </button>
          </>);
        })()}
      </main>

    <nav className="bn">
      {user.role === 'Dapur' ? (
        <>
          <button type="button" className={page === 'Antrian' ? 'on' : ''} onClick={() => handlePageChange('Antrian')}>
            <ChefHat size={22} /><span>Antrian</span>
            {siapCount > 0 && <i>{siapCount}</i>}
          </button>
          <button type="button" className={page === 'Pengaturan' ? 'on' : ''} onClick={() => handlePageChange('Pengaturan')}>
            <Settings size={22} /><span>Pengaturan</span>
          </button>
        </>
      ) : (
        <>
          {user.role === 'Admin' && (
            <button type="button" className={page === 'Dashboard' ? 'on' : ''} onClick={() => handlePageChange('Dashboard')}>
              <LayoutDashboard size={22} /><span>Dasbor</span>
            </button>
          )}
          <button type="button" className={page === 'Pesanan' ? 'on' : ''} onClick={() => handlePageChange('Pesanan')}>
            <ShoppingCart size={22} /><span>Pesanan</span>
            {cartQty > 0 && !addingToOrder && <i style={{ background: '#2563eb' }}>{cartQty}</i>}
          </button>
          {user.role === 'Kasir' && (
            <button type="button" className={page === 'Denah' ? 'on' : ''} onClick={() => handlePageChange('Denah')}>
              <LayoutGrid size={22} /><span>Denah</span>
            </button>
          )}
          <button type="button" className={page === 'Antrian' ? 'on' : ''} onClick={() => handlePageChange('Antrian')}>
            <ChefHat size={22} /><span>Antrian</span>
            {siapCount > 0 && <i>{siapCount}</i>}
          </button>
          <button type="button" className={page === 'Riwayat' ? 'on' : ''} onClick={() => handlePageChange('Riwayat')}>
            <ClipboardList size={22} /><span>Riwayat</span>
          </button>
          <button type="button" className={moreActive ? 'on' : ''} onClick={() => setMoreOpen(true)}>
            <MenuIcon size={22} /><span>Lainnya</span>
          </button>
        </>
      )}
    </nav>

{moreOpen && (
  <div className="po-ov" onClick={() => setMoreOpen(false)}>
    <div className="po-sheet" onClick={e => e.stopPropagation()}>
      <div className="po-handle"></div>
      <div className="po-cart-head">
        <div><h3>Menu lainnya</h3></div>
        <button type="button" className="po-x" onClick={() => setMoreOpen(false)} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="po-sheet-body" style={{ paddingBottom: 20 }}>
        <div className="ms-group">
          {moreItems.map(([Icon, label]) => (
            <div key={label} className="ms-row clickable" onClick={() => { setMoreOpen(false); handlePageChange(label); }}>
              <div className="ms-row-start">
                <div className="ms-icon-box blue"><Icon size={20} /></div>
                <div className="ms-row-text"><span className="ms-row-label">{label}</span></div>
              </div>
              <ChevronRight size={18} color="var(--mut)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

      {/* ================= SHEET: DETAIL BON ================= */}
      {selectedOrder && user.role !== 'Dapur' && (() => {
        const o = selectedOrder;
        const remain = remainOf(o), settled = settledOf(o), st = statusOf(o);
        const orderItems = o?.items || [];
        const qtyTotal = orderItems.reduce((sum, x) => sum + x.qty, 0);
        const isAdmin = user.role === 'Admin';
        return (
          <div className="dt-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="dt-sheet" onClick={e => e.stopPropagation()}>
              <div className="dt-handle"></div>
              <div className="dt-head">
                <div className="dt-meja" title={locLabel(o.location)}><small>LOKASI</small><b>{locLabel(o.location)}</b></div>
                <div className="dt-title"><h2>{o.id}</h2><p><Clock size={12} /> {o.date} · {o.time}</p></div>
                <button className="dt-close" onClick={() => setSelectedOrder(null)} aria-label="Tutup"><X size={18} /></button>
              </div>

              <div className="dt-body">
                <div>
                  <div className="dt-chips">
                    <span className="dt-chip" style={{ background: '#111827', color: '#fff' }}>Antrian {qLabel(o)}</span>
                    {remain > 0
                      ? <span className="dt-chip" style={{ background: '#fee2e2', color: '#991b1b' }}>Belum lunas</span>
                      : <span className="dt-chip" style={{ background: '#dcfce7', color: '#166534' }}>Lunas</span>}
                    <span className="dt-chip" style={{ background: STATUS_STYLE[st][0], color: STATUS_STYLE[st][1] }}>{st}</span>
                    <span className="dt-chip" style={{ background: o.kitchen_printed ? '#dcfce7' : '#fef9c3', color: o.kitchen_printed ? '#166534' : '#854d0e' }}>{o.kitchen_printed ? '✓ Dapur tercetak' : 'Dapur belum dicetak'}</span>
                    <span className="dt-chip" style={{ background: o.customer_printed ? '#dcfce7' : '#fef9c3', color: o.customer_printed ? '#166534' : '#854d0e' }}>{o.customer_printed ? '✓ Struk tercetak' : 'Struk belum dicetak'}</span>
                  </div>
                  <div className="dt-info">
                    <div><span>Pelanggan</span><b>{o.customer || 'Umum'}</b></div>
                    <div><span>Kasir</span><b>{o.cashier}</b></div>
                    <div><span>Metode bayar</span><b>{o.payment}</b></div>
                    <div><span>Jumlah item</span><b>{qtyTotal} porsi</b></div>
                  </div>
                  <div className="dt-sec"><span>Daftar item</span><small>{orderItems.length} jenis</small></div>
                  <div>
                    {orderItems.map((it, idx) => (
                      <div className="dt-item" key={idx}>
                        <div className="dt-qty">{it.qty}×</div>
                        <div>
                          <b>{it.name}</b>
                          <small>{money(it.price)} / porsi</small>
                          {it.note && <small style={{ color: '#b45309', fontWeight: 600 }}>Catatan: {it.note}</small>}
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: STATUS_STYLE[it.item_status || 'Baru'][0], color: STATUS_STYLE[it.item_status || 'Baru'][1], fontWeight: 700 }}>
                              Status Item: {it.item_status || 'Baru'}
                            </span>
                          </div>
                        </div>
                        <strong>{money(it.qty * it.price)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignSelf: 'start' }}>
                  <div className="dt-sum">
                    <div className="dt-sec" style={{ margin: '0 0 8px' }}><span>Status pesanan</span></div>
                    <div className="dt-st">
                      {STATUSES.map(s => <button key={s} type="button" className={st === s ? 'on' : ''} onClick={() => setStatus(o, s)}>{s}</button>)}
                    </div>
                  </div>
                  {o.notes && <div className="dt-note"><span>Catatan</span>{o.notes}</div>}
                  <div className="dt-sum">
                    {((o.discount || 0) > 0 || (o.rounding || 0) > 0) && (
                      <>
                        <div className="dt-row"><span>Subtotal</span><b>{money(sumItems(orderItems))}</b></div>
                        {o.discount > 0 && <div className="dt-row"><span>Diskon</span><b>−{money(o.discount)}</b></div>}
                        {o.rounding > 0 && <div className="dt-row"><span>Pembulatan</span><b>+{money(o.rounding)}</b></div>}
                      </>
                    )}
                    <div className="dt-total"><span>Total tagihan</span><strong>{money(o.total)}</strong></div>
                    {o.payment !== 'Belum Bayar' && <div className="dt-row"><span>Sudah dibayar</span><b>{money(settled)}</b></div>}
                    {o.payment !== 'Belum Bayar' && (o.change || 0) > 0 && <div className="dt-row"><span>Kembalian</span><b>{money(o.change)}</b></div>}
                    {remain > 0 && <div className="dt-row due"><span>Sisa belum dibayar</span><b>{money(remain)}</b></div>}
                  </div>
                  {Array.isArray(o.payments) && o.payments.length > 1 && (
                    <div className="dt-sum">
                      <div className="dt-sec" style={{ margin: '0 0 8px' }}><span>Rincian pembayaran</span></div>
                      {o.payments.map((p, i) => (
                        <div className="dt-row" key={i}><span>{p.payer ? `${p.payer} · ${p.m}` : p.m}</span><b>{money(p.a)}</b></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="dt-foot">
                <div className="dt-main">
                  {remain > 0 && <><button className="dt-btn pay" onClick={() => openSettle(o)}><Wallet size={18} /> Bayar Sisa · {money(remain)}</button><button className="dt-btn" style={{ background: '#ede9fe', color: '#6d28d9' }} onClick={() => openSplitPayment(o)}><Users size={18} /> Split Bill</button></>}
                  <button className={'dt-btn print ' + (o.kitchen_printed ? 'done' : '')} disabled={printing} onClick={() => printOrder(o, 'kitchen')}>
                    <Printer size={18} /> {printing ? 'Mencetak...' : o.kitchen_printed ? 'Cetak Ulang Tiket Dapur' : 'Cetak Tiket Dapur'}
                  </button>
                </div>
                <div className="dt-tiles">
                  <button className="dt-tile" disabled={printing} onClick={() => printOrder(o, 'kitchen')}><i style={{ background: o.kitchen_printed ? '#16a34a' : '#eab308' }}></i><Printer size={18} /> Dapur</button>
                  <button className="dt-tile" disabled={printing} onClick={() => printOrder(o, 'customer')}><i style={{ background: o.customer_printed ? '#16a34a' : '#eab308' }}></i><Printer size={18} /> Struk Kasir (Manual)</button>
                  <button className="dt-tile" onClick={() => startAddToOrder(o)}><Plus size={18} /> Tambah</button>
                  <button className="dt-tile" onClick={() => openMove(o)}><ArrowRightLeft size={18} /> Pindah</button>
                  <button className="dt-tile" disabled={orderItems.length < 1 || (orderItems.length === 1 && orderItems[0].qty < 2)} onClick={() => openSplit(o)}><Scissors size={18} /> Pisah</button>
                  <button className="dt-tile" onClick={() => reorder(o)}><RotateCcw size={18} /> Pesan lagi</button>
                  {isAdmin && <button className="dt-tile del" onClick={() => deleteOrder(o)}><Trash2 size={18} /> Hapus</button>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= SHEET: SEBUAH MEJA (DENAH) ================= */}
      {tableSheet && (() => {
        const list = (tableInfo[tableSheet.key] || []).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
        return (
          <div className="po-ov" onClick={() => setTableSheet(null)}>
            <div className="po-sheet" onClick={e => e.stopPropagation()}>
              <div className="po-handle"></div>
              <div className="po-cart-head">
                <div><h3>{tableSheet.label}</h3><p>{list.length ? `${list.length} bon hari ini` : 'Belum ada pesanan hari ini'}</p></div>
                <button type="button" className="po-x" onClick={() => setTableSheet(null)} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="po-sheet-body">
                {list.map(o => {
                  const st = statusOf(o);
                  const orderItems = o?.items || [];
                  return (
                    <div className="mv-card" key={o.id}>
                      <div>
                        <b>{o.id} · {o.customer || 'Umum'}</b>
                        <small>{o.time} · {orderItems.reduce((s, x) => s + x.qty, 0)} item · {money(o.total)}</small>
                        <span className="tag" style={{ background: STATUS_STYLE[st][0], color: STATUS_STYLE[st][1] }}>{st}</span>
                        {remainOf(o) > 0 ? <span className="tag" style={{ background: '#fee2e2', color: '#991b1b' }}>Sisa {money(remainOf(o))}</span> : <span className="tag" style={{ background: '#dcfce7', color: '#166534' }}>Lunas</span>}
                        {o.bill_requested && remainOf(o) > 0 && <span className="tag" style={{ background: '#f3e8ff', color: '#6b21a8' }}>Minta bill</span>}
                      </div>
                      <div className="mv-btns">
                        <button type="button" className="mv-btn" onClick={() => { setTableSheet(null); setSelectedOrder(o); }}>Buka</button>
                        <button type="button" className="mv-btn alt" onClick={() => startAddToOrder(o)}>Tambah</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="po-cart-foot">
                {list.some(o => remainOf(o) > 0) && <button type="button" className="po-go alt" style={{ marginBottom: 8, background: list.some(o => o.bill_requested && remainOf(o) > 0) ? '#ede9fe' : '#f3e8ff', color: '#6d28d9', border: '1px solid #c4b5fd' }} onClick={() => requestBillForTable(tableSheet.key)}><Bell size={17} /> {list.some(o => o.bill_requested && remainOf(o) > 0) ? 'Minta bill sudah dikirim' : 'Minta bill'}</button>}
                <button type="button" className="po-go" onClick={() => startNewAt(tableSheet.loc)}>Pesanan baru di {tableSheet.label}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= SHEET: STOK / HABIS ================= */}
      {stockItem && (
        <div className="po-ov" onClick={() => setStockItem(null)}>
          <div className="po-sheet" onClick={e => e.stopPropagation()}>
            <div className="po-handle"></div>
            <div className="po-cart-head">
              <div><h3>{stockItem.name}</h3><p>{stockItem.sold_out ? 'Sedang ditandai habis' : stockItem.stock != null ? `Stok harian tersisa ${stockItem.stock}` : 'Tersedia, stok tidak dibatasi'}</p></div>
              <button type="button" className="po-x" onClick={() => setStockItem(null)} aria-label="Tutup"><X size={18} /></button>
            </div>
            <div className="po-sheet-body">
              <button type="button" className="po-go" style={{ width: '100%', background: stockItem.sold_out ? '#16a34a' : '#dc2626' }}
                onClick={() => saveStock(stockItem, stockItem.sold_out ? { sold_out: false, ...(stockItem.stock === 0 ? { stock: null } : {}) } : { sold_out: true })}>
                {stockItem.sold_out ? 'Tersedia lagi' : 'Tandai habis'}
              </button>
              <span className="po-lbl">Stok harian <em>kosongkan = tidak dibatasi</em></span>
              <input className="po-in" inputMode="numeric" value={stockDraft} onChange={e => setStockDraft(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Contoh: 20" />
              <p style={{ margin: '8px 0 0', fontSize: '.78rem', color: '#64748b' }}>Stok berkurang otomatis setiap ada pesanan dan menu menjadi habis saat mencapai 0.</p>
            </div>
            <div className="po-cart-foot">
              <button type="button" className="po-go alt" onClick={() => { const n = stockDraft === '' ? null : Number(stockDraft); saveStock(stockItem, { stock: n, sold_out: n === 0 }); }}>Simpan stok</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SHEET: PINDAH / GABUNG ================= */}
      {moveOrder && (() => {
        const o = moveOrder;
        const dest = moveTarget.trim();
        const tables = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, '0'));
        const others = orders.filter(x => x.id !== o.id && x.date === today);
        // Bon lain pada meja yang sama ditampilkan langsung, tanpa harus memilih meja tujuan.
        const sameTableCandidates = others
          .filter(x => normLoc(x.location) === normLoc(o.location))
          .sort((a, b) => (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0));
        const busyTables = new Set(others.filter(x => remainOf(x) > 0).map(x => normLoc(x.location)));
        const candidates = dest ? others.filter(x => normLoc(x.location) === normLoc(dest)) : [];
        const isSame = !!dest && normLoc(dest) === normLoc(o.location);
        const isTablePick = /^\d{2}$/.test(dest) && Number(dest) >= 1 && Number(dest) <= 40;
        return (
          <div className="mv-overlay">
            <div className="mv-sheet">
              <div className="mv-handle"></div>
              <div className="mv-head">
                <div><h2>Pindah / Gabung Meja</h2><p>{o.id} · Meja {o.location} · {o.customer || 'Umum'} · {money(o.total)}</p></div>
                <button className="mv-close" onClick={closeMove} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="mv-body">
                {sameTableCandidates.length > 0 && (
                  <section style={{ marginBottom: 18, padding: 12, border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff' }}>
                    <span className="mv-label" style={{ marginTop: 0, color: '#1d4ed8' }}>
                      Bon lain di {locLabel(o.location)} ({sameTableCandidates.length})
                    </span>
                    <p className="mv-hint" style={{ margin: '4px 0 10px' }}>
                      Jika beberapa bon dibuat untuk pengunjung yang sama, pilih bon tujuan. Bon yang dipilih akan tetap menjadi bon utama.
                    </p>
                    {sameTableCandidates.map(c => {
                      const cItems = c?.items || [];
                      return (
                        <div className="mv-card" key={`same-${c.id}`} style={{ background: '#fff', marginTop: 8 }}>
                          <div>
                            <b>{c.id} · {c.customer || 'Umum'}</b>
                            <small>{c.time} · {cItems.reduce((sum, x) => sum + (Number(x.qty) || 0), 0)} porsi · {money(c.total)}</small>
                            <span className="tag" style={remainOf(c) > 0
                              ? { background: '#fee2e2', color: '#991b1b' }
                              : { background: '#dcfce7', color: '#166534' }}>
                              {remainOf(c) > 0 ? `Sisa ${money(remainOf(c))}` : 'Lunas'}
                            </span>
                          </div>
                          <button className="mv-btn" disabled={moveBusy} onClick={() => doMerge(o, c)}>
                            Gabungkan ke bon ini
                          </button>
                        </div>
                      );
                    })}
                  </section>
                )}
                <span className="mv-label" style={{ marginTop: 0 }}>Pindah ke meja</span>
                <div className="mv-grid">
                  {tables.map(n => {
                    const cur = normLoc(o.location) === n;
                    return (
                      <button key={n} type="button" disabled={cur} className={'mv-table ' + (cur ? 'cur ' : '') + (dest === n ? 'on' : '')} onClick={() => { setMoveTarget(n); setMovePayungOpen(false); }}>
                        {n}{busyTables.has(n) && <i></i>}
                      </button>
                    );
                  })}
                </div>
                <div className="mv-legend"><i></i> Ada bon yang belum lunas</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {['Bawa pulang', 'Meja belakang'].map(q => (
                    <button key={q} type="button" onClick={() => { setMoveTarget(q); setMovePayungOpen(false); }}
                      style={{ height: '40px', padding: '0 14px', borderRadius: '99px', border: `1.5px solid ${moveTarget === q ? '#2563eb' : '#e2e8f0'}`, background: moveTarget === q ? '#eff6ff' : '#fff', color: moveTarget === q ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>{q}</button>
                  ))}
                  <button type="button" onClick={() => {
                    if (/^payung\s+/i.test(moveTarget)) {
                      setMovePayungOpen(!movePayungOpen);
                    } else {
                      setMoveTarget('Payung 1');
                      setMovePayungOpen(true);
                    }
                  }}
                    style={{ height: '40px', padding: '0 14px', borderRadius: '99px', border: `1.5px solid ${/^payung\s+/i.test(moveTarget) ? '#2563eb' : '#e2e8f0'}`, background: /^payung\s+/i.test(moveTarget) ? '#eff6ff' : '#fff', color: /^payung\s+/i.test(moveTarget) ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Umbrella size={14} />
                    {/^payung\s+/i.test(moveTarget) ? moveTarget : 'Payung'}
                  </button>
                </div>
                {(movePayungOpen || /^payung\s+/i.test(moveTarget)) && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '.76rem', fontWeight: 700, color: '#475569' }}>
                      <span><Umbrella size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Pilih Meja Payung:</span>
                      <small style={{ color: '#64748b' }}>Otomatis ke Payung [Nomor]</small>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {PAYUNG_NUMS.map(num => {
                        const val = `Payung ${num}`;
                        const active = (moveTarget || '').toLowerCase() === val.toLowerCase();
                        return (
                          <button key={num} type="button" onClick={() => { setMoveTarget(val); setMovePayungOpen(true); }}
                            style={{ height: '36px', padding: '0 8px', borderRadius: '8px', border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`, background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#334155', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer' }}>
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <input className="mv-input" value={isTablePick ? '' : moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="Atau ketik manual (misal: Bawa pulang)" />
                {isSame && <p className="mv-hint">Pesanan ini sudah berada di meja {o.location}.</p>}
                {dest && !isSame && candidates.length > 0 && (
                  <>
                    <span className="mv-label">Meja {dest} sudah punya {candidates.length} bon hari ini. Gabungkan?</span>
                    {candidates.map(c => {
                      const cItems = c?.items || [];
                      return (
                        <div className="mv-card" key={c.id}>
                          <div>
                            <b>{c.id} · {c.customer || 'Umum'}</b>
                            <small>{c.time} · {cItems.reduce((sum, x) => sum + x.qty, 0)} item · {money(c.total)}</small>
                            {remainOf(c) > 0 ? <span className="tag" style={{ background: '#fee2e2', color: '#991b1b' }}>Sisa {money(remainOf(c))}</span> : <span className="tag" style={{ background: '#dcfce7', color: '#166534' }}>Lunas</span>}
                          </div>
                          <button className="mv-btn" disabled={moveBusy} onClick={() => doMerge(o, c)}>Gabung ke sini</button>
                        </div>
                      );
                    })}
                  </>
                )}
                {dest && !isSame && (
                  <button className={'mv-move ' + (candidates.length > 0 ? 'alt' : '')} disabled={moveBusy} onClick={() => doMove(o, dest)}>
                    {candidates.length > 0 ? `Pindah saja ke meja ${dest} (bon terpisah)` : `Pindahkan ke meja ${dest}`}
                  </button>
                )}
                {!dest && <p className="mv-hint">Pilih meja tujuan. Kalau meja itu sudah punya bon hari ini, kamu bisa menggabungkannya.</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL KONFIRMASI PINDAH / GABUNG ================= */}
      {moveConfirm && (
        <div
          onClick={() => !moveBusy && setMoveConfirm(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(4px)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="z-confirm-title"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 410, background: '#fff', borderRadius: 20, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,.25)', animation: 'zConfirmIn .18s ease-out' }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', marginBottom: 15, background: moveConfirm.type === 'merge' ? '#fff7ed' : '#eff6ff', color: moveConfirm.type === 'merge' ? '#ea580c' : '#2563eb' }}>
              {moveConfirm.type === 'merge' ? <AlertTriangle size={25} /> : <ArrowRightLeft size={25} />}
            </div>
            <h3 id="z-confirm-title" style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '1.12rem', fontWeight: 800 }}>
              {moveConfirm.type === 'merge' ? 'Gabungkan dua bon?' : 'Pindahkan pesanan?'}
            </h3>
            {moveConfirm.type === 'merge' ? (
              <>
                <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '.9rem', lineHeight: 1.6 }}>
                  Bon <b>{moveConfirm.source.id}</b> dari {locLabel(moveConfirm.source.location)} akan digabung ke bon <b>{moveConfirm.target.id}</b> di {locLabel(moveConfirm.target.location)}.
                </p>
                <div style={{ padding: 12, borderRadius: 12, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '.82rem', lineHeight: 1.5 }}>
                  Bon asal akan diarsipkan. Seluruh item dan pembayaran akan dihitung ke bon tujuan. Tindakan ini tidak dapat dibatalkan dari aplikasi.
                </div>
              </>
            ) : (
              <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '.9rem', lineHeight: 1.6 }}>
                Pesanan <b>{moveConfirm.order.id}</b> akan dipindahkan dari <b>{locLabel(moveConfirm.order.location)}</b> ke <b>{locLabel(moveConfirm.destination)}</b>. Isi bon dan pembayarannya tidak berubah.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button type="button" disabled={moveBusy} onClick={() => setMoveConfirm(null)} style={{ flex: 1, height: 46, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
              <button type="button" disabled={moveBusy} onClick={confirmMoveAction} style={{ flex: 1.25, height: 46, border: 0, borderRadius: 12, background: moveConfirm.type === 'merge' ? '#ea580c' : '#2563eb', color: '#fff', fontWeight: 800, cursor: moveBusy ? 'wait' : 'pointer', opacity: moveBusy ? .65 : 1 }}>
                {moveBusy ? 'Memproses...' : moveConfirm.type === 'merge' ? 'Ya, gabungkan' : 'Ya, pindahkan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes zConfirmIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

      {/* ================= SHEET: PISAH BON ================= */}
      {splitOrder && (() => {
        const o = orders.find(x => x.id === splitOrder.id) || splitOrder;
        const orderItems = o?.items || [];
        const movedItems = orderItems.map((it, i) => ({ ...it, qty: Math.min(splitQty[i] || 0, it.qty) })).filter(it => it.qty > 0);
        const keptItems = orderItems.map((it, i) => ({ ...it, qty: Math.max(0, it.qty - Math.min(splitQty[i] || 0, it.qty)) })).filter(it => it.qty > 0);
        const movedTotal = sumItems(movedItems);
        const keptTotal = calcTotal(keptItems, o.discount || 0, o.rounding || 0);
        const movedQtyTotal = movedItems.reduce((s, x) => s + x.qty, 0);
        const keptQtyTotal = keptItems.reduce((s, x) => s + x.qty, 0);
        return (
          <div className="mv-overlay">
            <div className="mv-sheet">
              <div className="mv-handle"></div>
              <div className="mv-head">
                <div><h2>Pisah Bon</h2><p>{o.id} · Meja {o.location} · {money(o.total)}</p></div>
                <button className="mv-close" onClick={() => !moveBusy && setSplitOrder(null)} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="mv-body">
                <span className="mv-label" style={{ marginTop: 0 }}>Pilih porsi yang dipindah ke bon baru</span>
                {orderItems.map((it, i) => (
                  <div className="sp-row" key={i}>
                    <div><b>{it.name}</b><small>{it.qty} porsi · {money(it.price)}</small></div>
                    <div className="po-step">
                      <button type="button" onClick={() => setSplitQty(q => ({ ...q, [i]: Math.max(0, (q[i] || 0) - 1) }))}><Minus size={16} /></button>
                      <b>{splitQty[i] || 0}</b>
                      <button type="button" onClick={() => setSplitQty(q => ({ ...q, [i]: Math.min(it.qty, (q[i] || 0) + 1) }))}><Plus size={16} /></button>
                    </div>
                  </div>
                ))}
                <span className="mv-label">Meja untuk bon baru</span>
                <input className="mv-input" style={{ marginTop: 0 }} value={splitLoc} onChange={e => setSplitLoc(e.target.value)} placeholder="Meja / lokasi" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, margin: '16px 0 10px' }}>
                  <div style={{ minWidth: 0, padding: '13px 12px', border: '1px solid #dbeafe', borderRadius: 14, background: '#eff6ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1d4ed8', fontSize: '.76rem', fontWeight: 800, marginBottom: 7 }}><ShoppingCart size={15} /> BON ASAL</div>
                    <div style={{ color: '#0f172a', fontSize: 'clamp(1rem, 4vw, 1.3rem)', fontWeight: 850, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{money(keptTotal)}</div>
                    <div style={{ color: '#64748b', fontSize: '.75rem', marginTop: 5 }}>{keptQtyTotal} porsi tersisa</div>
                  </div>
                  <div style={{ minWidth: 0, padding: '13px 12px', border: '1px solid #bbf7d0', borderRadius: 14, background: '#f0fdf4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontSize: '.76rem', fontWeight: 800, marginBottom: 7 }}><Scissors size={15} /> BON BARU</div>
                    <div style={{ color: '#0f172a', fontSize: 'clamp(1rem, 4vw, 1.3rem)', fontWeight: 850, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{money(movedTotal)}</div>
                    <div style={{ color: '#64748b', fontSize: '.75rem', marginTop: 5 }}>{movedQtyTotal} porsi dipindahkan</div>
                  </div>
                </div>
                {((o.discount || 0) > 0 || (o.rounding || 0) > 0) && <p className="mv-hint">Diskon dan pembulatan tetap diterapkan pada bon asal.</p>}
                <p className="mv-hint" style={{ marginTop: 4 }}>Pembayaran yang sudah masuk diperhitungkan ke bon asal terlebih dahulu. Jika ada kelebihan pembayaran, sistem meneruskannya ke bon baru.</p>
                <button className="mv-move" disabled={moveBusy || !movedItems.length || !keptItems.length} onClick={doSplit}>Pisahkan jadi bon baru</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL VARIAN / BAKSO ================= */}
      {selectedItemForVariant && (() => {
        const item = selectedItemForVariant;
        const isDrink = ['Minuman', 'Kopi'].includes(item.category) || !!item._temperaturePrices;
        const isMie = /mie|mi /i.test(`${item.category} ${item.name}`);
        const milkExtra = variantMilk ? (normalizeMenuText(item.name) === 'teh hijau' ? 2000 : 3000) : 0;
        const extra = milkExtra + MENU_ADDONS.filter(a => variantToppings.includes(a.id)).reduce((s, a) => s + a.price, 0);
        const num = Math.max(1, Number(variantNum) || 1);
        const temps = [
          ['Panas', Flame, '#ea580c', '#fff7ed'],
          ['Hangat', Coffee, '#d97706', '#fffbeb'],
          ['Dingin', Snowflake, '#0284c7', '#f0f9ff']
        ];
        const basePrice = variantTemp && item._temperaturePrices?.[variantTemp.toLowerCase()] != null
          ? item._temperaturePrices[variantTemp.toLowerCase()] : Number(item.price || 0);
        const bigBtn = (on, color, bg) => ({
          minHeight: 54, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          border: `2px solid ${on ? color : '#e2e8f0'}`, background: on ? bg : '#fff', color: on ? color : '#475569',
          fontWeight: 800, fontSize: '.9rem', cursor: 'pointer'
        });
        return (
          <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setSelectedItemForVariant(null); }}>
            <div className="modal" style={{ width: 'calc(100% - 24px)', maxWidth: 440, maxHeight: 'min(92dvh, 760px)', overflowY: 'auto', padding: 'clamp(16px, 4vw, 22px)' }}>
              <button className="modal-close" onClick={() => setSelectedItemForVariant(null)} aria-label="Tutup"><X /></button>
              <p className="eyebrow">{isDrink ? 'PILIHAN MINUMAN' : 'TAMBAHAN MENU'}</p>
              <h2 style={{ marginBottom: 2, paddingRight: 44 }}>{item.name}</h2>
              <p className="muted" style={{ margin: '0 0 14px', fontSize: '.84rem' }}>Harga dasar {money(item.price)}</p>

              {isDrink && <>
                <span className="pay2-label" style={{ marginTop: 0 }}>1. Pilih suhu</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {temps.map(([t, Icon, color, bg]) => (
                    <button key={t} type="button" onClick={() => setVariantTemp(t)} style={bigBtn(variantTemp === t, color, bg)}>
                      <Icon size={20} />{t}
                      {item._temperaturePrices?.[t.toLowerCase()] != null && <small>{money(item._temperaturePrices[t.toLowerCase()])}</small>}
                    </button>
                  ))}
                </div>
                <span className="pay2-label">2. Susu</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <button type="button" onClick={() => setVariantMilk(false)} style={bigBtn(!variantMilk, '#2563eb', '#eff6ff')}>Tanpa susu</button>
                  <button type="button" onClick={() => setVariantMilk(true)} style={bigBtn(variantMilk, '#2563eb', '#eff6ff')}>Pakai susu <small>+{money(normalizeMenuText(item.name) === 'teh hijau' ? 2000 : 3000)}</small></button>
                </div>
              </>}

              {MENU_ADDONS.filter(a => a.categories.includes(item.category)).length > 0 && (
                <>
                  <span className="pay2-label">{isDrink ? '3.' : '1.'} Tambahan</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {MENU_ADDONS.filter(a => a.categories.includes(item.category)).map(a => {
                      const on = variantToppings.includes(a.id);
                      return <button key={a.id} type="button" onClick={() => setVariantToppings(old => on ? old.filter(x => x !== a.id) : [...old, a.id])}
                        style={bigBtn(on, '#15803d', '#f0fdf4')}>
                        {on ? '✓ ' : '+ '}{a.label}<small>{on ? 'Dipilih' : `+${money(a.price)}`}</small>
                      </button>;
                    })}
                  </div>
                </>
              )}

              {isMie && <>
                <span className="pay2-label">{isDrink ? '4.' : '2.'} Level pedas</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {SPICE_LEVELS.map(level => <button key={level} type="button" onClick={() => setVariantSpice(level)}
                    style={bigBtn(variantSpice === level, '#ea580c', '#fff7ed')}>{level}</button>)}
                </div>
              </>}

              <span className="pay2-label">{isDrink ? '5.' : isMie ? '3.' : '2.'} Jumlah</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
                <button type="button" aria-label="Kurangi" disabled={num <= 1} onClick={() => setVariantNum(Math.max(1, num - 1))}
                  style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid #cbd5e1', background: '#fff', display: 'grid', placeItems: 'center', opacity: num <= 1 ? .4 : 1 }}><Minus size={22} /></button>
                <b style={{ minWidth: 48, textAlign: 'center', fontSize: '2rem', fontVariantNumeric: 'tabular-nums' }}>{num}</b>
                <button type="button" aria-label="Tambah" onClick={() => setVariantNum(num + 1)}
                  style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid #2563eb', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center' }}><Plus size={22} /></button>
              </div>

              <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '.85rem', color: '#334155', fontWeight: 600 }}>
                  {num}× {item.name}{variantTemp ? ` · ${variantTemp}` : ''}{variantMilk ? ' · Susu' : ''}{variantToppings.length ? ` · ${MENU_ADDONS.filter(a => variantToppings.includes(a.id)).map(a => a.label).join(', ')}` : ''}{isMie && variantSpice !== 'Normal' ? ` · ${variantSpice}` : ''}
                </span>
                <b style={{ fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{money((basePrice + extra) * num)}</b>
              </div>

              <button className="primary full large" disabled={isDrink && !variantTemp} style={{ minHeight: 54, marginTop: 12 }} onClick={addVariantOne}>
                <Plus size={18} /> Tambah ke Keranjang
              </button>

              {variantAdded.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '.82rem' }}>
                  <b style={{ display: 'block', marginBottom: 4 }}>✓ Sudah masuk keranjang:</b>
                  {variantAdded.map((a, i) => <div key={i}>{a}</div>)}
                </div>
              )}
              <button className="po-go alt" style={{ width: '100%', marginTop: 10 }} onClick={() => setSelectedItemForVariant(null)}>
                {variantAdded.length > 0 ? 'Selesai' : 'Batal'}
              </button>
            </div>
          </div>
        );
      })()}

      {baksoOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '360px' }}>
            <button className="modal-close" onClick={() => setBaksoOpen(false)}><X /></button>
            <p className="eyebrow">HARGA CUSTOM</p>
            <h2>Bakso</h2>
            <label className="modal-label">Keterangan <em>Opsional</em></label>
            <input className="pay-input" value={baksoName} onChange={e => setBaksoName(e.target.value)} placeholder="Contoh: Urat, Telur, Jumbo..." />
            <label className="modal-label" style={{ marginTop: '12px' }}>Harga (Rp)</label>
            <input type="text" inputMode="numeric" className="pay-input" autoFocus value={baksoPrice}
              onChange={e => setBaksoPrice(e.target.value.replace(/\D/g, '').slice(0, 7))} onKeyDown={e => { if (e.key === 'Enter') addBakso(); }} placeholder="Contoh: 15000" />
            {Number(baksoPrice) > 0 && <small className="muted" style={{ display: 'block', marginTop: '6px' }}>Harga: <b>{money(baksoPrice)}</b></small>}
            <button className="primary full large" style={{ marginTop: '1.25rem' }} onClick={addBakso}>Tambah ke Keranjang</button>
          </div>
        </div>
      )}

      {/* ================= MODAL: SPLIT BILL PER ORANG (BON YANG SUDAH ADA) ================= */}
      {splitPayOrder && (() => {
        const o = orders.find(x => x.id === splitPayOrder.id) || splitPayOrder;
        const due = remainOf(o);
        const entered = splitPayRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
        const cashChange = splitPayRows.reduce((a, r) => a + (r.method === 'Tunai' ? Math.max(0, (Number(r.received) || Number(r.amount) || 0) - (Number(r.amount) || 0)) : 0), 0);
        return (
          <div className="pay2-overlay" onClick={() => !saving && setSplitPayOrder(null)}>
            <div className="pay2-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="pay2-handle"></div>
              <div className="pay2-head"><h2>Split Bill per Orang</h2><button className="pay2-close" onClick={() => !saving && setSplitPayOrder(null)} aria-label="Tutup"><X size={18} /></button></div>
              <div className="pay2-body">
                <div className="pay2-total"><span>{locLabel(o.location)} · Sisa tagihan</span><b>{money(due)}</b></div>
                <p style={{ color: '#64748b', fontSize: '.78rem', margin: '0 0 12px' }}>Masukkan bagian setiap pembayar. Setiap orang dapat menggunakan metode pembayaran berbeda.</p>
                {splitPayRows.map((r, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, marginBottom: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <b style={{ fontSize: '.88rem' }}>Pembayar {i + 1}</b>
                      {splitPayRows.length > 1 && <button type="button" className="text-btn" style={{ color: '#dc2626', margin: 0 }} onClick={() => setSplitPayRows(rows => rows.filter((_, j) => j !== i))}>Hapus</button>}
                    </div>
                    <input className="pay2-input" style={{ marginBottom: 8 }} value={r.name} onChange={e => updateSplitPayRow(i, { name: e.target.value })} placeholder="Nama pembayar (opsional)" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                      <select className="pay2-input" value={r.method} onChange={e => updateSplitPayRow(i, { method: e.target.value, received: e.target.value === 'Tunai' ? r.received : '' })}>
                        <option value="Tunai">Tunai</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option>
                      </select>
                      <input className="pay2-input" inputMode="numeric" value={r.amount} onChange={e => updateSplitPayRow(i, { amount: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="Bagian (Rp)" />
                    </div>
                    {r.method === 'Tunai' && <input className="pay2-input" style={{ marginTop: 8 }} inputMode="numeric" value={r.received} onChange={e => updateSplitPayRow(i, { received: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="Uang diterima (kosong = pas)" />}
                    {r.method === 'Tunai' && <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 7 }}>{[5000, 10000, 20000, 50000].map(n => <button key={n} type="button" className="pay2-chip" onClick={() => updateSplitPayRow(i, { received: String((Number(r.received) || Number(r.amount) || 0) + n) })}>+{n / 1000}rb</button>)}</div>}
                    {r.method === 'Tunai' && Number(r.received || r.amount) > Number(r.amount || 0) && <small style={{ display: 'block', marginTop: 5, color: '#15803d' }}>Kembalian: {money(Number(r.received || r.amount) - Number(r.amount || 0))}</small>}
                  </div>
                ))}
                <button type="button" className="pay2-chip" style={{ width: '100%', marginBottom: 12 }} onClick={addSplitPayRow}><Plus size={15} /> Tambah pembayar</button>
                <div className="pay2-result"><span>Total dibagi</span><b>{money(entered)}</b></div>
                <div className={'pay2-result ' + (entered > due ? 'warn' : '')}><span>{entered > due ? 'Melebihi tagihan' : 'Sisa setelah pembayaran'}</span><b>{money(Math.abs(due - entered))}</b></div>
                {cashChange > 0 && <div className="pay2-result"><span>Total kembalian tunai</span><b>{money(cashChange)}</b></div>}
              </div>
              <div className="pay2-foot"><button className="pay2-submit" disabled={saving || entered <= 0 || entered > due} onClick={confirmSplitPayment}>{saving ? 'Menyimpan...' : `Simpan pembayaran · ${money(entered)}`}</button></div>
            </div>
          </div>
        );
      })()}

      {/* ================= SHEET: PEMBAYARAN ================= */}
      {showPay && (() => {
        const rec = Number(paid || 0);
        const diff = rec - payDue;
        const quick = [20000, 50000, 100000];
        const newOrder = !settling && !addingToOrder;
        // Split Bill hanya tersedia untuk pesanan baru (bon lama memakai tombol "Split Bill" di detail bon)
        const methods = ['Tunai', 'QRIS', 'Transfer', ...(newOrder ? ['Split'] : []), 'Belum Bayar'].filter(m => !(settling && m === 'Belum Bayar'));
        const methodLabel = m => m === 'Split' ? 'Split Bill' : m;
        const submit = settling ? confirmSettle : addingToOrder ? confirmAdditionPayment : (payment === 'Split' && !splitManual) ? openSplitMenu : finish;
        const partialCash = settling && payment === 'Tunai' && rec > 0 && diff < 0;
        const isNewSplit = newOrder && payment === 'Split';
        const splitEntered = newSplitPayRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
        const splitLeft = grand - splitEntered;
        const splitCashChange = newSplitPayRows.reduce((a, r) => {
          if (r.method !== 'Tunai') return a;
          const amt = Number(r.amount) || 0;
          return a + Math.max(0, (Number(r.received) || amt) - amt);
        }, 0);
        const splitInvalid = isNewSplit && (splitEntered <= 0 || splitEntered > grand);
        return (
          <div className="pay2-overlay">
            <div className="pay2-sheet">
              <div className="pay2-handle"></div>
              <div className="pay2-head">
                <h2>{settling ? 'Pelunasan' : addingToOrder ? 'Pembayaran Tambahan' : 'Pembayaran'}</h2>
                <button className="pay2-close" onClick={closePay} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="pay2-body">
                <div className="pay2-total">
                  <span>{settling ? 'Sisa tagihan' : addingToOrder ? 'Total tambahan' : 'Total tagihan'}</span>
                  <b>{money(payDue)}</b>
                </div>
                {newOrder && (discAmt > 0 || roundAmt > 0) && (
                  <div className="pay2-brk">
                    <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
                    {discAmt > 0 && <div><span>Diskon</span><span>−{money(discAmt)}</span></div>}
                    {roundAmt > 0 && <div><span>Pembulatan</span><span>+{money(roundAmt)}</span></div>}
                  </div>
                )}

                <span className="pay2-label" style={{ marginTop: 0 }}>Metode pembayaran</span>
                <div className="pay2-methods">
                  {methods.map(m => <button key={m} className={'pay2-method ' + (payment === m ? 'on' : '')} onClick={() => { setPayment(m); if (m === 'Split') openSplitMenu(); }}>{methodLabel(m)}</button>)}
                </div>

                {payment === 'Tunai' && newOrder && (
                  <>
                    <span className="pay2-label">Pembulatan</span>
                    <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 0 }}>
                      {[[0, 'Tanpa'], [500, 'Rp500'], [1000, 'Rp1.000']].map(([v, l]) => (
                        <button key={v} type="button" className={'pay2-chip ' + (roundTo === v ? 'on' : '')} onClick={() => { setRoundTo(v); setPaid(''); }}>{l}</button>
                      ))}
                    </div>
                  </>
                )}

                {payment === 'Tunai' && (
                  <>
                    <span className="pay2-label">Uang diterima</span>
                    <input type="text" inputMode="numeric" className="pay2-input" value={paidRaw}
                      onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 6); setPaidRaw(d); setPaid(d ? String(Number(d) * 1000) : ''); }}
                      placeholder="Ketik 10 = Rp10.000" />
                    <div className="pay2-chips">
                      <button type="button" className={'pay2-chip ' + (rec === payDue ? 'on' : '')} onClick={() => { setPaid(String(payDue)); setPaidRaw(''); }}>Uang Pas</button>
                      {quick.map(n => (
                        <button key={n} type="button" className={'pay2-chip ' + (rec === n ? 'on' : '')} onClick={() => { setPaid(String(n)); setPaidRaw(String(n / 1000)); }}>{n / 1000}rb</button>
                      ))}
                    </div>
                    <span className="pay2-label" style={{ marginTop: 8 }}>Kalkulator pecahan uang · ketuk sesuai lembar diterima</span>
                    <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                      {[500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].map(n => <button key={n} type="button" className="pay2-chip" onClick={() => { setPaid(String(rec + n)); setPaidRaw(''); }}>+{n >= 1000 ? `${n / 1000}rb` : n}</button>)}
                      <button type="button" className="pay2-chip" onClick={() => { setPaid(''); setPaidRaw(''); }}>Reset pecahan</button>
                    </div>
                    <div className={'pay2-result ' + (rec > 0 && diff < 0 ? (settling ? 'warn' : 'short') : '')}>
                      <span>{rec > 0 && diff < 0 ? (settling ? 'Sisa setelah bayar' : 'Kurang') : 'Kembalian'}</span>
                      <b>{money(rec > 0 && diff < 0 ? -diff : Math.max(0, diff))}</b>
                    </div>
                  </>
                )}

                {/* ---- Split Bill untuk pesanan baru ---- */}
                {isNewSplit && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                    <b style={{ display: 'block', color: '#5b21b6', fontSize: '.9rem' }}>Split bill per menu</b>
                    <p style={{ margin: '4px 0 10px', color: '#6d28d9', fontSize: '.78rem', lineHeight: 1.5 }}>
                      Pilih menu milik tiap orang, nominal dihitung otomatis dari harga item.
                    </p>
                    <button type="button" className="pay2-chip" style={{ width: '100%' }} onClick={openSplitMenu}><Users size={15} /> Atur split bill per menu</button>
                    <button type="button" className="text-btn" style={{ margin: '8px 0 0', padding: 0, fontSize: '.78rem' }} onClick={() => setSplitManual(v => !v)}>
                      {splitManual ? 'Sembunyikan input nominal manual' : 'Atau isi nominal manual'}
                    </button>
                  </div>
                )}
                {isNewSplit && splitManual && (
                  <>
                    <span className="pay2-label">Split bill · bagi tagihan per orang</span>
                    <p style={{ color: '#64748b', fontSize: '.78rem', margin: '0 0 10px' }}>
                      Isi bagian tiap pembayar. Setiap orang boleh memakai metode berbeda. Jika total yang dibayar kurang dari tagihan, sisanya dicatat sebagai bon.
                    </p>
                    <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 0, marginBottom: 10 }}>
                      <button type="button" className="pay2-chip" onClick={() => splitEvenly(grand)}>Bagi rata ({newSplitPayRows.length} orang)</button>
                      <button type="button" className="pay2-chip" onClick={() => setNewSplitPayRows(newSplitRows())}>Reset</button>
                    </div>
                    {newSplitPayRows.map((r, i) => (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, marginBottom: 10, background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <b style={{ fontSize: '.88rem' }}>Pembayar {i + 1}</b>
                          {newSplitPayRows.length > 1 && <button type="button" className="text-btn" style={{ color: '#dc2626', margin: 0 }} onClick={() => removeNewSplitRow(i)}>Hapus</button>}
                        </div>
                        <input className="pay2-input" style={{ marginBottom: 8 }} value={r.name} onChange={e => updateNewSplitRow(i, { name: e.target.value })} placeholder="Nama pembayar (opsional)" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                          <select className="pay2-input" value={r.method} onChange={e => updateNewSplitRow(i, { method: e.target.value, received: e.target.value === 'Tunai' ? r.received : '' })}>
                            <option value="Tunai">Tunai</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option>
                          </select>
                          <input className="pay2-input" inputMode="numeric" value={r.amount} onChange={e => updateNewSplitRow(i, { amount: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="Bagian (Rp)" />
                        </div>
                        <button type="button" className="text-btn" style={{ margin: '6px 0 0', padding: 0 }} onClick={() => fillNewSplitRest(i, grand)}>Isi dengan sisa tagihan</button>
                        {r.method === 'Tunai' && <input className="pay2-input" style={{ marginTop: 8 }} inputMode="numeric" value={r.received} onChange={e => updateNewSplitRow(i, { received: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="Uang diterima (kosong = pas)" />}
                        {r.method === 'Tunai' && <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 7 }}>{[5000, 10000, 20000, 50000].map(n => <button key={n} type="button" className="pay2-chip" onClick={() => updateNewSplitRow(i, { received: String((Number(r.received) || Number(r.amount) || 0) + n) })}>+{n / 1000}rb</button>)}</div>}
                        {r.method === 'Tunai' && Number(r.received || r.amount) > Number(r.amount || 0) && <small style={{ display: 'block', marginTop: 5, color: '#15803d' }}>Kembalian: {money(Number(r.received || r.amount) - Number(r.amount || 0))}</small>}
                        {r.method === 'Tunai' && Number(r.received) > 0 && Number(r.received) < Number(r.amount || 0) && <small style={{ display: 'block', marginTop: 5, color: '#dc2626' }}>Uang diterima kurang dari bagian pembayar ini.</small>}
                      </div>
                    ))}
                    <button type="button" className="pay2-chip" style={{ width: '100%', marginBottom: 12 }} onClick={addNewSplitRow}><Plus size={15} /> Tambah pembayar</button>
                    <div className="pay2-result"><span>Total dibagi</span><b>{money(splitEntered)}</b></div>
                    <div className={'pay2-result ' + (splitLeft < 0 ? 'short' : splitLeft > 0 ? 'warn' : '')}>
                      <span>{splitLeft < 0 ? 'Melebihi tagihan' : splitLeft > 0 ? 'Sisa jadi bon' : 'Tagihan pas, lunas'}</span>
                      <b>{money(Math.abs(splitLeft))}</b>
                    </div>
                    {splitCashChange > 0 && <div className="pay2-result"><span>Total kembalian tunai</span><b>{money(splitCashChange)}</b></div>}
                  </>
                )}

                {settling && payment !== 'Tunai' && payment !== 'Belum Bayar' && (
                  <>
                    <span className="pay2-label">Nominal dibayar <em style={{ fontStyle: 'normal', fontWeight: 500, color: '#94a3b8' }}>kosongkan = lunas</em></span>
                    <input type="text" inputMode="numeric" className="pay2-input" value={partialAmt} onChange={e => setPartialAmt(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={String(payDue)} />
                    {Number(partialAmt) > 0 && Number(partialAmt) < payDue && (
                      <div className="pay2-result warn"><span>Sisa setelah bayar</span><b>{money(payDue - Number(partialAmt))}</b></div>
                    )}
                  </>
                )}

                {payment === 'Belum Bayar' && <div className="pay2-note">Pesanan akan dicatat dengan status <b>Belum Lunas</b> (Bon).</div>}
              </div>
              <div className="pay2-foot">
                <button className="pay2-submit" disabled={saving || (splitInvalid && splitManual)} onClick={submit}>
                  {saving ? 'Menyimpan...' : settling ? (partialCash || (Number(partialAmt) > 0 && Number(partialAmt) < payDue) ? 'Bayar Sebagian' : 'Lunasi Tagihan') : addingToOrder ? 'Simpan Tambahan' : isNewSplit && !splitManual ? 'Atur Split Bill per Menu' : isNewSplit ? (splitLeft > 0 ? `Simpan Split Bill · sisa ${money(splitLeft)} jadi bon` : 'Selesaikan Split Bill') : 'Selesaikan Transaksi'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= POPUP: SPLIT BILL PER MENU (PESANAN BARU) ================= */}
      {showSplitMenu && showPay && !settling && !addingToOrder && (() => {
        const payers = splitMenuPayers;
        const aOf = i => payers.reduce((a, _, p) => a + (splitMenuAssign[i]?.[p] || 0), 0);
        const subs = payers.map((_, p) => cart.reduce((a, it, i) => a + (splitMenuAssign[i]?.[p] || 0) * it.price, 0));
        const allAssigned = cart.length > 0 && cart.every((it, i) => aOf(i) === it.qty);
        const unassignedUnits = cart.reduce((a, it, i) => a + (it.qty - aOf(i)), 0);
        // Diskon dibagi proporsional ke tiap pembayar
        const factor = subtotal > 0 ? grand / subtotal : 1;
        const amounts = subs.map(s => Math.round(s * factor));
        if (allAssigned) {
          const diff = grand - amounts.reduce((a, b) => a + b, 0);
          const mx = subs.indexOf(Math.max(...subs));
          if (mx > -1) amounts[mx] += diff;
        }
        const totalAmt = amounts.reduce((a, b) => a + b, 0);
        const leftBon = Math.max(0, grand - totalAmt);
        const upd = (p, patch) => setSplitMenuPayers(r => r.map((x, i) => i === p ? { ...x, ...patch } : x));
        const bump = (i, p, delta) => setSplitMenuAssign(a => {
          const cur = a[i] || {};
          const used = payers.reduce((s, _, q) => s + (cur[q] || 0), 0);
          const v = (cur[p] || 0) + delta;
          if (v < 0 || (delta > 0 && used >= cart[i].qty)) return a;
          return { ...a, [i]: { ...cur, [p]: v } };
        });
        const assignRest = (p) => setSplitMenuAssign(a => {
          const n = { ...a };
          cart.forEach((it, i) => {
            const cur = { ...(n[i] || {}) };
            const used = payers.reduce((s, _, q) => s + (cur[q] || 0), 0);
            const rest = it.qty - used;
            if (rest > 0) cur[p] = (cur[p] || 0) + rest;
            n[i] = cur;
          });
          return n;
        });
        const addPayer = () => setSplitMenuPayers(r => [...r, { name: '', method: 'Tunai', received: '' }]);
        const removePayer = (p) => {
          if (payers.length <= 1) return;
          setSplitMenuPayers(r => r.filter((_, j) => j !== p));
          setSplitMenuAssign(a => {
            const n = {};
            Object.keys(a).forEach(k => {
              const o = {};
              Object.entries(a[k]).forEach(([q, v]) => { const qi = Number(q); if (qi < p) o[qi] = v; else if (qi > p) o[qi - 1] = v; });
              n[k] = o;
            });
            return n;
          });
        };
        const confirm = () => {
          const rows = payers.map((r, p) => ({ name: r.name, method: r.method, amount: amounts[p], received: r.received })).filter(r => r.amount > 0);
          if (!rows.length) { flash('Pilih menu untuk minimal satu pembayar.', 3500); return; }
          if (rows.some(r => r.method === 'Tunai' && Number(r.received) > 0 && Number(r.received) < r.amount)) { flash('Uang diterima salah satu pembayar masih kurang dari bagiannya.', 4500); return; }
          setShowSplitMenu(false);
          finish(rows);
        };
        const labelOf = (r, p) => r.name.trim() || `Pembayar ${p + 1}`;

        return (
          <div className="pay2-overlay" style={{ zIndex: 1300 }} onClick={() => !saving && setShowSplitMenu(false)}>
            <div className="pay2-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="pay2-handle"></div>
              <div className="pay2-head">
                <h2>Split Bill per Menu</h2>
                <button className="pay2-close" onClick={() => !saving && setShowSplitMenu(false)} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="pay2-body">
                <div className="pay2-total"><span>{locLabel(location)} · Total tagihan</span><b>{money(grand)}</b></div>

                <span className="pay2-label" style={{ marginTop: 0 }}>1. Siapa saja yang bayar</span>
                {payers.map((r, p) => (
                  <div key={p} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, marginBottom: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <b style={{ fontSize: '.88rem' }}>Pembayar {p + 1}</b>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="text-btn" style={{ margin: 0 }} onClick={() => assignRest(p)}>Semua sisa ke sini</button>
                        {payers.length > 1 && <button type="button" className="text-btn" style={{ color: '#dc2626', margin: 0 }} onClick={() => removePayer(p)}>Hapus</button>}
                      </div>
                    </div>
                    <input className="pay2-input" style={{ marginBottom: 8 }} value={r.name} onChange={e => upd(p, { name: e.target.value })} placeholder="Nama (opsional)" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                      <select className="pay2-input" value={r.method} onChange={e => upd(p, { method: e.target.value, received: '' })}>
                        <option value="Tunai">Tunai</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option>
                      </select>
                      <div className="pay2-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                        <span style={{ fontSize: '.75rem', color: '#64748b' }}>Bayar</span><b>{money(amounts[p])}</b>
                      </div>
                    </div>
                    {r.method === 'Tunai' && amounts[p] > 0 && (
                      <>
                        <input className="pay2-input" style={{ marginTop: 8 }} inputMode="numeric" value={r.received} onChange={e => upd(p, { received: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="Uang diterima (kosong = pas)" />
                        <div className="pay2-chips" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 7 }}>
                          {[5000, 10000, 20000, 50000].map(n => <button key={n} type="button" className="pay2-chip" onClick={() => upd(p, { received: String((Number(r.received) || amounts[p]) + n) })}>+{n / 1000}rb</button>)}
                        </div>
                        {Number(r.received) > amounts[p] && <small style={{ display: 'block', marginTop: 5, color: '#15803d' }}>Kembalian: {money(Number(r.received) - amounts[p])}</small>}
                        {Number(r.received) > 0 && Number(r.received) < amounts[p] && <small style={{ display: 'block', marginTop: 5, color: '#dc2626' }}>Uang diterima kurang.</small>}
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="pay2-chip" style={{ width: '100%', marginBottom: 14 }} onClick={addPayer}><Plus size={15} /> Tambah pembayar</button>

                <span className="pay2-label">2. Pilih menu tiap orang</span>
                {cart.map((it, i) => {
                  const rest = it.qty - aOf(i);
                  return (
                    <div key={it.id} style={{ border: `1px solid ${rest === 0 ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 14, padding: 12, marginBottom: 10, background: rest === 0 ? '#f0fdf4' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <b style={{ fontSize: '.9rem' }}>{it.qty}× {it.name}</b>
                          <small style={{ display: 'block', color: '#64748b' }}>{money(it.price)} / porsi{it.note ? ` · ${it.note}` : ''}</small>
                        </div>
                        <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap', background: rest === 0 ? '#dcfce7' : '#fef9c3', color: rest === 0 ? '#166534' : '#854d0e' }}>
                          {rest === 0 ? 'Sudah dibagi' : `Sisa ${rest} porsi`}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 10 }}>
                        {payers.map((r, p) => (
                          <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                            <span style={{ fontSize: '.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(r, p)}</span>
                            <div className="po-step">
                              <button type="button" aria-label="Kurangi" onClick={() => bump(i, p, -1)}><Minus size={14} /></button>
                              <b>{splitMenuAssign[i]?.[p] || 0}</b>
                              <button type="button" aria-label="Tambah" onClick={() => bump(i, p, 1)}><Plus size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <span className="pay2-label">Ringkasan</span>
                {payers.map((r, p) => (
                  <div className="pay2-result" key={p}><span>{labelOf(r, p)} · {r.method}</span><b>{money(amounts[p])}</b></div>
                ))}
                {discAmt > 0 && <p style={{ color: '#64748b', fontSize: '.75rem', margin: '4px 0 0' }}>Diskon {money(discAmt)} dibagi proporsional sesuai nilai menu tiap orang.</p>}
                {!allAssigned && (
                  <div className="pay2-result warn"><span>{unassignedUnits} porsi belum dibagi → jadi bon</span><b>{money(leftBon)}</b></div>
                )}
                {allAssigned && <div className="pay2-result"><span>Semua menu sudah dibagi</span><b>Lunas</b></div>}
              </div>
              <div className="pay2-foot">
                <button className="pay2-submit" disabled={saving || totalAmt <= 0} onClick={confirm}>
                  {saving ? 'Menyimpan...' : allAssigned ? `Selesaikan Split Bill · ${money(totalAmt)}` : `Simpan · sisa ${money(leftBon)} jadi bon`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {toastEl}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);