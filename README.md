# Zayga POS

Zayga POS adalah aplikasi kasir (Point of Sale) berbasis web untuk kedai makanan dan minuman. Aplikasi ini mencakup pencatatan pesanan, denah meja, pembayaran, antrian dapur, pencetakan struk, dan laporan penjualan dalam satu sistem.

Antarmuka dibuat dengan React, sedangkan penyimpanan data dan sinkronisasi real-time memakai Supabase. Aplikasi dapat dipakai dari laptop maupun ponsel, dan dapat dipasang sebagai PWA.

## Daftar Isi

- [Fitur](#fitur)
- [Peran Pengguna](#peran-pengguna)
- [Alur Kerja](#alur-kerja)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Instalasi](#instalasi)
- [Konfigurasi Database](#konfigurasi-database)
- [Konfigurasi Perangkat](#konfigurasi-perangkat)
- [Struktur Proyek](#struktur-proyek)
- [Catatan Keamanan](#catatan-keamanan)
- [Lisensi](#lisensi)

## Fitur

### Pesanan

- Katalog menu dengan kategori, pencarian, dan tab Favorit (menu yang paling sering dipesan).
- Pilihan suhu minuman (Panas, Hangat, Dingin) dan tambahan susu dengan biaya tambahan, dalam satu popup yang sederhana: pilih suhu, pilih susu, atur jumlah, lalu tambah.
- Catatan per item untuk dapur, dengan saran catatan yang menyesuaikan jenis menu.
- Menu Bakso dengan harga custom.
- Beberapa draf pesanan sekaligus, sehingga kasir dapat melayani beberapa meja bergantian.
- Diskon dalam rupiah atau persen.
- Stok harian per menu dan penanda menu habis (tahan lama pada menu untuk mengaturnya).
- Menambah item ke pesanan yang sudah berjalan.
- Pesanan tetap tersimpan saat internet terputus dan dikirim otomatis ketika koneksi kembali.

### Meja

- Denah meja 01 sampai 40, ditambah lokasi khusus: Bawa pulang, Meja belakang, dan Payung (1, 2, 37, 38, 39, 40).
- Status meja: kosong, terisi, belum lunas, dan minta bill.
- Memindahkan pesanan ke meja lain.
- Menggabungkan beberapa bon dalam satu meja.
- Memisahkan sebagian item menjadi bon baru.
- Pesan ulang dari bon sebelumnya.

### Pembayaran

- Metode: Tunai, QRIS, Transfer, dan Belum Bayar (bon).
- Pembulatan tunai (Rp500 atau Rp1.000), pilihan uang pas, dan hitung kembalian.
- Split bill per menu: menentukan menu milik tiap orang, nominal dihitung otomatis termasuk pembagian diskon.
- Split bill nominal manual dan bagi rata.
- Pelunasan bon, termasuk pembayaran sebagian.
- Catatan pembayaran per transaksi (siapa, metode, nominal).

### Antrian

- Nomor antrian harian yang sama di tiket dapur, riwayat, dan detail bon.
- Tampilan dapur: pesanan dikelompokkan per status (Baru, Dimasak, Siap), filter pos makanan atau minuman, timer keterlambatan, dan ringkasan menu yang perlu dimasak.
- Tampilan kasir (penyajian): daftar menu yang siap diantar, tombol antar per menu atau sekaligus, dan status pembayaran pada tiap kartu.
- Admin dapat berpindah antara tampilan dapur dan kasir.
- Alarm audio di perangkat yang ditandai sebagai pusat audio, serta notifikasi saat pesanan baru masuk atau menu siap diantar.

### Pencetakan

- Cetak langsung ke printer thermal 58 mm lewat Web Bluetooth (Chrome di Android).
- Print Relay: perangkat tanpa printer dapat mencetak lewat perangkat lain yang tersambung printer. Pengirim baru dianggap berhasil setelah menerima konfirmasi dari perangkat pencetak.
- Pusat Cetak Kasir: tiket dapur tercetak otomatis saat pesanan masuk.
- Cadangan melalui layanan Cleanter (alamat server dapat diatur).
- Tiket dapur, struk pelanggan, tiket menu tambahan, dan laporan tutup kasir memiliki format terpisah.
- Penyambungan ulang otomatis ke printer dan layar dijaga tetap menyala selama printer terhubung.

### Dashboard dan Laporan (Admin)

- Omzet, jumlah transaksi, porsi terjual, dan tagihan belum lunas, dibandingkan dengan periode sebelumnya.
- Rincian penjualan per jam (hari ini) atau per hari (7 dan 30 hari).
- Menu terlaris, penjualan per kategori, jam ramai, metode pembayaran, rekap kasir, status dapur, dan stok menipis.
- Tutup kasir per shift: modal awal, hitung uang di laci, selisih, riwayat penutupan, dan cetak laporan.

### Pengelolaan

- Kelola menu: tambah, ubah, aktifkan atau nonaktifkan, dan hapus.
- Kelola akun karyawan dan peran.
- Hapus transaksi dengan soft delete (data diarsipkan, tidak dihapus permanen).
- Log penghapusan riwayat dan catatan audit untuk perubahan penting (pindah meja, gabung, pisah, ubah status, hapus).
- Status perangkat real-time: perangkat mana yang tersambung ke printer dan pusat audio, serta nama perangkat yang dapat diubah.

## Peran Pengguna

| Peran | Akses |
|---|---|
| Admin | Seluruh fitur: dashboard, pesanan, denah, antrian, riwayat, tutup kasir, kelola menu, akun, dan pengaturan. |
| Kasir | Pesanan, denah, antrian (tampilan penyajian), riwayat, tutup kasir, dan pengaturan. Tidak dapat membuka dashboard dan kelola menu. |
| Dapur | Antrian (tampilan dapur) dan pengaturan. Dapat mengubah status Baru, Dimasak, dan Siap. |

Penandaan menu sebagai Diantar hanya dapat dilakukan oleh Kasir dan Admin.

## Alur Kerja

```text
Kasir membuat pesanan
        |
        v
Supabase menyimpan pesanan
        |
        +--> Tiket dapur tercetak otomatis di Pusat Cetak
        |
        v
Dapur menerima pesanan (alarm dan antrian real-time)
        |
        v
Dapur mengubah status: Baru -> Dimasak -> Siap
        |
        v
Kasir menerima notifikasi "Siap diantar"
        |
        v
Kasir menandai Diantar dan menyelesaikan pembayaran
```

## Teknologi

| Teknologi | Kegunaan |
|---|---|
| React | Antarmuka aplikasi |
| Vite | Build tool dan server pengembangan |
| Supabase (PostgreSQL, Realtime) | Database, sinkronisasi real-time, dan relay cetak |
| lucide-react | Ikon antarmuka |
| Web Bluetooth dan ESC/POS | Pencetakan langsung ke printer thermal |
| CSS | Tata letak dan tampilan responsif |

## Persyaratan

- Node.js versi LTS dan npm
- Proyek Supabase
- Browser modern. Untuk cetak Bluetooth gunakan Google Chrome di Android atau desktop (Web Bluetooth tidak tersedia di iOS dan Firefox)
- Akses HTTPS atau `localhost`, karena Web Bluetooth hanya berjalan pada koneksi aman

## Instalasi

### 1. Clone repository

```bash
git clone https://github.com/bmarzky/zayga.git
cd zayga
```

### 2. Pasang dependensi

```bash
npm install
```

### 3. Atur environment

Buat berkas `.env` di direktori utama:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Gunakan anon key saja. Jangan pernah memasukkan service role key ke aplikasi frontend atau repository.

### 4. Jalankan mode pengembangan

```bash
npm run dev
```

Agar dapat diakses dari perangkat lain di jaringan yang sama:

```bash
npm run dev -- --host 0.0.0.0
```

Buka alamat IP komputer beserta port yang tampil di terminal. Perlu diingat bahwa Web Bluetooth tidak berjalan pada alamat IP tanpa HTTPS, sehingga untuk mencetak gunakan versi yang sudah di-deploy dengan HTTPS.

### 5. Build produksi

```bash
npm run build
```

Hasil build berada di direktori `dist`.

## Konfigurasi Database

Aplikasi membutuhkan objek berikut di proyek Supabase.

**Tabel**

| Tabel | Isi |
|---|---|
| `users` | Akun dan peran pengguna |
| `menu_items` | Menu, harga, kategori, stok, dan status habis |
| `orders` | Pesanan, item, pembayaran, status, dan penanda soft delete (`deleted_at`, `deleted_by`) |
| `clear_logs` | Catatan penghapusan riwayat |
| `order_audit` | Catatan audit perubahan pesanan |
| `shift_closings` | Data tutup kasir |
| `app_settings` | Pengaturan aplikasi, misalnya alamat server cetak (`print_url`) |

**Fungsi database (RPC)**

| Fungsi | Kegunaan |
|---|---|
| `consume_stock` | Mengurangi stok secara atomik saat pesanan dibuat |
| `merge_orders` | Menggabungkan dua bon dalam satu transaksi |
| `split_order` | Memisahkan bon dalam satu transaksi |

**Realtime**

Aktifkan Realtime untuk tabel `orders`, `menu_items`, dan `users`.

Sesuaikan juga kebijakan Row Level Security (RLS) dengan kebutuhan operasional.

## Konfigurasi Perangkat

### Perangkat kasir

1. Login dengan akun Kasir.
2. Di Pengaturan, sambungkan printer Bluetooth. Perangkat yang tersambung ke printer otomatis menjadi server cetak untuk perangkat lain.
3. Aktifkan Pusat Cetak Kasir pada perangkat yang dipakai mencetak tiket dapur otomatis.
4. Gunakan Cetak Tes untuk memastikan printer siap.

### Perangkat dapur

1. Login dengan akun Dapur.
2. Di Pengaturan, aktifkan alarm pesanan dapur (diperlukan satu kali ketukan agar browser mengizinkan audio).
3. Letakkan berkas `public/kitchen-alarm.mp3` untuk suara alarm.
4. Gunakan tampilan layar penuh untuk monitor dapur.

### Pencetakan lewat Cleanter (opsional)

Jika tidak memakai Web Bluetooth, atur alamat layanan Cleanter di Pengaturan, bagian Pengaturan Lanjutan. Admin dapat menyimpan satu alamat server pusat untuk semua kasir, sedangkan alamat khusus perangkat dapat diatur terpisah.

## Struktur Proyek

```text
zayga/
├── public/
│   ├── icon.svg
│   └── kitchen-alarm.mp3
├── src/
│   ├── main.jsx        Aplikasi utama
│   ├── supabase.js     Klien Supabase
│   └── app.css         Gaya tampilan
├── .env
├── index.html
├── package.json
└── vite.config.js
```

Struktur ini adalah gambaran umum. Sesuaikan jika ada berkas atau direktori tambahan.

## Catatan Keamanan

- Jangan membagikan kredensial database atau kunci rahasia ke publik.
- Ganti akun dan password bawaan sebelum aplikasi dipakai operasional.
- Pastikan kebijakan RLS di Supabase sudah dibatasi sesuai kebutuhan.
- Pastikan semua perangkat memakai proyek Supabase yang sama.

## Lisensi

Proyek ini menggunakan lisensi MIT. Lihat berkas [LICENSE](LICENSE) untuk ketentuan lengkap.