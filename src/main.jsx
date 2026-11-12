import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, ShoppingCart, Utensils, ClipboardList, BarChart3, Settings, Search, Plus, Minus, Trash2, Printer, LogOut, Coffee, Menu as MenuIcon, X, CheckCircle2, MapPin, UserRound, Clock, Wallet, ShieldAlert, UserPlus, Users, Eye, EyeOff, Flame, Snowflake, Check, ArrowRightLeft, Server, Smartphone, RefreshCw, Save, Pencil, LayoutGrid, ChefHat, Lock, WifiOff, Percent, Scissors, RotateCcw, Bell, TrendingUp, TrendingDown, Crown, Package, AlertTriangle, Volume2, Maximize2, Minimize2, CheckCheck, Radio, List, Rows3 } from 'lucide-react';
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

const BAKSO_ID = 'bakso-custom';
const NOTE_PRESETS = ['Tidak pedas', 'Pedas', 'Extra pedas', 'Tanpa sayur', 'Tanpa bawang', 'Dibungkus'];
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
const sumItems = a => (a || []).reduce((s, x) => s + (x.price || 0) * (x.qty || 0), 0);
const calcTotal = (items, d = 0, r = 0) => Math.max(0, sumItems(items) - (d || 0) + (r || 0));
const baseName = n => String(n || '').replace(/ \((Panas|Hangat|Dingin)\)/, '').replace(/ \+ Susu$/, '');
const nowTime = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const ledger = (m, a, by) => ({ m, a, by, t: new Date().toISOString(), d: new Date().toLocaleDateString('en-CA') });
const isNetErr = e => !navigator.onLine || /fetch|network|failed to|timeout|load failed/i.test(e?.message || '');
const isDupErr = e => /duplicate|23505/i.test(String(e?.message || '') + String(e?.code || ''));
const buzz = (ms = 25) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} };

