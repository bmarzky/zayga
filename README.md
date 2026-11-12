# Zayga POS

Zayga POS adalah sistem kasir (*Point of Sale*) berbasis web yang dirancang untuk membantu operasional kedai makanan dan minuman. Sistem ini menyediakan pengelolaan menu, transaksi, meja, pembayaran, serta pemantauan pesanan dapur secara terintegrasi.

Zayga POS menggunakan React sebagai antarmuka aplikasi dan Supabase sebagai layanan backend untuk penyimpanan data serta sinkronisasi secara real-time. Sistem dapat diakses melalui perangkat laptop maupun ponsel selama terhubung ke jaringan yang sama atau memiliki akses internet.

## Fitur Utama

### 1. Kasir dan Pengelolaan Pesanan

- Menampilkan katalog menu makanan dan minuman.
- Mengelompokkan menu berdasarkan kategori.
- Menambahkan, mengubah, dan menghapus item dari pesanan.
- Mendukung pilihan varian minuman, seperti panas, hangat, dan dingin.
- Mendukung tambahan pilihan atau biaya berdasarkan varian menu.
- Mendukung pembuatan pesanan bakso dengan komposisi dan harga khusus.
- Menambahkan item ke pesanan yang sudah berjalan.
- Mengelola beberapa pesanan berdasarkan meja.
- Menyimpan pesanan yang belum diselesaikan pembayarannya.
- Menyelesaikan transaksi dan memperbarui status pembayaran.

### 2. Pengelolaan Meja

- Menyediakan denah meja interaktif dengan nomor meja 01–37.
- Menampilkan status meja berdasarkan kondisi pesanan.
- Mempermudah kasir memilih meja melalui tampilan denah.
- Mendukung pencatatan lokasi khusus, seperti dekat jendela, depan kasir, atau teras.
- Mendukung pencatatan nama pelanggan sebagai informasi tambahan.
- Memindahkan pesanan dari satu meja ke meja lainnya.
- Menggabungkan pesanan dari beberapa meja.
- Mendukung pengelolaan dan pemisahan tagihan sesuai kebutuhan operasional.

### 3. Kitchen Display System (KDS)

- Menampilkan pesanan yang masuk ke dapur.
- Memperbarui daftar pesanan secara real-time.
- Menampilkan rincian item dan jumlah pesanan.
- Membantu staf dapur memantau proses pengerjaan pesanan.
- Memperbarui status pesanan berdasarkan tahapan pengerjaan.
- Menyediakan informasi waktu pesanan untuk membantu pemantauan antrean.
- Mendukung notifikasi audio untuk pemberitahuan pesanan baru pada perangkat yang diaktifkan.

### 4. Sinkronisasi dan Notifikasi

- Menggunakan Supabase Realtime untuk menerima perubahan data.
- Menyediakan mekanisme polling sebagai pendukung sinkronisasi.
- Menyinkronkan informasi pesanan antara perangkat kasir dan dapur.
- Memberikan pembaruan status pesanan tanpa perlu memuat ulang halaman secara manual.
- Mendukung notifikasi ketika pesanan mengalami perubahan status.
- Menyediakan notifikasi visual dan audio sesuai konfigurasi perangkat.

### 5. Pembayaran

- Mendukung pembayaran tunai dan non-tunai.
- Mendukung pencatatan pesanan yang belum dibayar.
- Menampilkan jumlah pembayaran dan sisa tagihan.
- Mendukung pembayaran untuk pesanan yang telah dibuat sebelumnya.
- Menyediakan perhitungan total transaksi.
- Mendukung pencatatan nominal pembayaran tunai dan uang kembalian.

### 6. Pencetakan Struk

- Mendukung pencetakan menggunakan printer thermal.
- Mendukung printer yang terhubung melalui Bluetooth atau USB sesuai dukungan perangkat dan layanan penghubung.
- Memisahkan format cetak tiket dapur dan struk pelanggan.
- Menyediakan informasi pesanan pada tiket dapur.
- Menyediakan rincian transaksi pada struk pelanggan.
- Mendukung pengaturan alamat layanan pencetakan melalui konfigurasi aplikasi.

### 7. Dashboard dan Laporan

- Menampilkan ringkasan aktivitas penjualan.
- Menyediakan informasi omzet dan transaksi.
- Menampilkan rincian penjualan berdasarkan periode.
- Menyediakan informasi menu yang paling banyak dipesan.
- Menampilkan informasi waktu operasional dengan aktivitas pesanan tertinggi.
- Menyediakan ringkasan metode pembayaran.

### 8. Manajemen Pengguna

- Mendukung penggunaan aplikasi oleh beberapa pengguna.
- Menyediakan pengelolaan akun pengguna.
- Memisahkan akses berdasarkan peran pengguna.
- Menyediakan pengaturan menu dan operasional sesuai hak akses.

## Alur Kerja Sistem

Secara umum, proses operasional Zayga POS berjalan melalui alur berikut:

```text
+-----------------------+
|     Perangkat Kasir   |
|   Laptop / Ponsel     |
+-----------+-----------+
            |
            | Membuat Pesanan
            v
+-----------------------+
|    Database Supabase  |
|                       |
|  Penyimpanan Pesanan  |
|  Sinkronisasi Data    |
+-----------+-----------+
            |
            | Supabase Realtime
            v
+-----------------------+
|   Perangkat Dapur     |
| Kitchen Display System|
+-----------+-----------+
            |
            | Proses Pesanan
            v
+-----------------------+
|   Pembaruan Status    |
|                       |
|  Diproses / Siap      |
+-----------+-----------+
            |
            | Sinkronisasi
            v
+-----------------------+
|    Perangkat Kasir    |
|                       |
| Notifikasi Status     |
| Penyelesaian Transaksi|
+-----------------------+
```

