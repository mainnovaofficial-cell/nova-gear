/* ═══════════════════════════════════════════════════════
   Nova Gear — HPP Module
   Pembelian stok per batch: sumber China (Yuan) / Indonesia (Rupiah),
   tiap batch bisa berisi beberapa produk + freebie opsional
═══════════════════════════════════════════════════════ */
'use strict';

const HPP = {
  _data: [],
  _rowIds: [],
  _rowSeq: 0,

  async onLoad() {
    const el = document.getElementById('page-hpp');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>HPP — Harga Pokok Pembelian</h2><p>Catat pembelian stok per batch dari supplier (China/Indonesia)</p></div>
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
    const { data, error } = await App.db()
      .from('hpp_batches')
      .select('*, hpp_items(*)')
      .order('purchase_date', { ascending: false });
    if (error) { App.toast('Gagal memuat HPP: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _renderSummary() {
    const items = this._data.flatMap(b => b.hpp_items || []);
    const totalBatch = this._data.length;
    const totalUnit  = items.reduce((s,it) => s + (+it.qty||0), 0);
    const totalCost  = items.reduce((s,it) => s + (+it.total_cost||0), 0);
    const avgPerUnit = totalUnit > 0 ? totalCost / totalUnit : 0;
    const cards = [
      ['Total Batch', App.formatNumber(totalBatch), 'pengiriman'],
      ['Total Unit Beli', App.formatNumber(totalUnit), 'unit'],
      ['Total HPP', App.formatRupiah(totalCost), 'biaya keseluruhan'],
      ['Rata-rata HPP/Unit', App.formatRupiah(avgPerUnit), 'semua produk'],
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
    const sourceLabel = s => s === 'china' ? 'China (¥)' : 'Indonesia (Rp)';
    let rows = '';
    this._data.forEach(b => {
      const items = b.hpp_items || [];
      if (!items.length) {
        rows += `<tr>
          <td class="whitespace-nowrap">${App.formatDate(b.purchase_date)}</td>
          <td class="text-xs text-gray-400">${b.batch_no||'-'}</td>
          <td class="text-xs">${sourceLabel(b.source)}</td>
          <td colspan="4" class="text-xs text-gray-400">Belum ada produk</td>
          <td><button onclick="HPP.delete('${b.id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus Batch">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button></td>
        </tr>`;
        return;
      }
      items.forEach((it, idx) => {
        rows += `<tr>
          ${idx === 0 ? `
          <td class="whitespace-nowrap" rowspan="${items.length}">${App.formatDate(b.purchase_date)}</td>
          <td class="text-xs text-gray-400" rowspan="${items.length}">${b.batch_no||'-'}</td>
          <td class="text-xs" rowspan="${items.length}">${sourceLabel(b.source)}</td>` : ''}
          <td class="font-mono text-xs">${it.sku||'-'}</td>
          <td class="max-w-[140px] truncate" title="${it.product_name||''}">${it.product_name||'-'}</td>
          <td class="text-right">${App.formatNumber(it.qty)}</td>
          <td class="text-right text-money">${App.formatRupiah(it.cost_per_unit)}</td>
          <td class="text-right font-bold text-money">${App.formatRupiah(it.total_cost)}</td>
          ${idx === 0 ? `<td rowspan="${items.length}">
            <button onclick="HPP.delete('${b.id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus Batch">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>` : ''}
        </tr>`;
      });
    });
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Tanggal</th><th>Batch No</th><th>Sumber</th><th>SKU</th><th>Produk</th>
          <th class="text-right">Qty</th><th class="text-right">HPP/Unit</th>
          <th class="text-right">Total HPP</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    const settings = AppState.settings || {};
    this._rowIds = [];
    this._rowSeq = 0;
    App.openModal({
      title: 'Tambah Pembelian Stok (Batch)',
      size: 'max-w-3xl',
      body: `
      <div class="grid grid-cols-3 gap-4 mb-2">
        <div><label class="label">Tanggal Beli *</label><input id="h-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Batch No.</label><input id="h-batch" class="input" placeholder="Opsional"/></div>
        <div><label class="label">Sumber *</label>
          <select id="h-source" class="input" onchange="HPP._onSourceChange()">
            <option value="china">China (Yuan)</option>
            <option value="indonesia">Indonesia (Rupiah)</option>
          </select>
        </div>
      </div>
      <div id="h-rate-wrap" class="mb-4">
        <label class="label">Kurs Yuan → IDR</label>
        <input id="h-rate" type="number" class="input max-w-[200px]" value="${settings.yuan_rate||2200}" oninput="HPP._recalcAll()"/>
        <p class="text-xs text-gray-400 mt-1">Dipakai untuk konversi produk/freebie yang berasal dari China.</p>
      </div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Daftar Produk</span>
        <button type="button" onclick="HPP._addRow()" class="btn-secondary text-xs !py-1">+ Tambah Produk</button>
      </div>
      <div id="h-items"></div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="HPP.save()" class="btn-primary">Simpan Batch</button>`,
    });
    this._addRow();
    this._updateKursVisibility();
  },

  _rowHtml(id) {
    return `
    <div class="border rounded-lg p-3 mb-3 bg-gray-50" data-row-id="${id}">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-semibold text-gray-500">Produk</span>
        <button type="button" onclick="HPP._removeRow(${id})" class="text-gray-300 hover:text-red-500 text-xs">Hapus</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">SKU</label><input id="h-sku-${id}" class="input" placeholder="Kode SKU"/></div>
        <div><label class="label">Nama Produk *</label><input id="h-name-${id}" class="input" placeholder="Nama produk"/></div>
        <div><label class="label">QTY *</label><input id="h-qty-${id}" type="number" min="1" value="1" class="input" oninput="HPP._calcRow(${id})"/></div>
        <div><label class="label"><span id="h-price-label-${id}">Harga per Unit</span></label><input id="h-price-${id}" type="number" step="0.01" class="input" placeholder="0" oninput="HPP._calcRow(${id})"/></div>
        <div><label class="label"><span id="h-ship-label-${id}">Ongkir per Unit</span></label><input id="h-ship-${id}" type="number" step="0.01" class="input" placeholder="0" oninput="HPP._calcRow(${id})"/></div>
      </div>
      <div class="mt-3">
        <label class="inline-flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" id="h-freebie-toggle-${id}" onchange="HPP._toggleFreebie(${id})"/> Tambah Freebie
        </label>
        <div id="h-freebie-box-${id}" class="hidden grid grid-cols-2 gap-3 mt-2 pl-2 border-l-2 border-blue-100">
          <div><label class="label">Nama Freebie</label><input id="h-freebie-name-${id}" class="input" placeholder="Nama freebie"/></div>
          <div><label class="label">Sumber Freebie</label>
            <select id="h-freebie-source-${id}" class="input" onchange="HPP._calcRow(${id})">
              <option value="china">China (Yuan)</option>
              <option value="indonesia">Indonesia (Rupiah)</option>
            </select>
          </div>
          <div class="col-span-2"><label class="label"><span id="h-freebie-price-label-${id}">Harga Freebie per Unit (¥)</span></label>
            <input id="h-freebie-price-${id}" type="number" step="0.01" class="input" placeholder="0" oninput="HPP._calcRow(${id})"/></div>
        </div>
      </div>
      <div class="flex justify-between items-center mt-3 bg-blue-50 rounded-lg px-3 py-2">
        <span class="text-xs text-blue-600">HPP per Unit</span>
        <span id="h-preview-${id}" class="text-sm font-bold text-blue-700 text-money">Rp 0</span>
      </div>
    </div>`;
  },

  _addRow() {
    this._rowSeq += 1;
    const id = this._rowSeq;
    this._rowIds.push(id);
    document.getElementById('h-items').insertAdjacentHTML('beforeend', this._rowHtml(id));
    this._calcRow(id);
  },

  _removeRow(id) {
    this._rowIds = this._rowIds.filter(x => x !== id);
    const el = document.querySelector(`[data-row-id="${id}"]`);
    if (el) el.remove();
    this._updateKursVisibility();
  },

  _toggleFreebie(id) {
    const box = document.getElementById(`h-freebie-box-${id}`);
    if (box) box.classList.toggle('hidden');
    this._calcRow(id);
  },

  _onSourceChange() {
    this._recalcAll();
  },

  _recalcAll() {
    this._rowIds.forEach(id => this._calcRow(id));
    this._updateKursVisibility();
  },

  _computeRow({ source, rate, qty, price, ship, freebieOn, freebieSource, freebiePrice }) {
    const base = source === 'china' ? (price + ship) * rate : (price + ship);
    let freebieCost = 0;
    if (freebieOn) {
      freebieCost = freebieSource === 'china' ? freebiePrice * rate : freebiePrice;
    }
    const perUnit = base + freebieCost;
    const total = perUnit * qty;
    return { perUnit, total };
  },

  _calcRow(id) {
    const source = document.getElementById('h-source')?.value || 'china';
    const rate   = +document.getElementById('h-rate')?.value || 0;
    const qty    = +document.getElementById(`h-qty-${id}`)?.value   || 0;
    const price  = +document.getElementById(`h-price-${id}`)?.value || 0;
    const ship   = +document.getElementById(`h-ship-${id}`)?.value  || 0;

    const priceLabel = document.getElementById(`h-price-label-${id}`);
    const shipLabel   = document.getElementById(`h-ship-label-${id}`);
    if (priceLabel) priceLabel.textContent = source === 'china' ? 'Harga per Unit (¥ Yuan)' : 'Harga per Unit (Rp)';
    if (shipLabel)  shipLabel.textContent  = source === 'china' ? 'Ongkir per Unit (¥ Yuan)' : 'Ongkir per Unit (Rp)';

    const freebieOn     = !!document.getElementById(`h-freebie-toggle-${id}`)?.checked;
    const freebieSource = document.getElementById(`h-freebie-source-${id}`)?.value || 'china';
    const freebiePrice  = +document.getElementById(`h-freebie-price-${id}`)?.value || 0;
    const freebieLabel  = document.getElementById(`h-freebie-price-label-${id}`);
    if (freebieLabel) freebieLabel.textContent = `Harga Freebie per Unit (${freebieSource === 'china' ? '¥' : 'Rp'})`;

    const { perUnit } = this._computeRow({ source, rate, qty, price, ship, freebieOn, freebieSource, freebiePrice });
    const preview = document.getElementById(`h-preview-${id}`);
    if (preview) preview.textContent = App.formatRupiah(perUnit);

    this._updateKursVisibility();
  },

  _updateKursVisibility() {
    const source = document.getElementById('h-source')?.value || 'china';
    let needKurs = source === 'china';
    if (!needKurs) {
      for (const id of this._rowIds) {
        const on  = document.getElementById(`h-freebie-toggle-${id}`)?.checked;
        const src = document.getElementById(`h-freebie-source-${id}`)?.value;
        if (on && src === 'china') { needKurs = true; break; }
      }
    }
    const wrap = document.getElementById('h-rate-wrap');
    if (wrap) wrap.classList.toggle('hidden', !needKurs);
  },

  async save() {
    const date = document.getElementById('h-date').value;
    if (!date) { App.toast('Tanggal beli wajib diisi.', 'warning'); return; }
    const batchNo = document.getElementById('h-batch').value.trim() || null;
    const source  = document.getElementById('h-source').value;
    const rate    = +document.getElementById('h-rate').value || 0;

    const items = [];
    for (const id of this._rowIds) {
      const name  = document.getElementById(`h-name-${id}`).value.trim();
      const qty   = +document.getElementById(`h-qty-${id}`).value   || 0;
      const price = +document.getElementById(`h-price-${id}`).value || 0;
      if (!name || !qty || !price) continue;

      const sku   = document.getElementById(`h-sku-${id}`).value.trim() || null;
      const ship  = +document.getElementById(`h-ship-${id}`).value || 0;
      const freebieOn = !!document.getElementById(`h-freebie-toggle-${id}`).checked;
      const freebieName   = freebieOn ? (document.getElementById(`h-freebie-name-${id}`).value.trim() || null) : null;
      const freebieSource = freebieOn ? document.getElementById(`h-freebie-source-${id}`).value : null;
      const freebiePrice  = freebieOn ? (+document.getElementById(`h-freebie-price-${id}`).value || 0) : 0;

      const { perUnit, total } = this._computeRow({ source, rate, qty, price, ship, freebieOn, freebieSource, freebiePrice });

      items.push({
        sku, product_name: name, qty,
        price_unit: price, shipping_unit: ship,
        freebie_name: freebieName, freebie_source: freebieSource,
        freebie_price_unit: freebiePrice,
        cost_per_unit: perUnit, total_cost: total,
      });
    }
    if (!items.length) { App.toast('Minimal 1 produk (nama, qty, harga) harus diisi lengkap.', 'warning'); return; }

    const { data: batch, error: batchErr } = await App.db()
      .from('hpp_batches')
      .insert({ purchase_date: date, batch_no: batchNo, source, yuan_rate: rate })
      .select()
      .single();
    if (batchErr) { App.toast('Error: ' + batchErr.message, 'error'); return; }

    const { error: itemErr } = await App.db()
      .from('hpp_items')
      .insert(items.map(it => ({ ...it, batch_id: batch.id })));
    if (itemErr) {
      await App.db().from('hpp_batches').delete().eq('id', batch.id);
      App.toast('Error: ' + itemErr.message, 'error');
      return;
    }

    App.closeModal();
    App.toast('Pembelian disimpan!', 'success');
    await this._load();
  },

  async delete(batchId) {
    const ok = await App.confirm('Hapus batch pembelian ini beserta semua produknya?');
    if (!ok) return;
    const { error } = await App.db().from('hpp_batches').delete().eq('id', batchId);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(b => b.id !== batchId);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    const sourceLabel = s => s === 'china' ? 'China' : 'Indonesia';
    const rows = [];
    this._data.forEach(b => {
      (b.hpp_items || []).forEach(it => {
        rows.push({
          tanggal: b.purchase_date, batch_no: b.batch_no, sumber: sourceLabel(b.source),
          sku: it.sku, produk: it.product_name, qty: it.qty,
          harga_per_unit: it.price_unit, ongkir_per_unit: it.shipping_unit,
          freebie: it.freebie_name || '', sumber_freebie: it.freebie_source ? sourceLabel(it.freebie_source) : '',
          harga_freebie: it.freebie_price_unit || 0,
          hpp_per_unit: it.cost_per_unit, total_hpp: it.total_cost,
        });
      });
    });
    App.exportCSV(rows, 'hpp-export.csv');
  },
};
