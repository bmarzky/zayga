# Zayga POS — Prototype 1.0

Aplikasi POS web untuk Zayga. Versi ini sudah bisa dijalankan secara lokal di browser dan mencakup katalog 49 menu dari foto (terdapat 50 item), keranjang, pelanggan opsional, lokasi meja wajib dan bebas, catatan, pembayaran tunai/QRIS/transfer, kembalian, riwayat, laporan sederhana, pengelolaan menu admin, serta cetak struk thermal 58/80 mm.

## Menjalankan

1. Install Node.js LTS.
2. Ekstrak folder proyek.
3. Buka terminal di folder `zayga-pos`.
4. Jalankan:

```bash
npm install
npm run dev
```

5. Buka alamat lokal yang muncul (umumnya http://localhost:5173).

## Akun demo

- Admin: `admin` / `admin123`
- Kasir: `kasir` / `kasir123`

**Penting:** akun di atas hanya simulasi prototipe. Data disimpan di localStorage browser sehingga belum tersinkron antarperangkat. Jangan gunakan sebagai autentikasi produksi.

## Cetak struk

Buka Pengaturan, pilih 58mm atau 80mm. Hubungkan printer thermal USB/Bluetooth ke komputer, lalu pilih printer tersebut dari dialog cetak browser. Hasil cetak bergantung pada driver, browser, dan printer; lakukan test print sebelum operasional.

## Tahap wajib sebelum dipakai bersama di beberapa perangkat

Integrasikan Supabase Auth + PostgreSQL + Row Level Security. Setiap kasir/admin harus memiliki akun individual; role harus ditentukan dari tabel profil yang aman, bukan dari pilihan di browser. File `.env.example` berisi nama variabel yang dibutuhkan. Jangan pernah memasukkan service-role key ke frontend.

Lihat dokumentasi resmi: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs dan https://supabase.com/docs/guides/auth/quickstarts/react

## Dua jenis cetak struk
- **Tiket dapur:** nomor pesanan, waktu, kasir, nama pelanggan (jika ada), lokasi meja, item dan jumlah, serta catatan dapur. Tidak menampilkan harga atau informasi pembayaran.
- **Struk pelanggan:** rincian item dan harga, total, metode pembayaran, nominal diterima, dan kembalian.
- Keduanya dapat dicetak terpisah dari tabel Riwayat transaksi. Ukuran kertas mengikuti pengaturan 58 mm atau 80 mm.

\n## Pemilihan lokasi meja (v1.2)
- Kasir dapat memilih petak nomor meja 01 sampai 37.
- Nomor meja yang dipilih akan disimpan sebagai lokasi pesanan dan tercetak pada tiket dapur serta struk pelanggan.
- Lokasi tetap dapat diketik manual, misalnya "dekat jendela", "teras", atau "sebelah kasir".
- Kolom lokasi wajib diisi; nama pelanggan tetap opsional.


## Integrasi printer Bluetooth Android (58 mm)

Versi ini menggunakan **Cleanter: Thermal Printer BT** sebagai jembatan Bluetooth Classic (SPP) ESC/POS dari Chrome Android ke printer thermal. POS dan Cleanter harus berjalan pada HP Android yang sama.

### Persiapan Android

1. Instal Cleanter dari Google Play: https://play.google.com/store/apps/details?id=id.cleancode.cleanter
2. Pasangkan printer melalui Pengaturan Android → Bluetooth. Pastikan printer mendukung Bluetooth Classic (SPP) dan ESC/POS; Bluetooth BLE saja tidak didukung oleh Cleanter.
3. Buka Cleanter, pilih printer yang sudah dipasangkan, lalu tekan Start. Pastikan status printer terhubung.
4. Buka Zayga POS di Chrome pada perangkat Android yang sama.
5. Masuk ke menu **Pengaturan** Zayga POS, tekan **Periksa koneksi**, lalu **Cetak tes**.

### Perilaku cetak

- Setelah transaksi berhasil disimpan, POS mengirim **tiket dapur** terlebih dahulu secara otomatis. Tiket ini tidak memuat harga atau pembayaran.
- Setelah itu POS mengirim **struk pelanggan** dengan rincian harga, total, metode pembayaran, uang diterima, dan kembalian.
- Jika salah satu cetak gagal, transaksi tetap tersimpan. Buka **Riwayat** dan tekan tombol **Dapur** atau **Pelanggan** untuk mencetak ulang.
- Pengiriman dilakukan melalui `http://localhost:9100/health` dan `POST http://localhost:9100/print` dengan `paperWidth: 58`.

Dokumentasi bridge: https://cleanter.cleancode.id/docs/ dan https://cleanter.cleancode.id/docs/api-reference

> Catatan: printer harus kompatibel ESC/POS Bluetooth Classic SPP. Nama generik “Bluetooth thermal mobile printer” belum cukup untuk memastikan kompatibilitas semua model. Lakukan tes cetak sebelum dipakai operasional.

## Status aplikasi

Ini masih prototipe lokal berbasis `localStorage`; akun demo dan data transaksi belum memakai autentikasi/database cloud multi-perangkat. Integrasi printer tidak mengubah keterbatasan tersebut.