## Pengaturan Peran Pengguna

Zayga POS menyediakan pengelolaan akses berdasarkan peran pengguna agar setiap bagian operasional dapat menggunakan fitur sesuai kebutuhannya.

| Peran | Hak Akses |
|---|---|
| Admin | Mengelola pengguna, menu, pengaturan aplikasi, transaksi, serta melihat dashboard dan laporan. |
| Kasir | Mengelola pesanan, memilih meja, memproses pembayaran, melihat riwayat transaksi, dan menggunakan fitur pencetakan. |
| Dapur | Mengakses tampilan KDS untuk memantau pesanan dan memperbarui status pengerjaan sesuai konfigurasi akses aplikasi. |

## Teknologi yang Digunakan

| Teknologi | Kegunaan |
|---|---|
| React | Pengembangan antarmuka aplikasi. |
| Vite | Build tool dan server pengembangan. |
| JavaScript | Bahasa pemrograman utama aplikasi. |
| Supabase | Backend, database, autentikasi, dan sinkronisasi real-time. |
| PostgreSQL | Penyimpanan data melalui Supabase. |
| CSS | Pengaturan tampilan dan responsivitas antarmuka. |
| Browser API | Mendukung fitur audio dan interaksi perangkat. |

## Persyaratan Sistem

Sebelum menjalankan aplikasi, pastikan perangkat pengembangan telah memiliki:

- Node.js versi LTS yang kompatibel dengan Vite.
- npm.
- Akun dan proyek Supabase.
- Browser modern seperti Google Chrome atau Microsoft Edge.
- Koneksi internet atau jaringan lokal untuk komunikasi antarp perangkat.

## Instalasi dan Menjalankan Aplikasi

### 1. Clone Repository

```bash
git clone https://github.com/bmarzky/zayga.git
cd zayga
```

### 2. Instal Dependensi

```bash
npm install
```

### 3. Konfigurasi Environment

Buat file `.env` pada direktori utama proyek, kemudian masukkan konfigurasi Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Ganti nilai konfigurasi tersebut dengan URL proyek dan anon key dari dashboard Supabase.

Jangan memasukkan Supabase service role key ke dalam aplikasi frontend atau repository publik.

### 4. Jalankan Server Pengembangan

```bash
npm run dev
```

Secara default, Vite akan menjalankan aplikasi pada alamat lokal yang ditampilkan di terminal.

Untuk mengakses aplikasi dari perangkat lain dalam jaringan lokal, jalankan:

```bash
npm run dev -- --host 0.0.0.0
```

Kemudian akses alamat IP lokal komputer server melalui browser perangkat lain menggunakan port yang ditampilkan oleh Vite.

### 5. Build Aplikasi

Untuk membuat versi produksi:

```bash
npm run build
```

Hasil build akan disimpan dalam direktori `dist`.

Untuk menjalankan pemeriksaan build, gunakan perintah tersebut dan pastikan proses selesai tanpa error.

## Konfigurasi Perangkat Operasional

### Perangkat Kasir

1. Buka aplikasi melalui browser.
2. Login menggunakan akun kasir.
3. Pilih meja atau lokasi pelanggan.
4. Tambahkan menu sesuai pesanan.
5. Simpan pesanan untuk diteruskan ke dapur.
6. Proses pembayaran sesuai metode yang digunakan.
7. Cetak tiket dapur dan struk pelanggan jika diperlukan.

### Perangkat Dapur

1. Buka aplikasi melalui perangkat yang digunakan sebagai monitor dapur.
2. Login menggunakan akun dengan akses dapur apabila tersedia.
3. Buka tampilan Kitchen Display System.
4. Aktifkan izin audio browser apabila fitur notifikasi suara digunakan.
5. Pantau pesanan yang masuk dan perbarui status pengerjaannya.
6. Gunakan tampilan layar penuh untuk mempermudah pemantauan.

### Konfigurasi Printer

1. Hubungkan printer thermal ke perangkat yang menjalankan layanan pencetakan.
2. Pastikan perangkat printer dapat dikenali oleh layanan penghubung.
3. Atur alamat layanan pencetakan melalui pengaturan aplikasi.
4. Lakukan pengujian pencetakan tiket dapur dan struk pelanggan secara terpisah.

## Struktur Proyek

Struktur direktori utama aplikasi secara umum:

```text
zayga/
├── public/
│   └── kitchen-alarm.mp3
├── src/
│   ├── main.jsx
│   └── style.css
├── .env
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

Struktur tersebut menggambarkan berkas utama aplikasi. Direktori atau berkas tambahan dapat tersedia sesuai perkembangan proyek.

## Catatan Penggunaan

- Pastikan seluruh perangkat memiliki koneksi ke proyek Supabase yang sama.
- Gunakan akun sesuai peran dan hak akses masing-masing.
- Pastikan browser telah memberikan izin audio apabila notifikasi suara digunakan.
- Untuk pencetakan dari perangkat berbeda, pastikan alamat layanan pencetakan dapat dijangkau melalui jaringan.
- Jangan membagikan kredensial database atau kunci rahasia ke publik.
- Pastikan konfigurasi database dan kebijakan Row Level Security (RLS) telah disesuaikan dengan kebutuhan aplikasi.

## Lisensi

Proyek ini menggunakan lisensi MIT. Informasi lengkap mengenai ketentuan penggunaan dapat dilihat pada berkas [LICENSE](LICENSE).