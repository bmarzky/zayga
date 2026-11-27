// Zayga POS: rapikan menu kategori Nasi + harga baru.
// Pemakaian:  node update-menu-nasi.mjs src/main.jsx
import fs from 'node:fs';

const [jsxPath] = process.argv.slice(2);
if (!jsxPath) {
  console.error('Pemakaian: node update-menu-nasi.mjs <file-jsx-utama>');
  process.exit(1);
}

let src = fs.readFileSync(jsxPath, 'utf8');

if (src.includes('NASI_MENU_UPDATE')) {
  console.log('Sudah pernah diubah. Tidak ada yang berubah.');
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

// 1) Nasi Putih (10.000) -> Nasi (5.000)
once('Nasi Putih',
  "{ id: 15, name: 'Nasi Putih', category: 'Nasi', price: 10000, active: true },",
  "{ id: 15, name: 'Nasi', category: 'Nasi', price: 5000, active: true }, // NASI_MENU_UPDATE");

// 2) Tambah Lontong dan Nasi Telur
once('Ayam Geprek',
  "{ id: 18, name: 'Ayam Geprek', category: 'Nasi', price: 10000, active: true },",
  "{ id: 18, name: 'Ayam Geprek', category: 'Nasi', price: 10000, active: true },\n" +
  "  { id: 51, name: 'Lontong', category: 'Nasi', price: 13000, active: true },\n" +
  "  { id: 52, name: 'Nasi Telur', category: 'Nasi', price: 13000, active: true },");

// 3) Menu Nasi langsung masuk keranjang (tanpa popup tambahan Telur +3.000)
once('addon telur',
  "{ id: 'telur', label: 'Telur', price: 3000, categories: ['Mie', 'Popmie', 'Nasi'] }",
  "{ id: 'telur', label: 'Telur', price: 3000, categories: ['Mie', 'Popmie'] }");

fs.writeFileSync(jsxPath, src);
console.log('Selesai. 3 perubahan di ' + jsxPath + '.');
