// Patch Zayga POS: tab kategori sticky + geser kiri/kanan antar kategori (HP).
// Pemakaian:  node apply-swipe-tabs.mjs src/App.jsx src/app.css
import fs from 'node:fs';

const [jsxPath, cssPath] = process.argv.slice(2);
if (!jsxPath || !cssPath) {
  console.error('Pemakaian: node apply-swipe-tabs.mjs <file-jsx-utama> <file-css>');
  process.exit(1);
}

let src = fs.readFileSync(jsxPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

if (src.includes('SWIPE_TABS_PATCH') || css.includes('SWIPE_TABS_PATCH')) {
  console.log('File ini sudah pernah dipatch. Tidak ada yang diubah.');
  process.exit(0);
}

const once = (label, from, to) => {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.error('GAGAL pada "' + label + '": teks ditemukan ' + n + 'x (harus tepat 1x). Tidak ada file yang diubah.');
    process.exit(1);
  }
  src = src.replace(from, () => to);
};

/* 1) State, ref, dan handler (disisipkan setelah daftar menuTabs) */
const HOOKS = `
  // SWIPE_TABS_PATCH: tab kategori sticky + geser kiri/kanan antar kategori
  const [slideDir, setSlideDir] = useState('');
  const wrapRef = useRef(null);
  const topRef = useRef(null);
  const catsRef = useRef(null);
  const listRef = useRef(null);
  const swipe = useRef({ x: 0, y: 0, t: 0, active: false });

  const selectCategory = (c, dir) => {
    if (c === category) return;
    const a = menuTabs.indexOf(category), b = menuTabs.indexOf(c);
    setSlideDir(dir || (b > a ? 'left' : 'right'));
    setCategory(c);
    // jaga posisi: kalau sudah scroll melewati header, tetap rapat di bawah tab
    const wrap = wrapRef.current, head = topRef.current;
    if (wrap && head && wrap.scrollTop > head.offsetHeight) wrap.scrollTop = head.offsetHeight;
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const goCategory = (delta) => {
    const i = Math.max(0, menuTabs.indexOf(category));
    const n = i + delta;
    if (n < 0 || n >= menuTabs.length) return;
    buzz(10);
    selectCategory(menuTabs[n], delta > 0 ? 'left' : 'right');
  };

  const onSwipeStart = (e) => {
    if (e.touches.length !== 1) { swipe.current.active = false; return; }
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: Date.now(), active: true };
  };
  const onSwipeMove = (e) => {
    const s = swipe.current;
    if (!s.active || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - s.x), dy = Math.abs(t.clientY - s.y);
    if (dx > 12 && dx > dy) pressEnd(); // batalkan tahan-lama (stok) saat user menggeser
  };
  const onSwipeEnd = (e) => {
    const s = swipe.current;
    if (!s.active) return;
    s.active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Date.now() - s.t > 700) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    goCategory(dx < 0 ? 1 : -1); // geser kiri = kategori berikutnya
  };

  // tab yang aktif otomatis digeser ke tengah baris tab
  useEffect(() => {
    const c = catsRef.current;
    if (!c) return;
    const el = c.querySelector('button.on');
    if (!el) return;
    const cr = c.getBoundingClientRect(), er = el.getBoundingClientRect();
    c.scrollBy({ left: er.left - cr.left - (cr.width - er.width) / 2, behavior: 'smooth' });
  }, [category, page]);
`;
once('menuTabs',
  "const menuTabs = [...(favNames.length ? ['Favorit'] : []), ...categories, 'Bakso'];",
  "const menuTabs = [...(favNames.length ? ['Favorit'] : []), ...categories, 'Bakso'];\n" + HOOKS);

/* 2) JSX */
once('po-wrap',
  `<div className="po-wrap" style={{ '--po-top': stickyTop + 'px' }}>`,
  `<div className="po-wrap" ref={wrapRef} style={{ '--po-top': stickyTop + 'px' }}>`);

once('po-top',
  '<div className="po-top">',
  '<div className="po-top" ref={topRef}>');

// po-top ditutup tepat sebelum tab; penutup lama kini menutup po-cats-bar (jumlah tag tetap seimbang)
once('po-cats',
  '<div className="po-cats">',
  '</div>\n<div className="po-cats-bar">\n<div className="po-cats" ref={catsRef}>');

once('klik kategori',
  'onClick={() => setCategory(c)}',
  'onClick={() => selectCategory(c)}');

once('po-list',
  '<div className="po-list">',
  `<div key={category} ref={listRef} className={'po-list' + (slideDir ? ' slide-' + slideDir : '')} onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd} onTouchCancel={() => { swipe.current.active = false; }}>`);

/* 3) CSS */
const CSS = `

/* ============================================================
   SWIPE_TABS_PATCH — tab kategori sticky + geser antar kategori
   ============================================================ */
.po-top{position:static;top:auto;z-index:auto;border-bottom:0;flex:none}
.po-cats-bar{
  position:sticky;top:0;z-index:30;flex:none;
  padding:8px 12px;background:var(--sf);
  border-bottom:1px solid var(--line);
  box-shadow:0 2px 8px rgba(15,23,42,.05);
}
.po-cats{scroll-behavior:smooth}
.po-list{touch-action:pan-y;overscroll-behavior-x:contain}
.po-list.slide-left{animation:poSlideLeft .22s ease-out}
.po-list.slide-right{animation:poSlideRight .22s ease-out}
@keyframes poSlideLeft{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes poSlideRight{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
@media (max-width:899px){
  /* area geser tetap luas walau menu di kategori itu sedikit */
  .po-list{min-height:60dvh}
}
@media (min-width:900px){
  /* di tablet/desktop daftar menu punya scroll sendiri, tab tidak perlu sticky */
  .po-cats-bar{position:static;box-shadow:none}
}
`;
css = css.replace(/\s*$/, '\n') + CSS;

fs.writeFileSync(jsxPath, src);
fs.writeFileSync(cssPath, css);
console.log('Selesai. 5 perubahan di ' + jsxPath + ' dan blok CSS ditambahkan di ' + cssPath + '.');
