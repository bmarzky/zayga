# 🍜 Zayga POS & KDS (Point of Sale & Kitchen Display System)

Aplikasi Point of Sale (POS) modern berbasis web yang dirancang khusus untuk operasional usaha kuliner dan kedai makanan/minuman (F&B). Dilengkapi dengan sistem antrian dapur digital (**Kitchen Display System / KDS**), pemetaan denah meja interaktif, manajemen shift kasir, integrasi printer thermal Bluetooth/USB, serta dashboard analitik bisnis yang terhubung secara **Real-time** melalui Supabase Cloud.

---

## 🌟 Fitur Utama

### 1. 🛒 POS Kasir (Pemesanan & Transaksi)
* **Katalog Menu Cepat**: Pengelompokan kategori (Bakso, Mie, Snack, Nasi, Minuman, Kopi, Favorit) dan pencarian instan.
* **Varian & Custom Menu**: Dukungan pilihan temperatur (Panas/Hangat/Dingin), opsi susu, dan racikan bakso kustom.
* **Multi-Draft Pesanan**: Kasir dapat membuka dan menahan beberapa pesanan meja sekaligus secara bergantian.
* **Fleksibilitas Pembayaran**: Tunai, QRIS, Transfer, dan pencatatan Bon (*Belum Lunas*).
* **Kalkulasi & Pembulatan Otomatis**: Perhitungan kembalian otomatis dengan opsi pembulatan tunai (Rp500 / Rp1.000).
* **Diskon Fleksibel**: Diskon dalam nominal rupiah maupun persentase.

### 2. 🍳 KDS Dapur Profesional (Kitchen Display System)
* **Monitor Dapur Layar Lebar**: Dirancang ramah digunakan pada laptop dapur, tablet, maupun smartphone koki.
* **Timer Keterlambatan Pesanan (*Live Elapsed Timer*)**:
  * 🟢 **Aman (< 10 menit)**: Waktu persiapan normal.
  * 🟡 **Peringatan (10–20 menit)**: Waktu persiapan mulai lama.
  * 🔴 **Kritis / Berkedip (> 20 menit)**: Pesanan terlambat, prioritas utama koki.
* **Bel Dapur Otomatis (*Kitchen Chime*)**: Membunyikan bel nada ganda yang khas saat pesanan baru masuk dari kasir.
* **Rangkuman Batch Memasak**: Menampilkan total bahan yang harus dimasak sekaligus di bar atas (*contoh: "Perlu Dimasak: 6× Bakso Urat · 3× Mie Ayam"*).
* **Kontrol Status Cepat**: Tombol satu-klik per item (*Masak* $\rightarrow$ *Siap ✓*) dan tombol aksi massal (*Mulai Masak Semua*, *Tandai Siap Semua*).
* **Filter Pos Kerja**: Memisahkan antrian khusus pos 🍜 **Makanan** atau 🥤 **Minuman**.
* **Mode Layar Penuh (*Kiosk Mode*)**: Satu tombol untuk memaksimalkan layar monitor dapur tanpa bilah browser.

### 3. ⚡ Sinkronisasi Real-Time Ganda (Anti-Gagal)
* **Supabase Realtime WebSocket**: Pesanan yang disubmit dari HP kasir langsung muncul seketika di monitor dapur laptop.
* **Auto-Polling Cadangan**: Pengecekan latar belakang berkala memastikan data tetap sinkron 100% meskipun koneksi WiFi sempat tersendat.
* **Peringatan Balik ke Kasir**: Saat dapur menandai pesanan/item siap, kasir di HP menerima alarm audio, getaran HP (*vibration pattern*), dan banner pop-up meja siap antar.

### 4. 🪑 Denah Meja Interaktif
* Visualisasi petak meja 01 hingga 37 dan area tambahan (*Bawa Pulang, Meja Belakang*).
* Indikator warna status meja: **Kosong** (hijau), **Terisi** (kuning), dan **Belum Lunas** (merah).
* Fitur **Pindah Meja** dan **Pisah Tagihan (*Split Order*)**.