// [FIX #4] ID order: potongan waktu (base36) + 3 karakter acak kriptografis.
// Siklus waktu ~25 hari + 46.656 kemungkinan acak, jadi bentrok antar perangkat nyaris mustahil.
const genOrderId = () => {
  const t = Date.now().toString(36).toUpperCase().slice(-6);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  try {
    const a = new Uint8Array(3);
    crypto.getRandomValues(a);
    a.forEach(n => { r += chars[n % chars.length]; });
  } catch {
    for (let i = 0; i < 3; i++) r += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'ZG' + t + r;
};

// Gabungkan hasil server dengan pesanan yang masih menunggu di antrean offline
const withQueue = (data) => {
  const q = read('z_queue', []);
  return [...q.filter(x => !data.some(d => d.id === x.id)), ...data];
};

// [FIX #6] Hitung ulang bon setelah ada item tambahan.
// Diskon persen dihitung ulang dari subtotal baru; diskon rupiah tetap (dibatasi subtotal).
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

/* ===================== Struk & printer ===================== */
const receiptText = (text, align = 'left', bold = false, size = 'normal') => ({ type: 'text', text: String(text ?? ''), align, bold, size });
const receiptDivider = () => ({ type: 'divider' });

const settledOf = o => o?.payment === 'Belum Bayar' ? 0 : Math.max(0, (o?.paid || 0) - (o?.change || 0));
const remainOf = o => Math.max(0, (o?.total || 0) - settledOf(o));

const buildReceipt = (o, type) => {
  const kitchen = type === 'kitchen';
  const content = [receiptText('ZAYGA', 'center', true, 'large'), receiptText(o?.isAddition ? 'MENU TAMBAHAN' : (kitchen ? 'TIKET PESANAN DAPUR' : 'STRUK PEMBAYARAN'), 'center', true), receiptDivider(), ...(o?.isAddition ? [] : [receiptText(`No: ${o?.id}`, 'left', true)]), receiptText(`Waktu: ${o?.date} ${o?.time}`), receiptText(`Kasir: ${o?.cashier}`), receiptText(`Pelanggan: ${o?.customer || '-'}`), receiptText(`Lokasi: ${o?.location}`), receiptDivider()];
  for (const item of (o?.items || [])) {
    if (kitchen) {
      content.push(receiptText(`${item.qty} x ${item.name}`, 'left', true));
      if (item.note) content.push(receiptText(`    >> ${item.note}`, 'left', true));
    } else { content.push(receiptText(item.name)); content.push({ type: 'row', left: `${item.qty} x ${money(item.price)}`, right: money(item.qty * item.price) }); }
  }
  content.push(receiptDivider());
  if (kitchen) { content.push(receiptText('CATATAN DAPUR', 'left', true)); content.push(receiptText(o?.notes || '- Tidak ada catatan -')); content.push(receiptDivider()); content.push(receiptText('FITRI KAPAN NIKAH ?', 'center', true)); }
  else {
    if ((o?.discount || 0) > 0 || (o?.rounding || 0) > 0) {
      content.push({ type: 'row', left: 'Subtotal', right: money(sumItems(o?.items)) });
      if (o?.discount > 0) content.push({ type: 'row', left: 'Diskon', right: '-' + money(o?.discount) });
      if (o?.rounding > 0) content.push({ type: 'row', left: 'Pembulatan', right: money(o?.rounding) });
    }
    content.push({ type: 'row', left: 'TOTAL', right: money(o?.total), bold: true });
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
const sendPrintJob = (order, type, url) => postPrint(buildReceipt(order, type), `${order?.id}-${type}`, url);

/* ===================== Komponen Pendukung ===================== */
function OrdersTable({ orders, printOrder, onSelectOrder, onDelete }) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Status</th><th>Cetak</th><th>Pelanggan</th><th>Lokasi</th><th>Waktu</th><th>Total</th><th>Metode</th><th>Aksi / Cetak</th>
          </tr>
        </thead>
        <tbody>
          {safeOrders.map(o => {
            const isFullyPrinted = o.kitchen_printed && o.customer_printed;
            const st = statusOf(o);
            return (
              <tr key={o.id} style={{ cursor: 'pointer', background: isFullyPrinted ? 'transparent' : '#fefce8' }} onClick={() => onSelectOrder(o)}>
                <td data-label="ID"><b className="mono">{o.id}</b>{o._queued && <span className="cat-badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e' }}>Antre</span>}</td>
                <td data-label="Status"><span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, background: STATUS_STYLE[st][0], color: STATUS_STYLE[st][1] }}>{st}</span></td>
                <td data-label="Cetak">
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.kitchen_printed ? '#dcfce7' : '#fef08a', color: o.kitchen_printed ? '#166534' : '#854d0e' }}>{o.kitchen_printed ? 'Dap✓' : 'Dap!'}</span>
                    <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: o.customer_printed ? '#dcfce7' : '#fef08a', color: o.customer_printed ? '#166534' : '#854d0e' }}>{o.customer_printed ? 'Kas✓' : 'Kas!'}</span>
                  </div>
                </td>
                <td data-label="Pelanggan">{o.customer || '-'}</td>
                <td data-label="Lokasi"><span className="cat-badge">{o.location}</span></td>
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
          {safeOrders.length === 0 && <tr><td colSpan="9" className="empty-table" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada transaksi.</td></tr>}
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

    // breakdown performa harian / per jam (pengganti grafik)
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

    // menu trending
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

    // kategori
    const catMap = {};
    Object.values(tc).forEach(v => { catMap[v.cat] = (catMap[v.cat] || 0) + v.rev; });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    // jam sibuk
    const hrs = Array.from({ length: 16 }, (_, i) => i + 8);
    const peak = hrs.map(h => curO.filter(o => hourOf(o) === h).length);
    const peakMax = Math.max(...peak, 1);

    // metode bayar
    const pay = { Tunai: 0, QRIS: 0, Transfer: 0 };
    list.forEach(o => {
      if (Array.isArray(o.payments)) o.payments.forEach(p => { if (cur.has(p.d)) pay[p.m] = (pay[p.m] || 0) + (p.a || 0); });
      else if (cur.has(o.date) && o.payment !== 'Belum Bayar') pay[o.payment] = (pay[o.payment] || 0) + settledOf(o);
    });
    const payTotal = Object.values(pay).reduce((s, v) => s + v, 0);

    // kasir
    const cm = {};
    curO.forEach(o => { const c = o.cashier || 'Lainnya'; const e = cm[c] || (cm[c] = { amt: 0, n: 0 }); e.amt += o.total || 0; e.n++; });
    const cashiers = Object.entries(cm).sort((a, b) => b[1].amt - a[1].amt);

    // bon & antrian
    const bonOrders = list.filter(o => remainOf(o) > 0);
    const bon = sum(bonOrders, remainOf);
    const todayStr = ymd(new Date());
    const act = list.filter(o => o.date === todayStr && statusOf(o) !== 'Diantar');
    const live = { Baru: 0, Dimasak: 0, Siap: 0 };
    act.forEach(o => { const s = statusOf(o); if (live[s] !== undefined) live[s]++; });

    // stok
    const low = (items || []).filter(m => m.active && (m.sold_out || (m.stock != null && m.stock <= 5)))
      .sort((a, b) => (b.sold_out ? 1 : 0) - (a.sold_out ? 1 : 0) || (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 6);

    return { sales, prevSales, tx, prevTx, avg, prevAvg, qty, prevQty, disc, breakdown, maxBreakdownSales, bestBreakdown, top, cats, peak, peakMax, hrs, pay, payTotal, cashiers, bon, bonN: bonOrders.length, live, liveN: act.length, low };
  }, [orders, items, range]);

  const rangeName = range === 1 ? 'Hari ini' : range === 7 ? '7 hari terakhir' : '30 hari terakhir';
  const prevName = range === 1 ? 'kemarin' : `${range} hari sebelumnya`;
  const topMax = d.top[0]?.qty || 1;
  const catMax = d.cats[0]?.[1] || 1;
  const PAYC = { Tunai: 'var(--ok)', QRIS: 'var(--p)', Transfer: '#7c3aed' };
  const PAYC_HEX = { Tunai: '#16a34a', QRIS: '#2563eb', Transfer: '#7c3aed' };
  const LIVEC = { Baru: ['var(--warn-s)', 'var(--warn)'], Dimasak: ['var(--p-s)', 'var(--p)'], Siap: ['var(--ok-s)', 'var(--ok-d)'] };

  return (
    <div className="content">
      <div className="db">

        {/* Header & filter rentang waktu */}
        <div className="db-bar">
          <div>
            <h3>Ringkasan bisnis</h3>
            <p>Performa kedai · {rangeName} dibanding {prevName}.</p>
          </div>
          <div className="db-seg" role="tablist">
            {[[1, 'Hari ini'], [7, '7 Hari'], [30, '30 Hari']].map(([v, l]) => (
              <button key={v} type="button" className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>
            ))}
          </div>
        </div>

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
              : <span className="db-kpi-prev">Semua lunas ✓</span>
            }
          </div>
        </div>

        {/* Rincian performa harian / berkala (pengganti grafik) */}
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
                        <div
                          className={'db-fill' + (isBest ? ' db-fill-best' : '')}
                          style={{ width: `${item.sales > 0 ? Math.max(5, pct) : 0}%` }}
                        />
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

        <div className="db-grid">
          {/* Menu trending */}
          <section className="ui-card db-span2">
            <div className="ui-title">
              <div><h3>Menu terlaris</h3><p>Peringkat porsi terjual, dibandingkan {prevName}.</p></div>
              <Flame size={20} color="var(--warn)" />
            </div>
            {d.top.length ? (
              <div className="db-rank">
                {d.top.map((m, i) => (
                  <div className="db-rank-row" key={m.name}>
                    <div className="db-no">{i === 0 ? <Crown size={15} /> : i + 1}</div>
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
              <div><h3>Jam sibuk</h3><p>Transaksi per jam · {rangeName.toLowerCase()}.</p></div>
              <Clock size={20} color="var(--p)" />
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

          {/* Metode bayar - donut + legend */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Metode pembayaran</h3><p>Distribusi uang masuk.</p></div>
              <Wallet size={20} color="var(--ok)" />
            </div>
            {d.payTotal > 0 ? (
              <div className="db-pay-wrap">
                <DonutChart
                  slices={Object.values(d.pay)}
                  colors={Object.keys(d.pay).map(k => PAYC_HEX[k] || '#94a3b8')}
                />
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
              <div><h3>Penjualan per kategori</h3><p>Kontribusi omzet tiap kategori.</p></div>
              <BarChart3 size={20} color="#7c3aed" />
            </div>
            {d.cats.length ? (
              <div className="db-hb">
                {d.cats.map(([c, v], i) => {
                  const pct = Math.round(v / catMax * 100);
                  return (
                    <div className="db-hb-row" key={c}>
                      <div className="top"><b>{c}</b><span>{moneyShort(v)}</span></div>
                      <div className="db-track-wrap">
                        <div className="db-track">
                          <div className="db-fill db-fill-violet" style={{ width: Math.max(4, pct) + '%' }}></div>
                        </div>
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
              <div><h3>Rekap kasir</h3><p>Penjualan per akun kasir.</p></div>
              <Users size={20} color="var(--p)" />
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

          {/* Operasional & stok */}
          <section className="ui-card">
            <div className="ui-title">
              <div><h3>Status dapur hari ini</h3><p>{d.liveN} pesanan aktif sekarang.</p></div>
              <ChefHat size={20} color="var(--warn)" />
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
  const [usersList, setUsersList] = useState([]);

  const [items, setItems] = useState([]);
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

  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queueCount, setQueueCount] = useState(() => read('z_queue', []).length);
  const flushing = useRef(false);

  const [notifPerm, setNotifPerm] = useState(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  // Pusat audio hanya aktif pada perangkat yang ditandai secara lokal (mis. laptop dapur).
  const [centralAudioDevice, setCentralAudioDevice] = useState(() => read('z_central_audio_device', false));
  const [centralAudioReady, setCentralAudioReady] = useState(false);
  const kitchenAudioRef = useRef(null);
  const seenKitchenAudioOrders = useRef(new Set());

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [addingToOrder, setAddingToOrder] = useState(null);
  const [settling, setSettling] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Kasir' });
  const [selectedItemForVariant, setSelectedItemForVariant] = useState(null);
  const [variantTemp, setVariantTemp] = useState('');
  const [variantSusu, setVariantSusu] = useState(false);

  const [moveOrder, setMoveOrder] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);

  const [splitOrder, setSplitOrder] = useState(null);
  const [splitQty, setSplitQty] = useState({});
  const [splitLoc, setSplitLoc] = useState('');

  const [infoOpen, setInfoOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);

  const [baksoOpen, setBaksoOpen] = useState(false);
  const [baksoPrice, setBaksoPrice] = useState('');
  const [baksoName, setBaksoName] = useState('');

  const [localPrintUrl, setLocalPrintUrl] = useState(() => getLocalPrintBridge());
  const [serverPrintUrl, setServerPrintUrl] = useState('http://localhost:9100');

  const [printerStatus, setPrinterStatus] = useState('Memeriksa...');
  const [printerName, setPrinterName] = useState('');
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', category: 'Mie', price: '' });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [setTab, setSetTab] = useState('printer');
  const [serverDraft, setServerDraft] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [noteItem, setNoteItem] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStats, setNoteStats] = useState(() => read('z_note_stats', {}));

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
        flash('Notifikasi langsung aktif! Anda akan menerima peringatan meski di luar web.', 4000);
        new Notification('Zayga POS Terhubung', { body: 'Notifikasi latar belakang berhasil diaktifkan.' });
      } else {
        flash('Izin notifikasi ditolak oleh browser.', 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const testNotification = () => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Tes notifikasi Zayga', { body: 'Jika ini muncul, notifikasi perangkat sudah siap.', tag: 'zayga-test' });
      }
    } catch {}
    flash('Tes notifikasi visual dijalankan.', 2500);
  };

  // File audio diletakkan di folder public dengan nama kitchen-alarm.mp3.
  // Hanya perangkat yang ditandai sebagai pusat audio yang boleh memutarnya.
  const playCentralKitchenAlarm = () => {
    if (!read('z_central_audio_device', false) || !kitchenAudioRef.current) return;
    try {
      const audio = kitchenAudioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch(err => console.warn('Audio dapur tidak dapat diputar:', err));
    } catch (err) {
      console.warn('Gagal memutar alarm dapur:', err);
    }
  };

  const activateCentralAudio = async () => {
    try {
      const audio = new Audio('/kitchen-alarm.mp3');
      audio.preload = 'auto';
      audio.volume = 1;
      kitchenAudioRef.current = audio;
      // Pemutaran dari klik pengguna membuka izin audio browser untuk sesi ini.
      await audio.play();
      setCentralAudioReady(true);
      setCentralAudioDevice(true);
      write('z_central_audio_device', true);
      flash('Laptop berhasil diaktifkan sebagai pusat audio dapur.', 4500);
    } catch (err) {
      setCentralAudioReady(false);
      flash('Audio belum bisa diputar. Pastikan file public/kitchen-alarm.mp3 tersedia dan klik aktivasi lagi.', 6500);
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
    setToast({ msg, action });
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
      if (resUsers.data) setUsersList(resUsers.data);
      if (resMenu.data) setItems(resMenu.data);
      if (resOrders.data) setOrders(withQueue(resOrders.data));
      if (resLogs.data) setClearLogs(resLogs.data);
      if (resShifts.data) setShifts(resShifts.data);
      if (resSettings.data && resSettings.data.value) setServerPrintUrl(resSettings.data.value);
    } catch (err) {
      console.error('Gagal mengambil data dari Supabase:', err.message);
    }
  };

  const queueOrder = (o) => { const q = read('z_queue', []); q.push(o); write('z_queue', q); setQueueCount(q.length); };

  // [FIX #5] Antrean offline:
  //  - Error duplikat TIDAK langsung dianggap terkirim. Dicek dulu apakah baris di server memang
  //    pesanan yang sama (created_at + kasir sama). Kalau beda, ID diganti baru lalu dicoba lagi.
  //  - Stok dikurangi untuk setiap pesanan antrean yang berhasil terkirim.
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
    const ch = supabase.channel('zayga-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => {
        if (p.eventType === 'INSERT') {
          const n = p.new;
          if (n.deleted_at) return;
          const exists = ordersRef.current.some(x => x.id === n.id);
          setOrders(o => o.some(x => x.id === n.id) ? o : [n, ...o]);

          // Alarm pesanan baru hanya diputar oleh satu perangkat yang ditandai sebagai pusat audio.
          // Tidak memeriksa nama kasir agar pesanan dari laptop pusat sendiri juga tetap memicu alarm.
          if (read('z_central_audio_device', false) && !seenKitchenAudioOrders.current.has(n.id)) {
            seenKitchenAudioOrders.current.add(n.id);
            playCentralKitchenAlarm();
          }

          // Notifikasi visual tetap boleh tampil pada perangkat lain; tidak ada suara lokal di HP kasir.
          if (!exists && n.cashier !== userRef.current?.username) {
            const msgTitle = userRef.current?.role === 'Dapur' ? 'PESANAN BARU MASUK!' : `Pesanan baru ${locLabel(n.location)}`;
            const msgBody = `${locLabel(n.location)} · Oleh: ${n.cashier} · ${(n.items || []).length} item`;
            flash(msgTitle, 8000);
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
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
              flash(readyMsg, 10000);

              try {
                if ('Notification' in window && Notification.permission === 'granted') {
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
        if (p.eventType === 'DELETE') setItems(it => it.filter(x => x.id !== p.old.id));
        else setItems(it => it.some(x => x.id === p.new.id) ? it.map(x => x.id === p.new.id ? { ...x, ...p.new } : x) : [...it, p.new]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [user?.username]);

  // Fallback polling periodik: memastikan pesanan masuk ke KDS laptop dan pesanan siap selalu terkirim ke kasir
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

            // 1. Fallback ketika Realtime terputus: hanya laptop pusat yang memutar file alarm.
            const freshOrders = data.filter(d => !prevMap.has(d.id));
            if (read('z_central_audio_device', false) && freshOrders.length > 0) {
              const unseen = freshOrders.filter(d => !seenKitchenAudioOrders.current.has(d.id));
              unseen.forEach(d => seenKitchenAudioOrders.current.add(d.id));
              if (unseen.length > 0) playCentralKitchenAlarm();
            }
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

  useEffect(() => {
    if (addingToOrder) return;
    write('z_drafts', { draftId, drafts: drafts.map(d => d.id === draftId ? { id: draftId, cart, customer, location, notes, discount } : d) });
  }, [cart, customer, location, notes, discount, drafts, draftId, addingToOrder]);

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

  const favNames = useMemo(() => {
    const c = {};
    (orders || []).forEach(o => (o?.items || []).forEach(i => { const n = baseName(i.name); if (i.category !== 'Bakso') c[n] = (c[n] || 0) + i.qty; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  }, [orders]);
  const menuTabs = [...(favNames.length ? ['Favorit'] : []), ...categories, 'Bakso'];

  const filtered = useMemo(() => {
    let l = (items || []).filter(x => x.active && (category === 'Semua' || category === 'Favorit' || x.category === category) && x.name.toLowerCase().includes(query.toLowerCase()));
    if (category === 'Favorit') l = l.filter(x => favNames.includes(x.name)).sort((a, b) => favNames.indexOf(a.name) - favNames.indexOf(b.name));
    return l;
  }, [items, category, query, favNames]);
  const showBakso = (category === 'Semua' || category === 'Bakso') && 'bakso'.includes(query.trim().toLowerCase());

  const tableInfo = useMemo(() => {
    const m = {};
    todays.forEach(o => { const k = normLoc(o?.location); (m[k] = m[k] || []).push(o); });
    return m;
  }, [orders, today]);

  const noteChips = useMemo(() => {
    const custom = Object.entries(noteStats).filter(([k]) => !NOTE_PRESETS.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
    return [...NOTE_PRESETS, ...custom];
  }, [noteStats]);

  const subtotal = sumItems(cart);
  const discNum = Number(discount.value) || 0;
  const discAmt = addingToOrder ? 0 : Math.min(subtotal, discount.type === 'pct' ? Math.round(subtotal * Math.min(discNum, 100) / 100) : discNum);
  const netTotal = subtotal - discAmt;
  const roundAmt = (showPay && !settling && !addingToOrder && payment === 'Tunai' && roundTo) ? Math.ceil(netTotal / roundTo) * roundTo - netTotal : 0;
  const grand = netTotal + roundAmt;

  // [FIX #6] Saat menambah item ke bon lama, tagihan tambahan = total baru - total lama
  // (sudah memperhitungkan diskon persen yang menyesuaikan subtotal baru).
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
    setPayment('Tunai'); setPaid(''); setShowPay(true);
  };

  const add = (item) => {
    if (item.sold_out) { flash(`${item.name} sedang habis.`, 2500); return; }
    if (item.stock != null && qtyOf(item) >= item.stock) { flash(`Stok ${item.name} tinggal ${item.stock}.`, 3000); return; }
    if (item.category === 'Minuman' || item.category === 'Kopi') {
      setVariantTemp(''); setVariantSusu(false); setSelectedItemForVariant(item);
    } else addToCartDirect(item, false);
  };

  const addToCartDirect = (item, pakaiSusu = false, suhu = '') => {
    const finalPrice = pakaiSusu ? item.price + 3000 : item.price;
    const finalName = `${item.name}${suhu ? ` (${suhu})` : ''}${pakaiSusu ? ' + Susu' : ''}`;
    const finalId = `${item.id}${suhu ? `-${suhu.toLowerCase()}` : ''}${pakaiSusu ? '-susu' : ''}`;
    buzz();
    setCart(old => {
      const found = old.find(x => x.id === finalId);
      return found
        ? old.map(x => x.id === finalId ? { ...x, qty: x.qty + 1 } : x)
        : [...old, { id: finalId, menuId: item.id, name: finalName, category: item.category, price: finalPrice, qty: 1, item_status: 'Baru' }];
    });
    setSelectedItemForVariant(null);
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
    setItems(prev => prev.map(m => m.id === item.id ? { ...m, ...patch } : m));
    setStockItem(null);
    flash(patch.sold_out ? `${item.name} ditandai habis.` : `Stok ${item.name} diperbarui.`, 3000);
  };

  // [FIX #1] Pengurangan stok dilakukan ATOMIK di server (RPC consume_stock):
  // stock = greatest(0, stock - qty) dihitung di database, bukan dari angka di browser.
  // Dua kasir yang order bersamaan tidak lagi saling menimpa.
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

  const openItemNote = (x) => { setNoteItem(x); setNoteDraft(x.note || ''); };
  const toggleNoteChip = (p) => setNoteDraft(d => {
    const parts = d.split(',').map(s => s.trim()).filter(Boolean);
    return (parts.includes(p) ? parts.filter(s => s !== p) : [...parts, p]).join(', ');
  });
  const saveItemNote = () => {
    const x = noteItem;
    if (!x) return;
    const text = noteDraft.trim();
    const baseId = String(x.id).split('~')[0];
    const newId = text ? `${baseId}~${text.toLowerCase().replace(/\s+/g, '_')}` : baseId;
    if (text) {
      const st = { ...noteStats };
      text.split(',').map(s => s.trim()).filter(Boolean).forEach(p => { st[p] = (st[p] || 0) + 1; });
      setNoteStats(st); write('z_note_stats', st);
    }
    setCart(old => {
      const c0 = old.find(c => c.id === x.id);
      if (!c0) return old;
      const rest = old.filter(c => c.id !== x.id);
      const dup = rest.find(c => c.id === newId);
      if (dup) return rest.map(c => c.id === newId ? { ...c, qty: c.qty + c0.qty } : c);
      return old.map(c => c.id === x.id ? { ...c0, id: newId, note: text } : c);
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

    try {
      await sendPrintJob(
        { ...base, id: `${base.id}-T${Date.now().toString().slice(-4)}`, items: addedCart, isAddition: true, notes: extraNote },
        'kitchen',
        activePrintUrl
      );
      await supabase.from('orders').update({ kitchen_printed: true }).eq('id', base.id);
      updated = { ...updated, kitchen_printed: true };
      flash(`Tambahan ${locLabel(base.location)} tersimpan & tiket dapur tercetak.`, 6000);
    } catch (err) {
      flash(`Tambahan ${locLabel(base.location)} tersimpan, tapi cetak dapur gagal: ${err.message}`, 8000);
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
    e.preventDefault();
    if (user.role !== 'Admin') return;
    const uname = newUser.username.trim(), pwd = newUser.password.trim();
    if (!uname || !pwd) { flash('Username dan password wajib diisi.'); return; }
    if (usersList.some(u => u.username.toLowerCase() === uname.toLowerCase())) { flash('Username sudah digunakan. Pilih nama lain.'); return; }
    const newUserData = { username: uname, password: pwd, role: newUser.role };
    const { error } = await supabase.from('users').insert([newUserData]);
    if (!error) { setUsersList([...usersList, newUserData]); setNewUser({ username: '', password: '', role: 'Kasir' }); flash(`Akun ${newUser.role} "${uname}" berhasil dibuat.`, 4000); }
    else flash('Gagal membuat akun ke Supabase.', 4000);
  };
  const handleDeleteUser = async (targetUsername) => {
    if (user.role !== 'Admin') return;
    if (targetUsername.toLowerCase() === 'admin') { flash('Akun admin utama tidak dapat dihapus.'); return; }
    if (window.confirm(`Yakin ingin menghapus akun "${targetUsername}"?`)) {
      const { error } = await supabase.from('users').delete().eq('username', targetUsername);
      if (!error) { setUsersList(usersList.filter(u => u.username !== targetUsername)); flash(`Akun "${targetUsername}" berhasil dihapus.`, 4000); }
      else flash('Gagal menghapus akun.', 4000);
    }
  };

  const autoPrint = async (o) => {
    try {
      await sendPrintJob(o, 'kitchen', printUrlRef.current);
      const fields = { kitchen_printed: true };
      await supabase.from('orders').update(fields).eq('id', o.id);
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...fields } : x));
      return true;
    } catch (err) {
      flash(
        `Pesanan tersimpan, tetapi tiket dapur gagal dicetak: ${err.message}`,
        9000,
        { label: 'Coba cetak tiket dapur', fn: () => printOrder(o, 'kitchen') }
      );
      return false;
    }
  };

  const printOrder = async (o, type = 'customer') => {
    setPrinting(true);
    try {
      await sendPrintJob(o, type, printUrlRef.current);
      const updateField = type === 'kitchen' ? { kitchen_printed: true } : { customer_printed: true };
      await supabase.from('orders').update(updateField).eq('id', o.id);
      setOrders(prev => prev.map(item => item.id === o.id ? { ...item, ...updateField } : item));
      flash(`${type === 'kitchen' ? 'Tiket dapur' : 'Struk pelanggan'} ${o.id} berhasil dicetak.`);
    } catch (err) {
      flash(`Gagal mencetak: ${err.message}`, 7000, { label: 'Coba lagi', fn: () => printOrder(o, type) });
    } finally { setPrinting(false); }
  };

  const refreshPrinter = async () => {
    setPrinterStatus('Memeriksa...');
    try {
      const data = await checkPrintBridge(activePrintUrl);
      setPrinterStatus('Terhubung'); setPrinterName(data.printer?.name || 'Printer Bluetooth');
    } catch (err) { setPrinterStatus('Tidak terhubung'); setPrinterName(err.message); }
  };

  const testPrinter = async () => {
    setPrinting(true);
    try {
      const content = [receiptText('ZAYGA', 'center', true, 'large'), receiptText('TES KONEKSI PRINTER', 'center', true), receiptDivider(), receiptText('Bluetooth Classic · 58 mm', 'center'), receiptText(new Date().toLocaleString('id-ID'), 'center'), { type: 'feed', lines: 3 }];
      await postPrint(content, 'ZAYGA-TEST-PRINTER', activePrintUrl);
      flash('Tes printer berhasil.', 3000);
    } catch (err) { flash(`Tes printer gagal: ${err.message}`, 6000); }
    finally { setPrinting(false); }
  };

  const finish = async () => {
    if (saving) return;
    if (!location.trim()) { flash('Lokasi meja perlu diisi agar pesanan mudah diantar.', 4000); setShowPay(false); return; }
    if (!cart.length) return;
    const isBon = payment === 'Belum Bayar';
    const received = isBon ? 0 : (payment === 'Tunai' ? Number(paid || 0) : grand);
    if (!isBon && payment === 'Tunai' && received < grand) { flash('Uang diterima masih kurang.', 3000); return; }

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
      payment, paid: received, change: isBon ? 0 : Math.max(0, received - grand),
      status: isBon ? 'Belum Lunas' : 'Lunas', order_status: 'Baru',
      payments: isBon ? [] : [ledger(payment, grand, user.username)],
      kitchen_printed: false, customer_printed: false, cashier: user.username
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
    closeDraft(); setPaid(''); setShowPay(false); setCartOpen(false); setSaving(false);

    if (queued) { flash('Tidak ada internet: pesanan diantre dan dikirim otomatis saat online.', 7000); return; }
    consumeStock(sold);
    flash('Pesanan tersimpan. Mencetak tiket dapur...', 3000);
    const ok = await autoPrint(order);
    if (ok) flash(`${locLabel(order.location)} tersimpan & tiket dapur tercetak.`, 4000);
  };

  // [FIX #2] "Bersihkan riwayat" kini soft delete (kolom deleted_at), bukan DELETE permanen.
  // State lokal baru dikosongkan SETELAH server berhasil; data masih bisa dipulihkan lewat SQL.
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

  const openMove = (o) => { setMoveOrder(o); setMoveTarget(''); };
  const closeMove = () => { if (!moveBusy) { setMoveOrder(null); setMoveTarget(''); } };

  const doMove = async (o, destRaw) => {
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

  // [FIX #3] Gabung bon dijalankan lewat RPC merge_orders: update bon tujuan + arsipkan bon asal
  // dalam SATU transaksi database. Gagal di tengah = tidak ada perubahan sama sekali.
  const doMerge = async (srcIn, tgtIn) => {
    const src = orders.find(x => x.id === srcIn.id) || srcIn;
    const tgt = orders.find(x => x.id === tgtIn.id) || tgtIn;
    if (src.id === tgt.id) return;
    if (!window.confirm(`Gabungkan bon ${src.id} (meja ${src.location}) ke bon ${tgt.id} (meja ${tgt.location})?\nBon ${src.id} akan diarsipkan dan semua itemnya masuk ke bon ${tgt.id}.`)) return;

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

  // [FIX #3] Pisah bon lewat RPC split_order: bon asal dikurangi + bon baru dibuat dalam SATU transaksi.
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
      payments: [], order_status: statusOf(src),
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

  const saveMenu = async () => {
    if (user.role !== 'Admin') return;
    if (!menuForm.name.trim() || Number(menuForm.price) <= 0) return;
    if (editing) {
      const { error } = await supabase.from('menu_items').update({ name: menuForm.name, category: menuForm.category, price: Number(menuForm.price) }).eq('id', editing);
      if (!error) setItems(items.map(x => x.id === editing ? { ...x, ...menuForm, price: Number(menuForm.price) } : x));
    } else {
      const newItem = { name: menuForm.name, category: menuForm.category, price: Number(menuForm.price), active: true };
      const { data, error } = await supabase.from('menu_items').insert([newItem]).select();
      if (!error && data) setItems(prev => prev.some(x => x.id === data[0].id) ? prev : [...prev, data[0]]);
    }
    setEditing(null); setMenuForm({ name: '', category: 'Mie', price: '' });
  };
  const toggleMenuStatus = async (item) => {
    if (user.role !== 'Admin') return;
    const newStatus = !item.active;
    const { error } = await supabase.from('menu_items').update({ active: newStatus }).eq('id', item.id);
    if (!error) setItems(items.map(m => m.id === item.id ? { ...m, active: newStatus } : m));
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
    setPage(label); setSidebarOpen(false);
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
        else if (infoOpen) setInfoOpen(false); else if (showPay) closePay(); else if (baksoOpen) setBaksoOpen(false);
        else if (selectedItemForVariant) setSelectedItemForVariant(null); else if (splitOrder) setSplitOrder(null);
        else if (moveOrder) closeMove(); else if (tableSheet) setTableSheet(null); else if (selectedOrder) setSelectedOrder(null);
        else if (cartOpen) setCartOpen(false);
        return;
      }
      if (typing || !user) return;
      const anyOverlay = infoOpen || showPay || noteItem || selectedOrder || moveOrder || splitOrder || tableSheet || stockItem || discOpen || baksoOpen || selectedItemForVariant;
      if (e.key === '/' && page === 'Pesanan') { e.preventDefault(); searchRef.current && searchRef.current.focus(); }
      if (e.key === 'Enter' && page === 'Pesanan' && !anyOverlay && cart.length && !addingToOrder) goPay();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const toastEl = toast && (
    <div className="toast" style={{ zIndex: 1100 }}>
      <CheckCircle2 size={18} />
      <span>{toast.msg}</span>
      {toast.action && <button type="button" className="ta" onClick={() => { toast.action.fn(); setToast(null); }}>{toast.action.label}</button>}
    </div>
  );

  /* ===================== Layar login ===================== */
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

  /* ===================== Aplikasi utama ===================== */
  return (
    <div className="app-shell">
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)}></div>}

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
            <button className="icon-btn" title="Keluar" onClick={logoutNow}><LogOut size={16} /></button>
          </div>
          <p className="tiny">Zayga POS · Supabase Cloud</p>
        </div>
      </aside>

      <main className="main">
        {(!online || queueCount > 0) && (
          <div className="offline"><WifiOff size={16} />{!online ? 'Offline.' : 'Menyambungkan ulang.'} {queueCount > 0 ? `${queueCount} pesanan menunggu dikirim.` : 'Pesanan baru akan diantre.'}</div>
        )}
        {page !== 'Antrian' && (
          <header className="topbar">
            <div className="topbar-left">
              <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><MenuIcon size={24} /></button>
              <div><p className="eyebrow">{user.role === 'Admin' ? 'PANEL ADMIN' : user.role === 'Dapur' ? 'AREA DAPUR' : 'AREA KASIR'}</p><h2>{page}</h2></div>
            </div>
            <div className="top-right">
              <span className="live-dot"></span>
              <span className="hide-mobile">{online ? 'Supabase Online' : 'Offline'}</span>
              <span className="date-pill">
                <Clock size={14} />
                <span className="hide-mobile">{new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </span>
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
                  const variant = x.category === 'Minuman' || x.category === 'Kopi';
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
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.note || 'Catatan'}</span>
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
                            <button type="button" key={n} className={'po-tn ' + (location === n ? 'on' : '')} onClick={() => setLocation(n)}>{n}</button>
                          ))}
                        </div>
                        <div className="po-quick">
                          {['Bawa pulang', 'Meja belakang'].map(q => (
                            <button type="button" key={q} className={location === q ? 'on' : ''} onClick={() => setLocation(q)}>{q}</button>
                          ))}
                          {location && <button type="button" onClick={() => setLocation('')}>Hapus pilihan</button>}
                        </div>
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
                    <div className="po-quick" style={{ marginTop: 0 }}>
                      {noteChips.map(p => (
                        <button type="button" key={p} className={noteDraft.split(',').map(s => s.trim()).includes(p) ? 'on' : ''} onClick={() => toggleNoteChip(p)}>{p}</button>
                      ))}
                    </div>
                    <input className="po-in" style={{ marginTop: 10 }} value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveItemNote(); }} placeholder="Atau ketik sendiri, contoh: sambal dipisah" />
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
          const stateOf = k => { const l = tableInfo[k] || []; if (!l.length) return 'free'; if (l.some(o => remainOf(o) > 0)) return 'due'; if (l.some(o => statusOf(o) !== 'Diantar')) return 'busy'; return 'free'; };
          const pretty = { 'bawa pulang': 'Bawa pulang', 'meja belakang': 'Meja belakang' };
          const extras = [...new Set([...Object.keys(pretty), ...Object.keys(tableInfo).filter(k => !/^\d{2}$/.test(k))])];
          const stText = { free: 'Kosong', busy: 'Terisi', due: 'Belum lunas' };
          const cnt = s => nums.filter(n => stateOf(n) === s).length;
          const cell = (k, label, loc) => {
            const st = stateOf(k), n = (tableInfo[k] || []).length;
            return (
              <button type="button" key={k} className={'tb-cell tb-' + st} onClick={() => setTableSheet({ key: k, label, loc })}>
                {label.replace('Meja ', '')}<small>{stText[st]}{n > 1 ? ` · ${n} bon` : ''}</small>
              </button>
            );
          };
          return (
            <div className="content">
              <div className="tb">
                <div className="tb-sum">
                  <span className="tb-pill"><i style={{ background: '#22c55e' }}></i>Kosong {cnt('free')}</span>
                  <span className="tb-pill"><i style={{ background: '#eab308' }}></i>Terisi {cnt('busy')}</span>
                  <span className="tb-pill"><i style={{ background: '#ef4444' }}></i>Belum lunas {cnt('due')}</span>
                </div>
                <div className="tb-grid">{nums.map(n => cell(n, 'Meja ' + n, n))}</div>
                <div className="tb-ex">{extras.map(k => cell(k, pretty[k] || tableInfo[k]?.[0]?.location || k, pretty[k] || tableInfo[k]?.[0]?.location || k))}</div>
              </div>
            </div>
          );
        })()}

        {/* ================= ANTRIAN (BERBEDA PER HAK AKSES) =================
            Dapur  → KDS dapur  : memasak per item/pesanan, batch memasak, filter pos, TANPA info bayar
            Kasir  → Penyajian  : notifikasi siap, antar per item/semua, info pembayaran, TANPA kontrol masak
            Admin  → kedua tampilan, bisa dipindah lewat toggle (pilihan tersimpan)
        */}
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
              <button type="button" className={queueView === 'dapur' ? 'on' : ''} onClick={() => changeAdminQueueMode('dapur')}>👨‍🍳 Tampilan Dapur</button>
              <button type="button" className={queueView === 'kasir' ? 'on' : ''} onClick={() => changeAdminQueueMode('kasir')}>🧾 Tampilan Kasir</button>
            </div>
          );

          const syncBtn = (
            <button type="button" className="kds-action-btn" onClick={syncKdsNow} disabled={kdsSyncing} title="Sinkronkan data dengan database">
              <RefreshCw size={15} className={kdsSyncing ? 'anim-spin' : ''} /> <span className="btn-text-desktop">{kdsSyncing ? 'Menyinkronkan...' : 'Sinkron'}</span>
            </button>
          );

          const emptyBox = (title, text) => (
            <div className="ui-empty" style={{ padding: '48px 16px', background: 'var(--sf)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)' }}>
              <ChefHat size={42} color="var(--mut)" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{title}</h3>
              <p style={{ margin: 0, color: 'var(--mut)', fontSize: '0.85rem' }}>{text}</p>
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
                        <div className="kds-brand-ico"><ChefHat size={22} /></div>
                        <div>
                          <h2>KDS DAPUR ZAYGA</h2>
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
                              <small>{o.time} · {o.cashier ? `Kasir: ${o.cashier}` : o.id}</small>
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
                                    {it.note && <span className="kds-item-note">» {it.note}</span>}
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
                                    {it.note && <span className="exp-item-note">» {it.note}</span>}
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
          const list = histFilter === 'Hari ini' ? todays : histFilter === 'Belum lunas' ? orders.filter(o => remainOf(o) > 0) : orders;
          return (
            <div className="content">
              <div className="panel">
                <div className="section-head">
                  <div><h3>Riwayat transaksi</h3><p className="muted">Ketuk transaksi untuk melihat detail pesanan.</p></div>
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
                <div className="po-cats" style={{ marginBottom: 12 }}>
                  {['Hari ini', 'Belum lunas', 'Semua'].map(f => <button key={f} type="button" className={histFilter === f ? 'on' : ''} onClick={() => setHistFilter(f)}>{f}</button>)}
                </div>
                <OrdersTable orders={list} printOrder={printOrder} onSelectOrder={setSelectedOrder} onDelete={user.role === 'Admin' ? deleteOrder : null} />
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
        {page === 'Kelola Menu' && user.role === 'Admin' && (
          <div className="content">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Kelola menu</h3>
                  <p className="muted">Tambah, ubah harga, atau status menu. Menu Bakso berdiri sendiri dengan harga custom, jadi tidak perlu diatur di sini.</p>
                </div>
              </div>
              <div className="menu-editor">
                <input placeholder="Nama menu" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} />
                <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}>
                  {categories.slice(1).map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="number" inputMode="numeric" placeholder="Harga" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} />
                <button className="primary" onClick={saveMenu}>{editing ? 'Simpan' : 'Tambah'}</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nama menu</th><th>Kategori</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {items.map(x => (
                      <tr key={x.id}>
                        <td data-label="Nama menu"><b>{x.name}</b></td>
                        <td data-label="Kategori"><span className="cat-badge">{x.category}</span></td>
                        <td data-label="Harga">{money(x.price)}</td>
                        <td data-label="Status"><span className={x.active ? 'status-done' : 'status-off'}>{!x.active ? 'Nonaktif' : x.sold_out ? 'Habis' : x.stock != null ? `Stok ${x.stock}` : 'Aktif'}</span></td>
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

        {/* ================= PENGATURAN ================= */}
        {page === 'Pengaturan' && (() => {
          const isAdmin = user.role === 'Admin';
          const isDapur = user.role === 'Dapur';
          const onl = printerStatus === 'Terhubung';
          const checking = printerStatus === 'Memeriksa...';
          const tabs = [
            { id: 'printer', label: isDapur ? 'Notifikasi' : 'Printer & Notifikasi', icon: Printer },
            ...(isAdmin ? [{ id: 'akun', label: 'Karyawan', icon: Users }, { id: 'log', label: 'Log hapus', icon: ShieldAlert }] : []),
            { id: 'profil', label: 'Akun saya', icon: UserRound }
          ];
          const tab = tabs.some(t => t.id === setTab) ? setTab : 'printer';
          const serverDirty = serverDraft.trim() !== serverPrintUrl.trim();
          const roleCls = r => r === 'Admin' ? 'admin' : r === 'Dapur' ? 'dapur' : 'kasir';
          const notifPill = notifPerm === 'granted' ? ['ok', 'Diizinkan'] : notifPerm === 'denied' ? ['bad', 'Ditolak'] : ['wait', 'Belum diminta'];

          return (
            <div className="content">
              <div className="sx">
                <div className="sx-tabs" role="tablist">
                  {tabs.map(t => {
                    const TabIcon = t.icon;
                    return (
                      <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={'sx-tab ' + (tab === t.id ? 'on' : '')} onClick={() => setSetTab(t.id)}>
                        <TabIcon size={17} /> {t.label}
                      </button>
                    );
                  })}
                </div>

                {tab === 'printer' && (
                  <div className="sx-grid">
                    {!isDapur && (
                      <div className="ui-card">
                        <div className="sx-head">
                          <span className="sx-ico"><Printer size={20} /></span>
                          <div><h3>Status printer</h3><p>Cek apakah printer Bluetooth siap mencetak lewat Cleanter.</p></div>
                        </div>
                        <div className={'sx-status ' + (onl ? 'ok' : checking ? '' : 'bad')}>
                          <span className="dot"></span>
                          <div>
                            <b>{onl ? 'Printer terhubung' : checking ? 'Memeriksa koneksi...' : 'Printer belum terhubung'}</b>
                            <span className="t">{printerName || 'Pastikan aplikasi Cleanter aktif & Bluetooth menyala.'}</span>
                          </div>
                        </div>
                        <div className="sx-kv" style={{ marginTop: 8 }}><span>Endpoint aktif</span><b>{activePrintUrl}</b></div>
                        <div className="sx-actions">
                          <button type="button" className="sx-btn" onClick={refreshPrinter}><RefreshCw size={16} /> Cek ulang</button>
                          <button type="button" className="sx-btn primary" disabled={printing} onClick={testPrinter}><Printer size={16} /> {printing ? 'Mencetak...' : 'Cetak tes'}</button>
                        </div>
                      </div>
                    )}

                    <div className="ui-card" style={isDapur ? { gridColumn: '1 / -1' } : undefined}>
                      <div className="sx-head">
                        <span className="sx-ico amber"><Bell size={20} /></span>
                        <div><h3>Notifikasi pesanan</h3><p>Suara dan pop-up saat ada pesanan baru atau menu siap diantar, meski layar redup atau membuka aplikasi lain.</p></div>
                      </div>
                      <div className="sx-kv"><span>Izin browser</span><b><span className={'sx-pill ' + notifPill[0]}>{notifPill[1]}</span></b></div>
                      <div className="sx-kv"><span>Koneksi realtime</span><b><span className={'sx-pill ' + (online ? 'ok' : 'bad')}>{online ? 'Online' : 'Offline'}</span></b></div>
                      <div className="sx-actions">
                        {notifPerm !== 'granted' && (
                          <button type="button" className="sx-btn amber" onClick={requestNotificationPermission}><Bell size={16} /> Aktifkan notifikasi</button>
                        )}
                        <button type="button" className="sx-btn" onClick={testNotification}><Bell size={16} /> Tes notifikasi perangkat</button>
                      </div>
                      <div className="sx-field" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line, #e5e7eb)' }}>
                        <div className="sx-head" style={{ marginBottom: 8 }}>
                          <span className="sx-ico amber"><Volume2 size={20} /></span>
                          <div><h3>Pusat audio dapur</h3><p>Hanya satu perangkat (disarankan laptop) yang memutar file alarm untuk semua pesanan baru dari seluruh kasir.</p></div>
                        </div>
                        <div className="sx-kv"><span>Peran perangkat ini</span><b><span className={'sx-pill ' + (centralAudioDevice ? 'ok' : 'wait')}>{centralAudioDevice ? 'Pusat audio' : 'Perangkat kasir biasa'}</span></b></div>
                        <div className="sx-kv"><span>Status audio sesi ini</span><b><span className={'sx-pill ' + (centralAudioReady ? 'ok' : 'wait')}>{centralAudioReady ? 'Siap memutar' : 'Belum diaktifkan'}</span></b></div>
                        <p className="sx-hint" style={{ marginTop: 8 }}>Letakkan file alarm di <b>public/kitchen-alarm.mp3</b>. Hubungkan Headphones 2-K12 ke laptop dan pilih sebagai output suara Windows.</p>
                        <div className="sx-actions">
                          {!centralAudioDevice ? (
                            <button type="button" className="sx-btn amber" onClick={activateCentralAudio}><Volume2 size={16} /> Jadikan perangkat ini pusat audio & tes</button>
                          ) : (
                            <>
                              <button type="button" className="sx-btn amber" onClick={activateCentralAudio}><Volume2 size={16} /> Aktifkan ulang & tes audio</button>
                              <button type="button" className="sx-btn danger" onClick={disableCentralAudio}>Nonaktifkan pusat audio</button>
                            </>
                          )}
                        </div>
                      </div>
                      {notifPerm === 'denied' && <p className="sx-hint" style={{ marginTop: 10 }}>Izin ditolak. Buka pengaturan situs di browser lalu ubah izin Notifikasi menjadi "Izinkan".</p>}
                    </div>

                    {!isDapur && (
                      <div className="ui-card sx-full">
                        <div className="sx-head">
                          <span className="sx-ico green"><Server size={20} /></span>
                          <div><h3>Alamat printer (endpoint)</h3><p>Atur ke mana struk dan tiket dapur dikirim.</p></div>
                        </div>
                        <div className="sx-field">
                          <label className="sx-label"><Server size={15} /> Server pusat (semua kasir)</label>
                          <div className="sx-row">
                            <input className="sx-input" inputMode="url" value={serverDraft} onChange={e => setServerDraft(e.target.value)} placeholder="http://192.168.1.100:9100" disabled={!isAdmin} />
                            {isAdmin && <button type="button" className="sx-btn primary" disabled={!serverDirty} onClick={saveServerPrintUrl}><Save size={16} /> Simpan</button>}
                          </div>
                          <span className="sx-hint">{isAdmin ? 'Tersimpan di cloud, otomatis disinkronkan ke semua perangkat kasir.' : 'Hanya Admin yang dapat mengubah alamat server pusat.'}</span>
                        </div>
                        <div className="sx-field">
                          <label className="sx-label"><Smartphone size={15} /> Khusus perangkat ini (lokal)</label>
                          <input className="sx-input" inputMode="url" value={localPrintUrl} onChange={handleLocalPrintUrlChange} placeholder="http://localhost:9100" />
                          <span className="sx-hint">Hanya berlaku di perangkat ini. Jika server pusat diisi, server pusat diprioritaskan.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'akun' && isAdmin && (
                  <div className="sx-grid">
                    <div className="ui-card">
                      <div className="sx-head">
                        <span className="sx-ico"><UserPlus size={20} /></span>
                        <div><h3>Tambah akun karyawan</h3><p>Buat akun baru supaya karyawan bisa masuk.</p></div>
                      </div>
                      <form onSubmit={handleCreateUser}>
                        <div className="sx-field">
                          <label className="sx-label">Username</label>
                          <input className="sx-input" autoComplete="off" placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                        </div>
                        <div className="sx-field">
                          <label className="sx-label">Password</label>
                          <div className="sx-pass">
                            <input className="sx-input" autoComplete="new-password" type={showPwd ? 'text' : 'password'} placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                            <button type="button" className="sx-eye" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}>
                              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div className="sx-seg">
                          {['Kasir', 'Dapur', 'Admin'].map(r => <button key={r} type="button" className={newUser.role === r ? 'on' : ''} onClick={() => setNewUser({ ...newUser, role: r })}>{r}</button>)}
                        </div>
                        <button className="sx-btn primary" style={{ width: '100%' }} type="submit"><UserPlus size={16} /> Tambah akun</button>
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
                            <div className="sx-av">{u.username[0].toUpperCase()}</div>
                            <div className="sx-li-main">
                              <b>{u.username}</b>
                              <small><span className={'sx-badge ' + roleCls(u.role)}>{u.role}</span></small>
                            </div>
                            {u.username.toLowerCase() !== 'admin'
                              ? <button type="button" className="sx-del" onClick={() => handleDeleteUser(u.username)}><Trash2 size={14} /> Hapus</button>
                              : <span className="sx-tag">Akun utama</span>}
                          </div>
                        ))}
                        {!usersList.length && <div className="ui-empty">Belum ada akun.</div>}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'log' && isAdmin && (
                  <div className="ui-card">
                    <div className="sx-head">
                      <span className="sx-ico red"><ShieldAlert size={20} /></span>
                      <div><h3>Log riwayat yang dihapus</h3><p>Catatan siapa yang menghapus transaksi dan kapan.</p></div>
                    </div>
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
                )}

                {tab === 'profil' && (
                  <div className="ui-card" style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
                    <div className="sx-me">
                      <div className="big">{user.username[0].toUpperCase()}</div>
                      <b>{user.username}</b>
                      <span className={'sx-badge ' + roleCls(user.role)}>{user.role}</span>
                    </div>
                    <div className="sx-kv"><span>Status koneksi</span><b><span className={'sx-pill ' + (online ? 'ok' : 'bad')}>{online ? 'Online' : 'Offline'}</span></b></div>
                    <div className="sx-kv"><span>Pesanan menunggu kirim</span><b>{queueCount}</b></div>
                    <div className="sx-kv"><span>Notifikasi</span><b><span className={'sx-pill ' + notifPill[0]}>{notifPill[1]}</span></b></div>
                    <div className="sx-actions">
                      <button type="button" className="sx-btn danger" onClick={logoutNow}><LogOut size={16} /> Keluar dari aplikasi</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>

      <nav className="bn">
        {user.role === 'Dapur' ? (
          <>
            <button type="button" className={page === 'Antrian' ? 'on' : ''} onClick={() => handlePageChange('Antrian')}>
              <ChefHat size={20} />Antrian
              {siapCount > 0 && <i>{siapCount}</i>}
            </button>
            <button type="button" className={page === 'Pengaturan' ? 'on' : ''} onClick={() => handlePageChange('Pengaturan')}>
              <Settings size={20} />Pengaturan
            </button>
          </>
        ) : (
          <>
            {['Pesanan', 'Denah', 'Antrian', 'Riwayat'].map(l => {
              const it = visibleNavItems.find(n => n[1] === l);
              if (!it) return null;
              const Icon = it[0];
              return (
                <button key={l} type="button" className={page === l ? 'on' : ''} onClick={() => handlePageChange(l)}>
                  <Icon size={20} />{l}
                  {l === 'Antrian' && siapCount > 0 && <i>{siapCount}</i>}
                  {l === 'Pesanan' && cartQty > 0 && !addingToOrder && <i style={{ background: '#2563eb' }}>{cartQty}</i>}
                </button>
              );
            })}
            <button type="button" onClick={() => setSidebarOpen(true)}><MenuIcon size={20} />Lainnya</button>
          </>
        )}
      </nav>

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
                <div className="dt-meja"><small>MEJA</small><b>{o.location}</b></div>
                <div className="dt-title"><h2>{o.id}</h2><p>{o.date} · {o.time}</p></div>
                <button className="dt-close" onClick={() => setSelectedOrder(null)} aria-label="Tutup"><X size={18} /></button>
              </div>

              <div className="dt-body">
                <div>
                  <div className="dt-chips">
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
                </div>
              </div>

              <div className="dt-foot">
                <div className="dt-main">
                  {remain > 0 && <button className="dt-btn pay" onClick={() => openSettle(o)}><Wallet size={18} /> Bayar Sisa · {money(remain)}</button>}
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
                <span className="mv-label" style={{ marginTop: 0 }}>Pindah ke meja</span>
                <div className="mv-grid">
                  {tables.map(n => {
                    const cur = normLoc(o.location) === n;
                    return (
                      <button key={n} type="button" disabled={cur} className={'mv-table ' + (cur ? 'cur ' : '') + (dest === n ? 'on' : '')} onClick={() => setMoveTarget(n)}>
                        {n}{busyTables.has(n) && <i></i>}
                      </button>
                    );
                  })}
                </div>
                <div className="mv-legend"><i></i> Ada bon yang belum lunas</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {['Bawa pulang', 'Meja belakang'].map(q => (
                    <button key={q} type="button" onClick={() => setMoveTarget(q)}
                      style={{ height: '40px', padding: '0 14px', borderRadius: '99px', border: `1.5px solid ${moveTarget === q ? '#2563eb' : '#e2e8f0'}`, background: moveTarget === q ? '#eff6ff' : '#fff', color: moveTarget === q ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>{q}</button>
                  ))}
                </div>
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

      {/* ================= SHEET: PISAH BON ================= */}
      {splitOrder && (() => {
        const o = orders.find(x => x.id === splitOrder.id) || splitOrder;
        const orderItems = o?.items || [];
        const movedItems = orderItems.map((it, i) => ({ ...it, qty: Math.min(splitQty[i] || 0, it.qty) })).filter(it => it.qty > 0);
        const movedTotal = sumItems(movedItems);
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
                {((o.discount || 0) > 0 || (o.rounding || 0) > 0) && <p className="mv-hint">Diskon dan pembulatan tetap di bon asal.</p>}
                <p className="mv-hint">Bon baru: <b>{money(movedTotal)}</b>{movedItems.length ? ` (${movedItems.reduce((s, x) => s + x.qty, 0)} porsi)` : ''}. Pembayaran yang sudah masuk tetap dihitung ke bon asal dulu.</p>
                <button className="mv-move" disabled={moveBusy || !movedItems.length} onClick={doSplit}>Pisahkan jadi bon baru</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL VARIAN / BAKSO ================= */}
      {selectedItemForVariant && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '380px', textAlign: 'center' }}>
            <p className="eyebrow">PILIH VARIAN</p>
            <h2>{selectedItemForVariant.name}</h2>
            <p className="muted" style={{ margin: '4px 0 12px' }}>Suhu <em>Opsional</em></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[['Panas', Flame, '#ea580c', '#fff7ed'], ['Hangat', Coffee, '#d97706', '#fffbeb'], ['Dingin', Snowflake, '#0284c7', '#f0f9ff']].map(([t, Icon, color, bg]) => {
                const on = variantTemp === t;
                return (
                  <button key={t} type="button" onClick={() => setVariantTemp(on ? '' : t)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 4px', borderRadius: '14px', border: `2px solid ${on ? color : '#e2e8f0'}`, background: on ? bg : '#fff', color: on ? color : '#64748b', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                    <Icon size={24} />{t}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setVariantSusu(v => !v)}
              style={{ width: '100%', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', border: `2px solid ${variantSusu ? '#2563eb' : '#e2e8f0'}`, background: variantSusu ? '#eff6ff' : '#fff', color: variantSusu ? '#1d4ed8' : '#475569', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              <span>Tambah susu <small style={{ fontWeight: 500 }}>(+{money(3000)})</small></span>
              <span style={{ width: 22, height: 22, borderRadius: '6px', border: `2px solid ${variantSusu ? '#2563eb' : '#cbd5e1'}`, background: variantSusu ? '#2563eb' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {variantSusu && <Check size={14} />}
              </span>
            </button>
            <button className="primary full large" style={{ marginTop: '1.25rem' }} onClick={() => addToCartDirect(selectedItemForVariant, variantSusu, variantTemp)}>
              Tambah · {money(selectedItemForVariant.price + (variantSusu ? 3000 : 0))}
            </button>
            <button className="text-btn" style={{ marginTop: '8px' }} onClick={() => setSelectedItemForVariant(null)}>Batal</button>
          </div>
        </div>
      )}

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

      {/* ================= SHEET: PEMBAYARAN ================= */}
      {showPay && (() => {
        const rec = Number(paid || 0);
        const diff = rec - payDue;
        const quick = [20000, 50000, 100000];
        const methods = ['Tunai', 'QRIS', 'Transfer', 'Belum Bayar'].filter(m => !(settling && m === 'Belum Bayar'));
        const submit = settling ? confirmSettle : addingToOrder ? confirmAdditionPayment : finish;
        const newOrder = !settling && !addingToOrder;
        const partialCash = settling && payment === 'Tunai' && rec > 0 && diff < 0;
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
                  {methods.map(m => <button key={m} className={'pay2-method ' + (payment === m ? 'on' : '')} onClick={() => setPayment(m)}>{m}</button>)}
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
                    <div className={'pay2-result ' + (rec > 0 && diff < 0 ? (settling ? 'warn' : 'short') : '')}>
                      <span>{rec > 0 && diff < 0 ? (settling ? 'Sisa setelah bayar' : 'Kurang') : 'Kembalian'}</span>
                      <b>{money(rec > 0 && diff < 0 ? -diff : Math.max(0, diff))}</b>
                    </div>
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
                <button className="pay2-submit" disabled={saving} onClick={submit}>
                  {saving ? 'Menyimpan...' : settling ? (partialCash || (Number(partialAmt) > 0 && Number(partialAmt) < payDue) ? 'Bayar Sebagian' : 'Lunasi Tagihan') : addingToOrder ? 'Simpan Tambahan' : 'Selesaikan Transaksi'}
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