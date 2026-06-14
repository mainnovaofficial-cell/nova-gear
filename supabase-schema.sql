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
  status              text,   -- Selesai | Dibatalkan | Dikembalikan | Gagal
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

-- ── HPP (Harga Pokok Pembelian / Cost of Goods)
create table if not exists hpp (
  id                uuid primary key default gen_random_uuid(),
  sku               text,
  product_name      text,
  qty               integer,
  price_yuan        numeric(14,4) default 0,
  yuan_rate         numeric(10,2) default 2200,
  price_idr         numeric(14,2) default 0,
  shipping_china    numeric(14,2) default 0,
  shipping_per_unit numeric(14,2) default 0,
  other_cost        numeric(14,2) default 0,
  total_cost        numeric(14,2) default 0,
  cost_per_unit     numeric(14,2) default 0,
  purchase_date     date,
  batch_no          text,
  notes             text,
  created_at        timestamptz default now()
);

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
--  Row Level Security (RLS) — aktifkan setelah setup
--  Untuk production, gunakan Supabase Auth + RLS policies.
--  Untuk sementara (anon key): disable RLS di table settings.
-- ═══════════════════════════════════════════════════════

-- Aktifkan RLS (opsional — nonaktifkan jika pakai anon key saja)
-- alter table orders     enable row level security;
-- alter table scan_logs  enable row level security;
-- alter table hpp        enable row level security;
-- alter table ads        enable row level security;
-- alter table operational enable row level security;
-- alter table settings   enable row level security;

-- Policy allow all untuk anon (development — ganti untuk production)
-- create policy "allow_all" on orders      for all using (true) with check (true);
-- create policy "allow_all" on scan_logs   for all using (true) with check (true);
-- create policy "allow_all" on hpp         for all using (true) with check (true);
-- create policy "allow_all" on ads         for all using (true) with check (true);
-- create policy "allow_all" on operational for all using (true) with check (true);
-- create policy "allow_all" on settings    for all using (true) with check (true);
