-- ═══════════════════════════════════════════════════════
--  Nova Gear — Supabase Schema
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- ── Products (master data produk)
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique not null,
  name        text not null,
  category    text,
  weight      integer default 0,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ── Orders (semua pesanan penjualan)
create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            text,
  invoice_no          text,
  sku                 text,
  product_name        text,
  variation           text,
  qty                 integer default 1,
  selling_price       numeric(14,2) default 0,
  gross_revenue       numeric(14,2) default 0,
  shopee_commission   numeric(14,2) default 0,
  shopee_service_fee  numeric(14,2) default 0,
  shopee_ads_fee      numeric(14,2) default 0,
  shopee_other_fee    numeric(14,2) default 0,
  net_revenue         numeric(14,2) default 0,
  buyer_shipping      numeric(14,2) default 0,
  expedition          text,
  status              text,   -- Diproses | Selesai | Gagal Kirim | Batal ("Dibayar" deprecated, lihat MIGRASI v10)
  order_date          date,
  payment_date        date,
  source              text default 'shopee',  -- shopee | offline
  notes               text,
  created_at          timestamptz default now()
);

create unique index if not exists orders_order_no_sku_key on orders(order_no, sku) where order_no is not null and sku is not null;
create index if not exists orders_status_idx           on orders(status);
create index if not exists orders_order_date_idx       on orders(order_date);
create index if not exists orders_sku_idx              on orders(sku);

-- ── Scan logs (scanner packing)
create table if not exists scan_logs (
  id            uuid primary key default gen_random_uuid(),
  order_no      text not null,
  expedition    text,
  scan_date     date default current_date,
  scan_time     timestamptz default now(),
  is_cancelled  boolean default false,
  cancel_time   timestamptz,
  cancel_reason text,
  created_at    timestamptz default now()
);

create index if not exists scan_logs_date_idx     on scan_logs(scan_date);
create index if not exists scan_logs_order_no_idx on scan_logs(order_no);

