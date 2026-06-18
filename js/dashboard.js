/* ═══════════════════════════════════════════════════════
   Nova Gear — Dashboard Module
═══════════════════════════════════════════════════════ */
'use strict';

const Dashboard = {
  _charts: {},

  async onLoad() {
    const el = document.getElementById('page-dashboard');
    el.innerHTML = this._skeleton();
    try {
      await this._render(el);
    } catch (err) {
      console.error(err);
      App.toast('Gagal memuat dashboard: ' + err.message, 'error');
    }
  },

  async _render(el) {
    const db = App.db();
    const [
      { data: orders,    error: e1 },
      { data: hppData,   error: e2 },
      { data: adsData,   error: e3 },
      { data: opData,    error: e4 },
      { data: scanToday, error: e5 },
    ] = await Promise.all([
      db.from('orders').select('status,gross_revenue,net_revenue,shopee_commission,shopee_service_fee,shopee_ads_fee,shopee_other_fee,order_date,expedition,created_at,qty,sku'),
      db.from('hpp_items').select('sku,cost_per_unit,created_at').order('created_at', { ascending: false }),
      db.from('ads').select('cost'),
      db.from('operational').select('cost'),
      db.from('scan_logs').select('id,expedition,is_cancelled,scan_date').eq('scan_date', App.todayISO()),
    ]);
    if (e1 || e2 || e3 || e4 || e5) throw new Error((e1||e2||e3||e4||e5).message);

    const settings  = await App.getSettings();
    const modalAwal = parseFloat(settings.modal_awal || 0);

    const today     = App.todayISO();
    const all       = orders || [];
    // "Berhasil" = Selesai ATAU Dibayar (Dibayar diset oleh Import Income untuk pesanan Selesai yang dananya sudah dirilis)
    const selesai   = all.filter(o => o.status === 'Selesai' || o.status === 'Dibayar');
    const batal     = all.filter(o => o.status === 'Batal');
    const gagal     = all.filter(o => o.status === 'Gagal Kirim');
    const retur     = all.filter(o => o.status === 'Dikembalikan');
    const diproses  = all.filter(o => o.status === 'Diproses');
    const diprosesHariIni = diproses.filter(o => (o.created_at || '').slice(0, 10) === today);

    const sum       = (arr, key) => arr.reduce((s, r) => s + (+r[key] || 0), 0);
    const omzet     = sum(selesai, 'gross_revenue');
    const netRev    = sum(selesai, 'net_revenue');
    const potShopee = sum(selesai, 'shopee_commission') + sum(selesai, 'shopee_service_fee') + sum(selesai, 'shopee_ads_fee') + sum(selesai, 'shopee_other_fee');

    // HPP = qty pesanan berhasil (Selesai/Dibayar) × HPP terbaru per SKU dari hpp_items
    // (bukan total seluruh stok yang pernah dibeli) — konsisten dengan logika Laba Rugi.
    const hppMap = {};
    (hppData || []).forEach(r => {
      const k = r.sku;
      if (!k || k in hppMap) return; // sudah diurutkan terbaru dulu → pertama ditemukan = terbaru
      hppMap[k] = +r.cost_per_unit || 0;
    });
    const freebieDefault = App.getFreebieDefaultPrice(settings);
    const totalHPP = selesai.reduce((s, o) => {
      const qty = +o.qty || 1;
      return s + (App.isFreebieSku(o.sku) ? qty * freebieDefault : qty * (hppMap[o.sku] || 0));
    }, 0);

    const totalAds  = sum(adsData  || [], 'cost');
    const totalOp   = sum(opData   || [], 'cost');
    const totalExp  = totalHPP + totalAds + totalOp;
    const labaB     = netRev - totalExp;
    const sisaKas   = modalAwal + netRev - totalExp;

    const scans     = (scanToday || []).filter(s => !s.is_cancelled);
    const returnRate = selesai.length > 0 ? (retur.length / selesai.length * 100).toFixed(1) : '0.0';

    // Daily revenue for chart (last 30 days)
    const dailyMap = {};
    selesai.forEach(o => {
      const d = o.order_date?.slice(0, 10) || '';
      if (!d) return;
      if (!dailyMap[d]) dailyMap[d] = { omzet: 0, net: 0 };
      dailyMap[d].omzet += +o.gross_revenue || 0;
      dailyMap[d].net   += +o.net_revenue   || 0;
    });
    const days = Object.keys(dailyMap).sort().slice(-30);

    // Expedition breakdown today
    const expMap = {};
    scans.forEach(s => {
      const e = s.expedition || 'Lainnya';
      expMap[e] = (expMap[e] || 0) + 1;
    });

    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Ringkasan performa toko — semua waktu</p>
        </div>
        <button onclick="Dashboard.onLoad()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </button>
      </div>

      <!-- Row 1: Financial -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        ${this._bigCard('Omzet', App.formatRupiah(omzet), 'Total penjualan kotor', 'bg-emerald-50','text-emerald-600','M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 6v1m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z')}
        ${this._bigCard('Net Diterima', App.formatRupiah(netRev), `Pot. Shopee ${App.formatRupiah(potShopee)}`, 'bg-blue-50','text-blue-600','M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z')}
        ${this._bigCard('Total Pengeluaran', App.formatRupiah(totalExp), 'HPP + Iklan + Operasional', 'bg-amber-50','text-amber-600','M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z')}
        ${this._bigCard('Laba Bersih', App.formatRupiah(labaB), 'Net − HPP − Iklan − Ops', labaB>=0?'bg-green-50':'bg-red-50', labaB>=0?'text-green-600':'text-red-600','M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z')}
        ${this._bigCard('Sisa Kas', App.formatRupiah(sisaKas), 'Modal + Net − Pengeluaran', sisaKas>=0?'bg-sky-50':'bg-red-50', sisaKas>=0?'text-sky-600':'text-red-600','M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z')}
      </div>

      <!-- Row 2: Order Status -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        ${this._miniCard('Dikirim Hari Ini', diprosesHariIni.length, 'bg-blue-50 border-blue-100', 'text-blue-700')}
        ${this._miniCard('Total Diproses', diproses.length, 'bg-indigo-50 border-indigo-100', 'text-indigo-700')}
        ${this._miniCard('Berhasil', selesai.length, 'bg-green-50 border-green-100', 'text-green-700')}
        ${this._miniCard('Dibatalkan', batal.length, 'bg-gray-50 border-gray-200', 'text-gray-600')}
        ${this._miniCard('Gagal Kirim', gagal.length, 'bg-red-50 border-red-100', 'text-red-700')}
        ${this._miniCard('Retur/Rusak', retur.length, 'bg-orange-50 border-orange-100', 'text-orange-700')}
        ${this._miniCard('Return Rate', returnRate + '%', 'bg-purple-50 border-purple-100', 'text-purple-700')}
      </div>

      <!-- Row 3: Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div class="card lg:col-span-2">
          <div class="card-header mb-3">
            <span class="card-title">Tren Omzet — 30 hari terakhir</span>
          </div>
          <div style="height:200px;position:relative"><canvas id="chart-revenue"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header mb-3">
            <span class="card-title">Distribusi Status</span>
          </div>
          <div style="height:190px;position:relative"><canvas id="chart-status"></canvas></div>
        </div>
      </div>

      <!-- Row 4: Scanner + Expense breakdown -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Scanner Hari Ini</span>
            <span class="badge badge-blue">${scans.length} paket</span>
          </div>
          ${Object.keys(expMap).length === 0
            ? `<div class="empty-state py-8"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><p>Belum ada scan hari ini</p></div>`
            : `<div class="mt-1 space-y-1">${Object.entries(expMap).sort((a,b)=>b[1]-a[1]).map(([e,c])=>`
                <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span class="text-sm text-gray-700">${e}</span>
                  <span class="badge badge-blue">${c} paket</span>
                </div>`).join('')}</div>`}
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Rincian Pengeluaran</span>
          </div>
          <div class="space-y-4 mt-1">
            ${this._expBar('HPP (Modal)', totalHPP, totalExp, 'bg-blue-500')}
            ${this._expBar('Iklan & Marketing', totalAds, totalExp, 'bg-purple-500')}
            ${this._expBar('Operasional', totalOp, totalExp, 'bg-amber-500')}
          </div>
          <div class="border-t border-gray-100 mt-4 pt-3 flex justify-between">
            <span class="text-sm font-semibold text-gray-700">Total</span>
            <span class="font-bold text-money">${App.formatRupiah(totalExp)}</span>
          </div>
        </div>
      </div>`;

    this._initChartRevenue(days, dailyMap);
    this._initChartStatus(selesai.length, batal.length, gagal.length, retur.length);
  },

  _bigCard(title, value, sub, bg, tc, path) {
    return `<div class="stat-card">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="stat-label">${title}</p>
          <p class="stat-value text-money truncate">${value}</p>
          <p class="stat-sub truncate">${sub}</p>
        </div>
        <div class="w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg class="w-5 h-5 ${tc}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/>
          </svg>
        </div>
      </div>
    </div>`;
  },

  _miniCard(label, value, bg, tc) {
    return `<div class="stat-card border ${bg}">
      <p class="stat-label">${label}</p>
      <p class="text-xl font-bold ${tc} text-money">${value}</p>
    </div>`;
  },

  _expBar(label, value, total, color) {
    const pct = total > 0 ? Math.min(100, Math.round(value / total * 100)) : 0;
    return `<div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="text-gray-600">${label}</span>
        <span class="font-semibold text-gray-800 text-money">${App.formatRupiah(value)}</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-1.5">
        <div class="${color} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
      </div>
    </div>`;
  },

  _skeleton() {
    return `<div class="page-header"><div>
      <div class="skeleton h-6 w-32 mb-2 rounded"></div>
      <div class="skeleton h-4 w-52 rounded"></div>
    </div></div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      ${Array(4).fill('<div class="stat-card"><div class="skeleton h-3 w-20 mb-3 rounded"></div><div class="skeleton h-7 w-32 mb-2 rounded"></div><div class="skeleton h-3 w-24 rounded"></div></div>').join('')}
    </div>
    <div class="skeleton h-40 w-full rounded-xl mb-5"></div>`;
  },

  _initChartRevenue(days, dailyMap) {
    const ctx = document.getElementById('chart-revenue');
    if (!ctx || typeof Chart === 'undefined') return;
    if (this._charts.revenue) this._charts.revenue.destroy();
    this._charts.revenue = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [
          { label: 'Omzet',        data: days.map(d => dailyMap[d]?.omzet || 0), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.07)', fill: true, tension: 0.4, pointRadius: 2 },
          { label: 'Net Diterima', data: days.map(d => dailyMap[d]?.net   || 0), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.05)',  fill: true, tension: 0.4, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => App.formatRupiah(c.raw) } },
        },
        scales: {
          y: { ticks: { callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? (v/1e3).toFixed(0)+'rb' : v, font: { size: 10 } }, grid: { color: '#f3f4f6' } },
          x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
        },
      },
    });
  },

  _initChartStatus(selesai, batal, gagal, retur) {
    const ctx = document.getElementById('chart-status');
    if (!ctx || typeof Chart === 'undefined') return;
    if (this._charts.status) this._charts.status.destroy();
    this._charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Berhasil', 'Dibatalkan', 'Gagal', 'Retur'],
        datasets: [{ data: [selesai, batal, gagal, retur], backgroundColor: ['#22c55e','#9ca3af','#ef4444','#f97316'], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 6 } } },
        cutout: '62%',
      },
    });
  },
};
