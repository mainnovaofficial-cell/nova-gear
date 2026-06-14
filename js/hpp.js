/* ═══════════════════════════════════════════════════════
   Nova Gear — HPP Module
   Pembelian stok: harga Yuan, kurs, ongkir China, auto HPP
═══════════════════════════════════════════════════════ */
'use strict';

const HPP = {
  _data: [],

  async onLoad() {
    const el = document.getElementById('page-hpp');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>HPP — Harga Pokok Pembelian</h2><p>Catat pembelian stok dari supplier (China)</p></div>
      <div class="flex gap-2">
        <button onclick="HPP.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Pembelian
        </button>
      </div>
    </div>
    <!-- Summary cards -->
    <div id="hpp-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"></div>
    <!-- Table -->
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Pembelian</span>
        <button onclick="HPP._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
      </div>
      <div id="hpp-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('hpp').select('*').order('purchase_date', { ascending: false });
    if (error) { App.toast('Gagal memuat HPP: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _renderSummary() {
    const d    = this._data;
    const totalUnit = d.reduce((s,r) => s + (+r.qty||0), 0);
    const totalIdr  = d.reduce((s,r) => s + (+r.price_idr||0), 0);
    const totalShip = d.reduce((s,r) => s + (+r.shipping_china||0), 0);
    const totalCost = d.reduce((s,r) => s + (+r.total_cost||0), 0);
    const cards = [
      ['Total Unit Beli', App.formatNumber(totalUnit), 'unit'],
      ['Total Modal (IDR)', App.formatRupiah(totalIdr), 'harga barang'],
      ['Total Ongkir China', App.formatRupiah(totalShip), 'pengiriman'],
      ['Total HPP', App.formatRupiah(totalCost), 'biaya keseluruhan'],
    ];
    document.getElementById('hpp-summary').innerHTML = cards.map(([t,v,s]) => `
      <div class="stat-card"><p class="stat-label">${t}</p><p class="stat-value text-money">${v}</p><p class="stat-sub">${s}</p></div>`).join('');
  },

  _renderTable() {
    const el = document.getElementById('hpp-table');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg><p>Belum ada data pembelian</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Tanggal</th><th>SKU</th><th>Produk</th><th>Batch</th>
          <th class="text-right">Qty</th><th class="text-right">Harga (¥)</th>
          <th class="text-right">Kurs</th><th class="text-right">Harga (Rp)</th>
          <th class="text-right">Ongkir China</th><th class="text-right">Biaya Lain</th>
          <th class="text-right">Total HPP</th><th class="text-right">HPP/Unit</th><th></th>
        </tr></thead>
        <tbody>${this._data.map(r => `<tr>
          <td class="whitespace-nowrap">${App.formatDate(r.purchase_date)}</td>
          <td class="font-mono text-xs">${r.sku||'-'}</td>
          <td class="max-w-[140px] truncate" title="${r.product_name||''}">${r.product_name||'-'}</td>
          <td class="text-xs text-gray-400">${r.batch_no||'-'}</td>
          <td class="text-right">${App.formatNumber(r.qty)}</td>
          <td class="text-right text-money">¥${(+r.price_yuan||0).toFixed(2)}</td>
          <td class="text-right text-money">${App.formatNumber(r.yuan_rate)}</td>
          <td class="text-right text-money">${App.formatRupiah(r.price_idr)}</td>
          <td class="text-right text-money">${App.formatRupiah(r.shipping_china)}</td>
          <td class="text-right text-money">${App.formatRupiah(r.other_cost)}</td>
          <td class="text-right font-bold text-money">${App.formatRupiah(r.total_cost)}</td>
          <td class="text-right font-semibold text-blue-600 text-money">${App.formatRupiah(r.cost_per_unit)}</td>
          <td>
            <button onclick="HPP.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    const settings = AppState.settings || {};
    App.openModal({
      title: 'Tambah Pembelian Stok',
      size: 'max-w-2xl',
      body: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="label">Tanggal Beli *</label><input id="h-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Batch No.</label><input id="h-batch" class="input" placeholder="Optional"/></div>
        <div class="col-span-2"><label class="label">Nama Produk *</label><input id="h-name" class="input" placeholder="Nama produk"/></div>
        <div><label class="label">SKU</label><input id="h-sku" class="input" placeholder="Kode SKU"/></div>
        <div><label class="label">Qty (unit) *</label><input id="h-qty" type="number" min="1" class="input" value="1" oninput="HPP._calc()"/></div>

        <div class="col-span-2 border-t pt-4 mt-1">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Harga Barang</p>
        </div>
        <div><label class="label">Harga per Unit (¥ Yuan) *</label><input id="h-yuan" type="number" class="input" placeholder="0.00" step="0.01" oninput="HPP._calc()"/></div>
        <div><label class="label">Kurs Yuan → IDR *</label><input id="h-rate" type="number" class="input" value="${settings.yuan_rate||2200}" oninput="HPP._calc()"/></div>
        <div><label class="label">Harga (IDR) — otomatis</label><input id="h-idr" type="number" class="input bg-gray-50" placeholder="Dihitung otomatis" readonly/></div>

        <div class="col-span-2 border-t pt-4 mt-1">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Biaya Pengiriman & Lain</p>
        </div>
        <div><label class="label">Total Ongkir dari China (Rp)</label><input id="h-ship-total" type="number" class="input" placeholder="0" oninput="HPP._calc()"/></div>
        <div><label class="label">Ongkir per Unit — otomatis</label><input id="h-ship-unit" type="number" class="input bg-gray-50" placeholder="Dihitung otomatis" readonly/></div>
        <div><label class="label">Biaya Lain (Customs dll) (Rp)</label><input id="h-other" type="number" class="input" placeholder="0" oninput="HPP._calc()"/></div>

        <div class="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4 mt-1">
          <div class="flex justify-between items-center">
            <span class="text-sm font-semibold text-blue-800">Total HPP</span>
            <span id="h-total-display" class="text-xl font-bold text-blue-700 text-money">Rp 0</span>
          </div>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs text-blue-600">HPP per Unit</span>
            <span id="h-unit-display" class="text-sm font-bold text-blue-600 text-money">Rp 0</span>
          </div>
        </div>
        <div class="col-span-2"><label class="label">Catatan</label><input id="h-notes" class="input" placeholder="Opsional"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="HPP.save()" class="btn-primary">Simpan</button>`,
    });
    this._calc();
  },

  _calc() {
    const qty       = +document.getElementById('h-qty')?.value        || 0;
    const yuan      = +document.getElementById('h-yuan')?.value       || 0;
    const rate      = +document.getElementById('h-rate')?.value       || 0;
    const shipTotal = +document.getElementById('h-ship-total')?.value || 0;
    const other     = +document.getElementById('h-other')?.value      || 0;

    const idr      = yuan * rate * qty;
    const shipUnit = qty > 0 ? shipTotal / qty : 0;
    const total    = idr + shipTotal + other;
    const perUnit  = qty > 0 ? total / qty : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val.toFixed(0); };
    set('h-idr',       idr);
    set('h-ship-unit', shipUnit);
    const td = document.getElementById('h-total-display');
    const ud = document.getElementById('h-unit-display');
    if (td) td.textContent = App.formatRupiah(total);
    if (ud) ud.textContent = App.formatRupiah(perUnit);
  },

  async save() {
    const name = document.getElementById('h-name').value.trim();
    const yuan = +document.getElementById('h-yuan').value || 0;
    const qty  = +document.getElementById('h-qty').value  || 0;
    if (!name || !yuan || !qty) { App.toast('Nama produk, harga Yuan, dan qty wajib diisi.', 'warning'); return; }

    const rate      = +document.getElementById('h-rate').value       || 2200;
    const shipTotal = +document.getElementById('h-ship-total').value || 0;
    const other     = +document.getElementById('h-other').value      || 0;
    const idr       = yuan * rate * qty;
    const shipUnit  = qty > 0 ? shipTotal / qty : 0;
    const total     = idr + shipTotal + other;
    const perUnit   = qty > 0 ? total / qty : 0;

    const payload = {
      sku:              document.getElementById('h-sku').value.trim()   || null,
      product_name:     name,
      qty,
      price_yuan:       yuan,
      yuan_rate:        rate,
      price_idr:        idr,
      shipping_china:   shipTotal,
      shipping_per_unit: shipUnit,
      other_cost:       other,
      total_cost:       total,
      cost_per_unit:    perUnit,
      purchase_date:    document.getElementById('h-date').value,
      batch_no:         document.getElementById('h-batch').value.trim() || null,
      notes:            document.getElementById('h-notes').value.trim() || null,
    };

    const { error } = await App.db().from('hpp').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Pembelian disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus data pembelian ini?');
    if (!ok) return;
    const { error } = await App.db().from('hpp').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.purchase_date, sku: r.sku, produk: r.product_name,
      qty: r.qty, harga_yuan: r.price_yuan, kurs: r.yuan_rate,
      harga_idr: r.price_idr, ongkir_china: r.shipping_china,
      biaya_lain: r.other_cost, total_hpp: r.total_cost, hpp_per_unit: r.cost_per_unit,
    })), 'hpp-export.csv');
  },
};
