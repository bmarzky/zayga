# Zayga POS

Sistem kasir (Point of Sale) dan antrian dapur (Kitchen Display System) berbasis web untuk kedai makanan dan minuman, terhubung secara real-time menggunakan Supabase.

---

## Ringkasan Fitur

| Modul | Deskripsi |
|---|---|
| **Kasir (POS)** | Katalog menu, varian minuman, racikan bakso custom, multi-draft meja, diskon, dan pembulatan tunai. |
| **KDS Dapur** | Monitor antrian real-time, timer keterlambatan pesanan, notifikasi audio bel, dan filter pos masak. |
| **Sinkronisasi** | Koneksi ganda (WebSocket Realtime + background polling) dengan notifikasi dua arah kasir-dapur. |
| **Denah Meja** | Visualisasi meja 01–37, status meja (kosong/terisi/bon), pindah meja, dan pisah tagihan. |
| **Dashboard** | Analitik omzet, rincian penjualan berkala, menu terlaris, jam sibuk, dan metode pembayaran. |
| **Manajemen Kas** | Rekonsiliasi kas laci kasir (tutup shift) dan pencatatan selisih modal awal. |
| **Cetak Struk** | Cetak thermal 58mm dan 80mm untuk tiket dapur dan struk pelanggan via Bluetooth / USB. |

---

## Alur Kerja Operasional

```text
[ HP Kasir ]                     [ Laptop Dapur (KDS) ]
  Pesan Menu & Meja                 Layar Antrian Real-time
         │                                     ▲
         ▼ (Simpan Order)                      │ (Bel Dapur Berbunyi)
  [ Database Supabase ] ───────────────────────┘
         │
         │ (Tandai Masak / Siap)
         ▼
  [ Notifikasi Kasir ]
  (Audio, Getar & Pop-up Meja Siap Antar)
```

---

## Pengaturan Peran (Role)

* **Admin**: Akses penuh ke seluruh menu, laporan dashboard, kelola menu, dan pengaturan sistem.
* **Kasir**: Dikhususkan untuk staf penerima pesanan, denah meja, dan monitoring pesanan siap diantar.
* **Dapur**: Layar otomatis terkunci pada mode KDS untuk pemrosesan antrian dan status masak item.

---

## Instalasi & Menjalankan

### Prasyarat
* Node.js LTS (versi 18 ke atas)
* Akun Supabase

### Langkah Instalasi

1. **Kloning repositori:**
   ```bash
   git clone https://github.com/bmarzky/zayga.git
   cd zayga
   ```

2. **Instal dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment:**
   Buat file `.env` di root direktori:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Jalankan server pengembangan:**
   ```bash
   npm run dev
   ```

5. **Build produksi:**
   ```bash
   npm run build
   ```

---

## Konfigurasi KDS Dapur di Laptop

Untuk mengoperasikan laptop sebagai layar dapur:
1. Login dengan akun bertipe **Dapur**.
2. Klik tombol **Tes Bel** untuk memastikan izin audio browser aktif.
3. Klik tombol **Layar Penuh** (atau tekan `F11`) untuk beralih ke mode monitor penuh.
4. Gunakan mouse eksternal untuk interaksi koki agar perangkat tetap terlindungi.

---

## Lisensi

Proyek ini dilisensikan di bawah lisensi [MIT](LICENSE).
