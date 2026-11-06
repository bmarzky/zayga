-- ==========================================
-- 1. TABEL USERS (AKUN KARYAWAN & ADMIN)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Kasir'
);

-- Masukkan akun default awal
INSERT INTO users (username, password, role) VALUES
('admin', 'admin123', 'Admin'),
('bima', 'bima123', 'Kasir'),
('agam', 'agam123', 'Kasir'),
('ariel', 'ariel123', 'Kasir')
ON CONFLICT (username) DO NOTHING;


-- ==========================================
-- 2. TABEL MENU ITEMS (DAFTAR MENU)
-- ==========================================
CREATE TABLE IF NOT EXISTS menu_items (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

-- Masukkan data awal menu (seed data)
INSERT INTO menu_items (id, name, category, price, active) VALUES
(1, 'Mie Soto Medan', 'Mie', 10000, true),
(2, 'Mie Soto Medan + Telur', 'Mie', 13000, true),
(3, 'Mie Sedaap Goreng', 'Mie', 10000, true),
(4, 'Mie Sedaap Goreng + Telur', 'Mie', 13000, true),
(5, 'Kentang Goreng', 'Snack', 15000, true),
(6, 'Risol', 'Snack', 10000, true),
(7, 'Tempe Goreng', 'Snack', 10000, true),
(8, 'Tahu Goreng', 'Snack', 10000, true),
(9, 'Nugget', 'Snack', 10000, true),
(10, 'Sosis Goreng', 'Snack', 10000, true),
(11, 'Popmie Rasa Ayam', 'Popmie', 8000, true),
(12, 'Popmie Rasa Kari', 'Popmie', 8000, true),
(13, 'Popmie Rasa Soto', 'Popmie', 8000, true),
(14, 'Nasi Ayam Geprek', 'Nasi', 15000, true),
(15, 'Nasi Putih + Telur', 'Nasi', 13000, true),
(16, 'Nasi Goreng Telur', 'Nasi', 13000, true),
(17, 'Nasi Goreng Ayam', 'Nasi', 15000, true),
(18, 'Ayam Geprek', 'Nasi', 10000, true),
(19, 'Es Kosong', 'Minuman', 2000, true),
(20, 'Blue Squash', 'Minuman', 12000, true),
(21, 'Orange Squash', 'Minuman', 12000, true),
(22, 'Teh Hijau', 'Minuman', 8000, true),
(23, 'Teh Hijau Susu', 'Minuman', 10000, true),
(24, 'Teh Panas', 'Minuman', 5000, true),
(25, 'Teh Dingin', 'Minuman', 5000, true),
(26, 'Teh Tarek', 'Minuman', 5000, true),
(27, 'Lemon Tea', 'Minuman', 5000, true),
(28, 'Milo', 'Minuman', 5000, true),
(29, 'Sirup Kurnia', 'Minuman', 5000, true),
(30, 'Sirup Orange', 'Minuman', 5000, true),
(31, 'Sirup Melon', 'Minuman', 5000, true),
(32, 'Nutrisari', 'Minuman', 5000, true),
(33, 'Jeruk Peras', 'Minuman', 5000, true),
(34, 'Jeruk Kasturi', 'Minuman', 5000, true),
(35, 'Espresso Panas', 'Kopi', 10000, true),
(36, 'Espresso Dingin', 'Kopi', 13000, true),
(37, 'Sanger Panas', 'Kopi', 12000, true),
(38, 'Sanger Dingin', 'Kopi', 15000, true),
(39, 'Cappucino', 'Kopi', 5000, true),
(40, 'Nescafe', 'Kopi', 5000, true),
(41, 'Nescafe Susu', 'Kopi', 8000, true),
(42, 'Kopi Ulee Kareng', 'Kopi', 5000, true),
(43, 'Luwak White Coffee', 'Kopi', 5000, true),
(44, 'Air Mineral Botol', 'Soft Drink', 5000, true),
(45, 'Air Mineral Gelas', 'Soft Drink', 1000, true),
(46, 'Teh Botol', 'Soft Drink', 5000, true),
(47, 'Teh Pucuk Harum', 'Soft Drink', 5000, true),
(48, 'Fanta', 'Soft Drink', 5000, true),
(49, 'Sprite', 'Soft Drink', 5000, true),
(50, 'Nipis Madu', 'Soft Drink', 5000, true)
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- 3. TABEL ORDERS (TRANSAKSI / PESANAN)
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    customer TEXT,
    location TEXT NOT NULL,
    notes TEXT,
    items JSONB NOT NULL,
    total NUMERIC NOT NULL,
    payment TEXT NOT NULL,
    paid NUMERIC NOT NULL,
    change NUMERIC NOT NULL,
    status TEXT NOT NULL,
    cashier TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 4. TABEL CLEAR LOGS (AUDIT PENGHAPUSAN RIWAYAT)
-- ==========================================
CREATE TABLE IF NOT EXISTS clear_logs (
    id BIGINT PRIMARY KEY,
    who TEXT NOT NULL,
    role TEXT NOT NULL,
    time TEXT NOT NULL,
    count INTEGER NOT NULL
);


-- ==========================================
-- 5. PENGATURAN KEAMANAN (ROW LEVEL SECURITY / RLS)
-- ==========================================
-- Membuka akses publik agar aplikasi POS lokal (React) bisa membaca & menulis data dengan mudah via Supabase Client Anon Key
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE clear_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses publik users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik clear_logs" ON clear_logs FOR ALL USING (true) WITH CHECK (true);