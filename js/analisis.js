/* ═══════════════════════════════════════════════════════
   Nova Gear — Analisis Produk Module
   Mode Aktual (dari data Income/Orders yang sudah diimport)
   Mode Simulasi (kalkulator manual untuk produk baru)
═══════════════════════════════════════════════════════ */
'use strict';

const Analisis = {
  _mode: 'aktual',
  _products: [],   // grouped per Nama Produk, masing-masing punya .skus[]
  _expanded: new Set(),

  async onLoad() {
    const el = document.getElementById('page-analisis');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Analisis Produk</h2><p>Margin aktual dari data Income, atau simulasi harga produk baru</p></div>
      <button onclick="Analisis.onLoad()" class="btn-secondary text-xs">Refresh</button>
    </div>
    <div class="tabs mb-4">
      <button id="analisis-tab-aktual"   class="tab-btn ${this._mode==='aktual'?'active':''}"   onclick="Analisis._switchMode('aktual')">Aktual</button>
      <button id="analisis-tab-simulasi" class="tab-btn ${this._mode==='simulasi'?'active':''}" onclick="Analisis._switchMode('simulasi')">Simulasi Produk Baru</button>
    </div>
    <div id="analisis-content"></div>`;
    await this._load();
    this._renderMode();
  },

  _switchMode(mode) {
    this._mode = mode;
    document.getElementById('analisis-tab-aktual')?.classList.toggle('active', mode === 'aktual');
    document.getElementById('analisis-tab-simulasi')?.classList.toggle('active', mode === 'simulasi');
    this._renderMode();
  },

  _renderMode() {
    if (this._mode === 'simulasi') this._renderSimulasi();
    else this._renderAktual();
  },

  /* ═══════════════════════════════════════════════
     MODE 1 — AKTUAL (dari income_releases & orders)
  ═══════════════════════════════════════════════ */
  async _load() {
    const db = App.db();
    const [{ data: orders }, { data: releases }, { data: hpp }, settings] = await Promise.all([
      db.from('orders').select('order_no,sku,product_name,qty,gross_revenue,net_revenue,status'),
      db.from('income_releases').select('order_no,gross_amount,discount,voucher_seller,net_amount'),
      db.from('hpp_items').select('sku,cost_per_unit,created_at').order('created_at', { ascending: false }),
      App.getSettings(),
    ]);
    const freebieDefault = App.getFreebieDefaultPrice(settings);

    // Pesanan berhasil (Selesai/Dibayar) saja
    const soldLines = (orders || []).filter(o => o.status === 'Selesai' || o.status === 'Dibayar');

    // Total omzet (gross_revenue) per order_no — dipakai untuk mengalokasikan
    // potongan/net per-order dari income_releases ke tiap baris SKU (kasus multi-item order)
    const orderGrossTotal = {};
    soldLines.forEach(o => {
      const key = o.order_no || o.product_name;
      orderGrossTotal[key] = (orderGrossTotal[key] || 0) + (+o.gross_revenue || 0);
    });
    const orderLineCount = {};
    soldLines.forEach(o => {
      const key = o.order_no || o.product_name;
      orderLineCount[key] = (orderLineCount[key] || 0) + 1;
    });

    const incomeMap = {};
    (releases || []).forEach(r => { incomeMap[r.order_no] = r; });

    // HPP terbaru per SKU
    const hppMap = {};
    (hpp || []).forEach(r => {
      const k = r.sku;
      if (!k || k in hppMap) return; // sudah descending → pertama ditemukan = terbaru
      hppMap[k] = +r.cost_per_unit || 0;
    });

    // Build per-SKU aggregate
    const skuMap = {};
    soldLines.forEach(o => {
      const k = o.sku || o.product_name || 'TANPA-SKU';
      if (!skuMap[k]) skuMap[k] = { sku: k, name: o.product_name || k, sold: 0, gross: 0, potongan: 0, net: 0 };

      const key       = o.order_no || o.product_name;
      const orderTotal = orderGrossTotal[key] || 0;
      const share      = orderTotal > 0 ? (+o.gross_revenue || 0) / orderTotal : 1 / (orderLineCount[key] || 1);
      const income     = o.order_no ? incomeMap[o.order_no] : null;

      let linePotongan = 0;
      let lineNet      = +o.net_revenue || 0; // fallback kalau belum ada data Income utk order ini
      if (income) {
        linePotongan = -((+income.discount || 0) + (+income.voucher_seller || 0)) * share;
        lineNet      = (+income.net_amount || 0) * share;
      }

      skuMap[k].sold     += +o.qty || 1;
      skuMap[k].gross    += +o.gross_revenue || 0;
      skuMap[k].potongan += linePotongan;
      skuMap[k].net      += lineNet;
    });

    const skuList = Object.values(skuMap).map(p => {
      const hppUnit  = (hppMap[p.sku] || 0) + (App.isFreebieSku(p.sku) ? freebieDefault : 0);
      const hppTotal = p.sold * hppUnit;
      const profit   = p.net - hppTotal;
      const marginPct = hppTotal > 0 ? (profit / hppTotal * 100) : (profit > 0 ? 100 : 0);
      return { ...p, hppUnit, hppTotal, profit, marginPct };
    });

    // Group per Nama Produk (gabung semua varian SKU)
    const productMap = {};
    skuList.forEach(p => {
      const name = p.name || p.sku;
      if (!productMap[name]) productMap[name] = { name, sold: 0, gross: 0, potongan: 0, net: 0, hppTotal: 0, profit: 0, skus: [] };
      const g = productMap[name];
      g.sold     += p.sold;
      g.gross    += p.gross;
      g.potongan += p.potongan;
      g.net      += p.net;
      g.hppTotal += p.hppTotal;
      g.profit   += p.profit;
      g.skus.push(p);
    });

    this._products = Object.values(productMap).map(g => ({
      ...g,
      marginPct: g.hppTotal > 0 ? (g.profit / g.hppTotal * 100) : (g.profit > 0 ? 100 : 0),
    })).sort((a, b) => b.gross - a.gross);
  },

  _renderAktual() {
    const content = document.getElementById('analisis-content');
    content.innerHTML = `
    <div id="analisis-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Margin per Produk (Aktual)</span>
        <input id="analisis-q" type="text" class="input !py-1 text-xs w-48" placeholder="Cari produk..." oninput="Analisis._filterTable()"/>
      </div>
      <p class="text-xs text-gray-400 mb-3">Klik nama produk untuk lihat breakdown per SKU/varian. Potongan Shopee dialokasikan proporsional dari data Income per pesanan.</p>
      <div id="analisis-table"></div>
    </div>`;
    this._renderSummary();
    this._renderTable(this._products);
  },

  _renderSummary() {
    const ps    = this._products;
    const totalGross = ps.reduce((s,p) => s+p.gross, 0);
    const totalNet   = ps.reduce((s,p) => s+p.net,   0);
    const avgMargin  = ps.length ? ps.reduce((s,p) => s+p.marginPct, 0) / ps.length : 0;
    const best       = [...ps].sort((a,b) => b.marginPct-a.marginPct)[0];
    document.getElementById('analisis-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Produk</p><p class="stat-value">${ps.length}</p><p class="stat-sub">tercatat terjual</p></div>
      <div class="stat-card"><p class="stat-label">Total Omzet</p><p class="stat-value text-money">${App.formatRupiah(totalGross)}</p><p class="stat-sub">semua produk</p></div>
      <div class="stat-card"><p class="stat-label">Rata-rata Margin</p><p class="stat-value ${avgMargin>=0?'text-green-600':'text-red-600'}">${avgMargin.toFixed(1)}%</p><p class="stat-sub">dari HPP</p></div>
      <div class="stat-card"><p class="stat-label">Produk Margin Tertinggi</p><p class="stat-value text-sm font-bold truncate">${best?.name||'-'}</p><p class="stat-sub">${best?best.marginPct.toFixed(1)+'%':''}</p></div>`;
  },

  _filterTable() {
    const q = document.getElementById('analisis-q').value.toLowerCase();
    const filtered = q ? this._products.filter(p =>
      p.name.toLowerCase().includes(q) || p.skus.some(s => s.sku.toLowerCase().includes(q))
    ) : this._products;
    this._renderTable(filtered);
  },

  _toggleExpand(name) {
    if (this._expanded.has(name)) this._expanded.delete(name);
    else this._expanded.add(name);
    this._filterTable();
  },

  _renderTable(data) {
    const el = document.getElementById('analisis-table');
    if (!data.length) {
      el.innerHTML = `<div class="empty-state py-10"><p>Tidak ada data produk terjual</p></div>`;
      return;
    }
    const mClass = pct => pct >= 30 ? 'text-green-600' : pct >= 10 ? 'text-amber-600' : 'text-red-600';
    const mBadge = pct => pct >= 30 ? 'badge-green' : pct >= 10 ? 'badge-yellow' : 'badge-red';

    const skuRow = s => `<tr class="bg-gray-50/60">
      <td></td>
      <td class="font-mono text-xs text-gray-500 pl-4">└ ${s.sku}</td>
      <td class="text-right text-sm">${App.formatNumber(s.sold)}</td>
      <td class="text-right text-money text-sm">${App.formatRupiah(s.gross)}</td>
      <td class="text-right text-money text-sm text-red-500">${App.formatRupiah(s.potongan)}</td>
      <td class="text-right text-money text-sm ${s.hppTotal>0?'':'text-gray-300'}">${s.hppTotal>0?App.formatRupiah(s.hppTotal):'Belum ada'}</td>
      <td class="text-right font-semibold text-money text-sm ${mClass(s.marginPct)}">${App.formatRupiah(s.profit)}</td>
      <td class="text-right"><span class="badge ${mBadge(s.marginPct)}">${s.marginPct.toFixed(1)}%</span></td>
    </tr>`;

    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th></th><th>Nama Produk / SKU</th>
          <th class="text-right">Terjual</th>
          <th class="text-right">Omzet</th>
          <th class="text-right">Potongan Shopee</th>
          <th class="text-right">HPP Total</th>
          <th class="text-right">Profit</th>
          <th class="text-right">Margin %</th>
        </tr></thead>
        <tbody>${data.map(p => {
          const expanded = this._expanded.has(p.name);
          const hasMulti = p.skus.length > 1;
          const arrow = `<button onclick="Analisis._toggleExpand('${p.name.replace(/'/g, "\\'")}')" class="text-gray-400 hover:text-gray-700 transition-transform ${expanded ? 'rotate-90' : ''} inline-block">▶</button>`;
          const mainRow = `<tr class="cursor-pointer" onclick="Analisis._toggleExpand('${p.name.replace(/'/g, "\\'")}')">
            <td class="text-center">${arrow}</td>
            <td class="font-medium max-w-[200px] truncate" title="${p.name}">${p.name}${hasMulti ? ` <span class="badge badge-blue">${p.skus.length} varian</span>` : ''}</td>
            <td class="text-right font-semibold">${App.formatNumber(p.sold)}</td>
            <td class="text-right text-money">${App.formatRupiah(p.gross)}</td>
            <td class="text-right text-money text-red-500">${App.formatRupiah(p.potongan)}</td>
            <td class="text-right text-money ${p.hppTotal>0?'':'text-gray-300'}">${p.hppTotal>0?App.formatRupiah(p.hppTotal):'Belum ada'}</td>
            <td class="text-right font-semibold text-money ${mClass(p.marginPct)}">${App.formatRupiah(p.profit)}</td>
            <td class="text-right"><span class="badge ${mBadge(p.marginPct)}">${p.marginPct.toFixed(1)}%</span></td>
          </tr>`;
          const subRows = expanded ? p.skus.map(skuRow).join('') : '';
          return mainRow + subRows;
        }).join('')}</tbody>
      </table>
    </div>`;
  },

  /* ═══════════════════════════════════════════════
     MODE 2 — SIMULASI (produk baru, input manual)
  ═══════════════════════════════════════════════ */
  _renderSimulasi() {
    const content = document.getElementById('analisis-content');
    content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="card">
        <h3 class="card-title mb-4">Simulasi Harga Produk Baru</h3>
        <div class="space-y-3">
          <div><label class="label">Nama Produk</label>
            <input id="sim2-name" class="input" placeholder="Nama produk (opsional)"/>
          </div>
          <div><label class="label">Modal / HPP (Rp)</label>
            <input id="sim2-hpp" type="number" class="input" value="0" min="0" oninput="Analisis._calcSimLive()"/>
          </div>
          <div><label class="label">Harga Jual (Rp)</label>
            <input id="sim2-price" type="number" class="input" value="0" min="0" oninput="Analisis._calcSimLive()"/>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label">Biaya Layanan (%)</label>
              <input id="sim2-layanan" type="number" class="input" value="0" step="0.1" min="0" oninput="Analisis._calcSimLive()"/>
            </div>
            <div><label class="label">Gratis Ongkir (%)</label>
              <input id="sim2-ongkir" type="number" class="input" value="0" step="0.1" min="0" oninput="Analisis._calcSimLive()"/>
            </div>
            <div><label class="label">Promo Xtra (%)</label>
              <input id="sim2-promo" type="number" class="input" value="0" step="0.1" min="0" oninput="Analisis._calcSimLive()"/>
            </div>
            <div><label class="label">Affiliate (%)</label>
              <input id="sim2-affiliate" type="number" class="input" value="0" step="0.1" min="0" oninput="Analisis._calcSimLive()"/>
            </div>
          </div>
          <div><label class="label">Biaya Proses Pesanan (Rp)</label>
            <input id="sim2-proses" type="number" class="input" value="1250" step="50" min="0" oninput="Analisis._calcSimLive()"/>
          </div>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title mb-4">Hasil Simulasi</h3>
        <div id="sim2-result"></div>
      </div>
    </div>`;
    this._calcSimLive();
  },

  _calcSimLive() {
    const hpp        = +document.getElementById('sim2-hpp')?.value        || 0;
    const price       = +document.getElementById('sim2-price')?.value      || 0;
    const layananPct  = +document.getElementById('sim2-layanan')?.value    || 0;
    const ongkirPct   = +document.getElementById('sim2-ongkir')?.value     || 0;
    const promoPct    = +document.getElementById('sim2-promo')?.value      || 0;
    const affiliatePct= +document.getElementById('sim2-affiliate')?.value  || 0;
    const prosesRp     = +document.getElementById('sim2-proses')?.value    || 0;

    const totalPotonganPct = layananPct + ongkirPct + promoPct + affiliatePct;
    const potonganPersenRp = price * totalPotonganPct / 100;
    const totalPotonganRp  = potonganPersenRp + prosesRp;
    const netDiterima      = price - totalPotonganRp;
    const profit           = netDiterima - hpp;
    const marginPct        = price > 0 ? (profit / price * 100) : 0;
    const roiPct           = hpp > 0 ? (profit / hpp * 100) : 0;
    const color            = profit >= 0 ? 'text-green-700' : 'text-red-700';
    const bgColor           = profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100';

    const el = document.getElementById('sim2-result');
    if (!el) return;
    el.innerHTML = `
      <div class="p-4 border rounded-xl space-y-2 text-sm ${bgColor}">
        <div class="flex justify-between"><span class="text-gray-600">Harga Jual</span><span class="font-semibold text-money">${App.formatRupiah(price)}</span></div>
        <div class="flex justify-between"><span class="text-gray-600">Potongan Shopee (${totalPotonganPct.toFixed(1)}%)</span><span class="font-semibold text-money text-red-500">− ${App.formatRupiah(potonganPersenRp)}</span></div>
        <div class="flex justify-between"><span class="text-gray-600">Biaya Proses Pesanan</span><span class="font-semibold text-money text-red-500">− ${App.formatRupiah(prosesRp)}</span></div>
        <div class="flex justify-between border-t pt-2"><span class="text-gray-600">Net Diterima</span><span class="font-semibold text-money">${App.formatRupiah(netDiterima)}</span></div>
        <div class="flex justify-between"><span class="text-gray-600">Modal / HPP</span><span class="font-semibold text-money text-red-500">− ${App.formatRupiah(hpp)}</span></div>
        <div class="flex justify-between border-t pt-2 text-base">
          <span class="font-bold ${color}">Profit per Unit</span>
          <span class="font-bold ${color} text-money">${App.formatRupiah(profit)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Margin (dari harga jual)</span>
          <span class="font-bold ${color}">${marginPct.toFixed(1)}%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">ROI (dari modal)</span>
          <span class="font-bold ${color}">${roiPct.toFixed(1)}%</span>
        </div>
      </div>`;
  },
};
