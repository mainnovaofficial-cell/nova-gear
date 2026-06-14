/* ═══════════════════════════════════════════════════════
   Nova Gear — Penjualan Module
   3 import terpisah: Pesanan / Retur-Batal / Income
═══════════════════════════════════════════════════════ */
'use strict';

const Penjualan = {
  _tab: 'semua',
  _orders: [],
  _filter: { status: '', q: '', dateFrom: '', dateTo: '' },

  async onLoad() {
    const el = document.getElementById('page-penjualan');
    el.innerHTML = this._shell();
    await this._loadOrders();
    this._renderTab();
    this._bindFilter();
  },

  _shell() {
    return `
    <div class="page-header">
      <div>
        <h2>Penjualan</h2>
        <p>Import file Shopee atau tambah pesanan manual</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button onclick="Penjualan.openImportPesanan()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import Pesanan
        </button>
        <button onclick="Penjualan.openImportRetBatal()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v4m4-4v4"/></svg>
          Import Retur/Batal
        </button>
        <button onclick="Penjualan.openImportIncome()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Import Income
        </button>
        <button onclick="Penjualan.openManual()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Manual
        </button>
        ${App.isOwner() ? `
        <button onclick="Penjualan.hapusSemuaData()" class="btn-danger text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Hapus Semua Data
        </button>` : ''}
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-4 !py-3">
      <div class="flex flex-wrap gap-2 items-center">
        <input id="pj-search" type="text" placeholder="Cari no. pesanan / produk..." class="input w-52 !py-1.5 text-xs" oninput="Penjualan._onFilter()"/>
        <select id="pj-status" class="input w-40 !py-1.5 text-xs" onchange="Penjualan._onFilter()">
          <option value="">Semua Status</option>
          <option>Selesai</option><option>Dibatalkan</option><option>Gagal</option><option>Dikembalikan</option>
        </select>
        <input id="pj-from" type="date" class="input w-36 !py-1.5 text-xs" onchange="Penjualan._onFilter()"/>
        <input id="pj-to"   type="date" class="input w-36 !py-1.5 text-xs" onchange="Penjualan._onFilter()"/>
        <button onclick="Penjualan._resetFilter()" class="btn-secondary text-xs !py-1.5">Reset</button>
        <span id="pj-count" class="text-xs text-gray-400 ml-auto"></span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn active" onclick="Penjualan._switchTab('semua', this)">Semua Pesanan</button>
      <button class="tab-btn"        onclick="Penjualan._switchTab('status', this)">Rekap Status</button>
      <button class="tab-btn"        onclick="Penjualan._switchTab('harian', this)">Rekap Harian</button>
    </div>

    <div id="pj-tab-content"></div>`;
  },

  async _loadOrders() {
    const { data, error } = await App.db().from('orders').select('*').order('order_date', { ascending: false });
    if (error) { App.toast('Gagal memuat data pesanan.', 'error'); return; }
    this._orders = data || [];
  },

  _filtered() {
    const f = this._filter;
    return this._orders.filter(o => {
      if (f.status && o.status !== f.status) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (!(o.order_no||'').toLowerCase().includes(q) && !(o.product_name||'').toLowerCase().includes(q) && !(o.sku||'').toLowerCase().includes(q)) return false;
      }
      if (f.dateFrom && (o.order_date||'') < f.dateFrom) return false;
      if (f.dateTo   && (o.order_date||'') > f.dateTo)   return false;
      return true;
    });
  },

  _switchTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('#page-penjualan .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._renderTab();
  },

  _renderTab() {
    const data = this._filtered();
    const uniqueOrders = new Set(data.map(o => o.order_no).filter(Boolean)).size;
    const manualCount  = data.filter(o => !o.order_no).length;
    const totalPesanan = uniqueOrders + manualCount;
    document.getElementById('pj-count').textContent =
      `${totalPesanan} pesanan · ${data.length} item`;
    const el = document.getElementById('pj-tab-content');
    if (this._tab === 'semua')   el.innerHTML = this._tableSemua(data);
    if (this._tab === 'status')  el.innerHTML = this._tableStatus(data);
    if (this._tab === 'harian')  el.innerHTML = this._tableHarian(data);
  },

  _tableSemua(data) {
    if (!data.length) return `<div class="empty-state"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>Tidak ada pesanan</p></div>`;

    const statusBadge = s => {
      const m = { Selesai:'badge-green', Dibatalkan:'badge-gray', Gagal:'badge-red', Dikembalikan:'badge-orange' };
      return `<span class="badge ${m[s]||'badge-gray'}">${s||'-'}</span>`;
    };
    const deleteBtn = id => `
      <button onclick="Penjualan.deleteOrder('${id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>`;

    // Group rows by order_no, preserving sort order
    const groups = [];
    const groupMap = {};
    for (const o of data) {
      const key = o.order_no || ('manual_' + o.id);
      if (!groupMap[key]) {
        const g = { key, items: [] };
        groups.push(g);
        groupMap[key] = g;
      }
      groupMap[key].items.push(o);
    }

    const rows = groups.flatMap(g => {
      const isMulti = g.items.length > 1;
      return g.items.map((o, i) => {
        const isFirst = i === 0;
        const isLast  = i === g.items.length - 1;
        return `<tr class="${!isFirst ? 'bg-blue-50/20' : ''} ${isLast && isMulti ? 'border-b-2 border-gray-200' : ''}">
          <td class="font-mono text-xs ${isFirst ? 'text-gray-500' : 'text-gray-300 pl-4'}">
            ${isFirst
              ? (o.order_no || '<span class="text-gray-400">manual</span>') +
                (isMulti ? ` <span class="badge badge-blue">${g.items.length} item</span>` : '')
              : '└'}
          </td>
          <td class="whitespace-nowrap">${isFirst ? App.formatDate(o.order_date) : ''}</td>
          <td class="max-w-[180px] truncate" title="${o.product_name||''}">${o.product_name||'-'}</td>
          <td class="font-mono text-xs">${o.sku||'-'}</td>
          <td class="text-center">${o.qty||1}</td>
          <td class="text-money">${App.formatRupiah(o.selling_price)}</td>
          <td class="text-money">${App.formatRupiah(o.gross_revenue)}</td>
          <td class="text-money">${isFirst ? App.formatRupiah(o.net_revenue) : ''}</td>
          <td>${isFirst ? (o.expedition||'-') : ''}</td>
          <td>${isFirst ? statusBadge(o.status) : ''}</td>
          <td>${isFirst ? `<span class="badge ${o.source==='offline'?'badge-orange':'badge-blue'}">${o.source||'shopee'}</span>` : ''}</td>
          <td>${deleteBtn(o.id)}</td>
        </tr>`;
      });
    });

    return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>No. Pesanan</th><th>Tanggal</th><th>Produk</th><th>SKU</th><th>Qty</th>
          <th>Harga Jual</th><th>Subtotal</th><th>Net</th><th>Ekspedisi</th><th>Status</th><th>Sumber</th><th></th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
  },

  _tableStatus(data) {
    const map = {};
    // Track net per unique order_no to avoid double-counting multi-item orders
    const netByOrder = {};
    data.forEach(o => {
      const s   = o.status || 'Tidak Diketahui';
      const key = o.order_no || o.id;
      if (!map[s]) map[s] = { orderNos: new Set(), omzet: 0, net: 0 };
      map[s].orderNos.add(key);
      map[s].omzet += +o.gross_revenue || 0;
      if (!netByOrder[key]) {
        netByOrder[key] = +o.net_revenue || 0;
        map[s].net += netByOrder[key];
      }
    });
    const rows = Object.entries(map);
    if (!rows.length) return `<div class="empty-state"><p>Tidak ada data</p></div>`;
    const badgeMap = { Selesai:'badge-green', Dibatalkan:'badge-gray', Gagal:'badge-red', Dikembalikan:'badge-orange' };
    const totalOrders = new Set(data.map(o => o.order_no || o.id)).size;
    const totalOmzet  = data.reduce((s, o) => s + (+o.gross_revenue||0), 0);
    const totalNet    = Object.values(netByOrder).reduce((s, v) => s + v, 0);
    return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Status</th><th>Pesanan Unik</th><th>Total Item</th><th>Total Omzet</th><th>Total Net</th></tr></thead>
        <tbody>${rows.map(([s, v]) => `<tr>
          <td><span class="badge ${badgeMap[s]||'badge-gray'}">${s}</span></td>
          <td class="font-semibold">${App.formatNumber(v.orderNos.size)}</td>
          <td class="text-gray-500">${App.formatNumber([...v.orderNos].reduce((c, k) => c + data.filter(o=>(o.order_no||o.id)===k).length, 0))}</td>
          <td class="text-money">${App.formatRupiah(v.omzet)}</td>
          <td class="text-money">${App.formatRupiah(v.net)}</td>
        </tr>`).join('')}
        <tr class="font-semibold bg-gray-50">
          <td>Total</td>
          <td>${App.formatNumber(totalOrders)}</td>
          <td class="text-gray-500">${App.formatNumber(data.length)}</td>
          <td class="text-money">${App.formatRupiah(totalOmzet)}</td>
          <td class="text-money">${App.formatRupiah(totalNet)}</td>
        </tr></tbody>
      </table>
    </div>`;
  },

  _tableHarian(data) {
    const map = {};
    const netByOrder = {};
    data.forEach(o => {
      const d   = o.order_date?.slice(0,10) || 'Tanpa Tanggal';
      const key = o.order_no || o.id;
      if (!map[d]) map[d] = { orderNos: new Set(), selesaiNos: new Set(), omzet: 0, net: 0 };
      map[d].orderNos.add(key);
      map[d].omzet += +o.gross_revenue || 0;
      if (!netByOrder[key]) {
        netByOrder[key] = { d, net: +o.net_revenue || 0 };
        map[d].net += netByOrder[key].net;
      }
      if (o.status === 'Selesai') map[d].selesaiNos.add(key);
    });
    const rows = Object.entries(map).sort((a,b) => b[0].localeCompare(a[0]));
    if (!rows.length) return `<div class="empty-state"><p>Tidak ada data</p></div>`;
    return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Total Pesanan</th><th>Total Item</th><th>Selesai</th><th>Total Omzet</th><th>Total Net</th></tr></thead>
        <tbody>${rows.map(([d, v]) => `<tr>
          <td class="font-medium">${App.formatDate(d)}</td>
          <td class="font-semibold">${App.formatNumber(v.orderNos.size)}</td>
          <td class="text-gray-500">${App.formatNumber(data.filter(o=>(o.order_date?.slice(0,10)||'Tanpa Tanggal')===d).length)}</td>
          <td><span class="badge badge-green">${v.selesaiNos.size}</span></td>
          <td class="text-money">${App.formatRupiah(v.omzet)}</td>
          <td class="text-money">${App.formatRupiah(v.net)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  _onFilter() {
    this._filter.q        = document.getElementById('pj-search')?.value || '';
    this._filter.status   = document.getElementById('pj-status')?.value || '';
    this._filter.dateFrom = document.getElementById('pj-from')?.value   || '';
    this._filter.dateTo   = document.getElementById('pj-to')?.value     || '';
    this._renderTab();
  },

  _resetFilter() {
    this._filter = { status: '', q: '', dateFrom: '', dateTo: '' };
    document.getElementById('pj-search').value = '';
    document.getElementById('pj-status').value = '';
    document.getElementById('pj-from').value   = '';
    document.getElementById('pj-to').value     = '';
    this._renderTab();
  },

  _bindFilter() {},

  /* ─────────────────────────────────────────
     SHARED HELPERS
  ───────────────────────────────────────── */
  _col(row, ...keys) {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return '';
  },

  _toNum(v) {
    const s = String(v).trim();
    if (!s) return 0;
    // Format Indonesia (Shopee): titik = pemisah ribuan, koma = desimal
    // "19.837.500" → 19837500 | "1.500,50" → 1500.50
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  },

  _toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  },

  _importDropZone(inputId, accept, label, colorClass) {
    return `
    <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                hover:border-${colorClass}-300 hover:bg-${colorClass}-50/30 transition-colors"
         onclick="document.getElementById('${inputId}').click()">
      <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p class="text-sm text-gray-500">${label}</p>
    </div>`;
  },

  /* ─────────────────────────────────────────
     1. IMPORT PESANAN (xlsx — status Selesai)
  ───────────────────────────────────────── */
  openImportPesanan() {
    App.openModal({
      title: 'Import File Pesanan Shopee',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> pesanan dari Shopee Seller Center.
        Hanya baris berstatus <strong>Selesai</strong> yang diimport. Duplikat (No. Pesanan sama) dilewati.</p>
        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-4">
          <p class="font-semibold mb-1">Kolom yang dipetakan:</p>
          <p>No. Pesanan · Status Pesanan · Nomor Referensi SKU · Nama Produk · Nama Variasi</p>
          <p>Harga Setelah Diskon · Jumlah · Subtotal Pesanan · Voucher Ditanggung Penjual</p>
          <p>Total Pembayaran · Waktu Pesanan Dibuat · Opsi Pengiriman</p>
        </div>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
             onclick="document.getElementById('imp-pesanan-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .xlsx ke sini</p>
          <input id="imp-pesanan-file" type="file" accept=".xlsx,.xls" class="hidden"
                 onchange="Penjualan.importPesananFile(this.files[0])"/>
        </div>
        <div id="imp-progress" class="hidden mt-4 text-sm text-blue-600 text-center font-medium"></div>
        <div id="imp-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importPesananFile(file) {
    if (!file) return;
    const prog = document.getElementById('imp-progress');
    const res  = document.getElementById('imp-result');
    prog.textContent = 'Membaca file...';
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

      if (!rows.length) throw new Error('File kosong atau tidak dapat dibaca.');

      prog.textContent = `Memfilter baris Selesai dari ${rows.length} baris...`;

      const col    = this._col.bind(this);
      const toNum  = this._toNum.bind(this);
      const toDate = this._toDate.bind(this);

      const records = rows
        .filter(r => {
          const s = col(r, 'Status Pesanan', 'Status', 'Order Status');
          return s === 'Selesai' || s === 'Completed';
        })
        .map(r => ({
          order_no:         col(r, 'No. Pesanan', 'No Pesanan', 'Order ID'),
          sku:              col(r, 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU'),
          product_name:     col(r, 'Nama Produk', 'Product Name'),
          variation:        col(r, 'Nama Variasi', 'Variasi'),
          selling_price:    toNum(col(r, 'Harga Setelah Diskon', 'Harga Jual', 'Unit Price')),
          qty:              toNum(col(r, 'Jumlah', 'Qty', 'Quantity')) || 1,
          gross_revenue:    toNum(col(r, 'Subtotal Pesanan', 'Total Harga Setelah Diskon', 'Subtotal')),
          shopee_other_fee: toNum(col(r, 'Voucher Ditanggung Penjual', 'Voucher Seller')),
          net_revenue:      toNum(col(r, 'Total Pembayaran', 'Total Penghasilan', 'Net Revenue')),
          order_date:       toDate(col(r, 'Waktu Pesanan Dibuat', 'Tanggal Pesanan', 'Order Date')),
          expedition:       col(r, 'Opsi Pengiriman', 'Ekspedisi', 'Kurir', 'Shipping'),
          status:           'Selesai',
          source:           'shopee',
        }))
        .filter(r => r.order_no);

      if (!records.length) {
        res.innerHTML = `<p class="text-orange-700">Tidak ada pesanan berstatus <strong>Selesai</strong> di file ini.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      // Fetch existing (order_no, sku) pairs to detect duplicates by composite key
      prog.textContent = 'Mengecek duplikat di database...';
      const orderNos = [...new Set(records.map(r => r.order_no).filter(Boolean))];
      const { data: existing, error: fetchErr } = await App.db()
        .from('orders')
        .select('order_no, sku')
        .in('order_no', orderNos);
      if (fetchErr) throw fetchErr;

      const existingSet = new Set((existing || []).map(r => `${r.order_no}||${r.sku||''}`));
      const newRecords  = records.filter(r => !existingSet.has(`${r.order_no}||${r.sku||''}`));
      const skipped     = records.length - newRecords.length;

      if (!newRecords.length) {
        res.innerHTML = `<p class="text-orange-700">Semua <strong>${records.length}</strong> pesanan sudah ada di database. Tidak ada data baru.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      prog.textContent = `Menyimpan ${newRecords.length} pesanan baru...`;
      const { error } = await App.db().from('orders').insert(newRecords);
      if (error) throw error;

      const totalOmzet = newRecords.reduce((s, r) => s + r.gross_revenue, 0);
      const totalNet   = newRecords.reduce((s, r) => s + r.net_revenue,   0);

      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">✓ Import berhasil!</p>
          <p>Pesanan baru: <strong>${newRecords.length}</strong></p>
          ${skipped ? `<p>Dilewati (sudah ada): <strong>${skipped}</strong></p>` : ''}
          <p>Total Omzet: <strong>${App.formatRupiah(totalOmzet)}</strong></p>
          <p>Total Net Diterima: <strong>${App.formatRupiah(totalNet)}</strong></p>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');

      App.toast(`Import selesai: ${records.length} pesanan`, 'success');
      await this._loadOrders();
      this._renderTab();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ─────────────────────────────────────────
     2. IMPORT RETUR / BATAL (ZIP berisi 2 xlsx)
  ───────────────────────────────────────── */
  openImportRetBatal() {
    App.openModal({
      title: 'Import Retur & Batal / Gagal Kirim',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.zip</strong> dari Shopee yang berisi 2 file .xlsx
        (cancelled & failed delivery). Deteksi tipe otomatis dari header kolom.</p>
        <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 mb-4 space-y-2">
          <div>
            <p class="font-semibold">File Cancelled (Pesanan Dibatalkan) — kategori: Batal</p>
            <p class="text-amber-700">No. Pesanan · Alasan Pembatalan · SKU · Nama Produk · Subtotal Pesanan · Waktu Pesanan Dibuat</p>
          </div>
          <div>
            <p class="font-semibold">File Failed Delivery (Gagal Kirim) — kategori: Gagal Kirim</p>
            <p class="text-amber-700">No. Pesanan · Status Pengiriman · SKU · Nama Produk · Subtotal Pesanan</p>
          </div>
        </div>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
             onclick="document.getElementById('imp-ret-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v4m4-4v4"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .zip ke sini</p>
          <input id="imp-ret-file" type="file" accept=".zip" class="hidden"
                 onchange="Penjualan.importRetBatalFile(this.files[0])"/>
        </div>
        <div id="ret-progress" class="hidden mt-4 text-sm text-amber-600 text-center font-medium"></div>
        <div id="ret-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importRetBatalFile(file) {
    if (!file) return;
    const prog = document.getElementById('ret-progress');
    const res  = document.getElementById('ret-result');
    prog.textContent = 'Membaca file ZIP...';
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    try {
      if (typeof JSZip === 'undefined') throw new Error('Library JSZip belum dimuat. Coba reload halaman.');

      const zip      = await JSZip.loadAsync(file);
      const entries  = Object.values(zip.files).filter(f => !f.dir && /\.(xlsx|xls)$/i.test(f.name));

      if (!entries.length) throw new Error('Tidak ada file .xlsx di dalam ZIP.');

      const col    = this._col.bind(this);
      const toNum  = this._toNum.bind(this);
      const toDate = this._toDate.bind(this);

      let allRecords = [];

      for (const entry of entries) {
        prog.textContent = `Memproses: ${entry.name}...`;
        const buf  = await entry.async('arraybuffer');
        const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
        if (!rows.length) continue;

        // Detect type: if any header contains "Alasan" or "Pembatalan" → Batal, else → Gagal Kirim
        const headers     = Object.keys(rows[0] || {});
        const isCancelled = headers.some(h => /alasan|pembatalan|cancel/i.test(h));
        const category    = isCancelled ? 'Batal' : 'Gagal Kirim';

        const recs = rows
          .map(r => ({
            order_no:        col(r, 'No. Pesanan', 'No Pesanan', 'Order ID'),
            category,
            cancel_reason:   isCancelled
              ? col(r, 'Alasan Pembatalan', 'Cancel Reason', 'Cancellation Reason')
              : null,
            delivery_status: !isCancelled
              ? col(r, 'Status Pengiriman', 'Status pengiriman gagal', 'Delivery Status', 'Status Gagal')
              : null,
            sku:             col(r, 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU'),
            product_name:    col(r, 'Nama Produk', 'Product Name'),
            gross_revenue:   toNum(col(r, 'Subtotal Pesanan', 'Subtotal', 'Total Harga')),
            order_date:      toDate(col(r, 'Waktu Pesanan Dibuat', 'Tanggal Pesanan', 'Order Date')),
          }))
          .filter(r => r.order_no);

        allRecords.push(...recs);
      }

      if (!allRecords.length) {
        res.innerHTML = `<p class="text-orange-700">Tidak ada data valid ditemukan di file ZIP.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      prog.textContent = `Menyimpan ${allRecords.length} data ke database...`;
      const { error } = await App.db()
        .from('returns')
        .upsert(allRecords, { onConflict: 'order_no,category', ignoreDuplicates: true });
      if (error) throw error;

      const nBatal = allRecords.filter(r => r.category === 'Batal').length;
      const nGagal = allRecords.filter(r => r.category === 'Gagal Kirim').length;

      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">✓ Import berhasil!</p>
          <p>Pesanan Dibatalkan: <strong>${nBatal}</strong></p>
          <p>Gagal Kirim: <strong>${nGagal}</strong></p>
          <p>Total: <strong>${allRecords.length}</strong> data</p>
          <p class="text-xs text-gray-400 mt-1">Duplikat (No. Pesanan + kategori sama) dilewati otomatis.</p>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');

      App.toast(`Import retur/batal: ${allRecords.length} data`, 'success');

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ─────────────────────────────────────────
     3. IMPORT INCOME / PENGHASILAN (xlsx — sheet Summary)
  ───────────────────────────────────────── */
  openImportIncome() {
    const now = new Date();
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    App.openModal({
      title: 'Import File Income / Penghasilan',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> penghasilan Shopee.
        Nilai diambil dari sheet <strong>Summary / Ringkasan</strong>.</p>
        <div class="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-800 mb-4">
          <p class="font-semibold mb-1">Field yang diambil:</p>
          <p>Total Pendapatan · Voucher Penjual · Biaya Komisi AMS · Biaya Administrasi</p>
          <p>Biaya Layanan · Biaya Proses Pesanan · Premi · Total yang Dilepas</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div><label class="label">Bulan</label>
            <select id="inc-bulan" class="input">
              ${bulanNames.map((m, i) => `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
          <div><label class="label">Tahun</label>
            <input id="inc-tahun" type="number" class="input" value="${now.getFullYear()}" min="2020" max="2035"/>
          </div>
        </div>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-green-300 hover:bg-green-50/30 transition-colors"
             onclick="document.getElementById('imp-inc-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .xlsx ke sini</p>
          <input id="imp-inc-file" type="file" accept=".xlsx,.xls" class="hidden"
                 onchange="Penjualan.importIncomeFile(this.files[0])"/>
        </div>
        <div id="inc-progress" class="hidden mt-4 text-sm text-green-600 text-center font-medium"></div>
        <div id="inc-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importIncomeFile(file) {
    if (!file) return;
    const prog  = document.getElementById('inc-progress');
    const res   = document.getElementById('inc-result');
    const bulan = parseInt(document.getElementById('inc-bulan').value);
    const tahun = parseInt(document.getElementById('inc-tahun').value);

    prog.textContent = 'Membaca file...';
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });

      // Find the Summary/Ringkasan sheet
      const sheetName = wb.SheetNames.find(n => /summary|ringkasan/i.test(n)) || wb.SheetNames[0];
      const ws        = wb.Sheets[sheetName];

      // Read as raw rows (header:1) to handle non-tabular key-value layout
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      // Build a flat label→value map from any adjacent pair of non-empty cells in each row
      const valMap = {};
      for (const row of rawRows) {
        for (let i = 0; i < row.length - 1; i++) {
          const label = String(row[i]).trim();
          const value = String(row[i + 1]).trim();
          if (label && value && /\d/.test(value)) valMap[label.toLowerCase()] = value;
        }
      }

      const findVal = (...terms) => {
        for (const term of terms) {
          for (const [label, value] of Object.entries(valMap)) {
            if (label.includes(term.toLowerCase())) {
              return this._toNum(value);
            }
          }
        }
        return 0;
      };

      const record = {
        bulan,
        tahun,
        total_pendapatan:     findVal('total pendapatan', 'total revenue', 'pendapatan kotor'),
        voucher_penjual:      findVal('voucher penjual', 'seller voucher'),
        biaya_komisi_ams:     findVal('komisi ams', 'ams commission', 'biaya komisi'),
        biaya_administrasi:   findVal('biaya administrasi', 'admin fee', 'administration fee'),
        biaya_layanan:        findVal('biaya layanan', 'service fee', 'layanan'),
        biaya_proses_pesanan: findVal('biaya proses pesanan', 'processing fee', 'proses pesanan'),
        premi:                findVal('premi', 'premium'),
        total_dilepas:        findVal('total yang dilepas', 'total released', 'total dilepas'),
      };

      prog.textContent = 'Menyimpan ke database...';
      const { error } = await App.db()
        .from('income_summary')
        .upsert(record, { onConflict: 'bulan,tahun' });
      if (error) throw error;

      const bulanNames = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">✓ Income ${bulanNames[bulan]} ${tahun} berhasil disimpan!</p>
          <div class="mt-2 space-y-0.5 text-xs text-gray-700 border-t border-gray-100 pt-2">
            <p>Total Pendapatan: <strong>${App.formatRupiah(record.total_pendapatan)}</strong></p>
            <p>Voucher Penjual: <strong>${App.formatRupiah(record.voucher_penjual)}</strong></p>
            <p>Biaya Komisi AMS: <strong>${App.formatRupiah(record.biaya_komisi_ams)}</strong></p>
            <p>Biaya Administrasi: <strong>${App.formatRupiah(record.biaya_administrasi)}</strong></p>
            <p>Biaya Layanan: <strong>${App.formatRupiah(record.biaya_layanan)}</strong></p>
            <p>Biaya Proses Pesanan: <strong>${App.formatRupiah(record.biaya_proses_pesanan)}</strong></p>
            <p>Premi: <strong>${App.formatRupiah(record.premi)}</strong></p>
            <p class="font-semibold pt-1 border-t border-gray-100">Total yang Dilepas: <strong>${App.formatRupiah(record.total_dilepas)}</strong></p>
          </div>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');

      App.toast(`Income ${bulanNames[bulan]} ${tahun} berhasil diimport!`, 'success');

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ─────────────────────────────────────────
     TAMBAH MANUAL
  ───────────────────────────────────────── */
  openManual(order = null) {
    const o = order || {};
    App.openModal({
      title: order ? 'Edit Pesanan' : 'Tambah Pesanan Manual',
      size: 'max-w-2xl',
      body: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="label">No. Pesanan</label><input id="m-order-no" class="input" value="${o.order_no||''}" placeholder="Optional"/></div>
        <div><label class="label">Tanggal</label><input id="m-date" type="date" class="input" value="${o.order_date||App.todayISO()}"/></div>
        <div class="col-span-2"><label class="label">Nama Produk *</label><input id="m-name" class="input" value="${o.product_name||''}" placeholder="Nama produk"/></div>
        <div><label class="label">SKU</label><input id="m-sku" class="input" value="${o.sku||''}" placeholder="SKU"/></div>
        <div><label class="label">Variasi</label><input id="m-var" class="input" value="${o.variation||''}" placeholder="Opsional"/></div>
        <div><label class="label">Qty *</label><input id="m-qty" type="number" min="1" class="input" value="${o.qty||1}"/></div>
        <div><label class="label">Harga Jual (Rp) *</label><input id="m-price" type="number" class="input" value="${o.selling_price||''}" placeholder="0" oninput="Penjualan._calcManual()"/></div>
        <div><label class="label">Omzet / Total (Rp)</label><input id="m-gross" type="number" class="input" value="${o.gross_revenue||''}" placeholder="Otomatis dari qty × harga"/></div>
        <div><label class="label">Net Diterima (Rp)</label><input id="m-net" type="number" class="input" value="${o.net_revenue||''}" placeholder="Setelah potongan"/></div>
        <div><label class="label">Ekspedisi</label><input id="m-exp" class="input" value="${o.expedition||''}" placeholder="JNE, J&T, dll"/></div>
        <div><label class="label">Status *</label>
          <select id="m-status" class="input">
            ${['Selesai','Dibatalkan','Gagal','Dikembalikan'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div><label class="label">Sumber</label>
          <select id="m-source" class="input">
            <option value="offline" ${o.source==='offline'?'selected':''}>Offline</option>
            <option value="shopee"  ${o.source==='shopee'||!o.source?'selected':''}>Shopee</option>
          </select>
        </div>
        <div class="col-span-2"><label class="label">Catatan</label><input id="m-notes" class="input" value="${o.notes||''}" placeholder="Opsional"/></div>
      </div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Penjualan.saveManual(${order ? `'${order.id}'` : 'null'})" class="btn-primary">Simpan</button>`,
    });
  },

  _calcManual() {
    const qty   = +document.getElementById('m-qty')?.value   || 1;
    const price = +document.getElementById('m-price')?.value || 0;
    const gross = document.getElementById('m-gross');
    if (gross && !gross.value) gross.value = qty * price;
  },

  async saveManual(id) {
    const name  = document.getElementById('m-name').value.trim();
    const price = +document.getElementById('m-price').value || 0;
    if (!name || !price) { App.toast('Nama produk dan harga wajib diisi.', 'warning'); return; }

    const qty   = +document.getElementById('m-qty').value   || 1;
    const gross = +document.getElementById('m-gross').value || qty * price;
    const net   = +document.getElementById('m-net').value   || gross;

    const payload = {
      order_no:     document.getElementById('m-order-no').value.trim() || null,
      order_date:   document.getElementById('m-date').value,
      product_name: name,
      sku:          document.getElementById('m-sku').value.trim(),
      variation:    document.getElementById('m-var').value.trim(),
      qty,
      selling_price: price,
      gross_revenue: gross,
      net_revenue:   net,
      expedition:    document.getElementById('m-exp').value.trim(),
      status:        document.getElementById('m-status').value,
      source:        document.getElementById('m-source').value,
      notes:         document.getElementById('m-notes').value.trim(),
    };

    try {
      if (id) {
        const { error } = await App.db().from('orders').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await App.db().from('orders').insert(payload);
        if (error) throw error;
      }
      App.closeModal();
      App.toast('Pesanan disimpan!', 'success');
      await this._loadOrders();
      this._renderTab();
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  async deleteOrder(id) {
    const ok = await App.confirm('Hapus pesanan ini? Data tidak bisa dikembalikan.');
    if (!ok) return;
    const { error } = await App.db().from('orders').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Pesanan dihapus.', 'success');
    this._orders = this._orders.filter(o => o.id !== id);
    this._renderTab();
  },

  async hapusSemuaData() {
    if (!App.isOwner()) { App.toast('Hanya Owner yang bisa menghapus semua data.', 'warning'); return; }
    const ok = await App.confirm('Apakah Anda yakin? Semua data pesanan akan dihapus permanen dan tidak dapat dikembalikan.');
    if (!ok) return;
    try {
      const { error } = await App.db().from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      App.toast('Semua data pesanan berhasil dihapus.', 'success');
      this._orders = [];
      this._renderTab();
    } catch (err) {
      App.toast('Gagal hapus: ' + err.message, 'error');
    }
  },
};
