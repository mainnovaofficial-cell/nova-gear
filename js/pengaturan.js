/* ═══════════════════════════════════════════════════════
   Nova Gear — Pengaturan Module
   Kelola settings, password, akses level
═══════════════════════════════════════════════════════ */
'use strict';

const Pengaturan = {
  _settings: {},

  async onLoad() {
    if (!App.isOwner()) {
      document.getElementById('page-pengaturan').innerHTML = `
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h3 class="text-gray-700 font-semibold mb-1">Akses Terbatas</h3>
          <p class="text-gray-400 text-sm">Halaman Pengaturan hanya dapat diakses oleh <strong>Owner</strong>.</p>
        </div>`;
      return;
    }
    await this._load();
  },

  async _load() {
    this._settings = await App.reloadSettings();
    const s = this._settings;
    const el = document.getElementById('page-pengaturan');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Pengaturan</h2><p>Konfigurasi toko, akses, dan default sistem</p></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- Informasi Toko -->
      <div class="card">
        <h3 class="card-title mb-4">Informasi Toko</h3>
        <div class="space-y-4">
          <div><label class="label">Nama Toko</label>
            <input id="s-store-name" class="input" value="${s.store_name||'Nova Gear'}"/>
          </div>
        </div>
        <button onclick="Pengaturan.saveGroup(['store_name'])" class="btn-primary text-xs mt-4">Simpan</button>
      </div>

      <!-- Default Shopee -->
      <div class="card">
        <h3 class="card-title mb-4">Default Potongan Shopee</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Biaya Layanan (%)</label>
            <input id="s-service" type="number" class="input" value="${s.shopee_service_fee_pct||6.5}" step="0.1" oninput="Pengaturan._updateShopeeTotal()"/>
          </div>
          <div><label class="label">Gratis Ongkir (%)</label>
            <input id="s-free-shipping" type="number" class="input" value="${s.shopee_free_shipping_pct||5.5}" step="0.1" oninput="Pengaturan._updateShopeeTotal()"/>
          </div>
          <div><label class="label">Promo Xtra (%)</label>
            <input id="s-promo-xtra" type="number" class="input" value="${s.shopee_promo_xtra_pct||6.5}" step="0.1" oninput="Pengaturan._updateShopeeTotal()"/>
          </div>
          <div><label class="label">Affiliate (%)</label>
            <input id="s-affiliate" type="number" class="input" value="${s.shopee_affiliate_pct||5.0}" step="0.1" oninput="Pengaturan._updateShopeeTotal()"/>
          </div>
        </div>
        <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
          <span class="text-sm font-semibold text-gray-700">Total Potongan</span>
          <span id="s-shopee-total" class="font-bold text-blue-700">0%</span>
        </div>
        <p class="text-xs text-gray-400 mt-2">Digunakan pada input manual dan simulasi analisis.</p>
        <button onclick="Pengaturan.saveGroup(['shopee_service_fee_pct','shopee_free_shipping_pct','shopee_promo_xtra_pct','shopee_affiliate_pct'])" class="btn-primary text-xs mt-4">Simpan</button>
      </div>

      <!-- Modal Awal -->
      <div class="card">
        <h3 class="card-title mb-4">Modal Awal</h3>
        <div><label class="label">Modal Awal (Rp)</label>
          <input id="s-modal-awal" type="number" class="input" value="${s.modal_awal||0}" step="1000" min="0"/>
        </div>
        <p class="text-xs text-gray-400 mt-2">Digunakan untuk menghitung Posisi Kas di Laba Rugi.</p>
        <button onclick="Pengaturan.saveGroup(['modal_awal'])" class="btn-primary text-xs mt-4">Simpan</button>
      </div>

      <!-- Kurs Yuan -->
      <div class="card">
        <h3 class="card-title mb-4">Kurs Yuan Default</h3>
        <div><label class="label">Kurs 1 Yuan → Rp</label>
          <input id="s-yuan-rate" type="number" class="input" value="${s.yuan_rate||2200}"/>
        </div>
        <p class="text-xs text-gray-400 mt-2">Digunakan sebagai default di form HPP.</p>
        <button onclick="Pengaturan.saveGroup(['yuan_rate'])" class="btn-primary text-xs mt-4">Simpan</button>
      </div>

      <!-- Harga Freebie Default -->
      <div class="card">
        <h3 class="card-title mb-4">Harga Freebie Default</h3>
        <div><label class="label">Harga Freebie Default (Rp)</label>
          <input id="s-freebie-price" type="number" class="input" value="${s.freebie_default_price||7300}" step="100" min="0"/>
        </div>
        <p class="text-xs text-gray-400 mt-2">Dipakai otomatis untuk SKU yang berakhiran "-F" di form HPP, Laba Rugi, dan Analisis Margin.</p>
        <button onclick="Pengaturan.saveGroup(['freebie_default_price'])" class="btn-primary text-xs mt-4">Simpan</button>
      </div>

      <!-- Password Owner -->
      <div class="card">
        <h3 class="card-title mb-4">Keamanan & Password</h3>
        <div class="space-y-3">
          <div>
            <label class="label">Password Owner (baru)</label>
            <input id="s-owner-pw" type="password" class="input" placeholder="Kosongkan jika tidak diubah"/>
          </div>
          <div>
            <label class="label">Password Admin (baru)</label>
            <input id="s-admin-pw" type="password" class="input" placeholder="Kosongkan jika tidak diubah"/>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
            ⚠ Password saat ini disimpan di database Supabase. Untuk produksi, gunakan autentikasi Supabase Auth yang lebih aman.
          </div>
        </div>
        <button onclick="Pengaturan.savePasswords()" class="btn-primary text-xs mt-4">Simpan Password</button>
      </div>

      <!-- Level Akses -->
      <div class="card lg:col-span-2">
        <h3 class="card-title mb-4">Informasi Level Akses</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xl">👑</span>
              <span class="font-bold text-purple-800">Owner</span>
            </div>
            <ul class="text-sm text-purple-700 space-y-1">
              <li>✓ Akses semua halaman</li>
              <li>✓ Lihat Laba Rugi & Analisis</li>
              <li>✓ Kelola Pengaturan</li>
              <li>✓ Hapus data</li>
              <li>✓ Export semua laporan</li>
            </ul>
          </div>
          <div class="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xl">🛠️</span>
              <span class="font-bold text-blue-800">Admin</span>
            </div>
            <ul class="text-sm text-blue-700 space-y-1">
              <li>✓ Scanner Packing</li>
              <li>✓ Input Penjualan, Stok, HPP</li>
              <li>✓ Input Iklan & Operasional</li>
              <li>✗ Tidak bisa akses Pengaturan</li>
              <li>✗ Tidak bisa hapus data</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Supabase Config -->
      <div class="card lg:col-span-2">
        <h3 class="card-title mb-4">Konfigurasi Database</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label class="label">Supabase Project URL</label>
            <input id="s-sb-url" class="input font-mono text-xs" value="${localStorage.getItem('ng_url')||''}" type="url"/>
          </div>
          <div><label class="label">Supabase Anon Key</label>
            <input id="s-sb-key" class="input font-mono text-xs" value="${localStorage.getItem('ng_key')||''}" type="password"/>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="Pengaturan.saveSupabase()" class="btn-primary text-xs">Simpan & Reconnect</button>
          <button onclick="Pengaturan.clearSetup()" class="btn-danger text-xs">Reset Setup</button>
        </div>
      </div>

    </div>`;
    this._updateShopeeTotal();
  },

  _updateShopeeTotal() {
    const ids = ['s-service', 's-free-shipping', 's-promo-xtra', 's-affiliate'];
    const total = ids.reduce((sum, id) => sum + (parseFloat(document.getElementById(id)?.value || 0) || 0), 0);
    const el = document.getElementById('s-shopee-total');
    if (el) el.textContent = total.toFixed(2) + '%';
  },

  async saveGroup(keys) {
    const fieldMap = {
      store_name:                 's-store-name',
      shopee_service_fee_pct:     's-service',
      shopee_free_shipping_pct:   's-free-shipping',
      shopee_promo_xtra_pct:      's-promo-xtra',
      shopee_affiliate_pct:       's-affiliate',
      yuan_rate:                  's-yuan-rate',
      modal_awal:                 's-modal-awal',
      freebie_default_price:      's-freebie-price',
    };

    const updates = keys.map(k => ({
      key: k,
      value: document.getElementById(fieldMap[k])?.value?.trim() || '',
      updated_at: new Date().toISOString(),
    }));

    try {
      for (const u of updates) {
        const { error } = await App.db().from('settings').upsert(u, { onConflict: 'key' });
        if (error) throw error;
      }
      // Update store name in UI if changed
      if (keys.includes('store_name')) {
        const name = updates.find(u=>u.key==='store_name')?.value;
        if (name) {
          localStorage.setItem('ng_store', name);
          document.getElementById('sidebar-store-name').textContent = name;
          document.getElementById('topbar-store').textContent       = name;
        }
      }
      App.toast('Pengaturan disimpan!', 'success');
      await App.reloadSettings();
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async savePasswords() {
    const ownerPw = document.getElementById('s-owner-pw').value;
    const adminPw = document.getElementById('s-admin-pw').value;
    if (!ownerPw && !adminPw) { App.toast('Tidak ada perubahan password.', 'warning'); return; }

    try {
      const updates = [];
      if (ownerPw) updates.push({ key: 'owner_password', value: ownerPw, updated_at: new Date().toISOString() });
      if (adminPw) updates.push({ key: 'admin_password', value: adminPw, updated_at: new Date().toISOString() });
      for (const u of updates) {
        const { error } = await App.db().from('settings').upsert(u, { onConflict: 'key' });
        if (error) throw error;
      }
      document.getElementById('s-owner-pw').value = '';
      document.getElementById('s-admin-pw').value = '';
      App.toast('Password berhasil diubah!', 'success');
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  saveSupabase() {
    const url = document.getElementById('s-sb-url').value.trim();
    const key = document.getElementById('s-sb-key').value.trim();
    if (!url || !key) { App.toast('URL dan Key wajib diisi.', 'warning'); return; }
    localStorage.setItem('ng_url', url);
    localStorage.setItem('ng_key', key);
    App.toast('Konfigurasi disimpan. Halaman akan dimuat ulang...', 'info', 2000);
    setTimeout(() => location.reload(), 2000);
  },

  clearSetup() {
    App.confirm('Reset semua konfigurasi? Anda akan diarahkan ke halaman setup ulang.').then(ok => {
      if (!ok) return;
      localStorage.removeItem('ng_url');
      localStorage.removeItem('ng_key');
      localStorage.removeItem('ng_store');
      location.reload();
    });
  },
};
