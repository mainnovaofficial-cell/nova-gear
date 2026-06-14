/* ═══════════════════════════════════════════════════════
   Nova Gear — Stok Module
   Stok masuk dari HPP, stok keluar dari pesanan selesai
═══════════════════════════════════════════════════════ */
'use strict';

const Stok = {
  async onLoad() {
    const el = document.getElementById('page-stok');
    el.innerHTML = `<div class="page-header"><div><h2>Stok</h2><p>Rekap stok masuk dan keluar per SKU</p></div>
      <div class="flex gap-2">
        <button onclick="Stok.openAdjust()" class="btn-secondary text-xs">Penyesuaian Manual</button>
        <button onclick="Stok.onLoad()" class="btn-primary text-xs">Refresh</button>
      </div>
    </div>
    <div id="stok-content"><div class="skeleton h-40 w-full rounded-xl"></div></div>`;
    await this._render();
  },

  async _render() {
    try {
      const db = App.db();
      const [{ data: hppData }, { data: orders }, { data: adjustments }] = await Promise.all([
        db.from('hpp').select('sku,product_name,qty'),
        db.from('orders').select('sku,qty,status').eq('status', 'Selesai'),
        db.from('stok_adjust').select('sku,qty,notes,created_at').order('created_at', { ascending: false }).limit(100),
      ]);

      // Build map: sku → { name, masuk, keluar, adjust }
      const map = {};

      const ensure = (sku, name = '') => {
        if (!map[sku]) map[sku] = { sku, name: name || sku, masuk: 0, keluar: 0, adjust: 0 };
        if (!map[sku].name && name) map[sku].name = name;
      };

      (hppData || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku, r.product_name);
        map[sku].masuk += +r.qty || 0;
      });

      (orders || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku);
        map[sku].keluar += +r.qty || 0;
      });

      (adjustments || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku);
        map[sku].adjust += +r.qty || 0;
      });

      const rows = Object.values(map).sort((a,b) => a.sku.localeCompare(b.sku));

      document.getElementById('stok-content').innerHTML = rows.length === 0
        ? `<div class="empty-state card py-16"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><p>Belum ada data stok. Tambah HPP terlebih dahulu.</p></div>`
        : `<div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>SKU</th><th>Nama Produk</th>
              <th class="text-right">Stok Masuk</th>
              <th class="text-right">Stok Keluar</th>
              <th class="text-right">Penyesuaian</th>
              <th class="text-right">Sisa Stok</th>
              <th>Status</th>
            </tr></thead>
            <tbody>${rows.map(r => {
              const sisa = r.masuk - r.keluar + r.adjust;
              const status = sisa <= 0 ? ['badge-red','Habis'] : sisa <= 5 ? ['badge-yellow','Hampir Habis'] : ['badge-green','Tersedia'];
              return `<tr>
                <td class="font-mono text-xs font-semibold text-gray-600">${r.sku}</td>
                <td class="font-medium">${r.name}</td>
                <td class="text-right text-green-700 font-semibold">${App.formatNumber(r.masuk)}</td>
                <td class="text-right text-red-600 font-semibold">${App.formatNumber(r.keluar)}</td>
                <td class="text-right ${r.adjust >= 0 ? 'text-blue-600' : 'text-orange-600'} font-semibold">${r.adjust > 0 ? '+' : ''}${App.formatNumber(r.adjust)}</td>
                <td class="text-right font-bold text-lg text-money">${App.formatNumber(sisa)}</td>
                <td><span class="badge ${status[0]}">${status[1]}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>`;
    } catch (err) {
      // stok_adjust table might not exist yet — render without it
      await this._renderSimple();
    }
  },

  async _renderSimple() {
    const db = App.db();
    const [{ data: hppData }, { data: orders }] = await Promise.all([
      db.from('hpp').select('sku,product_name,qty'),
      db.from('orders').select('sku,qty,status').eq('status', 'Selesai'),
    ]);

    const map = {};
    const ensure = (sku, name = '') => {
      if (!map[sku]) map[sku] = { sku, name: name || sku, masuk: 0, keluar: 0 };
      if (!map[sku].name && name) map[sku].name = name;
    };
    (hppData || []).forEach(r => { const k = r.sku||'TANPA-SKU'; ensure(k, r.product_name); map[k].masuk += +r.qty||0; });
    (orders  || []).forEach(r => { const k = r.sku||'TANPA-SKU'; ensure(k); map[k].keluar += +r.qty||0; });

    const rows = Object.values(map).sort((a,b) => a.sku.localeCompare(b.sku));

    document.getElementById('stok-content').innerHTML = rows.length === 0
      ? `<div class="empty-state card py-16"><p>Belum ada data stok.</p></div>`
      : `<div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>SKU</th><th>Nama Produk</th>
            <th class="text-right">Stok Masuk</th>
            <th class="text-right">Stok Keluar</th>
            <th class="text-right">Sisa Stok</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${rows.map(r => {
            const sisa = r.masuk - r.keluar;
            const st   = sisa <= 0 ? ['badge-red','Habis'] : sisa <= 5 ? ['badge-yellow','Hampir Habis'] : ['badge-green','Tersedia'];
            return `<tr>
              <td class="font-mono text-xs font-semibold text-gray-600">${r.sku}</td>
              <td class="font-medium">${r.name}</td>
              <td class="text-right text-green-700 font-semibold">${App.formatNumber(r.masuk)}</td>
              <td class="text-right text-red-600 font-semibold">${App.formatNumber(r.keluar)}</td>
              <td class="text-right font-bold text-lg text-money">${App.formatNumber(sisa)}</td>
              <td><span class="badge ${st[0]}">${st[1]}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  },

  openAdjust() {
    App.openModal({
      title: 'Penyesuaian Stok Manual',
      body: `
        <p class="text-sm text-gray-500 mb-4">Gunakan nilai positif untuk menambah stok, negatif untuk mengurangi.</p>
        <div class="space-y-3">
          <div><label class="label">SKU *</label><input id="adj-sku" class="input" placeholder="Kode SKU produk"/></div>
          <div><label class="label">Jumlah (+ tambah / − kurangi) *</label><input id="adj-qty" type="number" class="input" placeholder="Contoh: 10 atau -3"/></div>
          <div><label class="label">Keterangan</label><input id="adj-notes" class="input" placeholder="Opsional"/></div>
        </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Stok.saveAdjust()" class="btn-primary">Simpan</button>`,
    });
  },

  async saveAdjust() {
    const sku   = document.getElementById('adj-sku').value.trim();
    const qty   = +document.getElementById('adj-qty').value;
    const notes = document.getElementById('adj-notes').value.trim();
    if (!sku || !qty) { App.toast('SKU dan jumlah wajib diisi.', 'warning'); return; }

    // Try to insert into stok_adjust (create if needed via RPC or just warn)
    const { error } = await App.db().from('stok_adjust').insert({ sku, qty, notes });
    if (error) {
      // Table might not exist — show SQL hint
      App.toast('Tabel stok_adjust belum dibuat. Jalankan SQL: CREATE TABLE stok_adjust (id uuid primary key default gen_random_uuid(), sku text, qty integer, notes text, created_at timestamptz default now());', 'warning');
      return;
    }
    App.closeModal();
    App.toast('Penyesuaian stok disimpan.', 'success');
    this.onLoad();
  },
};
