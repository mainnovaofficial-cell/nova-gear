/* ═══════════════════════════════════════════════════════
   Nova Gear — Penjualan Module
   3 import terpisah: Pesanan / Retur-Batal / Income
   + Manajemen stok: stok_action per pesanan
   + Section "Perlu Direview" untuk Owner
═══════════════════════════════════════════════════════ */
'use strict';

const Penjualan = {
  _tab: 'semua',
  _orders: [],
  _filter: { status: '', q: '', dateFrom: '', dateTo: '' },
  _harianDate: '',

  async onLoad() {
    const el = document.getElementById('page-penjualan');
    el.innerHTML = `<div class="p-8 text-center text-gray-400 text-sm">Memuat data pesanan...</div>`;
    await this._loadOrders();
    el.innerHTML = this._shell();
    this._renderTab();
    this._updateReviewBadge();
  },

  _shell() {
    return `
    <div class="page-header">
      <div>
        <h2>Penjualan</h2>
        <p>Import file Shopee atau tambah pesanan manual</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button onclick="Penjualan.openImportHarian()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import Harian
        </button>
        <button onclick="Penjualan.openImportMingguan()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Import Mingguan
        </button>
        <button onclick="Penjualan.openImportReturLengkap()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v4m4-4v4"/></svg>
          Import Retur Lengkap
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
        <button onclick="Penjualan.openHapusPeriode()" class="btn-danger text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Hapus Data Periode
        </button>` : ''}
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-4 !py-3">
      <div class="flex flex-wrap gap-2 items-center">
        <input id="pj-search" type="text" placeholder="Cari no. pesanan / produk / SKU..." class="input w-56 !py-1.5 text-xs" oninput="Penjualan._onFilter()"/>
        <select id="pj-status" class="input w-44 !py-1.5 text-xs" onchange="Penjualan._onFilter()">
          <option value="">Semua Status</option>
          <option>Diproses</option>
          <option>Selesai</option>
          <option>Dibayar</option>
          <option>Gagal Kirim</option>
          <option>Batal</option>
          <option>Retur</option>
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
      <button class="tab-btn"        onclick="Penjualan._switchTab('review', this)">
        Perlu Direview
        <span id="pj-review-badge" class="hidden ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">0</span>
      </button>
      <button class="tab-btn"        onclick="Penjualan._switchTab('batal', this)">
        Batal
        <span id="pj-batal-badge" class="hidden ml-1.5 bg-gray-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">0</span>
      </button>
    </div>

    <div id="pj-tab-content"></div>`;
  },

  async _loadOrders() {
    const { data, error } = await App.db().from('orders').select('*').order('order_date', { ascending: false });
    if (error) { App.toast('Gagal memuat data pesanan.', 'error'); return; }
    this._orders = data || [];
  },

  _updateReviewBadge() {
    const badge = document.getElementById('pj-review-badge');
    if (badge) {
      const count = this._orders.filter(o =>
        ['menunggu_barang_kembali', 'perlu_review', 'sudah_keluar_tidak_balik'].includes(o.stok_action)
      ).length;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
    const batalBadge = document.getElementById('pj-batal-badge');
    if (batalBadge) {
      const n = this._orders.filter(o => o.status === 'Batal').length;
      batalBadge.textContent = n;
      batalBadge.classList.toggle('hidden', n === 0);
    }
  },

  _filtered() {
    const f = this._filter;
    return this._orders.filter(o => {
      if (f.status && o.status !== f.status) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (!(o.order_no||'').toLowerCase().includes(q) &&
            !(o.product_name||'').toLowerCase().includes(q) &&
            !(o.sku||'').toLowerCase().includes(q)) return false;
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
    document.getElementById('pj-count').textContent = `${totalPesanan} pesanan · ${data.length} item`;
    const el = document.getElementById('pj-tab-content');
    if (this._tab === 'semua')   el.innerHTML = this._tableSemua(data);
    if (this._tab === 'status')  el.innerHTML = this._tableStatus(data);
    if (this._tab === 'harian')  el.innerHTML = this._tableHarian(data);
    if (this._tab === 'review')  el.innerHTML = this._tableReview();
    if (this._tab === 'batal')   el.innerHTML = this._tableBatal();
  },

  /* ── STATUS & STOK HELPERS ── */

  // Petakan status Shopee mentah → 4 status internal Nova Gear (Diproses/Selesai/Gagal Kirim/Batal).
  // "Dibayar" TIDAK pernah dihasilkan di sini — itu hanya diset oleh Import Income
  // (lihat importIncomeFile), khusus untuk pesanan yang sudah berstatus "Selesai".
  // Return null berarti baris harus dilewati (mis. Menunggu Pembayaran, Dikembalikan).
  _mapStatus(shopeeStatus, cancelReason) {
    const s = (shopeeStatus || '').toLowerCase().trim();
    const r = (cancelReason  || '').toLowerCase().trim();

    // Dilewati / skip — tidak diimport
    if (s.includes('menunggu pembayaran') || s.includes('belum dibayar') || s.includes('dikembalikan')) return null;

    // Gagal Kirim — dicek sebelum Batal karena di Shopee ini sering tampil sebagai "Batal" + alasan
    if (s.includes('gagal kirim') || s.includes('pengiriman gagal') ||
        r.includes('pengiriman gagal') || r.includes('gagal dikirim')) return 'Gagal Kirim';

    // Batal (selain yang sudah ditangani sebagai Gagal Kirim di atas)
    if (s.includes('batal')) return 'Batal';

    // Selesai — termasuk status panjang seperti
    // "Pesanan diterima, namun Pembeli masih dapat mengajukan pengembalian hingga ..."
    if (s.includes('selesai') || s.includes('pesanan diterima') || s.includes('diterima pembeli')) return 'Selesai';

    // Diproses
    if (s.includes('perlu dikirim') || s.includes('sedang dikirim') ||
        s.includes('telah dikirim') || s.includes('dalam pengiriman') ||
        s === 'diproses') return 'Diproses';

    return null; // status tidak dikenali — lewati
  },

  // Tentukan dampak stok berdasarkan status internal (bukan status Shopee mentah).
  _determineStokAction(internalStatus, cancelReason) {
    if (internalStatus === 'Diproses' || internalStatus === 'Selesai') return 'keluar';
    if (internalStatus === 'Gagal Kirim') return 'menunggu_barang_kembali';
    if (internalStatus === 'Batal') {
      const r = (cancelReason || '').toLowerCase();
      if (r.includes('paket hilang') || r.includes('package lost') || r.includes('hilang')) return 'sudah_keluar_tidak_balik';
      return 'tidak_berubah';
    }
    return 'tidak_berubah';
  },

  _stokActionBadge(action) {
    const map = {
      keluar:                   ['badge-red',    'Stok Keluar'],
      tidak_berubah:            ['badge-gray',   'Stok Tetap'],
      sudah_keluar_tidak_balik: ['badge-orange', 'Paket Hilang'],
      menunggu_barang_kembali:  ['badge-yellow', 'Tunggu Retur'],
      barang_kembali:           ['badge-green',  'Barang Kembali'],
      perlu_review:             ['badge-blue',   'Perlu Review'],
      kompensasi_selesai:       ['badge-green',  'Kompensasi OK'],
    };
    if (!action) return '';
    const [cls, lbl] = map[action] || ['badge-gray', action];
    return `<span class="badge ${cls} text-xs">${lbl}</span>`;
  },

  /* ── TAB: SEMUA PESANAN ── */
  _tableSemua(data) {
    if (!data.length) return `<div class="empty-state"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>Tidak ada pesanan</p></div>`;

    const statusBadge = s => {
      const m = { Selesai:'badge-green', Dibayar:'badge-emerald', Diproses:'badge-blue', 'Gagal Kirim':'badge-red', Batal:'badge-gray', Retur:'badge-orange' };
      return `<span class="badge ${m[s]||'badge-gray'}">${s||'-'}</span>`;
    };
    const batalBtn = (id, status) => status === 'Batal' ? '' : `
      <button onclick="Penjualan.batalkanOrder('${id}')"
              class="text-xs text-orange-400 hover:text-orange-600 transition-colors font-medium whitespace-nowrap">
        Batalkan
      </button>`;
    const editBtn = (o) => `
      <button onclick="Penjualan.openEditManual('${o.id}')"
              class="text-xs text-blue-400 hover:text-blue-600 transition-colors font-medium whitespace-nowrap">
        Edit
      </button>`;

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
          <td>${isFirst ? (o.expedition||'-') : ''}</td>
          <td>${isFirst ? statusBadge(o.status) : ''}</td>
          <td>${isFirst ? this._stokActionBadge(o.stok_action) : ''}</td>
          <td>${isFirst ? `<span class="badge ${o.source==='offline'?'badge-orange':'badge-blue'}">${o.source||'shopee'}</span>` : ''}</td>
          <td>${isFirst ? batalBtn(o.id, o.status) : ''} ${editBtn(o)}</td>
        </tr>`;
      });
    });

    return `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>No. Pesanan</th><th>Tanggal</th><th>Produk</th><th>SKU</th><th>Qty</th>
          <th>Harga Jual</th><th>Ekspedisi</th>
          <th>Status</th><th>Stok</th><th>Sumber</th><th></th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
  },

  /* ── TAB: REKAP STATUS ── */
  _tableStatus(data) {
    const map = {};
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
    const badgeMap = { Selesai:'badge-green', Dibayar:'badge-emerald', Diproses:'badge-blue', 'Gagal Kirim':'badge-red', Batal:'badge-gray', Retur:'badge-orange' };
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

  /* ── TAB: REKAP HARIAN ── */
  _tableHarian(_data) {
    const today = App.todayISO();
    if (!this._harianDate) this._harianDate = today;
    const sel  = this._harianDate;

    // Previous day
    const prevD = new Date(sel + 'T12:00:00');
    prevD.setDate(prevD.getDate() - 1);
    const prev = prevD.toISOString().slice(0, 10);

    const dayAll  = this._orders.filter(o => (o.order_date || '').slice(0, 10) === sel);
    const prevAll = this._orders.filter(o => (o.order_date || '').slice(0, 10) === prev);

    // Total Pesanan = unique order_no
    const uniqueNos = new Set(dayAll.map(o  => o.order_no || o.id));
    const prevNos   = new Set(prevAll.map(o => o.order_no || o.id));

    // Total Item = sum of qty
    const totalQty = dayAll.reduce((s, o)  => s + (+o.qty || 1), 0);
    const prevQty  = prevAll.reduce((s, o) => s + (+o.qty || 1), 0);

    const diffOrders = uniqueNos.size - prevNos.size;
    const diffQty    = totalQty - prevQty;

    const diffColor = n => n > 0 ? 'text-green-600' : n < 0 ? 'text-red-500' : 'text-gray-400';
    const arrow     = n => n > 0 ? '↑' : n < 0 ? '↓' : '→';
    const sign      = n => n > 0 ? '+' : '';

    const statusBadge = s => {
      const m = { Selesai:'badge-green', Dibayar:'badge-emerald', Diproses:'badge-blue', 'Gagal Kirim':'badge-red', Batal:'badge-gray', Retur:'badge-orange' };
      return `<span class="badge ${m[s]||'badge-gray'}">${s||'-'}</span>`;
    };

    const tableHtml = dayAll.length === 0
      ? `<div class="empty-state card py-12 mt-4"><p>Tidak ada pesanan dengan tanggal ini.</p></div>`
      : `<div class="table-wrapper mt-4">
          <table class="data-table">
            <thead><tr>
              <th>No. Pesanan</th><th>Produk</th><th>SKU</th>
              <th class="text-center">Qty</th><th>Status</th>
            </tr></thead>
            <tbody>${dayAll.map(o => `<tr>
              <td class="font-mono text-xs text-gray-500">${o.order_no || 'manual'}</td>
              <td class="max-w-[200px] truncate text-sm" title="${o.product_name||''}">${o.product_name||'-'}</td>
              <td class="font-mono text-xs">${o.sku||'-'}</td>
              <td class="text-center font-semibold">${o.qty||1}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

    return `
    <div class="card mt-4 !py-3">
      <div class="flex flex-wrap gap-3 items-center">
        <label class="text-sm font-medium text-gray-600">Tanggal Pesanan:</label>
        <input type="date" value="${sel}" max="${today}" class="input w-40 !py-1.5 text-xs"
               onchange="Penjualan._setHarianDate(this.value)"/>
        ${sel !== today ? `<button onclick="Penjualan._setHarianDate('${today}')" class="btn-secondary text-xs !py-1.5">Hari Ini</button>` : ''}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mt-4" style="max-width:480px">
      <div class="stat-card">
        <p class="stat-label">Total Pesanan</p>
        <p class="text-2xl font-bold text-gray-800">${uniqueNos.size}</p>
        <p class="text-xs mt-1 font-medium ${diffColor(diffOrders)}">
          ${arrow(diffOrders)} ${sign(diffOrders)}${diffOrders} vs hari sebelumnya
        </p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Total Item (Qty)</p>
        <p class="text-2xl font-bold text-gray-800">${totalQty}</p>
        <p class="text-xs mt-1 font-medium ${diffColor(diffQty)}">
          ${arrow(diffQty)} ${sign(diffQty)}${diffQty} vs hari sebelumnya
        </p>
      </div>
    </div>

    ${tableHtml}`;
  },

  _setHarianDate(d) {
    this._harianDate = d;
    this._renderTab();
  },

  /* ── TAB: PERLU DIREVIEW ── */
  _tableReview() {
    const REVIEW_ACTIONS = ['menunggu_barang_kembali', 'perlu_review', 'sudah_keluar_tidak_balik'];
    const items = this._orders.filter(o => REVIEW_ACTIONS.includes(o.stok_action));

    if (!items.length) return `
      <div class="empty-state card py-16">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-gray-300 mx-auto mb-3">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-gray-500">Tidak ada pesanan yang perlu direview.</p>
      </div>`;

    const menunggu   = items.filter(o => o.stok_action === 'menunggu_barang_kembali');
    const perlu      = items.filter(o => o.stok_action === 'perlu_review');
    const hilang     = items.filter(o => o.stok_action === 'sudah_keluar_tidak_balik');

    const section = (title, color, desc, rows) => !rows.length ? '' : `
      <div class="card mb-4">
        <div class="flex items-start gap-3 mb-3">
          <div class="w-2 h-2 rounded-full bg-${color}-400 mt-2 flex-shrink-0"></div>
          <div>
            <h3 class="font-semibold text-gray-800">${title} <span class="badge badge-gray ml-1">${rows.length}</span></h3>
            <p class="text-xs text-gray-500 mt-0.5">${desc}</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>No. Pesanan</th><th>Tanggal</th><th>Produk</th><th>SKU</th><th class="text-center">Qty</th>
              <th>Alasan</th>${App.isOwner() ? '<th>Aksi</th>' : ''}
            </tr></thead>
            <tbody>${rows.map(o => `<tr>
              <td class="font-mono text-xs text-gray-500">${o.order_no||'manual'}</td>
              <td class="whitespace-nowrap text-sm">${App.formatDate(o.order_date)}</td>
              <td class="max-w-[160px] truncate text-sm" title="${o.product_name||''}">${o.product_name||'-'}</td>
              <td class="font-mono text-xs">${o.sku||'-'}</td>
              <td class="text-center font-semibold">${o.qty||1}</td>
              <td class="text-xs text-gray-500 max-w-[200px] truncate" title="${o.cancel_reason||''}">${o.cancel_reason||'-'}</td>
              ${App.isOwner() ? `<td>${this._reviewActions(o)}</td>` : ''}
            </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    return `
    <div class="mt-2">
      ${section(
        'Menunggu Barang Kembali', 'yellow',
        'Pengiriman gagal — konfirmasi apakah barang sudah kembali ke gudang.',
        menunggu
      )}
      ${section(
        'Perlu Review', 'blue',
        'Alasan pembatalan tidak dikenali — Owner perlu menentukan dampak stok.',
        perlu
      )}
      ${section(
        'Paket Hilang — Perlu Catat Kompensasi', 'orange',
        'Stok sudah keluar dan tidak kembali. Catat sebagai Pemasukan Kompensasi.',
        hilang
      )}
    </div>`;
  },

  /* ── TAB: BATAL ── */
  _tableBatal() {
    const items = this._orders.filter(o => o.status === 'Batal')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    if (!items.length) return `
      <div class="empty-state card py-16 mt-4">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-gray-300 mx-auto mb-3">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-gray-500">Tidak ada pesanan batal.</p>
      </div>`;

    return `
    <div class="table-wrapper mt-4">
      <table class="data-table">
        <thead><tr>
          <th>No. Pesanan</th><th>Tanggal</th><th>Produk</th><th>SKU</th>
          <th class="text-center">Qty</th><th>Alasan</th><th>Stok</th>
        </tr></thead>
        <tbody>${items.map(o => `<tr>
          <td class="font-mono text-xs text-gray-500">${o.order_no || 'manual'}</td>
          <td class="whitespace-nowrap text-sm">${App.formatDate(o.order_date)}</td>
          <td class="max-w-[180px] truncate text-sm" title="${o.product_name||''}">${o.product_name||'-'}</td>
          <td class="font-mono text-xs">${o.sku||'-'}</td>
          <td class="text-center font-semibold">${o.qty||1}</td>
          <td class="text-xs text-gray-500 max-w-[200px] truncate" title="${o.cancel_reason||''}">${o.cancel_reason||'-'}</td>
          <td>${this._stokActionBadge(o.stok_action)}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  /* ── BATALKAN PESANAN (per baris) ── */
  async batalkanOrder(id) {
    const order = this._orders.find(o => o.id === id);
    if (!order) return;

    const msg = `Batalkan pesanan ${order.order_no || 'ini'} (SKU: ${order.sku||'-'}, ${order.qty||1} unit)?\nStok akan otomatis dikembalikan.`;
    const ok = await App.confirm(msg);
    if (!ok) return;

    const { error } = await App.db().from('orders').update({
      status: 'Batal',
      stok_action: 'tidak_berubah',
    }).eq('id', id);

    if (error) { App.toast('Gagal membatalkan: ' + error.message, 'error'); return; }

    App.toast('Pesanan dibatalkan. Stok dikembalikan.', 'success');
    const idx = this._orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      this._orders[idx].status = 'Batal';
      this._orders[idx].stok_action = 'tidak_berubah';
    }
    this._updateReviewBadge();
    this._renderTab();
  },

  _reviewActions(o) {
    if (o.stok_action === 'menunggu_barang_kembali') {
      return `
        <div class="flex gap-1">
          <button onclick="Penjualan.confirmReview('${o.id}','barang_kembali')"
                  class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium whitespace-nowrap">
            Barang Kembali
          </button>
          <button onclick="Penjualan.confirmReview('${o.id}','tidak_kembali')"
                  class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium whitespace-nowrap">
            Tidak Kembali
          </button>
        </div>`;
    }
    if (o.stok_action === 'perlu_review') {
      return `
        <div class="flex gap-1">
          <button onclick="Penjualan.confirmReview('${o.id}','stok_keluar')"
                  class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium whitespace-nowrap">
            Stok Keluar
          </button>
          <button onclick="Penjualan.confirmReview('${o.id}','stok_tetap')"
                  class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium whitespace-nowrap">
            Stok Tetap
          </button>
        </div>`;
    }
    if (o.stok_action === 'sudah_keluar_tidak_balik') {
      return `
        <button onclick="Penjualan.confirmReview('${o.id}','kompensasi_selesai')"
                class="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium whitespace-nowrap">
          Catat Kompensasi
        </button>`;
    }
    return '';
  },

  async confirmReview(id, action) {
    if (!App.isOwner()) { App.toast('Hanya Owner yang dapat konfirmasi.', 'warning'); return; }

    const order = this._orders.find(o => o.id === id);
    if (!order) return;

    const confirmMap = {
      barang_kembali:      `Konfirmasi barang SKU ${order.sku} (${order.qty} unit) sudah kembali ke gudang? Stok akan dikembalikan.`,
      tidak_kembali:       `Konfirmasi barang SKU ${order.sku} TIDAK kembali? Stok tetap keluar.`,
      stok_keluar:         `Set stok SKU ${order.sku} (${order.qty} unit) sebagai KELUAR?`,
      stok_tetap:          `Set stok SKU ${order.sku} TIDAK BERUBAH (stok tidak dikurangi)?`,
      kompensasi_selesai:  `Tandai pesanan ${order.order_no||'manual'} sebagai sudah dicatat kompensasi di laporan keuangan?`,
    };

    const ok = await App.confirm(confirmMap[action] || 'Konfirmasi aksi ini?');
    if (!ok) return;

    const newActionMap = {
      barang_kembali:     'barang_kembali',
      tidak_kembali:      'sudah_keluar_tidak_balik',
      stok_keluar:        'keluar',
      stok_tetap:         'tidak_berubah',
      kompensasi_selesai: 'kompensasi_selesai',
    };

    const newAction = newActionMap[action];
    if (!newAction) return;

    const updatePayload = { stok_action: newAction };
    if (action === 'kompensasi_selesai') {
      updatePayload.notes = (order.notes ? order.notes + ' | ' : '') +
        `Kompensasi dicatat pada ${App.todayISO()} oleh Owner`;
    }

    const { error } = await App.db().from('orders').update(updatePayload).eq('id', id);
    if (error) { App.toast('Gagal menyimpan: ' + error.message, 'error'); return; }

    const msgMap = {
      barang_kembali:     'Barang dikonfirmasi kembali. Stok dipulihkan.',
      tidak_kembali:      'Dikonfirmasi: barang tidak kembali. Stok tetap keluar.',
      stok_keluar:        'Stok dikurangi untuk pesanan ini.',
      stok_tetap:         'Stok tidak berubah untuk pesanan ini.',
      kompensasi_selesai: 'Kompensasi berhasil dicatat.',
    };
    App.toast(msgMap[action] || 'Berhasil disimpan.', 'success');

    // Update local state
    const idx = this._orders.findIndex(o => o.id === id);
    if (idx !== -1) this._orders[idx].stok_action = newAction;

    this._updateReviewBadge();
    this._renderTab();
  },

  /* ── FILTER ── */
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

  /* ── SHARED HELPERS ── */
  _col(row, ...keys) {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return '';
  },

  _toNum(v) {
    const s = String(v).trim();
    if (!s) return 0;
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

  /* ═══════════════════════════════════════════════
     1a. IMPORT HARIAN — Perlu Dikirim (insert baru)
  ═══════════════════════════════════════════════ */
  openImportHarian() {
    App.openModal({
      title: 'Import Harian — Perlu Dikirim',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> Perlu Dikirim dari Shopee Seller Center.
        Tambah pesanan baru &amp; kurangi stok. Pesanan yang sudah ada di database dilewati.</p>
        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-3 space-y-1">
          <p class="font-semibold">Pemetaan status Shopee → Nova Gear:</p>
          <p>• Perlu Dikirim / Sedang Dikirim / Telah Dikirim → <strong>Diproses</strong> (stok keluar)</p>
          <p>• Selesai / Pesanan Diterima → <strong>Selesai</strong> (stok keluar)</p>
          <p>• Batal (pengiriman gagal) → <strong>Gagal Kirim</strong> (tunggu barang kembali)</p>
          <p>• Batal (alasan lain) → <strong>Batal</strong> (stok tetap)</p>
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
                 onchange="Penjualan.importPesananFile(this.files[0], 'harian')"/>
        </div>
        <div id="imp-progress" class="hidden mt-4 text-sm text-blue-600 text-center font-medium"></div>
        <div id="imp-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  /* ═══════════════════════════════════════════════
     1b. IMPORT MINGGUAN — semua pesanan (update status)
  ═══════════════════════════════════════════════ */
  openImportMingguan() {
    App.openModal({
      title: 'Import Mingguan — Update Status',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> semua pesanan dari Shopee Seller Center.
        Update status pesanan yang sudah ada. Pesanan baru tidak ditambahkan.</p>
        <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 mb-3 space-y-1">
          <p class="font-semibold">Yang terjadi saat import mingguan:</p>
          <p>• Diproses → Selesai: status &amp; stok diperbarui</p>
          <p>• Diproses → Gagal Kirim: ditandai menunggu barang kembali</p>
          <p>• Diproses → Batal: stok otomatis dikembalikan</p>
          <p>• Pesanan baru di file ini akan dilewati</p>
        </div>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
             onclick="document.getElementById('imp-pesanan-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .xlsx ke sini</p>
          <input id="imp-pesanan-file" type="file" accept=".xlsx,.xls" class="hidden"
                 onchange="Penjualan.importPesananFile(this.files[0], 'mingguan')"/>
        </div>
        <div id="imp-progress" class="hidden mt-4 text-sm text-amber-600 text-center font-medium"></div>
        <div id="imp-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importPesananFile(file, mode = 'harian') {
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

      const col    = this._col.bind(this);
      const toNum  = this._toNum.bind(this);
      const toDate = this._toDate.bind(this);

      prog.textContent = `Memproses ${rows.length} baris...`;

      // Parse semua baris, petakan ke 4 status internal, lewati status tidak relevan
      const records = rows
        .map(r => {
          const shopeeStatus       = col(r, 'Status Pesanan', 'Status', 'Order Status');
          const cancelReason       = col(r, 'Alasan Pembatalan', 'Alasan Pembatalan Pesanan', 'Cancel Reason', 'Cancellation Reason');
          const cancelReturnStatus = col(r, 'Status Pembatalan/Pengembalian', 'Cancellation/Return Status', 'Return Status');
          const returnedQty        = toNum(col(r, 'Returned quantity', 'Jumlah Dikembalikan', 'Returned Qty'));

          let status = this._mapStatus(shopeeStatus, cancelReason);
          if (!status) return null; // Menunggu Pembayaran, dll → lewati

          // Pesanan "Selesai" yang punya retur aktif → override ke Retur, masuk Perlu Direview
          const isRetur = status === 'Selesai' && cancelReturnStatus && returnedQty > 0;
          if (isRetur) status = 'Retur';

          return {
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
            status,
            cancel_reason:    isRetur ? cancelReturnStatus : (cancelReason || null),
            source:           'shopee',
            stok_action:      isRetur ? 'menunggu_barang_kembali' : this._determineStokAction(status, cancelReason),
          };
        })
        .filter(r => r && r.order_no);

      if (!records.length) {
        res.innerHTML = `<p class="text-orange-700">Tidak ada data pesanan valid di file ini.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      // ── Fetch existing records (batch 100) — ambil juga status untuk deteksi perubahan
      const orderNos   = [...new Set(records.map(r => r.order_no))];
      const existingMap = new Map(); // "order_no||sku" → { status }
      const BATCH = 100;
      for (let i = 0; i < orderNos.length; i += BATCH) {
        const chunk = orderNos.slice(i, i + BATCH);
        prog.textContent = `Mengecek database... (${Math.min(i + BATCH, orderNos.length)}/${orderNos.length})`;
        const { data: existing, error: fetchErr } = await App.db()
          .from('orders')
          .select('order_no, sku, status')
          .in('order_no', chunk);
        if (fetchErr) throw new Error(`Gagal cek database: ${fetchErr.message}${fetchErr.details ? ' — ' + fetchErr.details : ''}`);
        (existing || []).forEach(r => existingMap.set(`${r.order_no}||${r.sku||''}`, { status: r.status }));
      }

      // ── Pisahkan: insert baru vs update status yang berubah
      const toInsert = [];
      // toUpdateGroups: key = "newStatus__stokAction" → { fields, orderNos[] }
      // Di-group agar banyak order_no bisa diupdate dalam satu .in() call
      const toUpdateGroups = {};

      for (const r of records) {
        const key      = `${r.order_no}||${r.sku||''}`;
        const existing = existingMap.get(key);
        if (!existing) {
          toInsert.push(r);
        } else if (existing.status !== r.status) {
          const groupKey = `${r.status}__${r.stok_action || ''}`;
          if (!toUpdateGroups[groupKey]) {
            toUpdateGroups[groupKey] = {
              fields:   { status: r.status, stok_action: r.stok_action, cancel_reason: r.cancel_reason },
              orderNos: new Set(),
            };
          }
          toUpdateGroups[groupKey].orderNos.add(r.order_no);
        }
        // status sama → tidak perlu apa-apa
      }

      // ── Insert baru (harian only, batch 200)
      let migrationWarning = false;
      let insertError = null;
      if (mode === 'harian') {
        const INSERT_BATCH = 200;
        for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
          const batch = toInsert.slice(i, i + INSERT_BATCH);
          prog.textContent = `Menyimpan pesanan baru... (${Math.min(i + INSERT_BATCH, toInsert.length)}/${toInsert.length})`;
          let { error } = await App.db().from('orders').upsert(batch, { onConflict: 'order_no,sku' });

          // Fallback 1: kolom stok_action / cancel_reason belum ada (migrasi v3 belum dijalankan)
          let batchToUse = batch;
          if (error && (error.message === 'Bad Request' ||
              (error.message || '').includes('stok_action') ||
              (error.message || '').includes('cancel_reason'))) {
            const stripped = batch.map(({ cancel_reason, stok_action, ...rec }) => rec);
            ({ error } = await App.db().from('orders').upsert(stripped, { onConflict: 'order_no,sku' }));
            batchToUse = stripped;
            migrationWarning = true;
          }
          // Fallback 2: unique constraint (order_no,sku) belum aktif di PostgREST →
          // plain INSERT aman karena toInsert sudah difilter ke record yang benar-benar baru
          if (error && error.code === '42P10') {
            ({ error } = await App.db().from('orders').insert(batchToUse));
          }
          if (error) { insertError = error; break; }
        }
        if (insertError) throw new Error(`Gagal insert: ${insertError.message}${insertError.details ? ' — ' + insertError.details : ''} (kode: ${insertError.code || '-'})`);
      }

      // ── Update status yang berubah (mingguan only, batch 100 order_no per request)
      let totalUpdated = 0;
      if (mode === 'mingguan') {
        const updateGroupList = Object.values(toUpdateGroups);
        for (const group of updateGroupList) {
          const nos = [...group.orderNos];
          for (let i = 0; i < nos.length; i += BATCH) {
            const chunk = nos.slice(i, i + BATCH);
            prog.textContent = `Mengupdate status... (${totalUpdated + chunk.length} order)`;
            const { error: updErr } = await App.db()
              .from('orders')
              .update(group.fields)
              .in('order_no', chunk);
            if (updErr) throw new Error(`Gagal update status: ${updErr.message}`);
            totalUpdated += chunk.length;
          }
        }
      }

      // ── Tampilkan hasil
      if (mode === 'harian') {
        const countByStatus = s => toInsert.filter(r => r.status === s).length;
        const nDiproses  = countByStatus('Diproses');
        const nSelesai   = countByStatus('Selesai');
        const nGagal     = countByStatus('Gagal Kirim');
        const nBatal     = countByStatus('Batal');
        const totalOmzet = toInsert.reduce((s, r) => s + r.gross_revenue, 0);
        const nReview    = toInsert.filter(r => r.stok_action === 'sudah_keluar_tidak_balik').length;
        res.innerHTML = `
          <div class="space-y-1">
            <p class="font-semibold text-green-700">Import Harian selesai!</p>
            <p class="text-xs text-gray-600">Pesanan baru ditambahkan: <strong>${toInsert.length}</strong></p>
            ${migrationWarning ? `
            <div class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <strong>Migrasi v3 belum dijalankan</strong> — fitur stok_action tidak aktif.
            </div>` : `
            <div class="mt-2 text-xs space-y-0.5 border-t border-gray-100 pt-2">
              ${nDiproses ? `<p><span class="font-medium text-blue-700">Diproses:</span> ${nDiproses}</p>` : ''}
              ${nSelesai  ? `<p><span class="font-medium text-green-700">Selesai:</span> ${nSelesai}</p>` : ''}
              ${nGagal    ? `<p><span class="font-medium text-red-600">Gagal Kirim:</span> ${nGagal}</p>` : ''}
              ${nBatal    ? `<p><span class="font-medium text-gray-500">Batal:</span> ${nBatal}</p>` : ''}
              ${nReview   ? `<p class="text-orange-600 font-semibold">Paket Hilang: ${nReview}</p>` : ''}
            </div>`}
            <p class="text-xs text-gray-500 pt-1">Total Omzet baru: ${App.formatRupiah(totalOmzet)}</p>
          </div>`;
        App.toast(`Import Harian: ${toInsert.length} pesanan baru`, 'success');
      } else {
        const updatesByStatus = {};
        for (const g of Object.values(toUpdateGroups)) {
          const s = g.fields.status;
          updatesByStatus[s] = (updatesByStatus[s] || 0) + g.orderNos.size;
        }
        const uRows = Object.entries(updatesByStatus);
        const badgeMap = { Selesai:'text-green-700', Diproses:'text-blue-700', 'Gagal Kirim':'text-red-600', Batal:'text-gray-500' };
        res.innerHTML = `
          <div class="space-y-1">
            <p class="font-semibold text-green-700">Import Mingguan selesai!</p>
            <p class="text-xs text-gray-600">Status diperbarui: <strong>${totalUpdated}</strong> pesanan</p>
            ${uRows.length ? `<div class="mt-2 text-xs space-y-0.5 border-t border-gray-100 pt-2">
              ${uRows.map(([s, n]) => `<p><span class="font-medium ${badgeMap[s]||'text-gray-600'}">${s}:</span> ${n}</p>`).join('')}
            </div>` : `<p class="text-xs text-gray-400 mt-1">Tidak ada perubahan status.</p>`}
          </div>`;
        App.toast(`Import Mingguan: ${totalUpdated} status diperbarui`, 'success');
      }

      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');

      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-red-600">Import gagal</p>
          <p class="text-red-700 text-xs whitespace-pre-wrap">${err.message}</p>
          ${err.message === 'Bad Request' || (err.message || '').includes('stok_action') ? `
          <p class="text-xs text-orange-700 mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
            Kemungkinan penyebab: kolom <strong>cancel_reason</strong> dan <strong>stok_action</strong>
            belum ada di database. Jalankan <strong>SQL Migrasi v3</strong> di Supabase SQL Editor terlebih dahulu.
          </p>` : ''}
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ═══════════════════════════════════════════════
     2. IMPORT RETUR LENGKAP (3 slot xlsx terpisah)
  ═══════════════════════════════════════════════ */
  openImportReturLengkap() {
    const slot = (num, title, path, cols) => `
      <div class="border border-gray-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">${num}</span>
          <span class="font-medium text-sm text-gray-800">${title}</span>
          <span class="text-xs text-gray-400 ml-auto">opsional</span>
        </div>
        <p class="text-xs text-gray-400 mb-0.5 pl-7">Shopee → Pengembalian/Pembatalan → <strong>${path}</strong> → Export</p>
        <p class="text-xs text-gray-500 mb-3 pl-7">Kolom: ${cols}</p>
        <div class="border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2 cursor-pointer
                    hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
             onclick="document.getElementById('ret-file-${num}').click()">
          <svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-xs" id="ret-file-${num}-name"><span class="text-gray-400">Klik untuk pilih file .xlsx</span></p>
        </div>
        <input id="ret-file-${num}" type="file" accept=".xlsx,.xls" class="hidden"
               onchange="Penjualan._setRetFileName(${num}, this)"/>
      </div>`;
    App.openModal({
      title: 'Import Retur Lengkap',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-4">Upload 1, 2, atau 3 file sekaligus. Semua slot opsional — upload file yang tersedia lalu klik <strong>Proses Semua</strong>.</p>
        <div class="space-y-3">
          ${slot(1, 'Pembatalan (Order Cancellation)', 'Pembatalan', 'No. Pesanan, Alasan Pembatalan, SKU Induk, Nama Produk')}
          ${slot(2, 'Pengiriman Gagal (Order Failed Delivery)', 'Pengiriman Gagal', 'No. Pesanan, Status pengiriman gagal, SKU')}
          ${slot(3, 'Pengembalian Barang/Dana (Order Return Refund)', 'Pengembalian Barang/Dana', 'No. Pesanan, SKU Induk/Kode Variasi, Status Pembatalan/Pengembalian, Status Pengembalian Barang, Jumlah Produk Dikembalikan')}
        </div>
        <div id="ret-progress" class="hidden mt-4 text-sm text-blue-600 text-center font-medium"></div>
        <div id="ret-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Penjualan.prosesReturLengkap()" class="btn-primary">Proses Semua</button>`,
    });
  },

  _setRetFileName(num, input) {
    const el = document.getElementById(`ret-file-${num}-name`);
    if (el && input.files[0]) {
      el.innerHTML = `<span class="text-blue-600 font-medium">${input.files[0].name}</span>`;
    }
  },

  async prosesReturLengkap() {
    const f1 = document.getElementById('ret-file-1')?.files[0];
    const f2 = document.getElementById('ret-file-2')?.files[0];
    const f3 = document.getElementById('ret-file-3')?.files[0];
    if (!f1 && !f2 && !f3) { App.toast('Pilih minimal 1 file untuk diproses.', 'warning'); return; }

    const prog = document.getElementById('ret-progress');
    const res  = document.getElementById('ret-result');
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    const readXlsx = async file => {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' });
    };

    try {
      const records = [];

      // ── SLOT 1: Pembatalan ──
      if (f1) {
        prog.textContent = 'Membaca Slot 1 — Pembatalan...';
        const rows = await readXlsx(f1);
        for (const r of rows) {
          const orderNo = this._col(r, 'No. Pesanan', 'No Pesanan', 'Order ID');
          if (!orderNo) continue;
          records.push({
            order_no:      orderNo,
            sku:           this._col(r, 'SKU Induk', 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU') || null,
            product_name:  this._col(r, 'Nama Produk', 'Product Name') || null,
            cancel_reason: this._col(r, 'Alasan Pembatalan', 'Alasan', 'Cancel Reason') || null,
            qty:           this._toNum(this._col(r, 'Jumlah', 'Qty', 'Quantity')) || 1,
            status:        'Batal',
            stok_action:   'tidak_berubah',
          });
        }
      }

      // ── SLOT 2: Pengiriman Gagal ──
      if (f2) {
        prog.textContent = 'Membaca Slot 2 — Pengiriman Gagal...';
        const rows = await readXlsx(f2);
        for (const r of rows) {
          const orderNo = this._col(r, 'No. Pesanan', 'No Pesanan', 'Order ID');
          if (!orderNo) continue;
          const delivSt = this._col(r, 'Status pengiriman gagal', 'Status Pengiriman Gagal', 'Status Pengiriman', 'Delivery Status', 'Status');
          records.push({
            order_no:      orderNo,
            sku:           this._col(r, 'SKU Induk', 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU') || null,
            product_name:  this._col(r, 'Nama Produk', 'Product Name') || null,
            cancel_reason: delivSt || null,
            qty:           this._toNum(this._col(r, 'Jumlah', 'Qty', 'Quantity')) || 1,
            status:        'Gagal Kirim',
            stok_action:   'menunggu_barang_kembali',
          });
        }
      }

      // ── SLOT 3: Pengembalian Barang/Dana ──
      if (f3) {
        prog.textContent = 'Membaca Slot 3 — Pengembalian Barang/Dana...';
        const rows = await readXlsx(f3);
        for (const r of rows) {
          const orderNo = this._col(r, 'No. Pesanan', 'No Pesanan', 'Order ID');
          if (!orderNo) continue;
          const retSt = this._col(r, 'Status Pengembalian Barang', 'Status Pengembalian', 'Return Status');
          records.push({
            order_no:      orderNo,
            sku:           this._col(r, 'SKU Induk/Kode Variasi', 'SKU Induk', 'Kode Variasi', 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU') || null,
            product_name:  this._col(r, 'Nama Produk', 'Product Name') || null,
            cancel_reason: this._col(r, 'Status Pembatalan/Pengembalian', 'Status Pengembalian', 'Status') || null,
            qty:           this._toNum(this._col(r, 'Jumlah Produk Dikembalikan', 'Jumlah Dikembalikan', 'Jumlah', 'Qty')) || 1,
            status:        'Retur',
            stok_action:   'menunggu_barang_kembali',
          });
        }
      }

      if (!records.length) {
        res.innerHTML = `<p class="text-orange-700">Tidak ada data valid ditemukan di file yang dipilih.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      // ── Cek order yang sudah ada di DB ──
      prog.textContent = 'Mengecek database...';
      const allNos = [...new Set(records.map(r => r.order_no))];
      const existingMap = new Map(); // order_no → [{id, sku}]
      const BATCH = 100;
      for (let i = 0; i < allNos.length; i += BATCH) {
        const chunk = allNos.slice(i, i + BATCH);
        const { data, error } = await App.db().from('orders').select('id, order_no, sku').in('order_no', chunk);
        if (error) throw error;
        (data || []).forEach(o => {
          if (!existingMap.has(o.order_no)) existingMap.set(o.order_no, []);
          existingMap.get(o.order_no).push(o);
        });
      }

      // ── Update pesanan ada / Insert pesanan baru ──
      let nUpdate = 0, nInsert = 0, nBatal = 0, nGagal = 0, nRetur = 0, nReview = 0;
      const today = App.todayISO();

      for (const rec of records) {
        const existing = existingMap.get(rec.order_no) || [];
        const updateFields = {
          status:        rec.status,
          stok_action:   rec.stok_action,
          cancel_reason: rec.cancel_reason || null,
        };

        // Cari exact match order_no + sku (kalau rec.sku null, cocok semua record order_no itu)
        let targetIds = [];
        if (existing.length > 0) {
          if (rec.sku) {
            targetIds = existing.filter(o => (o.sku || '') === rec.sku).map(o => o.id);
          } else {
            targetIds = existing.map(o => o.id);
          }
        }

        if (targetIds.length > 0) {
          const { error } = await App.db().from('orders').update(updateFields).in('id', targetIds);
          if (error) throw new Error(`Gagal update ${rec.order_no}: ${error.message}`);
          nUpdate++;
        } else {
          const { error } = await App.db().from('orders').insert({
            order_no:      rec.order_no,
            order_date:    today,
            product_name:  rec.product_name || '-',
            sku:           rec.sku || null,
            qty:           rec.qty || 1,
            selling_price: 0,
            gross_revenue: 0,
            source:        'shopee',
            ...updateFields,
          });
          if (error) throw new Error(`Gagal insert ${rec.order_no}: ${error.message}`);
          nInsert++;
        }

        if (rec.status === 'Batal')           nBatal++;
        else if (rec.status === 'Gagal Kirim') nGagal++;
        else if (rec.status === 'Retur')       nRetur++;
        if (rec.stok_action === 'menunggu_barang_kembali') nReview++;
      }

      res.innerHTML = `
        <div class="space-y-2">
          <p class="font-semibold text-green-700">Proses selesai!</p>
          <div class="grid grid-cols-3 gap-2 text-xs text-center">
            ${nBatal ? `<div class="bg-gray-50 border border-gray-200 rounded-lg p-2"><p class="font-bold text-xl text-gray-700">${nBatal}</p><p class="text-gray-500 mt-0.5">Batal</p></div>` : ''}
            ${nGagal ? `<div class="bg-red-50 border border-red-100 rounded-lg p-2"><p class="font-bold text-xl text-red-600">${nGagal}</p><p class="text-red-500 mt-0.5">Gagal Kirim</p></div>` : ''}
            ${nRetur ? `<div class="bg-orange-50 border border-orange-100 rounded-lg p-2"><p class="font-bold text-xl text-orange-600">${nRetur}</p><p class="text-orange-500 mt-0.5">Retur</p></div>` : ''}
          </div>
          <div class="text-xs text-gray-500 pt-2 border-t border-gray-100 space-y-0.5">
            <p>Diperbarui: <strong>${nUpdate}</strong> pesanan &nbsp;·&nbsp; Ditambah baru: <strong>${nInsert}</strong> pesanan</p>
            ${nReview ? `<p class="text-amber-600 font-medium">${nReview} pesanan masuk tab "Perlu Direview" (barang belum kembali ke gudang).</p>` : ''}
          </div>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');
      App.toast(`Import selesai: ${nBatal} Batal · ${nGagal} Gagal Kirim · ${nRetur} Retur`, 'success');

      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="font-semibold text-red-600">Error</p><p class="text-red-700 text-xs mt-1 whitespace-pre-wrap">${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ═══════════════════════════════════════════════
     3. IMPORT INCOME / PENGHASILAN (xlsx — Summary)
  ═══════════════════════════════════════════════ */
  openImportIncome() {
    const now = new Date();
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    App.openModal({
      title: 'Import File Income / Penghasilan',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> penghasilan Shopee.
        Detail per pesanan diambil dari sheet <strong>Income</strong>, ringkasan dari sheet <strong>Summary / Ringkasan</strong>.</p>
        <div class="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-800 mb-4">
          <p class="font-semibold mb-1">Sheet Income (per No. Pesanan):</p>
          <p>No. Pesanan · Tanggal Dana Dilepaskan · Harga Asli Produk · Total Diskon Produk · Voucher disponsori Penjual</p>
          <p class="font-semibold mt-2 mb-1">Sheet Summary (ringkasan bulanan):</p>
          <p>Total Pendapatan · Voucher Penjual · Biaya Komisi AMS · Biaya Administrasi</p>
          <p>Biaya Layanan · Biaya Proses Pesanan · Premi · Total yang Dilepas</p>
          <p class="mt-2 text-green-700">Pesanan yang ditemukan di sheet Income otomatis diset status <strong>Dibayar</strong>.</p>
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

      /* ── 1. Sheet "Income" → income_releases (per No. Pesanan) ── */
      const incomeSheetName = wb.SheetNames.find(n => /^income$/i.test(n.trim())) ||
                               wb.SheetNames.find(n => /income/i.test(n));
      const releases = [];

      if (incomeSheetName) {
        const wsIncome = wb.Sheets[incomeSheetName];
        const rows      = XLSX.utils.sheet_to_json(wsIncome, { header: 1, raw: false, defval: '' });
        const headerRow = rows[5] || []; // baris 6 (1-based) = index 5

        // Normalisasi header: rapikan non-breaking-space/spasi ganda supaya pencocokan substring stabil
        // (header gabungan kolom kadang menyisipkan karakter spasi non-standar dari export Shopee).
        const normHeader = h => String(h || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const findColIdx = (...terms) => {
          for (const term of terms) {
            const t = normHeader(term);
            const idx = headerRow.findIndex(h => normHeader(h).includes(t));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const COL_ORDER_NO = 1; // kolom B
        const colRelease   = findColIdx('tanggal dana dilepaskan', 'dana dilepaskan');
        const colGross     = findColIdx('harga asli produk');
        const colDiscount  = findColIdx('total diskon produk', 'diskon produk');
        const colVoucher   = findColIdx('voucher disponsori penjual', 'voucher ditanggung penjual', 'voucher penjual', 'seller voucher');
        const colNet       = findColIdx('total penghasilan', 'total income', 'net income');

        for (let i = 6; i < rows.length; i++) { // data mulai baris 7 (index 6)
          const row = rows[i];
          if (!row) continue;
          const orderNo = String(row[COL_ORDER_NO] || '').trim();
          if (!orderNo) continue;
          const gross   = colGross    !== -1 ? this._toNum(row[colGross])    : 0;
          const disc    = colDiscount !== -1 ? this._toNum(row[colDiscount]) : 0;
          const voucher = colVoucher  !== -1 ? this._toNum(row[colVoucher])  : 0;
          // Net Diterima sebenarnya = kolom "Total Penghasilan" Shopee (sudah final
          // setelah semua potongan), bukan dihitung manual dari gross+diskon+voucher
          // (data Shopee bisa punya komponen potongan lain di luar diskon/voucher).
          const net = colNet !== -1 ? this._toNum(row[colNet]) : (gross + disc + voucher);
          releases.push({
            order_no:       orderNo,
            release_date:   colRelease !== -1 ? this._toDate(row[colRelease]) : null,
            gross_amount:   gross,
            discount:       disc,
            voucher_seller: voucher,
            net_amount:     net,
          });
        }
      }

      let releasesSaved = 0;
      let ordersMarkedDibayar = 0;
      if (releases.length) {
        prog.textContent = `Menyimpan ${releases.length} data Income...`;
        const SAVE_BATCH = 500;
        for (let i = 0; i < releases.length; i += SAVE_BATCH) {
          const batch = releases.slice(i, i + SAVE_BATCH);
          const { error } = await App.db().from('income_releases').upsert(batch, { onConflict: 'order_no' });
          if (error) throw new Error(`Gagal simpan income_releases: ${error.message}`);
        }
        releasesSaved = releases.length;

        // Update status pesanan: Selesai → Dibayar untuk order_no yang ada di file Income.
        // Pencocokan exact-match SQL (.eq/.in) rentan gagal kalau order_no di tabel orders
        // punya spasi tersisa atau beda kapitalisasi dibanding yang diekstrak dari file Income
        // (mis. "240115ABCD1 " vs "240115abcd1"). Maka pencocokan dinormalisasi di JS dulu
        // (hapus semua whitespace + uppercase) sebelum diupdate berdasarkan id.
        const normOrderNo = s => String(s || '').replace(/\s+/g, '').toUpperCase();
        const releaseNoSet = new Set(releases.map(r => normOrderNo(r.order_no)));

        prog.textContent = 'Mengambil data pesanan Selesai...';
        const FETCH_PAGE = 1000;
        let allSelesai = [];
        let from = 0;
        while (true) {
          const { data, error: fetchErr } = await App.db()
            .from('orders')
            .select('id, order_no')
            .eq('status', 'Selesai')
            .not('order_no', 'is', null)
            .range(from, from + FETCH_PAGE - 1);
          if (fetchErr) throw new Error(`Gagal mengambil data pesanan: ${fetchErr.message}`);
          allSelesai.push(...(data || []));
          if (!data || data.length < FETCH_PAGE) break;
          from += FETCH_PAGE;
        }

        const matchedIds = allSelesai
          .filter(o => releaseNoSet.has(normOrderNo(o.order_no)))
          .map(o => o.id);

        prog.textContent = 'Memperbarui status pesanan...';
        const UPDATE_BATCH = 200;
        for (let i = 0; i < matchedIds.length; i += UPDATE_BATCH) {
          const chunk = matchedIds.slice(i, i + UPDATE_BATCH);
          const { error: updErr } = await App.db()
            .from('orders')
            .update({ status: 'Dibayar' })
            .in('id', chunk);
          if (updErr) throw new Error(`Gagal update status Dibayar: ${updErr.message}`);
          ordersMarkedDibayar += chunk.length;
        }
      }

      /* ── 2. Sheet "Summary"/"Ringkasan" → income_summary (seperti sebelumnya) ── */
      const summarySheetName = wb.SheetNames.find(n => /summary|ringkasan/i.test(n)) || wb.SheetNames[0];
      const wsSummary  = wb.Sheets[summarySheetName];
      const rawRows    = XLSX.utils.sheet_to_json(wsSummary, { header: 1, raw: false, defval: '' });

      // Normalisasi label: rapikan spasi ganda/non-breaking-space supaya pencocokan substring stabil
      const normLabel = s => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

      // Baris ringkasan/total Shopee sering memakai sel label gabungan (merged) yang lebih
      // lebar, sehingga nilai angkanya tidak selalu persis di kolom sebelah label — bisa
      // beberapa kolom setelahnya. Maka: ambil label = sel pertama yang tidak kosong,
      // value = sel angka PALING KANAN di baris yang sama (bukan cuma kolom i+1).
      const valMap = {};
      for (const row of rawRows) {
        if (!row || !row.length) continue;
        let labelIdx = -1;
        for (let i = 0; i < row.length; i++) {
          if (String(row[i] ?? '').trim()) { labelIdx = i; break; }
        }
        if (labelIdx === -1) continue;
        const rawLabel = String(row[labelIdx]).trim();
        if (!rawLabel || /^[\d.,\-]+$/.test(rawLabel)) continue; // baris diawali angka murni → bukan label

        let value = null;
        for (let i = row.length - 1; i > labelIdx; i--) {
          const cell = String(row[i] ?? '').trim();
          if (cell && /\d/.test(cell)) { value = cell; break; }
        }
        if (value !== null) valMap[normLabel(rawLabel)] = value;
      }

      const findVal = (...terms) => {
        for (const term of terms) {
          const t = normLabel(term);
          for (const [label, value] of Object.entries(valMap)) {
            if (label.includes(t)) return this._toNum(value);
          }
        }
        return 0;
      };

      const record = {
        bulan, tahun,
        total_pendapatan:     findVal('total pendapatan', 'total penghasilan', 'total revenue', 'pendapatan kotor', 'penghasilan kotor'),
        voucher_penjual:      findVal('voucher penjual', 'seller voucher'),
        biaya_komisi_ams:     findVal('komisi ams', 'ams commission', 'biaya komisi'),
        biaya_administrasi:   findVal('biaya administrasi', 'admin fee', 'administration fee'),
        biaya_layanan:        findVal('biaya layanan', 'service fee', 'layanan'),
        biaya_proses_pesanan: findVal('biaya proses pesanan', 'processing fee', 'proses pesanan'),
        premi:                findVal('premi', 'premium'),
        total_dilepas:        findVal('total yang dilepas', 'total dilepaskan', 'dana yang dilepaskan', 'total released', 'total dilepas'),
      };

      prog.textContent = 'Menyimpan ringkasan ke database...';
      const { error } = await App.db().from('income_summary').upsert(record, { onConflict: 'bulan,tahun' });
      if (error) throw error;

      const bulanNames = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">Income ${bulanNames[bulan]} ${tahun} berhasil disimpan!</p>
          ${releasesSaved ? `
          <div class="mt-2 text-xs text-gray-700 border-t border-gray-100 pt-2 space-y-0.5">
            <p>Data Income per pesanan: <strong>${releasesSaved}</strong> baris</p>
            <p>Status pesanan diupdate jadi <strong>Dibayar</strong>: <strong>${ordersMarkedDibayar}</strong> pesanan</p>
          </div>` : `
          <p class="text-xs text-orange-600 mt-1">Sheet "Income" tidak ditemukan — detail per pesanan dilewati, hanya ringkasan Summary yang disimpan.</p>`}
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

      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  /* ═══════════════════════════════════════════════
     TAMBAH / EDIT MANUAL
  ═══════════════════════════════════════════════ */
  openEditManual(id) {
    const order = this._orders.find(o => o.id === id);
    if (!order) { App.toast('Pesanan tidak ditemukan.', 'error'); return; }
    this.openManual(order);
  },

  openManual(order = null) {
    if (!order) return this.openManualMulti();
    const o = order;
    App.openModal({
      title: 'Edit Pesanan',
      size: 'max-w-2xl',
      body: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="label">No. Pesanan</label><input id="m-order-no" class="input" value="${o.order_no||''}" placeholder="Optional"/></div>
        <div><label class="label">Tanggal</label><input id="m-date" type="date" class="input" value="${o.order_date||App.todayISO()}"/></div>
        <div class="col-span-2"><label class="label">Nama Produk *</label><input id="m-name" class="input" value="${o.product_name||''}" placeholder="Nama produk"/></div>
        <div><label class="label">SKU</label><input id="m-sku" class="input" value="${o.sku||''}" placeholder="SKU"/></div>
        <div><label class="label">Variasi</label><input id="m-var" class="input" value="${o.variation||''}" placeholder="Opsional"/></div>
        <div><label class="label">Qty *</label><input id="m-qty" type="number" min="1" class="input" value="${o.qty||1}" oninput="Penjualan._calcManual()"/></div>
        <div><label class="label">Harga Jual (Rp) *</label><input id="m-price" type="text" inputmode="decimal" class="input" value="${o.selling_price||''}" placeholder="0" oninput="Penjualan._calcManual()"/></div>
        <div><label class="label">Omzet / Total (Rp)</label><input id="m-gross" type="number" class="input" value="${o.gross_revenue||''}" placeholder="Otomatis dari qty × harga"/></div>
        <div><label class="label">Net Diterima (Rp)</label><input id="m-net" type="text" inputmode="decimal" class="input" value="${o.net_revenue||''}" placeholder="Setelah potongan"/></div>
        <div><label class="label">Ekspedisi</label><input id="m-exp" class="input" value="${o.expedition||''}" placeholder="JNE, J&T, dll"/></div>
        <div><label class="label">Status *</label>
          <select id="m-status" class="input">
            ${['Diproses','Selesai','Gagal Kirim','Batal'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
            ${o.status === 'Dibayar' ? `<option selected>Dibayar</option>` : ''}
          </select>
        </div>
        <div><label class="label">Stok Action</label>
          <select id="m-stok-action" class="input">
            <option value="">— Otomatis dari Status —</option>
            <option value="keluar" ${o.stok_action==='keluar'?'selected':''}>Stok Keluar</option>
            <option value="tidak_berubah" ${o.stok_action==='tidak_berubah'?'selected':''}>Stok Tetap</option>
            <option value="perlu_review" ${o.stok_action==='perlu_review'?'selected':''}>Perlu Review</option>
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
        <button onclick="Penjualan.saveManual('${order.id}')" class="btn-primary">Simpan</button>`,
    });
  },

  /* ═══════════════════════════════════════════════
     TAMBAH MANUAL — MULTI-SKU (1 pesanan, beberapa produk)
  ═══════════════════════════════════════════════ */
  openManualMulti() {
    this._manualRows = [{ sku: '', name: '', variation: '', qty: 1, price: '' }];
    App.openModal({
      title: 'Tambah Pesanan Manual',
      size: 'max-w-4xl',
      body: `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div><label class="label">No. Pesanan</label><input id="mm-order-no" class="input" placeholder="Optional"/></div>
        <div><label class="label">Tanggal</label><input id="mm-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Ekspedisi</label><input id="mm-exp" class="input" placeholder="JNE, J&T, dll"/></div>
        <div><label class="label">Status *</label>
          <select id="mm-status" class="input">
            ${['Diproses','Selesai','Gagal Kirim','Batal'].map(s=>`<option>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex items-center justify-between mb-2">
        <span class="label !mb-0">Produk</span>
        <button onclick="Penjualan._addManualRow()" class="btn-secondary text-xs !py-1">+ Tambah Produk</button>
      </div>
      <div id="mm-rows" class="space-y-2 mb-3"></div>
      <div class="text-right text-sm font-semibold">Omzet Total: <span id="mm-total" class="text-money">Rp 0</span></div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Penjualan.saveManualMulti()" class="btn-primary">Simpan</button>`,
    });
    this._renderManualRows();
  },

  _renderManualRows() {
    const el = document.getElementById('mm-rows');
    if (!el) return;
    el.innerHTML = this._manualRows.map((r, i) => `
      <div class="grid grid-cols-12 gap-2 items-end">
        <div class="col-span-2"><label class="label text-xs">SKU</label><input id="mm-sku-${i}" class="input" value="${r.sku}" placeholder="SKU" oninput="Penjualan._updateManualRow(${i})"/></div>
        <div class="col-span-4"><label class="label text-xs">Nama Produk *</label><input id="mm-name-${i}" class="input" value="${r.name}" placeholder="Nama produk" oninput="Penjualan._updateManualRow(${i})"/></div>
        <div class="col-span-2"><label class="label text-xs">Variasi</label><input id="mm-var-${i}" class="input" value="${r.variation}" placeholder="Opsional" oninput="Penjualan._updateManualRow(${i})"/></div>
        <div class="col-span-1"><label class="label text-xs">Qty *</label><input id="mm-qty-${i}" type="number" min="1" class="input" value="${r.qty}" oninput="Penjualan._updateManualRow(${i})"/></div>
        <div class="col-span-2"><label class="label text-xs">Harga (Rp) *</label><input id="mm-price-${i}" type="text" inputmode="decimal" class="input" value="${r.price}" placeholder="0" oninput="Penjualan._updateManualRow(${i})"/></div>
        <div class="col-span-1 pb-1.5 text-right">${this._manualRows.length > 1 ? `<button onclick="Penjualan._removeManualRow(${i})" class="text-red-400 hover:text-red-600 text-xs font-medium">Hapus</button>` : ''}</div>
      </div>`).join('');
    this._calcManualMultiTotal();
  },

  _updateManualRow(i) {
    const r = this._manualRows[i];
    if (!r) return;
    r.sku       = document.getElementById(`mm-sku-${i}`)?.value.trim() || '';
    r.name      = document.getElementById(`mm-name-${i}`)?.value.trim() || '';
    r.variation = document.getElementById(`mm-var-${i}`)?.value.trim() || '';
    r.qty       = +document.getElementById(`mm-qty-${i}`)?.value || 1;
    r.price     = document.getElementById(`mm-price-${i}`)?.value || '';
    this._calcManualMultiTotal();
  },

  _addManualRow() {
    this._manualRows.push({ sku: '', name: '', variation: '', qty: 1, price: '' });
    this._renderManualRows();
  },

  _removeManualRow(i) {
    if (this._manualRows.length <= 1) return;
    this._manualRows.splice(i, 1);
    this._renderManualRows();
  },

  _calcManualMultiTotal() {
    const total = this._manualRows.reduce((s, r) => s + (+r.qty || 1) * this._stripPrice(r.price), 0);
    const el = document.getElementById('mm-total');
    if (el) el.textContent = App.formatRupiah(total);
  },

  async saveManualMulti() {
    const orderNo    = document.getElementById('mm-order-no').value.trim() || null;
    const orderDate  = document.getElementById('mm-date').value;
    const expedition = document.getElementById('mm-exp').value.trim();
    const status     = document.getElementById('mm-status').value;

    const rows = this._manualRows
      .map(r => ({
        sku:          r.sku,
        product_name: r.name,
        variation:    r.variation,
        qty:          +r.qty || 1,
        price:        this._stripPrice(r.price),
      }))
      .filter(r => r.product_name && r.price);

    if (!rows.length) { App.toast('Minimal 1 produk dengan nama & harga wajib diisi.', 'warning'); return; }

    try {
      for (const r of rows) {
        const gross   = r.qty * r.price;
        const payload = {
          order_no:      orderNo,
          order_date:    orderDate,
          product_name:  r.product_name,
          sku:           r.sku,
          variation:     r.variation,
          qty:           r.qty,
          selling_price: r.price,
          gross_revenue: gross,
          net_revenue:   gross,
          expedition,
          status,
          stok_action:   this._determineStokAction(status, ''),
          source:        'shopee',
          notes:         '',
        };

        let updated = false;
        if (orderNo && r.sku) {
          const { data: existing, error: findError } = await App.db().from('orders')
            .select('id').eq('order_no', orderNo).eq('sku', r.sku).maybeSingle();
          if (findError) throw findError;
          if (existing) {
            const { error } = await App.db().from('orders').update(payload).eq('id', existing.id);
            if (error) throw error;
            updated = true;
          }
        }
        if (!updated) {
          const { error } = await App.db().from('orders').upsert(payload, { onConflict: 'order_no,sku' });
          if (error) throw error;
        }
      }
      App.closeModal();
      App.toast(`Pesanan disimpan (${rows.length} produk)!`, 'success');
      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  // Strip pemisah ribuan "." dan "," dari input harga sebelum dipakai sebagai angka —
  // form ini menerima "155.783" / "155,783" / "155783" dan semuanya harus jadi 155783.
  _stripPrice(v) {
    return parseInt(String(v ?? '').replace(/[.,]/g, ''), 10) || 0;
  },

  _calcManual() {
    const qty   = +document.getElementById('m-qty')?.value || 1;
    const price = this._stripPrice(document.getElementById('m-price')?.value);
    const gross = document.getElementById('m-gross');
    if (gross) gross.value = qty * price;
  },

  async saveManual(id) {
    const name  = document.getElementById('m-name').value.trim();
    const price = this._stripPrice(document.getElementById('m-price').value);
    if (!name || !price) { App.toast('Nama produk dan harga wajib diisi.', 'warning'); return; }

    const qty       = +document.getElementById('m-qty').value   || 1;
    const gross     = +document.getElementById('m-gross').value || qty * price;
    const net       = this._stripPrice(document.getElementById('m-net').value) || gross;
    const status    = document.getElementById('m-status').value;
    const stokInput = document.getElementById('m-stok-action').value;

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
      status,
      stok_action:   stokInput || this._determineStokAction(status, ''),
      source:        document.getElementById('m-source').value,
      notes:         document.getElementById('m-notes').value.trim(),
    };

    try {
      if (id) {
        const { error } = await App.db().from('orders').update(payload).eq('id', id);
        if (error) throw error;
      } else if (payload.order_no && payload.sku) {
        // Kombinasi No. Pesanan + SKU punya unique index parsial di DB —
        // cek manual dulu supaya bisa update kalau sudah ada, insert kalau belum.
        const { data: existing, error: findError } = await App.db().from('orders')
          .select('id').eq('order_no', payload.order_no).eq('sku', payload.sku).maybeSingle();
        if (findError) throw findError;
        if (existing) {
          const { error } = await App.db().from('orders').update(payload).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await App.db().from('orders').insert(payload);
          if (error) throw error;
        }
      } else {
        const { error } = await App.db().from('orders').insert(payload);
        if (error) throw error;
      }
      App.closeModal();
      App.toast('Pesanan disimpan!', 'success');
      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();
    } catch (err) {
      App.toast('Error: ' + err.message, 'error');
    }
  },

  /* ═══════════════════════════════════════════════
     HAPUS PESANAN (per baris)
  ═══════════════════════════════════════════════ */
  async deleteOrder(id) {
    const order = this._orders.find(o => o.id === id);
    const DEDUCT = ['keluar', 'sudah_keluar_tidak_balik', 'menunggu_barang_kembali'];
    const affectsStok = order && DEDUCT.includes(order.stok_action);

    let msg = 'Hapus pesanan ini?';
    if (affectsStok) {
      msg = `Hapus pesanan ini?\n\nKarena stok pesanan ini sudah dicatat keluar, stok ${order.qty||1} unit SKU "${order.sku||'-'}" akan otomatis kembali setelah dihapus.`;
    } else if (order && !order.stok_action && order.status === 'Selesai') {
      msg = `Hapus pesanan ini? Stok ${order.qty||1} unit SKU "${order.sku||'-'}" akan otomatis kembali.`;
    }

    const ok = await App.confirm(msg);
    if (!ok) return;

    const { error } = await App.db().from('orders').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }

    App.toast('Pesanan dihapus.' + (affectsStok ? ' Stok dikembalikan.' : ''), 'success');
    this._orders = this._orders.filter(o => o.id !== id);
    this._renderTab();
    this._updateReviewBadge();
  },

  /* ═══════════════════════════════════════════════
     HAPUS DATA PERIODE (Owner only)
  ═══════════════════════════════════════════════ */
  openHapusPeriode() {
    if (!App.isOwner()) { App.toast('Hanya Owner yang bisa menghapus data.', 'warning'); return; }
    const now = new Date();
    const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    App.openModal({
      title: 'Hapus Data Periode',
      body: `
        <p class="text-sm text-gray-600 mb-4">Pilih bulan dan tahun yang ingin dihapus. Semua pesanan pada periode tersebut akan dihapus permanen.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Bulan</label>
            <select id="del-bulan" class="input">
              ${bulanNames.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div><label class="label">Tahun</label>
            <input id="del-tahun" type="number" class="input" value="${now.getFullYear()}" min="2020" max="2035"/>
          </div>
        </div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Penjualan.hapusPeriode()" class="btn-danger">Hapus</button>`,
    });
  },

  async hapusPeriode() {
    const bulan    = document.getElementById('del-bulan').value;
    const tahun    = document.getElementById('del-tahun').value;
    const bulanNames = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const label    = `${bulanNames[parseInt(bulan)]} ${tahun}`;
    const dateFrom = `${tahun}-${bulan}-01`;
    // Hitung awal bulan berikutnya agar tidak perlu tahu jumlah hari per bulan
    const nextMonth = new Date(parseInt(tahun), parseInt(bulan), 1); // bulan JS 0-based, jadi parseInt(bulan) = bulan berikutnya
    const dateNext  = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    App.closeModal();
    const ok = await App.confirm(`Hapus semua pesanan bulan ${label}? Tidak bisa dibatalkan.`);
    if (!ok) return;

    try {
      const { error } = await App.db()
        .from('orders')
        .delete()
        .gte('order_date', dateFrom)
        .lt('order_date', dateNext);
      if (error) throw error;
      App.toast(`Data pesanan ${label} berhasil dihapus.`, 'success');
      await this._loadOrders();
      this._renderTab();
      this._updateReviewBadge();
    } catch (err) {
      App.toast('Gagal hapus: ' + err.message, 'error');
    }
  },
};
