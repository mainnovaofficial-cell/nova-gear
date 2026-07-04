/* ═══════════════════════════════════════════════════════════
   Nova Gear — Core Application (app.js)
   Handles: Supabase init, auth, routing, modal, toast, utils
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────
   SUPABASE SQL SCHEMA (run once in Supabase SQL Editor)
─────────────────────────────────────
Paste this in your Supabase SQL Editor to create all tables:

-- Products (master data)
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique not null,
  name        text not null,
  category    text,
  weight      integer default 0,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- Orders (all sales)
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
  status              text,
  order_date          date,
  payment_date        date,
  source              text default 'shopee',
  notes               text,
  created_at          timestamptz default now()
);

-- Scanner packing logs
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

-- HPP (cost of goods purchased)
create table if not exists hpp (
  id               uuid primary key default gen_random_uuid(),
  sku              text,
  product_name     text,
  qty              integer,
  price_yuan       numeric(14,4) default 0,
  yuan_rate        numeric(10,2) default 2200,
  price_idr        numeric(14,2) default 0,
  shipping_china   numeric(14,2) default 0,
  shipping_per_unit numeric(14,2) default 0,
  other_cost       numeric(14,2) default 0,
  total_cost       numeric(14,2) default 0,
  cost_per_unit    numeric(14,2) default 0,
  purchase_date    date,
  batch_no         text,
  notes            text,
  created_at       timestamptz default now()
);

-- Ads & Marketing
create table if not exists ads (
  id             uuid primary key default gen_random_uuid(),
  platform       text,
  campaign_name  text,
  cost           numeric(14,2) default 0,
  impressions    integer default 0,
  clicks         integer default 0,
  orders_count   integer default 0,
  ad_date        date,
  notes          text,
  created_at     timestamptz default now()
);

-- Operational costs
create table if not exists operational (
  id          uuid primary key default gen_random_uuid(),
  category    text,
  description text,
  cost        numeric(14,2) default 0,
  op_date     date,
  recurring   boolean default false,
  notes       text,
  created_at  timestamptz default now()
);

-- App settings (key-value)
create table if not exists settings (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  value      text,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('store_name',              'Nova Gear'),
  ('shopee_commission_pct',   '2'),
  ('shopee_service_fee_pct',  '2'),
  ('shopee_ads_fee_pct',      '0'),
  ('yuan_rate',               '2200'),
  ('default_expedition',      'JNE'),
  ('owner_password',          'owner123'),
  ('admin_password',          'admin123')
on conflict (key) do nothing;
─────────────────────────────────────── */

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const AppState = {
  supabase:      null,
  currentPage:   'dashboard',
  user:          null,  // { role: 'owner'|'admin' }
  settings:      {},
  sidebarOpen:   true,
};

