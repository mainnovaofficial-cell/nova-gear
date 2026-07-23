/* ═══════════════════════════════════════════════════════
   Nova Gear — HPP Module
   Pembelian stok per batch: sumber China (Yuan) / Indonesia (Rupiah),
   tiap batch bisa berisi beberapa produk + freebie opsional
   + Tab Uang Muka Pembelian: DP yang dibayar duluan (potong Saldo BCA
   saat dibayar), bisa di-link ke batch HPP saat barangnya diinput
═══════════════════════════════════════════════════════ */
'use strict';

const HPP = {
  _data: [],
  _rowIds: [],
  _rowSeq: 0,
  _tab: 'pembelian',
  _umData: [],
  _selectedUM: new Set(),

  async onLoad() {
    const el = document.getElementById('page-hpp');
    el.innerHTML = this._shell();
    await this._load();
  },

  _shell() {
    return `
    <div class="page-header">
      <div><h2>HPP — Harga Pokok Pembelian</h2><p>Catat pembelian stok per batch dari supplier (China/Indonesia), dan Uang Muka yang dibayar duluan</p></div>
      <div class="flex gap-2">
        <button id="hpp-btn-add-pembelian" onclick="HPP.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Pembelian
        </button>
        <button id="hpp-btn-add-um" onclick="HPP.openAddUM()" class="btn-primary text-xs hidden">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Uang Muka
        </button>
      </div>
    </div>
    <div id="hpp-um-banner"></div>
    <div class="tabs">
      <button class="tab-btn active" onclick="HPP._switchTab('pembelian', this)">Pembelian</button>
      <button class="tab-btn" onclick="HPP._switchTab('umuka', this)">Uang Muka</button>
    </div>
    <div id="hpp-tab-content"></div>`;
  },

  async _load() {
    const [hppRes, umRes] = await Promise.all([
      App.db().from('hpp_batches').select('*, hpp_items(*)').order('purchase_date', { ascending: false }),
      App.db().from('uang_muka_pembelian').select('*, hpp_batches(batch_no, purchase_date)').order('tanggal', { ascending: false }),
    ]);
    if (hppRes.error) { App.toast('Gagal memuat HPP: ' + hppRes.error.message, 'error'); return; }
    if (umRes.error)  { App.toast('Gagal memuat Uang Muka: ' + umRes.error.message, 'error'); return; }
    this._data   = hppRes.data || [];
    this._umData = umRes.data || [];
    this._renderBanner();
    this._renderTab();
  },

  _switchTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('#page-hpp .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('hpp-btn-add-pembelian').classList.toggle('hidden', tab !== 'pembelian');
    document.getElementById('hpp-btn-add-um').classList.toggle('hidden', tab !== 'umuka');
    this._renderTab();
  },

  _renderTab() {
    const el = document.getElementById('hpp-tab-content');
    if (this._tab === 'pembelian') {
      el.innerHTML = `
      <div id="hpp-summary" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5"></div>
      <div class="card">
        <div class="card-header mb-3">
          <span class="card-title">Riwayat Pembelian</span>
          <button onclick="HPP._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
        </div>
        <div id="hpp-table"></div>
      </div>`;
      this._renderSummary();
      this._renderTable();
    } else {
      el.innerHTML = `
      <div id="hpp-um-summary" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5"></div>
      <div class="card">
        <div class="card-header mb-3">
          <span class="card-title">Riwayat Uang Muka Pembelian</span>
          <button onclick="HPP._exportUMCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
        </div>
        <div id="hpp-um-table"></div>
      </div>`;
      this._renderUMSummary();
      this._renderUMTable();
    }
  },

  _renderBanner() {
    const el = document.getElementById('hpp-um-banner');
    if (!el) return;
    const unused = this._umData.filter(u => !u.terpakai);
    if (!unused.length) { el.innerHTML = ''; return; }
    const total = unused.reduce((s, r) => s + (+r.jumlah || 0), 0);
    el.innerHTML = `
    <div class="card !py-3 !px-4 mb-4 border-l-4 border-indigo-400 bg-indigo-50/50 flex items-center justify-between flex-wrap gap-2">
      <div>
        <p class="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Uang Muka Belum Terpakai</p>
        <p class="text-xs text-gray-500 mt-0.5">${unused.length} entri menggantung — belum di-link ke pembelian manapun</p>
      </div>
      <p class="text-lg font-bold text-indigo-700 text-money">${App.formatRupiah(total)}</p>
    </div>`;
  },

  _renderSummary() {
    const items = this._data.flatMap(b => b.hpp_items || []);
    const totalBatch = this._data.length;
    const totalUnit  = items.reduce((s,it) => s + (+it.qty||0), 0);
    const totalCost  = items.reduce((s,it) => s + (+it.total_cost||0), 0);
    const cards = [
      ['Total Batch', App.formatNumber(totalBatch), 'pengiriman'],
      ['Total Unit Beli', App.formatNumber(totalUnit), 'unit'],
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
    this._selectedUM = new Set();
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
      <div id="h-items"></div>
      <div class="mt-4 pt-4 border-t border-gray-100">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gunakan Uang Muka (opsional)</span>
        <p class="text-xs text-gray-400 mt-0.5 mb-2">Pilih Uang Muka yang sudah dibayar untuk barang ini — otomatis di-link ke batch ini dan tidak akan memotong Saldo BCA lagi (hanya sisanya, mis. ongkir, yang kepotong normal).</p>
        <div id="h-um-section"></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="HPP.save()" class="btn-primary">Simpan Batch</button>`,
    });
    this._addRow();
    this._updateKursVisibility();
    this._renderUMPicker();
  },

  _renderUMPicker() {
    const el = document.getElementById('h-um-section');
    if (!el) return;
    const unused = this._umData.filter(u => !u.terpakai);
    if (!unused.length) {
      el.innerHTML = `<p class="text-xs text-gray-400">Tidak ada uang muka yang belum terpakai.</p>`;
      return;
    }
    el.innerHTML = `
      <div class="space-y-1.5 max-h-40 overflow-y-auto border rounded-lg p-2">
        ${unused.map(u => `
          <label class="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded hover:bg-gray-50 cursor-pointer">
            <span class="flex items-center gap-2 min-w-0">
              <input type="checkbox" class="h-um-check" data-id="${u.id}" data-jumlah="${u.jumlah}" onchange="HPP._onUMToggle()"/>
              <span class="truncate">${App.formatDate(u.tanggal)} — ${u.deskripsi||'-'}</span>
            </span>
            <span class="font-semibold text-money whitespace-nowrap">${App.formatRupiah(u.jumlah)}</span>
          </label>`).join('')}
      </div>
      <p id="h-um-total" class="text-xs text-indigo-600 font-medium mt-1.5"></p>`;
    this._onUMToggle();
  },

  _onUMToggle() {
    const checks = Array.from(document.querySelectorAll('.h-um-check:checked'));
    this._selectedUM = new Set(checks.map(c => c.dataset.id));
    const total = checks.reduce((s,c) => s + (+c.dataset.jumlah || 0), 0);
    const label = document.getElementById('h-um-total');
    if (label) label.textContent = total > 0 ? `Total Uang Muka dipakai: ${App.formatRupiah(total)}` : '';
  },

  _rowHtml(id) {
    const source = document.getElementById('h-source')?.value || 'china';
    return `
    <div class="border rounded-lg p-3 mb-3 bg-gray-50" data-row-id="${id}">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-semibold text-gray-500">Produk</span>
        <button type="button" onclick="HPP._removeRow(${id})" class="text-gray-300 hover:text-red-500 text-xs">Hapus</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">SKU</label><input id="h-sku-${id}" class="input" placeholder="Kode SKU" oninput="HPP._onSkuInput(${id})"/></div>
        <div><label class="label">Nama Produk *</label><input id="h-name-${id}" class="input" placeholder="Nama produk"/></div>
        <div><label class="label">QTY *</label><input id="h-qty-${id}" type="number" min="1" value="1" class="input" oninput="HPP._calcRow(${id})"/></div>
        <div><label class="label">Mode Input Harga</label>
          <select id="h-mode-${id}" class="input" onchange="HPP._onModeChange(${id})">
            <option value="total">Total (otomatis dibagi Qty)</option>
            <option value="manual">Manual per Unit</option>
          </select>
        </div>
      </div>

      <div id="h-total-box-${id}" class="grid grid-cols-2 gap-3 mt-2">
        <div id="h-yuan-helper-${id}" class="col-span-2 ${source === 'china' ? '' : 'hidden'}">
          <label class="label text-gray-400">Bantuan Konversi (opsional): Total Harga Barang (¥ Yuan)</label>
          <input id="h-totalyuan-${id}" type="number" step="0.01" class="input" placeholder="Isi di sini untuk auto-isi Rupiah di bawah" oninput="HPP._onYuanHelper(${id})"/>
        </div>
        <div><label class="label">Total Harga Barang (Rp) *</label><input id="h-totalharga-${id}" type="number" step="0.01" class="input" placeholder="0" oninput="HPP._calcRow(${id})"/></div>
        <div><label class="label">Total Ongkir (Rp)</label><input id="h-totalongkir-${id}" type="number" step="0.01" class="input" placeholder="0" oninput="HPP._calcRow(${id})"/></div>
      </div>

      <div id="h-manual-box-${id}" class="hidden grid grid-cols-2 gap-3 mt-2">
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
        <div>
          <span class="text-xs text-blue-600">HPP per Unit</span>
          <p id="h-preview-detail-${id}" class="text-[11px] text-gray-400"></p>
        </div>
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

  _onSkuInput(id) {
    const sku = document.getElementById(`h-sku-${id}`)?.value || '';
    if (App.isFreebieSku(sku)) {
      const toggle = document.getElementById(`h-freebie-toggle-${id}`);
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        document.getElementById(`h-freebie-box-${id}`)?.classList.remove('hidden');
        const sourceSel = document.getElementById(`h-freebie-source-${id}`);
        if (sourceSel) sourceSel.value = 'indonesia';
      }
      const priceEl = document.getElementById(`h-freebie-price-${id}`);
      if (priceEl && !priceEl.value) {
        priceEl.value = App.getFreebieDefaultPrice(AppState.settings);
      }
    }
    this._calcRow(id);
  },

  _onSourceChange() {
    this._recalcAll();
  },

  _onModeChange(id) {
    const mode = document.getElementById(`h-mode-${id}`)?.value || 'total';
    document.getElementById(`h-total-box-${id}`)?.classList.toggle('hidden', mode !== 'total');
    document.getElementById(`h-manual-box-${id}`)?.classList.toggle('hidden', mode !== 'manual');
    this._calcRow(id);
  },

  // Bantuan konversi: user isi Total Harga Barang dalam Yuan, otomatis dikonversi
  // ke Rupiah (memakai Kurs batch) dan mengisi field "Total Harga Barang (Rp)" —
  // field itu tetap yang jadi sumber kebenaran/tersimpan, Yuan cuma alat bantu isi.
  _onYuanHelper(id) {
    const rate  = +document.getElementById('h-rate')?.value || 0;
    const yuan  = +document.getElementById(`h-totalyuan-${id}`)?.value || 0;
    const totalHargaInput = document.getElementById(`h-totalharga-${id}`);
    if (totalHargaInput) totalHargaInput.value = yuan ? Math.round(yuan * rate) : '';
    this._calcRow(id);
  },

  _recalcAll() {
    this._rowIds.forEach(id => {
      // Kalau baris ini pakai bantuan konversi Yuan, sinkronkan ulang ke Kurs terbaru
      // (mis. Kurs baru diubah setelah Yuan sudah diisi) sebelum recompute preview.
      const yuanEl = document.getElementById(`h-totalyuan-${id}`);
      if (yuanEl && yuanEl.value) this._onYuanHelper(id);
      else this._calcRow(id);
    });
    this._updateKursVisibility();
  },

  // mode 'total'  → pricePerUnit/shipPerUnit dihitung dari Total Harga Barang/Ongkir ÷ Qty
  //                 baris ini sendiri (bukan dibagi rata ke baris lain — tiap SKU independen).
  // mode 'manual' → persis logika lama: user isi harga & ongkir per unit langsung.
  // Kedua mode disimpan final dalam Rupiah (price_unit/shipping_unit).
  _computeRow({ mode, source, rate, qty, price, ship, totalHarga, totalOngkir, freebieOn, freebieSource, freebiePrice }) {
    let pricePerUnit, shipPerUnit;
    if (mode === 'manual') {
      pricePerUnit = source === 'china' ? price * rate : price;
      shipPerUnit  = ship;
    } else {
      pricePerUnit = qty > 0 ? totalHarga  / qty : 0;
      shipPerUnit  = qty > 0 ? totalOngkir / qty : 0;
    }
    let freebieCost = 0;
    if (freebieOn) {
      freebieCost = freebieSource === 'china' ? freebiePrice * rate : freebiePrice;
    }
    const perUnit = pricePerUnit + shipPerUnit + freebieCost;
    const total = perUnit * qty;
    return { pricePerUnit, shipPerUnit, perUnit, total };
  },

  _calcRow(id) {
    const source = document.getElementById('h-source')?.value || 'china';
    const rate   = +document.getElementById('h-rate')?.value || 0;
    const qty    = +document.getElementById(`h-qty-${id}`)?.value || 0;
    const mode   = document.getElementById(`h-mode-${id}`)?.value || 'total';

    const yuanHelper = document.getElementById(`h-yuan-helper-${id}`);
    if (yuanHelper) yuanHelper.classList.toggle('hidden', source !== 'china');

    const price       = +document.getElementById(`h-price-${id}`)?.value       || 0;
    const ship        = +document.getElementById(`h-ship-${id}`)?.value        || 0;
    const totalHarga  = +document.getElementById(`h-totalharga-${id}`)?.value  || 0;
    const totalOngkir = +document.getElementById(`h-totalongkir-${id}`)?.value || 0;

    const priceLabel = document.getElementById(`h-price-label-${id}`);
    const shipLabel   = document.getElementById(`h-ship-label-${id}`);
    if (priceLabel) priceLabel.textContent = source === 'china' ? 'Harga per Unit (¥ Yuan)' : 'Harga per Unit (Rp)';
    if (shipLabel)  shipLabel.textContent  = 'Ongkir per Unit (Rp)';

    const freebieOn     = !!document.getElementById(`h-freebie-toggle-${id}`)?.checked;
    const freebieSource = document.getElementById(`h-freebie-source-${id}`)?.value || 'china';
    const freebiePrice  = +document.getElementById(`h-freebie-price-${id}`)?.value || 0;
    const freebieLabel  = document.getElementById(`h-freebie-price-label-${id}`);
    if (freebieLabel) freebieLabel.textContent = `Harga Freebie per Unit (${freebieSource === 'china' ? '¥' : 'Rp'})`;

    const { pricePerUnit, shipPerUnit, perUnit } = this._computeRow({ mode, source, rate, qty, price, ship, totalHarga, totalOngkir, freebieOn, freebieSource, freebiePrice });
    const preview = document.getElementById(`h-preview-${id}`);
    if (preview) preview.textContent = App.formatRupiah(perUnit);
    const detail = document.getElementById(`h-preview-detail-${id}`);
    if (detail) {
      detail.textContent = mode === 'total'
        ? `Harga/Unit ${App.formatRupiah(pricePerUnit)} + Ongkir/Unit ${App.formatRupiah(shipPerUnit)}`
        : '';
    }

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
      const name = document.getElementById(`h-name-${id}`).value.trim();
      const qty  = +document.getElementById(`h-qty-${id}`).value || 0;
      const mode = document.getElementById(`h-mode-${id}`).value || 'total';

      const price       = +document.getElementById(`h-price-${id}`).value       || 0;
      const ship        = +document.getElementById(`h-ship-${id}`).value        || 0;
      const totalHarga  = +document.getElementById(`h-totalharga-${id}`).value  || 0;
      const totalOngkir = +document.getElementById(`h-totalongkir-${id}`).value || 0;

      const hasHarga = mode === 'manual' ? !!price : !!totalHarga;
      if (!name || !qty || !hasHarga) continue;

      const sku   = document.getElementById(`h-sku-${id}`).value.trim() || null;
      const freebieOn = !!document.getElementById(`h-freebie-toggle-${id}`).checked;
      const freebieName   = freebieOn ? (document.getElementById(`h-freebie-name-${id}`).value.trim() || null) : null;
      const freebieSource = freebieOn ? document.getElementById(`h-freebie-source-${id}`).value : null;
      const freebiePrice  = freebieOn ? (+document.getElementById(`h-freebie-price-${id}`).value || 0) : 0;

      const { pricePerUnit, shipPerUnit, perUnit, total } = this._computeRow({ mode, source, rate, qty, price, ship, totalHarga, totalOngkir, freebieOn, freebieSource, freebiePrice });

      items.push({
        sku, product_name: name, qty,
        price_unit: pricePerUnit, shipping_unit: shipPerUnit,
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

    // Auto-registrasi SKU baru ke stok_awal dengan hidden=false supaya langsung terlihat di Rekap Stok.
    // ignoreDuplicates:true → skip kalau SKU sudah ada, tidak overwrite baris yang ada.
    const newSkuRows = items
      .filter(it => it.sku)
      .map(it => ({ sku: it.sku, product_name: it.product_name || it.sku, qty: 0, hidden: false, updated_at: new Date().toISOString() }));
    if (newSkuRows.length) {
      await App.db().from('stok_awal').upsert(newSkuRows, { onConflict: 'sku', ignoreDuplicates: true });
    }

    // Link Uang Muka yang dipilih ke batch ini — supaya nilainya tidak dipotong lagi
    // dari Saldo BCA (sudah dipotong saat Uang Muka dibayar). Lihat js/dashboard.js.
    let umWarning = '';
    if (this._selectedUM.size) {
      const selectedIds = Array.from(this._selectedUM);
      const umTotal = this._umData
        .filter(u => selectedIds.includes(u.id))
        .reduce((s, u) => s + (+u.jumlah || 0), 0);
      const batchTotalCost = items.reduce((s, it) => s + it.total_cost, 0);
      if (umTotal > batchTotalCost) {
        umWarning = ` Peringatan: Uang Muka terpilih (${App.formatRupiah(umTotal)}) melebihi Total HPP batch ini (${App.formatRupiah(batchTotalCost)}).`;
      }
      const { error: umErr } = await App.db()
        .from('uang_muka_pembelian')
        .update({ terpakai: true, hpp_batch_id: batch.id })
        .in('id', selectedIds);
      if (umErr) { App.toast('Batch tersimpan, tapi gagal link Uang Muka: ' + umErr.message, 'error'); }
    }

    App.closeModal();
    App.toast('Pembelian disimpan!' + umWarning, umWarning ? 'warning' : 'success');
    await this._load();
  },

  async delete(batchId) {
    const ok = await App.confirm('Hapus batch pembelian ini beserta semua produknya?');
    if (!ok) return;
    // Lepas tautan Uang Muka yang terpakai di batch ini, supaya bisa dipakai lagi untuk pembelian lain.
    await App.db().from('uang_muka_pembelian').update({ terpakai: false, hpp_batch_id: null }).eq('hpp_batch_id', batchId);
    const { error } = await App.db().from('hpp_batches').delete().eq('id', batchId);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    await this._load();
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

  /* ══════════════════════════════════════════════
     Tab: Uang Muka Pembelian
  ══════════════════════════════════════════════ */

  _renderUMSummary() {
    const d = this._umData;
    const total  = d.reduce((s, r) => s + (+r.jumlah || 0), 0);
    const unused = d.filter(r => !r.terpakai);
    const used   = d.filter(r => r.terpakai);
    const cards = [
      ['Total Uang Muka', App.formatRupiah(total), `${d.length} entri`],
      ['Belum Terpakai', App.formatRupiah(unused.reduce((s,r)=>s+(+r.jumlah||0),0)), `${unused.length} entri`],
      ['Sudah Terpakai', App.formatRupiah(used.reduce((s,r)=>s+(+r.jumlah||0),0)), `${used.length} entri`],
    ];
    document.getElementById('hpp-um-summary').innerHTML = cards.map(([t,v,s]) => `
      <div class="stat-card"><p class="stat-label">${t}</p><p class="stat-value text-money">${v}</p><p class="stat-sub">${s}</p></div>`).join('');
  },

  _renderUMTable() {
    const el = document.getElementById('hpp-um-table');
    if (!this._umData.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg><p>Belum ada data uang muka</p></div>`;
      return;
    }
    const rows = this._umData.map(r => {
      const batch = r.hpp_batches;
      const batchLabel = batch ? (batch.batch_no || App.formatDate(batch.purchase_date)) : '-';
      const actionBtn = r.terpakai
        ? `<button onclick="HPP._unlinkUM('${r.id}')" class="text-gray-300 hover:text-amber-500 transition-colors" title="Lepas Tautan dari Batch">
             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5"/></svg>
           </button>`
        : `<button onclick="HPP._deleteUM('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus">
             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
           </button>`;
      return `<tr>
        <td class="whitespace-nowrap">${App.formatDate(r.tanggal)}</td>
        <td class="max-w-[220px] truncate" title="${r.deskripsi||''}">${r.deskripsi||'-'}</td>
        <td class="text-right font-semibold text-money">${App.formatRupiah(r.jumlah)}</td>
        <td>${r.terpakai ? `<span class="badge badge-green">Terpakai</span>` : `<span class="badge badge-yellow">Belum Terpakai</span>`}</td>
        <td class="text-xs text-gray-500">${batchLabel}</td>
        <td>${actionBtn}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Deskripsi</th><th class="text-right">Jumlah</th><th>Status</th><th>Batch Terkait</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  },

  openAddUM() {
    App.openModal({
      title: 'Tambah Uang Muka Pembelian',
      body: `
      <div class="space-y-4">
        <div><label class="label">Tanggal Bayar *</label><input id="um-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Deskripsi / Nama Barang *</label><input id="um-desc" class="input" placeholder="Mis. DP Batch Sarung Tangan Motor Maret"/></div>
        <div><label class="label">Jumlah Dibayar (Rp) *</label><input id="um-jumlah" type="number" class="input" placeholder="0"/></div>
      </div>
      <p class="text-xs text-gray-400 mt-3">Jumlah ini langsung mengurangi Saldo BCA saat disimpan, seperti pengeluaran Operasional. Nanti saat barang sampai dan HPP-nya diinput, Uang Muka ini bisa dipilih di form Tambah Pembelian supaya tidak kepotong Saldo BCA dua kali.</p>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="HPP.saveUM()" class="btn-primary">Simpan</button>`,
    });
  },

  async saveUM() {
    const tanggal = document.getElementById('um-date').value;
    const desc    = document.getElementById('um-desc').value.trim();
    const jumlah  = +document.getElementById('um-jumlah').value || 0;
    if (!tanggal || !desc || !jumlah) { App.toast('Tanggal, deskripsi, dan jumlah wajib diisi.', 'warning'); return; }
    const { error } = await App.db().from('uang_muka_pembelian').insert({ tanggal, deskripsi: desc, jumlah, terpakai: false });
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Uang Muka disimpan!', 'success');
    await this._load();
  },

  async _deleteUM(id) {
    const ok = await App.confirm('Hapus uang muka ini? Saldo BCA akan bertambah kembali sebesar nilai ini.');
    if (!ok) return;
    const { error } = await App.db().from('uang_muka_pembelian').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    await this._load();
  },

  async _unlinkUM(id) {
    const ok = await App.confirm('Lepas tautan Uang Muka ini dari batch pembelian? Statusnya kembali jadi "Belum Terpakai" dan bisa dipakai untuk pembelian lain.');
    if (!ok) return;
    const { error } = await App.db().from('uang_muka_pembelian').update({ terpakai: false, hpp_batch_id: null }).eq('id', id);
    if (error) { App.toast('Gagal lepas tautan: ' + error.message, 'error'); return; }
    App.toast('Tautan dilepas.', 'success');
    await this._load();
  },

  _exportUMCSV() {
    App.exportCSV(this._umData.map(r => ({
      tanggal: r.tanggal, deskripsi: r.deskripsi, jumlah: r.jumlah,
      status: r.terpakai ? 'Terpakai' : 'Belum Terpakai',
      batch_terkait: r.hpp_batches ? (r.hpp_batches.batch_no || r.hpp_batches.purchase_date || '') : '',
    })), 'uang-muka-export.csv');
  },
};
