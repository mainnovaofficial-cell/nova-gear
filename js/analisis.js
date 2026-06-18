/* ═══════════════════════════════════════════════════════
   Nova Gear — Analisis Produk Module
   Margin per produk + simulasi harga
═══════════════════════════════════════════════════════ */
'use strict';

const Analisis = {
  _products: [],

  async onLoad() {
    const el = document.getElementById('page-analisis');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Analisis Produk</h2><p>Margin per SKU dan simulasi harga jual</p></div>
      <button onclick="Analisis.onLoad()" class="btn-secondary text-xs">Refresh</button>
    </div>
    <div id="analisis-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Analisis per SKU / Produk</span>
        <input id="analisis-q" type="text" class="input !py-1 text-xs w-48" placeholder="Cari produk..." oninput="Analisis._filterTable()"/>
      </div>
      <div id="analisis-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const db = App.db();
    const [{ data: orders }, { data: hpp }, settings] = await Promise.all([
      db.from('orders').select('sku,product_name,qty,selling_price,gross_revenue,net_revenue,status'),
      db.from('hpp_items').select('sku,product_name,cost_per_unit,qty'),
      App.getSettings(),
    ]);
    const freebieDefault = App.getFreebieDefaultPrice(settings);

    // Build per-SKU map dari pesanan berhasil (Selesai atau Dibayar — Dibayar diset
    // oleh Import Income untuk pesanan Selesai yang dananya sudah dirilis)
    const skuMap = {};
    (orders || []).filter(o => o.status === 'Selesai' || o.status === 'Dibayar').forEach(o => {
      const k = o.sku || o.product_name || 'TANPA-SKU';
      if (!skuMap[k]) skuMap[k] = { sku: k, name: o.product_name||k, sold: 0, gross: 0, net: 0, prices: [] };
      skuMap[k].sold  += +o.qty          || 1;
      skuMap[k].gross += +o.gross_revenue || 0;
      skuMap[k].net   += +o.net_revenue   || 0;
      if (o.selling_price) skuMap[k].prices.push(+o.selling_price);
    });

    // Merge HPP cost_per_unit
    const hppMap = {};
    (hpp || []).forEach(r => {
      const k = r.sku || r.product_name || 'TANPA-SKU';
      if (!hppMap[k] || +r.cost_per_unit > 0) hppMap[k] = +r.cost_per_unit || 0;
    });

    this._products = Object.values(skuMap).map(p => {
      const avgPrice = p.prices.length ? p.prices.reduce((s,v)=>s+v,0)/p.prices.length : (p.gross/Math.max(p.sold,1));
      const hpp      = (hppMap[p.sku] || hppMap[p.name] || 0) + (App.isFreebieSku(p.sku) ? freebieDefault : 0);
      const netPerUnit = p.sold > 0 ? p.net / p.sold : 0;
      const marginRp   = netPerUnit - hpp;
      const marginPct  = hpp > 0 ? (marginRp / hpp * 100) : (netPerUnit > 0 ? 100 : 0);
      return { ...p, avgPrice, hpp, netPerUnit, marginRp, marginPct };
    }).sort((a,b) => b.gross - a.gross);

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
      <div class="stat-card"><p class="stat-label">Total Produk SKU</p><p class="stat-value">${ps.length}</p><p class="stat-sub">tercatat terjual</p></div>
      <div class="stat-card"><p class="stat-label">Total Omzet</p><p class="stat-value text-money">${App.formatRupiah(totalGross)}</p><p class="stat-sub">semua produk</p></div>
      <div class="stat-card"><p class="stat-label">Rata-rata Margin</p><p class="stat-value ${avgMargin>=0?'text-green-600':'text-red-600'}">${avgMargin.toFixed(1)}%</p><p class="stat-sub">dari HPP</p></div>
      <div class="stat-card"><p class="stat-label">Produk Margin Tertinggi</p><p class="stat-value text-sm font-bold truncate">${best?.name||'-'}</p><p class="stat-sub">${best?best.marginPct.toFixed(1)+'%':''}</p></div>`;
  },

  _filterTable() {
    const q = document.getElementById('analisis-q').value.toLowerCase();
    const filtered = q ? this._products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : this._products;
    this._renderTable(filtered);
  },

  _renderTable(data) {
    const el = document.getElementById('analisis-table');
    if (!data.length) {
      el.innerHTML = `<div class="empty-state py-10"><p>Tidak ada data produk terjual</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>#</th><th>SKU</th><th>Nama Produk</th>
          <th class="text-right">Terjual</th>
          <th class="text-right">Omzet</th>
          <th class="text-right">Avg Harga Jual</th>
          <th class="text-right">HPP/Unit</th>
          <th class="text-right">Net/Unit</th>
          <th class="text-right">Margin (Rp)</th>
          <th class="text-right">Margin (%)</th>
          <th></th>
        </tr></thead>
        <tbody>${data.map((p, i) => {
          const mColor = p.marginPct >= 30 ? 'text-green-600' : p.marginPct >= 10 ? 'text-amber-600' : 'text-red-600';
          const mBadge = p.marginPct >= 30 ? 'badge-green' : p.marginPct >= 10 ? 'badge-yellow' : 'badge-red';
          return `<tr>
            <td class="text-gray-400">${i+1}</td>
            <td class="font-mono text-xs text-gray-500">${p.sku}</td>
            <td class="font-medium max-w-[160px] truncate" title="${p.name}">${p.name}</td>
            <td class="text-right font-semibold">${App.formatNumber(p.sold)}</td>
            <td class="text-right text-money">${App.formatRupiah(p.gross)}</td>
            <td class="text-right text-money">${App.formatRupiah(p.avgPrice)}</td>
            <td class="text-right text-money ${p.hpp>0?'':'text-gray-300'}">${p.hpp>0?App.formatRupiah(p.hpp):'Belum ada'}</td>
            <td class="text-right text-money">${App.formatRupiah(p.netPerUnit)}</td>
            <td class="text-right font-semibold ${mColor} text-money">${App.formatRupiah(p.marginRp)}</td>
            <td class="text-right"><span class="badge ${mBadge}">${p.marginPct.toFixed(1)}%</span></td>
            <td><button onclick="Analisis.openSim('${encodeURIComponent(JSON.stringify({sku:p.sku,name:p.name,hpp:p.hpp,avgPrice:p.avgPrice}))}')"
              class="text-blue-400 hover:text-blue-600 text-xs whitespace-nowrap transition-colors">Simulasi</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  },

  openSim(encoded) {
    const p = JSON.parse(decodeURIComponent(encoded));
    App.openModal({
      title: `Simulasi Harga — ${p.name}`,
      body: `
      <div class="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
        <p class="text-gray-500">SKU: <span class="font-mono font-semibold">${p.sku}</span></p>
        <p class="text-gray-500 mt-1">HPP per unit: <span class="font-semibold text-money">${App.formatRupiah(p.hpp)}</span></p>
        <p class="text-gray-500">Harga jual rata-rata saat ini: <span class="font-semibold text-money">${App.formatRupiah(p.avgPrice)}</span></p>
      </div>
      <div class="space-y-3">
        <div>
          <label class="label">HPP per Unit (Rp)</label>
          <input id="sim-hpp" type="number" class="input" value="${p.hpp}" oninput="Analisis._calcSim()"/>
        </div>
        <div>
          <label class="label">Harga Jual Simulasi (Rp)</label>
          <input id="sim-price" type="number" class="input" value="${p.avgPrice}" oninput="Analisis._calcSim()"/>
        </div>
        <div>
          <label class="label">Estimasi Potongan Shopee (%) — opsional</label>
          <input id="sim-cut" type="number" class="input" value="6" step="0.5" oninput="Analisis._calcSim()"/>
        </div>
      </div>
      <div id="sim-result" class="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2 text-sm"></div>`,
    });
    this._calcSim();
  },

  _calcSim() {
    const hpp   = +document.getElementById('sim-hpp')?.value   || 0;
    const price = +document.getElementById('sim-price')?.value || 0;
    const cut   = +document.getElementById('sim-cut')?.value   || 0;

    const cutRp    = price * cut / 100;
    const netPrice = price - cutRp;
    const margin   = netPrice - hpp;
    const marginPct = hpp > 0 ? (margin / hpp * 100) : 0;
    const roi       = hpp > 0 ? (margin / hpp * 100) : 0;
    const color     = margin >= 0 ? 'text-green-700' : 'text-red-700';
    const bgColor   = margin >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100';

    const el = document.getElementById('sim-result');
    if (!el) return;
    el.className = `mt-4 p-4 border rounded-xl space-y-2 text-sm ${bgColor}`;
    el.innerHTML = `
      <div class="flex justify-between"><span class="text-gray-600">Harga Jual</span><span class="font-semibold text-money">${App.formatRupiah(price)}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">Potongan Shopee (${cut}%)</span><span class="font-semibold text-money text-red-500">− ${App.formatRupiah(cutRp)}</span></div>
      <div class="flex justify-between border-t pt-2"><span class="text-gray-600">Net Diterima</span><span class="font-semibold text-money">${App.formatRupiah(netPrice)}</span></div>
      <div class="flex justify-between"><span class="text-gray-600">HPP per Unit</span><span class="font-semibold text-money text-red-500">− ${App.formatRupiah(hpp)}</span></div>
      <div class="flex justify-between border-t pt-2 text-base">
        <span class="font-bold ${color}">Laba per Unit</span>
        <span class="font-bold ${color} text-money">${App.formatRupiah(margin)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">Margin</span>
        <span class="font-bold ${color}">${marginPct.toFixed(1)}%</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">ROI</span>
        <span class="font-bold ${color}">${roi.toFixed(1)}%</span>
      </div>`;
  },
};
