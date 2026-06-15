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
          <option>Gagal Kirim</option>
          <option>Batal</option>
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
    if (!badge) return;
    const count = this._orders.filter(o =>
      ['menunggu_barang_kembali', 'perlu_review', 'sudah_keluar_tidak_balik'].includes(o.stok_action)
    ).length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
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
  },

  /* ── STATUS & STOK HELPERS ── */

  // Petakan status Shopee mentah → 4 status internal Nova Gear.
  // Return null berarti baris harus dilewati (mis. Menunggu Pembayaran).
  _mapStatus(shopeeStatus, cancelReason) {
    const s = (shopeeStatus || '').toLowerCase().trim();
    const r = (cancelReason  || '').toLowerCase().trim();

    if (s === 'selesai' || s === 'completed') return 'Selesai';
    if (s.includes('pesanan diterima') || s.includes('order received')) return 'Selesai';
    if (s.includes('perlu dikirim') || s.includes('to ship') || s.includes('to_ship')) return 'Diproses';
    if (s.includes('sedang dikirim') || s.includes('shipped') || s.includes('in delivery')) return 'Diproses';
    if (s.includes('batal') || s.includes('cancel')) {
      if (r.includes('pengiriman gagal') || r.includes('gagal kirim') ||
          r.includes('delivery failed')  || r.includes('failed delivery')) return 'Gagal Kirim';
      return 'Batal';
    }
    if (s.includes('dikembalikan') || s.includes('return')) return 'Gagal Kirim';
    return null; // Menunggu Pembayaran, dll — lewati
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
      const m = { Selesai:'badge-green', Diproses:'badge-blue', 'Gagal Kirim':'badge-red', Batal:'badge-gray' };
      return `<span class="badge ${m[s]||'badge-gray'}">${s||'-'}</span>`;
    };
    const deleteBtn = id => `
      <button onclick="Penjualan.deleteOrder('${id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
          <td class="text-money">${App.formatRupiah(o.gross_revenue)}</td>
          <td class="text-money">${isFirst ? App.formatRupiah(o.net_revenue) : ''}</td>
          <td>${isFirst ? (o.expedition||'-') : ''}</td>
          <td>${isFirst ? statusBadge(o.status) : ''}</td>
          <td>${isFirst ? this._stokActionBadge(o.stok_action) : ''}</td>
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
          <th>Harga Jual</th><th>Subtotal</th><th>Net</th><th>Ekspedisi</th>
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
    const badgeMap = { Selesai:'badge-green', Diproses:'badge-blue', 'Gagal Kirim':'badge-red', Batal:'badge-gray' };
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
     1. IMPORT PESANAN (xlsx — semua status)
  ═══════════════════════════════════════════════ */
  openImportPesanan() {
    App.openModal({
      title: 'Import File Pesanan Shopee',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> pesanan dari Shopee Seller Center.
        Pesanan baru akan ditambahkan. Pesanan yang sudah ada akan <strong>diupdate statusnya</strong> jika berubah.</p>
        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-3 space-y-1">
          <p class="font-semibold">Pemetaan status Shopee → Nova Gear:</p>
          <p>• Perlu Dikirim / Sedang Dikirim → <strong>Diproses</strong> (stok keluar)</p>
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

      const col    = this._col.bind(this);
      const toNum  = this._toNum.bind(this);
      const toDate = this._toDate.bind(this);

      prog.textContent = `Memproses ${rows.length} baris...`;

      // Parse semua baris, petakan ke 4 status internal, lewati status tidak relevan
      const records = rows
        .map(r => {
          const shopeeStatus = col(r, 'Status Pesanan', 'Status', 'Order Status');
          const cancelReason = col(r, 'Alasan Pembatalan', 'Alasan Pembatalan Pesanan', 'Cancel Reason', 'Cancellation Reason');
          const status       = this._mapStatus(shopeeStatus, cancelReason);
          if (!status) return null; // Menunggu Pembayaran, dll → lewati
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
            cancel_reason:    cancelReason || null,
            source:           'shopee',
            stok_action:      this._determineStokAction(status, cancelReason),
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

      // ── Insert baru (batch 200)
      let migrationWarning = false;
      let insertError = null;
      const INSERT_BATCH = 200;
      for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
        const batch = toInsert.slice(i, i + INSERT_BATCH);
        prog.textContent = `Menyimpan pesanan baru... (${Math.min(i + INSERT_BATCH, toInsert.length)}/${toInsert.length})`;
        let { error } = await App.db().from('orders').insert(batch);

        // Fallback: kolom stok_action / cancel_reason belum ada (migrasi v3 belum dijalankan)
        if (error && (error.message === 'Bad Request' ||
            (error.message || '').includes('stok_action') ||
            (error.message || '').includes('cancel_reason'))) {
          const stripped = batch.map(({ cancel_reason, stok_action, ...rec }) => rec);
          ({ error } = await App.db().from('orders').insert(stripped));
          migrationWarning = true;
        }
        if (error) { insertError = error; break; }
      }
      if (insertError) throw new Error(`Gagal insert: ${insertError.message}${insertError.details ? ' — ' + insertError.details : ''} (kode: ${insertError.code || '-'})`);

      // ── Update status yang berubah (batch 100 order_no per request)
      let totalUpdated = 0;
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

      // ── Tampilkan hasil
      const countByStatus = s => toInsert.filter(r => r.status === s).length;
      const nDiproses  = countByStatus('Diproses');
      const nSelesai   = countByStatus('Selesai');
      const nGagal     = countByStatus('Gagal Kirim');
      const nBatal     = countByStatus('Batal');
      const totalOmzet = toInsert.reduce((s, r) => s + r.gross_revenue, 0);
      const nReview    = toInsert.filter(r => r.stok_action === 'sudah_keluar_tidak_balik').length;

      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">Import berhasil!</p>
          <div class="mt-2 text-xs space-y-0.5 border-t border-gray-100 pt-2">
            <p>Pesanan baru ditambahkan: <strong>${toInsert.length}</strong></p>
            <p>Status diperbarui: <strong>${totalUpdated}</strong> order</p>
          </div>
          ${migrationWarning ? `
          <div class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <strong>Migrasi v3 belum dijalankan</strong> — fitur stok_action tidak aktif.
            Jalankan SQL migrasi v3 di Supabase.
          </div>` : `
          <div class="mt-2 text-xs space-y-0.5 border-t border-gray-100 pt-2">
            ${nDiproses ? `<p><span class="font-medium text-blue-700">Diproses:</span> ${nDiproses}</p>` : ''}
            ${nSelesai  ? `<p><span class="font-medium text-green-700">Selesai:</span> ${nSelesai}</p>` : ''}
            ${nGagal    ? `<p><span class="font-medium text-red-600">Gagal Kirim:</span> ${nGagal}</p>` : ''}
            ${nBatal    ? `<p><span class="font-medium text-gray-500">Batal:</span> ${nBatal}</p>` : ''}
            ${nReview   ? `<p class="text-orange-600 font-semibold">Paket Hilang (perlu kompensasi): ${nReview}</p>` : ''}
          </div>`}
          <p class="text-xs text-gray-500 pt-1">Total Omzet baru: ${App.formatRupiah(totalOmzet)}</p>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');

      const toastExtra = totalUpdated > 0 ? ` · ${totalUpdated} status diperbarui` : '';
      App.toast(`Import selesai: ${toInsert.length} baru${toastExtra}`, 'success');
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
     2. IMPORT RETUR / BATAL (ZIP berisi 2 xlsx)
  ═══════════════════════════════════════════════ */
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

      const zip     = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(f => !f.dir && /\.(xlsx|xls)$/i.test(f.name));

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
            sku:          col(r, 'Nomor Referensi SKU', 'No. SKU Produk', 'SKU'),
            product_name: col(r, 'Nama Produk', 'Product Name'),
            gross_revenue: toNum(col(r, 'Subtotal Pesanan', 'Subtotal', 'Total Harga')),
            order_date:    toDate(col(r, 'Waktu Pesanan Dibuat', 'Tanggal Pesanan', 'Order Date')),
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

      prog.textContent = `Menyimpan ${allRecords.length} data...`;
      const { error } = await App.db()
        .from('returns')
        .upsert(allRecords, { onConflict: 'order_no,category', ignoreDuplicates: true });
      if (error) throw error;

      const nBatal = allRecords.filter(r => r.category === 'Batal').length;
      const nGagal = allRecords.filter(r => r.category === 'Gagal Kirim').length;

      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">Import berhasil!</p>
          <p>Pesanan Dibatalkan: <strong>${nBatal}</strong></p>
          <p>Gagal Kirim: <strong>${nGagal}</strong></p>
          <p>Total: <strong>${allRecords.length}</strong> data</p>
          <p class="text-xs text-gray-400 mt-1">Duplikat dilewati otomatis.</p>
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
      const sheetName = wb.SheetNames.find(n => /summary|ringkasan/i.test(n)) || wb.SheetNames[0];
      const ws        = wb.Sheets[sheetName];
      const rawRows   = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

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
            if (label.includes(term.toLowerCase())) return this._toNum(value);
          }
        }
        return 0;
      };

      const record = {
        bulan, tahun,
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
      const { error } = await App.db().from('income_summary').upsert(record, { onConflict: 'bulan,tahun' });
      if (error) throw error;

      const bulanNames = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      res.innerHTML = `
        <div class="space-y-1">
          <p class="font-semibold text-green-700">Income ${bulanNames[bulan]} ${tahun} berhasil disimpan!</p>
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

  /* ═══════════════════════════════════════════════
     TAMBAH / EDIT MANUAL
  ═══════════════════════════════════════════════ */
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
            ${['Diproses','Selesai','Gagal Kirim','Batal'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
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

    const qty       = +document.getElementById('m-qty').value   || 1;
    const gross     = +document.getElementById('m-gross').value || qty * price;
    const net       = +document.getElementById('m-net').value   || gross;
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
    const dateTo   = `${tahun}-${bulan}-31`;

    App.closeModal();
    const ok = await App.confirm(`Hapus semua pesanan bulan ${label}? Tidak bisa dibatalkan.`);
    if (!ok) return;

    try {
      const { error } = await App.db()
        .from('orders')
        .delete()
        .gte('order_date', dateFrom)
        .lte('order_date', dateTo);
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