### 5. 📊 Dashboard Analitik Bisnis
* **Ringkasan KPI**: Total Omzet, Jumlah Transaksi, Rata-rata per Nota, Porsi Terjual, dan Piutang Bon Belum Lunas.
* **Rincian Performa Harian / Berkala**: Daftar harian yang bersih dengan progress bar proporsional, persentase kontribusi, dan penanda hari puncak penjualan.
* **Menu Terlaris & Trending**: Peringkat menu paling diminati pelanggan.
* **Jam Sibuk**: Grafik transaksi per jam untuk mengoptimalkan jadwal staf.
* **Metode Pembayaran**: Diagram donat distribusi uang masuk (Tunai, QRIS, Transfer).
* **Rekap Performa Kasir**: Penjualan dan rata-rata per akun kasir.

### 6. 🔒 Tutup Kasir & Manajemen Shift
* Rekonsiliasi modal awal laci kasir dan uang tunai masuk.
* Perhitungan otomatis selisih kas fisik vs pencatatan sistem (*Uang Pas, Lebih, atau Kurang*).
* Cetak struk rekapitulasi penutupan shift ke printer thermal.

### 7. 🖨️ Cetak Struk Thermal (58 mm / 80 mm)
* **Tiket Dapur**: Hanya memuat nomor meja, waktu, nama kasir/pelanggan, daftar item, dan catatan dapur (tanpa harga/pembayaran).
* **Struk Pelanggan**: Rincian lengkap harga, diskon, total, metode bayar, uang diterima, dan kembalian.
* **Dukungan Printer**: Printer thermal USB/PC dan printer Bluetooth Classic SPP via bridge Cleanter di Android.

---

## 🛠️ Teknologi yang Digunakan

* **Frontend Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
* **Database & Realtime Backend**: [Supabase](https://supabase.com/) (PostgreSQL & Realtime Channels)
* **Icon Library**: [Lucide React](https://lucide.dev/)
* **Styling**: Vanilla CSS dengan Design Token CSS Variables (Responsif Desktop, Tablet, dan Mobile)
* **Audio Engine**: Web Audio API (Synthesizer Oscillator Bel Dapur & Kasir)

---

## 🚀 Panduan Memulai

### 1. Prasyarat
* [Node.js](https://nodejs.org/) (versi LTS yang direkomendasikan)
* Akun [Supabase](https://supabase.com/) dengan tabel database yang telah dikonfigurasi.

### 2. Kloning Repositori
```bash
git clone https://github.com/bmarzky/zayga.git
cd zayga
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment Variable
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi kredensial Supabase Anda di dalam `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 5. Jalankan Aplikasi
Mode pengembangan:
```bash
npm run dev
```
Buka browser di alamat yang tertera (biasanya `http://localhost:5173`).

Mode produksi (build):
```bash
npm run build
npm run preview
```

---

## 👥 Hak Akses & Akun Demo

Aplikasi memiliki 3 tingkatan hak akses (*Role*):
1. **Admin**: Memiliki akses penuh ke seluruh fitur (POS Kasir, Denah Meja, KDS Dapur, Riwayat Transaksi, Tutup Kasir, Kelola Menu, dan Pengaturan).
2. **Kasir**: Dikhususkan untuk staf pemesanan (POS Kasir, Denah Meja, Pemantauan Antrian Siap Diantar, dan Riwayat Transaksi).
3. **Dapur**: Dikhususkan untuk monitor dapur KDS (layar otomatis terkunci di halaman Antrian Dapur untuk memproses status masak pesanan).

---

## 📱 Rekomendasi Penggunaan Perangkat di Kedai

* **Kasir**: Menggunakan smartphone Android/iOS masing-masing staf kasir untuk menginput pesanan langsung di meja tamu atau di meja kasir.
* **Dapur**: Menggunakan laptop atau tablet yang diletakkan di area penyajian/dapur:
  * Login dengan akun role **Dapur**.
  * Klik tombol **🔔 Tes Bel Dapur** untuk menguji suara bel.
  * Klik tombol **⛶ Layar Penuh** (*Fullscreen*) untuk tampilan monitor KDS tanpa bilah browser.
  * Sambungkan mouse eksternal untuk pengoperasian yang aman dari tangan basah/berminyak.

---

## 📄 Lisensi
Hak Cipta © 2026 Zayga POS. Dilindungi di bawah lisensi [MIT](LICENSE).