-- ── HPP (Harga Pokok Pembelian / Cost of Goods) — per batch pengiriman
-- 1 batch = 1 pengiriman dari supplier, bisa berisi banyak produk
create table if not exists hpp_batches (
  id             uuid primary key default gen_random_uuid(),
  purchase_date  date not null,
  batch_no       text,
  source         text not null default 'china',   -- 'china' | 'indonesia'
  yuan_rate      numeric(10,2) default 2200,        -- kurs dipakai untuk item/freebie dari China
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists hpp_batches_date_idx on hpp_batches(purchase_date);

-- ── HPP items — tiap produk dalam 1 batch (+ freebie opsional)
create table if not exists hpp_items (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid references hpp_batches(id) on delete cascade,
  sku                 text,
  product_name        text not null,
  qty                 integer not null default 1,
  price_unit          numeric(14,4) default 0,   -- harga per unit, dalam mata uang sumber batch
  shipping_unit       numeric(14,4) default 0,   -- ongkir per unit, selalu dalam Rupiah (IDR)
  freebie_name        text,
  freebie_source      text,                       -- 'china' | 'indonesia', null jika tidak ada freebie
  freebie_price_unit  numeric(14,4) default 0,    -- harga freebie per unit, dalam mata uang sumber freebie
  cost_per_unit       numeric(14,2) default 0,    -- HPP per unit, sudah dikonversi ke IDR
  total_cost          numeric(14,2) default 0,    -- cost_per_unit * qty
  created_at          timestamptz default now()
);

create index if not exists hpp_items_batch_idx on hpp_items(batch_id);

-- ── Ads & Marketing (biaya iklan)
create table if not exists ads (
  id             uuid primary key default gen_random_uuid(),
  platform       text,       -- Shopee Ads | Meta | TikTok | Google | lainnya
  campaign_name  text,
  cost           numeric(14,2) default 0,
  impressions    integer default 0,
  clicks         integer default 0,
  orders_count   integer default 0,
  ad_date        date,
  notes          text,
  created_at     timestamptz default now()
);

-- ── Operational costs (biaya operasional)
create table if not exists operational (
  id          uuid primary key default gen_random_uuid(),
  category    text,       -- Packaging | Gaji | Listrik | Internet | lainnya
  description text,
  cost        numeric(14,2) default 0,
  op_date     date,
  recurring   boolean default false,
  notes       text,
  created_at  timestamptz default now()
);

-- ── Returns (pesanan dibatalkan & gagal kirim)
create table if not exists returns (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null,
  category        text not null,   -- 'Batal' | 'Gagal Kirim'
  cancel_reason   text,
  delivery_status text,
  sku             text,
  product_name    text,
  gross_revenue   numeric(14,2) default 0,
  order_date      date,
  created_at      timestamptz default now(),
  unique (order_no, category)
);

create index if not exists returns_category_idx  on returns(category);
create index if not exists returns_order_no_idx  on returns(order_no);

-- ── Income Summary (ringkasan penghasilan per bulan dari Shopee)
create table if not exists income_summary (
  id                    uuid primary key default gen_random_uuid(),
  bulan                 integer not null check (bulan between 1 and 12),
  tahun                 integer not null,
  total_pendapatan      numeric(14,2) default 0,
  voucher_penjual       numeric(14,2) default 0,
  biaya_komisi_ams      numeric(14,2) default 0,
  biaya_administrasi    numeric(14,2) default 0,
  biaya_layanan         numeric(14,2) default 0,
  biaya_proses_pesanan  numeric(14,2) default 0,
  premi                 numeric(14,2) default 0,
  total_dilepas         numeric(14,2) default 0,
  created_at            timestamptz default now(),
  unique (bulan, tahun)
);

create index if not exists income_summary_period_idx on income_summary(tahun, bulan);

-- ── Income Releases (detail per No. Pesanan dari sheet "Income" Shopee)
create table if not exists income_releases (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null,
  release_date    date,
  gross_amount    numeric(14,2) default 0,
  discount        numeric(14,2) default 0,
  voucher_seller  numeric(14,2) default 0,
  net_amount      numeric(14,2) default 0,
  created_at      timestamptz default now(),
  unique (order_no)
);

create index if not exists income_releases_release_date_idx on income_releases(release_date);
create index if not exists income_releases_order_no_idx     on income_releases(order_no);

-- ── Settings (pengaturan aplikasi)
create table if not exists settings (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  value      text,
  updated_at timestamptz default now()
);

-- ── Default settings
insert into settings (key, value) values
  ('store_name',                'Nova Gear'),
  ('shopee_service_fee_pct',    '6.5'),
  ('shopee_free_shipping_pct',  '5.5'),
  ('shopee_promo_xtra_pct',     '6.5'),
  ('shopee_affiliate_pct',      '5.0'),
  ('modal_awal',                '0'),
  ('yuan_rate',                 '2200'),
  ('freebie_default_price',     '7300'),
  ('default_expedition',        'JNE'),
  ('owner_password',            'owner123'),
  ('admin_password',            'admin123')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════
--  MIGRASI — jalankan jika database sudah ada sebelumnya
--  (skip jika baru setup dari awal)
-- ═══════════════════════════════════════════════════════

-- Tambah tabel baru (jika belum ada)
create table if not exists returns (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null,
  category        text not null,
  cancel_reason   text,
  delivery_status text,
  sku             text,
  product_name    text,
  gross_revenue   numeric(14,2) default 0,
  order_date      date,
  created_at      timestamptz default now(),
  unique (order_no, category)
);

create table if not exists income_summary (
  id                    uuid primary key default gen_random_uuid(),
  bulan                 integer not null check (bulan between 1 and 12),
  tahun                 integer not null,
  total_pendapatan      numeric(14,2) default 0,
  voucher_penjual       numeric(14,2) default 0,
  biaya_komisi_ams      numeric(14,2) default 0,
  biaya_administrasi    numeric(14,2) default 0,
  biaya_layanan         numeric(14,2) default 0,
  biaya_proses_pesanan  numeric(14,2) default 0,
  premi                 numeric(14,2) default 0,
  total_dilepas         numeric(14,2) default 0,
  created_at            timestamptz default now(),
  unique (bulan, tahun)
);

-- Ganti unique index: hapus index order_no tunggal, ganti composite (order_no + sku)
drop index if exists orders_order_no_key;
create unique index if not exists orders_order_no_sku_key on orders(order_no, sku) where order_no is not null and sku is not null;

-- Hapus kolom settings lama yang sudah diganti
delete from settings where key in ('shopee_commission_pct', 'shopee_ads_fee_pct');

-- Tambah settings baru (jika belum ada)
insert into settings (key, value) values
  ('shopee_service_fee_pct',    '6.5'),
  ('shopee_free_shipping_pct',  '5.5'),
  ('shopee_promo_xtra_pct',     '6.5'),
  ('shopee_affiliate_pct',      '5.0'),
  ('modal_awal',                '0')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════
--  MIGRASI v3 — Manajemen Stok
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- 1. Kolom baru di orders
alter table orders add column if not exists cancel_reason text;
alter table orders add column if not exists stok_action   text;
-- stok_action values:
--   'keluar'                  — stok berkurang (Selesai, Perlu Dikirim, Sedang Dikirim, dll)
--   'tidak_berubah'           — batal tanpa dampak stok
--   'sudah_keluar_tidak_balik'— paket hilang, stok tidak kembali
--   'menunggu_barang_kembali' — gagal kirim, tunggu konfirmasi barang balik
--   'barang_kembali'          — sudah dikonfirmasi barang kembali
--   'perlu_review'            — alasan tidak dikenali, perlu Owner tentukan
--   'kompensasi_selesai'      — paket hilang sudah dicatat kompensasi

-- 2. Backfill stok_action untuk data lama yang sudah Selesai
update orders set stok_action = 'keluar'
  where status = 'Selesai' and stok_action is null;

-- 3. Tabel stok awal per SKU (input manual Owner)
create table if not exists stok_awal (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,
  product_name text,
  qty          integer default 0,
  parent_sku   text,             -- opsional: SKU induk jika varian ini berbagi stok fisik dengan SKU lain
  hidden       boolean default false,  -- true = disembunyikan dari Rekap Stok (penjualan/HPP tetap terhitung di Laba Rugi)
  notes        text,
  updated_at   timestamptz default now(),
  created_at   timestamptz default now()
);

create index if not exists stok_awal_parent_sku_idx on stok_awal(parent_sku);

-- 4. Tabel stok_adjust (penyesuaian manual — sudah ada di kode lama, buat jika belum)
create table if not exists stok_adjust (
  id         uuid primary key default gen_random_uuid(),
  sku        text,
  qty        integer,
  notes      text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════
--  MIGRASI v4 — HPP per Batch (Sumber China/Indonesia + Freebie)
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- 1. Buat tabel batch & item baru (jika belum ada — lihat definisi di atas)
create table if not exists hpp_batches (
  id             uuid primary key default gen_random_uuid(),
  purchase_date  date not null,
  batch_no       text,
  source         text not null default 'china',
  yuan_rate      numeric(10,2) default 2200,
  notes          text,
  created_at     timestamptz default now()
);

create table if not exists hpp_items (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid references hpp_batches(id) on delete cascade,
  sku                 text,
  product_name        text not null,
  qty                 integer not null default 1,
  price_unit          numeric(14,4) default 0,
  shipping_unit       numeric(14,4) default 0,
  freebie_name        text,
  freebie_source      text,
  freebie_price_unit  numeric(14,4) default 0,
  cost_per_unit       numeric(14,2) default 0,
  total_cost          numeric(14,2) default 0,
  created_at          timestamptz default now()
);

create index if not exists hpp_batches_date_idx on hpp_batches(purchase_date);
create index if not exists hpp_items_batch_idx  on hpp_items(batch_id);

-- 2. Migrasi data lama dari tabel "hpp" (1 baris lama = 1 batch + 1 item)
--    Aman dijalankan berkali-kali: skip baris yang sudah pernah dimigrasi via notes marker.
insert into hpp_batches (id, purchase_date, batch_no, source, yuan_rate, notes, created_at)
select h.id, h.purchase_date, h.batch_no, 'china', h.yuan_rate, h.notes, h.created_at
from hpp h
where not exists (select 1 from hpp_batches b where b.id = h.id)
  and exists (select 1 from information_schema.tables where table_name = 'hpp');

insert into hpp_items (batch_id, sku, product_name, qty, price_unit, shipping_unit, cost_per_unit, total_cost, created_at)
select h.id, h.sku, h.product_name, h.qty, h.price_yuan, h.shipping_per_unit, h.cost_per_unit, h.total_cost, h.created_at
from hpp h
where not exists (select 1 from hpp_items it where it.batch_id = h.id)
  and exists (select 1 from information_schema.tables where table_name = 'hpp');

-- 3. Setelah memastikan data sudah pindah dengan benar, tabel "hpp" lama bisa dihapus:
-- drop table if exists hpp;

-- ═══════════════════════════════════════════════════════
--  MIGRASI v5 — Parent SKU (gabung stok varian dengan stok fisik sama)
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- Tambah kolom parent_sku di stok_awal (jika belum ada)
alter table stok_awal add column if not exists parent_sku text;

create index if not exists stok_awal_parent_sku_idx on stok_awal(parent_sku);

-- Contoh pemakaian: BM-M5-B-F dan BM-M5-B-TF adalah varian berbeda dari produk
-- yang sama secara fisik. Set parent_sku keduanya ke 'BM-M5-B' supaya stok
-- (stok awal, masuk HPP, keluar pesanan, penyesuaian) dihitung gabung di halaman Stok:
-- update stok_awal set parent_sku = 'BM-M5-B' where sku in ('BM-M5-B-F', 'BM-M5-B-TF');

-- ═══════════════════════════════════════════════════════
--  MIGRASI v6 — Harga Freebie Default (SKU berakhiran "-F")
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- Tambah setting harga freebie default (dipakai di HPP, Laba Rugi, Analisis Margin)
insert into settings (key, value) values
  ('freebie_default_price', '7300')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════
--  MIGRASI v7 — Sembunyikan Produk di Rekap Stok
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- Tambah kolom hidden di stok_awal (jika belum ada)
alter table stok_awal add column if not exists hidden boolean default false;

-- Catatan: SKU yang tidak punya baris di stok_awal sama sekali (hanya
-- tercatat dari hpp_items/orders) otomatis dianggap tersembunyi di
-- halaman Stok — ini logika sisi aplikasi, tidak perlu migrasi data.
-- Data penjualan & HPP produk yang disembunyikan tetap terhitung normal
-- di Laba Rugi dan Analisis Margin (filter hidden hanya berlaku di Rekap Stok).

-- ═══════════════════════════════════════════════════════
--  MIGRASI v8 — Income Releases (detail per No. Pesanan, sheet "Income")
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

create table if not exists income_releases (
  id              uuid primary key default gen_random_uuid(),
  order_no        text not null,
  release_date    date,
  gross_amount    numeric(14,2) default 0,
  discount        numeric(14,2) default 0,
  voucher_seller  numeric(14,2) default 0,
  net_amount      numeric(14,2) default 0,
  created_at      timestamptz default now(),
  unique (order_no)
);

create index if not exists income_releases_release_date_idx on income_releases(release_date);
create index if not exists income_releases_order_no_idx     on income_releases(order_no);

-- Catatan (revisi — lihat MIGRASI v10 di bawah): sebelumnya Import Income
-- otomatis mengubah status pesanan jadi "Dibayar". Perilaku ini SALAH dan
-- sudah dihapus — Import Income kini hanya menandai income_matched_at,
-- status fulfillment pesanan tidak pernah diubah oleh Import Income.

-- ═══════════════════════════════════════════════════════
--  MIGRASI v9 — Import Iklan Shopee (Iklanku, per produk per bulan)
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

create table if not exists ads_expenses (
  id            uuid primary key default gen_random_uuid(),
  month         integer not null,
  year          integer not null,
  product_name  text not null,
  biaya         numeric(14,2) default 0,
  konversi      integer default 0,
  omzet_iklan   numeric(14,2) default 0,
  acos          numeric(6,2) default 0,
  created_at    timestamptz default now(),
  unique (month, year, product_name)
);

create index if not exists ads_expenses_month_year_idx on ads_expenses(month, year);

-- ═══════════════════════════════════════════════════════
--  MIGRASI — Filter Operasional per Role
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- Tandai siapa yang input biaya operasional ('owner' | 'admin'), supaya
-- Admin hanya bisa lihat data yang diinput Admin sendiri, Owner lihat semua.
alter table operational add column if not exists created_by text;

-- Data lama (sebelum kolom ini ada) dianggap diinput Owner.
update operational set created_by = 'owner' where created_by is null;

-- ═══════════════════════════════════════════════════════
--  MIGRASI v10 — Fix: Import Income tidak boleh ubah status pesanan
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- Bug lama: importIncomeFile() di js/penjualan.js mengubah status pesanan
-- "Selesai" → "Dibayar" untuk order_no yang cocok dengan sheet Income.
-- Ini salah — Import Income seharusnya HANYA mencatat data keuangan, tidak
-- boleh menimpa status fulfillment. Kode sudah diperbaiki: Import Income
-- sekarang menandai kolom income_matched_at, TIDAK menyentuh status.

-- 1. Kolom baru untuk menandai pesanan yang sudah cocok dengan Income
--    (menggantikan overwrite status "Dibayar" yang lama).
alter table orders add column if not exists income_matched_at timestamptz;

-- 2. Perbaiki data yang sudah kadung ter-overwrite jadi status "Dibayar".
--    AMAN karena status "Dibayar" HANYA PERNAH diset oleh importIncomeFile(),
--    dan importIncomeFile() HANYA meng-update baris yang saat itu berstatus
--    "Selesai" (lihat query lama: .eq('status','Selesai') sebelum update).
--    Jadi setiap baris yang sekarang "Dibayar" pasti aslinya "Selesai".
--    Cek dulu jumlahnya (harusnya ~138):
--      select count(*) from orders where status = 'Dibayar';
update orders
set status = 'Selesai'
where status = 'Dibayar';

-- 3. (Opsional) Tandai income_matched_at untuk pesanan yang order_no-nya
--    memang sudah ada di income_releases, supaya kolom baru langsung
--    terisi untuk data historis yang match (bukan cuma dari Import Income
--    berikutnya).
update orders o
set income_matched_at = now()
from income_releases r
where o.order_no = r.order_no
  and o.income_matched_at is null;

-- Alternatif termudah kalau ragu dengan hasil update di atas: re-import
-- ulang file Order_all bulan bersangkutan via Import Mingguan (Penjualan) —
-- ini akan menulis ulang status pesanan langsung dari data Shopee terbaru,
-- tanpa bergantung pada asumsi "Dibayar selalu berasal dari Selesai".

-- ═══════════════════════════════════════════════════════
--  MIGRASI v11 — Kas Pribadi (Prive & Setoran) dan Hutang & Cicilan
--  Jalankan di Supabase SQL Editor setelah update ini
-- ═══════════════════════════════════════════════════════

-- ── Kas Pribadi: penarikan pribadi (Prive) & modal masuk (Setoran) ──
create table if not exists kas_pribadi (
  id          uuid primary key default gen_random_uuid(),
  tanggal     date not null,
  tipe        text not null check (tipe in ('prive', 'setoran')),
  jumlah      numeric(14,2) default 0,
  keterangan  text,
  created_at  timestamptz default now()
);

create index if not exists kas_pribadi_tanggal_idx on kas_pribadi(tanggal);
create index if not exists kas_pribadi_tipe_idx    on kas_pribadi(tipe);

-- ── Hutang: daftar pinjaman/cicilan ──
create table if not exists hutang (
  id              uuid primary key default gen_random_uuid(),
  nama_hutang     text not null,
  jumlah_total    numeric(14,2) default 0,
  jumlah_cicilan  integer default 1,
  created_at      timestamptz default now()
);

-- ── Pembayaran cicilan hutang. Setiap pembayaran bisa displit sumber dananya
--    antara Kas Bisnis dan Setoran Pribadi (jumlah = sumber_kas_bisnis + sumber_setoran_pribadi).
--    Lihat js/dashboard.js: hanya sumber_kas_bisnis yang mengurangi Sisa Kas — porsi
--    sumber_setoran_pribadi tidak dikurangi karena uangnya memang tidak pernah keluar
--    dari Kas Bisnis (dibayar langsung dari kantong pribadi Owner).
create table if not exists hutang_pembayaran (
  id                      uuid primary key default gen_random_uuid(),
  hutang_id               uuid references hutang(id) on delete cascade,
  tanggal                 date not null,
  jumlah                  numeric(14,2) default 0,
  sumber_kas_bisnis       numeric(14,2) default 0,
  sumber_setoran_pribadi  numeric(14,2) default 0,
  keterangan              text,
  created_at              timestamptz default now()
);

create index if not exists hutang_pembayaran_hutang_id_idx on hutang_pembayaran(hutang_id);
create index if not exists hutang_pembayaran_tanggal_idx   on hutang_pembayaran(tanggal);

-- ═══════════════════════════════════════════════════════
--  Row Level Security (RLS) — aktifkan setelah setup
--  Untuk production, gunakan Supabase Auth + RLS policies.
--  Untuk sementara (anon key): disable RLS di table settings.
-- ═══════════════════════════════════════════════════════

-- Aktifkan RLS (opsional — nonaktifkan jika pakai anon key saja)
-- alter table orders      enable row level security;
-- alter table scan_logs   enable row level security;
-- alter table hpp_batches enable row level security;
-- alter table hpp_items   enable row level security;
-- alter table ads         enable row level security;
-- alter table ads_expenses enable row level security;
-- alter table operational enable row level security;
-- alter table settings    enable row level security;
-- alter table kas_pribadi enable row level security;
-- alter table hutang      enable row level security;
-- alter table hutang_pembayaran enable row level security;

-- Policy allow all untuk anon (development — ganti untuk production)
-- create policy "allow_all" on orders      for all using (true) with check (true);
-- create policy "allow_all" on scan_logs   for all using (true) with check (true);
-- create policy "allow_all" on hpp_batches for all using (true) with check (true);
-- create policy "allow_all" on hpp_items   for all using (true) with check (true);
-- create policy "allow_all" on ads         for all using (true) with check (true);
-- create policy "allow_all" on ads_expenses for all using (true) with check (true);
-- create policy "allow_all" on operational for all using (true) with check (true);
-- create policy "allow_all" on settings    for all using (true) with check (true);
-- create policy "allow_all" on kas_pribadi for all using (true) with check (true);
-- create policy "allow_all" on hutang      for all using (true) with check (true);
-- create policy "allow_all" on hutang_pembayaran for all using (true) with check (true);