/* ══════════════════════════════════════
   MAIN APP OBJECT
══════════════════════════════════════ */
const App = {

  /* ── Initialise ── */
  async init() {
    this._updateClock();
    setInterval(() => this._updateClock(), 30000);

    const cfg = this._loadConfig();
    if (!cfg) {
      this._showSetup();
      return;
    }

    try {
      AppState.supabase = supabase.createClient(cfg.url, cfg.key);
    } catch (e) {
      this._showSetup('Kredensial tidak valid. Coba lagi.');
      return;
    }

    this._showLogin();
  },

  /* ── Supabase config (localStorage) ── */
  _loadConfig() {
    const url = localStorage.getItem('ng_url');
    const key = localStorage.getItem('ng_key');
    return url && key ? { url, key } : null;
  },

  _showSetup(err = '') {
    document.getElementById('setup-modal').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    if (err) {
      const el = document.getElementById('setup-error');
      el.textContent = err;
      el.classList.remove('hidden');
    }
  },

  saveSetup() {
    const url   = document.getElementById('setup-url').value.trim();
    const key   = document.getElementById('setup-key').value.trim();
    const store = document.getElementById('setup-store').value.trim() || 'Nova Gear';
    const errEl = document.getElementById('setup-error');

    if (!url || !key) {
      errEl.textContent = 'URL dan Key harus diisi.';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      new URL(url);
    } catch {
      errEl.textContent = 'URL tidak valid.';
      errEl.classList.remove('hidden');
      return;
    }

    localStorage.setItem('ng_url',   url);
    localStorage.setItem('ng_key',   key);
    localStorage.setItem('ng_store', store);

    document.getElementById('setup-modal').classList.add('hidden');

    AppState.supabase = supabase.createClient(url, key);
    this._showLogin();
  },

  /* ── Login ── */
  _showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  async handleLogin(e) {
    e.preventDefault();
    const role     = document.getElementById('login-role').value;
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.classList.add('hidden');

    try {
      const settings = await this._fetchSettings();
      const correctPwd = role === 'owner'
        ? (settings.owner_password || 'owner123')
        : (settings.admin_password || 'admin123');

      if (password !== correctPwd) {
        errEl.textContent = 'Password salah.';
        errEl.classList.remove('hidden');
        return;
      }

      AppState.user     = { role };
      AppState.settings = settings;
      this._enterApp();

    } catch (err) {
      errEl.textContent = 'Gagal menghubungi database. Periksa koneksi.';
      errEl.classList.remove('hidden');
    }
  },

  handleLogout() {
    AppState.user     = null;
    AppState.settings = {};
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    this._showLogin();
  },

  /* ── App shell ── */
  _enterApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    const store = localStorage.getItem('ng_store') || AppState.settings.store_name || 'Nova Gear';
    document.getElementById('sidebar-store-name').textContent = store;
    document.getElementById('topbar-store').textContent       = store;

    const role = AppState.user.role;
    document.getElementById('user-role-display').textContent = role === 'owner' ? 'Owner' : 'Admin';
    document.getElementById('user-avatar').textContent       = role === 'owner' ? 'O' : 'A';
    document.getElementById('role-badge').textContent        = role === 'owner' ? 'Owner' : 'Admin';
    document.getElementById('role-badge').className =
      role === 'owner'
        ? 'px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-xs font-medium'
        : 'px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-medium';

    // Admin hanya lihat menu Dashboard, Penjualan, Scanner Packing, Stok di sidebar.
    document.querySelectorAll('.nav-item').forEach(el => {
      const allowed = role === 'owner' || this.ADMIN_ALLOWED_PAGES.includes(el.dataset.page);
      el.classList.toggle('hidden', !allowed);
    });
    // Section header (mis. "Keuangan") adalah sibling SEBELUM nav-item-nya, bukan wrapper —
    // sembunyikan juga kalau semua nav-item di bawahnya (sampai header section berikutnya) tersembunyi.
    document.querySelectorAll('.nav-section').forEach(header => {
      let hasVisibleItem = false;
      let sib = header.nextElementSibling;
      while (sib && !sib.classList.contains('nav-section')) {
        if (sib.classList.contains('nav-item') && !sib.classList.contains('hidden')) hasVisibleItem = true;
        sib = sib.nextElementSibling;
      }
      header.classList.toggle('hidden', !hasVisibleItem);
    });

    this.navigate('dashboard');
  },

  /* ── Routing ── */
  navigate(page) {
    // Admin hanya boleh akses halaman tertentu — cegah akses langsung (mis. lewat sidebar
    // yang tersembunyi tapi sempat ter-klik, atau panggilan navigate() manual).
    if (this.isAdmin() && !this.ADMIN_ALLOWED_PAGES.includes(page)) {
      this.toast('Halaman ini hanya untuk Owner.', 'warning');
      page = 'dashboard';
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));

    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.remove('hidden');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Update topbar title
    const titles = {
      dashboard:   'Dashboard',
      penjualan:   'Penjualan',
      scanner:     'Scanner Packing',
      stok:        'Stok',
      hpp:         'HPP (Harga Pokok Pembelian)',
      iklan:       'Iklan & Marketing',
      operasional: 'Operasional',
      kaspribadi:  'Kas Pribadi',
      hutang:      'Hutang & Cicilan',
      analisis:    'Analisis Produk',
      labarugi:    'Laba Rugi',
      pengaturan:  'Pengaturan',
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    AppState.currentPage = page;

    // Call the page module's onLoad if available
    const moduleMap = {
      dashboard:   typeof Dashboard   !== 'undefined' ? Dashboard   : null,
      penjualan:   typeof Penjualan   !== 'undefined' ? Penjualan   : null,
      scanner:     typeof Scanner     !== 'undefined' ? Scanner     : null,
      stok:        typeof Stok        !== 'undefined' ? Stok        : null,
      hpp:         typeof HPP         !== 'undefined' ? HPP         : null,
      iklan:       typeof Iklan       !== 'undefined' ? Iklan       : null,
      operasional: typeof Operasional !== 'undefined' ? Operasional : null,
      kaspribadi:  typeof KasPribadi  !== 'undefined' ? KasPribadi  : null,
      hutang:      typeof Hutang      !== 'undefined' ? Hutang      : null,
      analisis:    typeof Analisis    !== 'undefined' ? Analisis    : null,
      labarugi:    typeof LabaRugi    !== 'undefined' ? LabaRugi    : null,
      pengaturan:  typeof Pengaturan  !== 'undefined' ? Pengaturan  : null,
    };

    const mod = moduleMap[page];
    if (mod && typeof mod.onLoad === 'function') {
      mod.onLoad();
    } else {
      // Module not loaded yet — show placeholder
      this._showComingSoon(page, target);
    }
  },

  _showComingSoon(page, el) {
    if (!el || el.innerHTML.trim() !== '') return; // already has content
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-gray-700 font-semibold mb-1">Modul Belum Dimuat</h3>
        <p class="text-gray-400 text-sm">Modul <strong>${page}</strong> akan segera ditambahkan.</p>
      </div>`;
  },

  /* ── Sidebar toggle ── */
  toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    AppState.sidebarOpen = !sb.classList.contains('collapsed');
  },

  /* ── Modal ── */
  openModal({ title = '', body = '', footer = '', size = 'max-w-lg' } = {}) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = body;

    const box = document.getElementById('modal-box');
    box.className = `bg-white rounded-2xl shadow-xl w-full ${size} pointer-events-auto max-h-[90vh] flex flex-col`;

    const footerEl = document.getElementById('modal-footer');
    if (footer) {
      footerEl.innerHTML = footer;
      footerEl.classList.remove('hidden');
    } else {
      footerEl.innerHTML = '';
      footerEl.classList.add('hidden');
    }

    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('modal-container').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-container').classList.add('hidden');
    document.getElementById('modal-body').innerHTML    = '';
    document.getElementById('modal-footer').innerHTML  = '';
  },

  /* ── Toast ── */
  toast(message, type = 'info', duration = 3500) {
    const icons = {
      success: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`,
      error:   `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v4m0 4h.01M12 4L2 20h20L12 4z"/></svg>`,
      info:    `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 200);
    }, duration);
  },

  /* ── DB helpers ── */
  db() {
    return AppState.supabase;
  },

  async _fetchSettings() {
    const { data, error } = await AppState.supabase
      .from('settings')
      .select('key, value');
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    return map;
  },

  async getSettings() {
    if (Object.keys(AppState.settings).length === 0) {
      AppState.settings = await this._fetchSettings();
    }
    return AppState.settings;
  },

  async reloadSettings() {
    AppState.settings = await this._fetchSettings();
    return AppState.settings;
  },

  /* ── Freebie (SKU berakhiran "-F") ── */
  isFreebieSku(sku) {
    return !!(sku && sku.trim().toUpperCase().endsWith('-F'));
  },

  getFreebieDefaultPrice(settings) {
    return +(settings || AppState.settings || {}).freebie_default_price || 7300;
  },

  // SKU di orders sering punya suffix varian (mis. "BM-M5-B-F", "BM-M5-B-TF") yang
  // berbagi HPP fisik sama dengan SKU induknya di hpp_items (mis. "BM-M5-B"). Coba
  // exact match dulu, kalau tidak ketemu strip 1 segmen suffix terakhir lalu coba lagi.
  resolveHppUnit(hppMap, sku) {
    if (!sku || !hppMap) return 0;
    if (sku in hppMap) return +hppMap[sku] || 0;
    const base = sku.replace(/-[^-]+$/, '');
    if (base && base !== sku && base in hppMap) return +hppMap[base] || 0;
    return 0;
  },

  /* ── Utilities ── */
  formatRupiah(value, withPrefix = true) {
    const num = Number(value) || 0;
    const formatted = Math.abs(num).toLocaleString('id-ID', { maximumFractionDigits: 0 });
    const prefix = withPrefix ? (num < 0 ? '-Rp ' : 'Rp ') : '';
    return `${prefix}${formatted}`;
  },

  formatNumber(value) {
    return (Number(value) || 0).toLocaleString('id-ID');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(dtStr) {
    if (!dtStr) return '-';
    const d = new Date(dtStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  monthStart() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  },

  isOwner() {
    return AppState.user?.role === 'owner';
  },

  requireOwner() {
    if (!this.isOwner()) {
      this.toast('Fitur ini hanya untuk Owner.', 'warning');
      return false;
    }
    return true;
  },

  isAdmin() {
    return AppState.user?.role === 'admin';
  },

  // Halaman yang boleh diakses role Admin — selain ini otomatis dialihkan ke Dashboard.
  ADMIN_ALLOWED_PAGES: ['dashboard', 'penjualan', 'scanner', 'stok', 'operasional'],

  _updateClock() {
    const el = document.getElementById('current-datetime');
    if (el) {
      el.textContent = new Date().toLocaleString('id-ID', {
        weekday: 'short', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
  },

  /* ── Simple confirm dialog ── */
  confirm(message) {
    return new Promise(resolve => {
      App.openModal({
        title: 'Konfirmasi',
        body: `<p class="text-gray-600 text-sm">${message}</p>`,
        footer: `
          <button onclick="App.closeModal(); window._confirmResolve(false);" class="btn-secondary">Batal</button>
          <button onclick="App.closeModal(); window._confirmResolve(true);"  class="btn-danger">Ya, Lanjutkan</button>
        `,
      });
      window._confirmResolve = resolve;
    });
  },

  /* ── Export table to CSV ── */
  exportCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
      this.toast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    );
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('File CSV berhasil diunduh.', 'success');
  },
};

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());
