/* ═══════════════════════════════════════════════════════
   Nova Gear — Laba Rugi Module
   Laporan P&L otomatis dari Income Releases (Shopee) + HPP + Beban
═══════════════════════════════════════════════════════ */
'use strict';

const LabaRugi = {
  _bulanNames: ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],

  async onLoad() {
    const now   = new Date();
    const el    = document.getElementById('page-labarugi');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Laba Rugi</h2><p>Laporan otomatis berdasarkan bulan rilis dana (Income Shopee)</p></div>
      <div class="flex gap-2 flex-wrap items-center">
        <select id="lr-bulan" class="input !py-1 text-xs">
          ${this._bulanNames.map((m, i) => i === 0 ? '' : `<option value="${i}" ${i === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <input id="lr-tahun" type="number" class="input !py-1 text-xs w-24" value="${now.getFullYear()}" min="2020" max="2035"/>
        <button onclick="LabaRugi._render()" class="btn-primary text-xs">Hitung</button>
        <button onclick="LabaRugi._print()" class="btn-secondary text-xs">Print / PDF</button>
      </div>
    </div>
    <div id="lr-content"><div class="skeleton h-60 rounded-xl"></div></div>`;
    await this._render();
  },

  async _render() {
    const bulan = parseInt(document.getElementById('lr-bulan')?.value) || (new Date().getMonth() + 1);
    const tahun = parseInt(document.getElementById('lr-tahun')?.value) || new Date().getFullYear();
    const el    = document.getElementById('lr-content');
    el.innerHTML = `<div class="skeleton h-60 rounded-xl"></div>`;

    try {
      const db = App.db();
      const settings  = await App.getSettings();
      const modalAwal = parseFloat(settings.modal_awal || 0);

      const dateFrom = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
      const nextMonth = new Date(tahun, bulan, 1); // bulan 1-based → index ini = bulan berikutnya
      const dateTo = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // ── 1. Income releases bulan ini (Net Diterima) ──
      const { data: releasesData, error: relErr } = await db
        .from('income_releases')
        .select('order_no,release_date,gross_amount,discount,voucher_seller,net_amount')
        .gte('release_date', dateFrom)
        .lt('release_date', dateTo);
      if (relErr) throw relErr;
      const releases = releasesData || [];
      const orderNos = [...new Set(releases.map(r => r.order_no).filter(Boolean))];

      // ── 2. Order lines (qty, sku) untuk pesanan Dibayar yang match income bulan ini ──
      let orderLines = [];
      if (orderNos.length) {
        const BATCH = 100;
        for (let i = 0; i < orderNos.length; i += BATCH) {
          const chunk = orderNos.slice(i, i + BATCH);
          const { data, error } = await db
            .from('orders')
            .select('order_no,sku,qty,status')
            .eq('status', 'Dibayar')
            .in('order_no', chunk);
          if (error) throw error;
          orderLines.push(...(data || []));
        }
      }

      // ── 3. HPP per SKU terbaru ──
      const { data: hppItemsData, error: hppErr } = await db
        .from('hpp_items')
        .select('sku,cost_per_unit,created_at,hpp_batches(purchase_date)')
        .order('created_at', { ascending: false });
      if (hppErr) throw hppErr;
      const hppMap = {};
      (hppItemsData || []).forEach(r => {
        const k = r.sku;
        if (!k || k in hppMap) return; // sudah descending → pertama ditemukan = terbaru
        hppMap[k] = +r.cost_per_unit || 0;
      });

      // ── 4. Ads & Operasional bulan ini ──
      const [{ data: ads, error: adsErr }, { data: ops, error: opsErr }] = await Promise.all([
        db.from('ads').select('cost,ad_date').gte('ad_date', dateFrom).lt('ad_date', dateTo),
        db.from('operational').select('cost,op_date').gte('op_date', dateFrom).lt('op_date', dateTo),
      ]);
      if (adsErr) throw adsErr;
      if (opsErr) throw opsErr;

      const sum = (arr, key) => (arr || []).reduce((s, r) => s + (+r[key] || 0), 0);

      const grossAmount = sum(releases, 'gross_amount');
      const discount    = sum(releases, 'discount');
      const voucher     = sum(releases, 'voucher_seller');
      const netRev      = sum(releases, 'net_amount');

      // HPP = qty × HPP per unit per SKU (hpp_items) — kecuali SKU freebie "-F" → freebie default
      const freebieDefault = App.getFreebieDefaultPrice(settings);
      let totalHPPBarang = 0;
      let totalFreebie   = 0;
      let qtyTerjual     = 0;
      orderLines.forEach(o => {
        const qty = +o.qty || 1;
        qtyTerjual += qty;
        if (App.isFreebieSku(o.sku)) {
          totalFreebie += qty * freebieDefault;
        } else {
          totalHPPBarang += qty * (hppMap[o.sku] || 0);
        }
      });
      const totalHPP  = totalHPPBarang + totalFreebie;
      const labaKotor = netRev - totalHPP;

      const totalAds   = sum(ads, 'cost');
      const totalOps   = sum(ops, 'cost');
      const totalBeban = totalAds + totalOps;

      const labaBersih       = labaKotor - totalBeban;
      const marginPct        = grossAmount > 0 ? (labaBersih / grossAmount * 100) : 0;
      const totalPemasukan   = netRev;
      const totalPengeluaran = totalHPP + totalAds + totalOps;
      const sisaKas          = modalAwal + totalPemasukan - totalPengeluaran;

      const uniqueOrders   = orderNos.length;
      const unmatchedCount = orderNos.length - new Set(orderLines.map(o => o.order_no)).size;

      const label = `${this._bulanNames[bulan]} ${tahun}`;

      el.innerHTML = `
      <div id="lr-print-area" class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="card mb-4 text-center !py-5">
          <h3 class="text-lg font-bold text-gray-900">Laporan Laba Rugi</h3>
          <p class="text-sm text-gray-500 mt-1">Nova Gear — ${label}</p>
        </div>

        <!-- P&L Statement -->
        <div class="card space-y-0 !p-0 overflow-hidden">

          <!-- PENDAPATAN -->
          ${this._section('PENDAPATAN (INCOME RELEASES)', [
            { label: 'Harga Asli Produk', value: grossAmount, main: true },
          ])}
          ${this._subsection('Potongan', [
            { label: 'Total Diskon Produk', value: discount },
            { label: 'Voucher Disponsori Penjual', value: voucher },
          ])}
          ${this._total('Net Diterima', netRev, netRev >= 0 ? 'text-blue-700' : 'text-red-600')}

          <!-- HPP -->
          ${this._section('HARGA POKOK PENJUALAN', [
            { label: 'HPP Barang (qty × HPP per SKU)', value: -totalHPPBarang, main: true },
          ])}
          ${this._subsection('Tambahan Biaya', [
            { label: 'Freebie (SKU berakhiran "-F")', value: -totalFreebie },
          ])}
          ${this._total('Total HPP', -totalHPP, 'text-red-600')}
          ${this._total('Laba Kotor', labaKotor, labaKotor >= 0 ? 'text-green-700' : 'text-red-600')}

          <!-- BEBAN -->
          ${this._section('BEBAN USAHA', [
            { label: 'Iklan & Marketing', value: -totalAds, main: true },
            { label: 'Biaya Operasional', value: -totalOps, main: true },
          ])}
          ${this._total('Total Beban Usaha', -totalBeban, 'text-orange-700')}

          <!-- LABA BERSIH -->
          <div class="px-5 py-4 ${labaBersih >= 0 ? 'bg-green-50' : 'bg-red-50'} border-t-2 ${labaBersih >= 0 ? 'border-green-200' : 'border-red-200'}">
            <div class="flex justify-between items-center">
              <span class="font-black text-base ${labaBersih >= 0 ? 'text-green-800' : 'text-red-800'}">LABA BERSIH</span>
              <span class="font-black text-xl text-money ${labaBersih >= 0 ? 'text-green-700' : 'text-red-700'}">${App.formatRupiah(labaBersih)}</span>
            </div>
            <p class="text-xs ${labaBersih >= 0 ? 'text-green-600' : 'text-red-500'} mt-1">Margin: ${marginPct.toFixed(2)}% dari omzet</p>
          </div>

          <!-- POSISI KAS -->
          <div class="px-5 py-4 bg-sky-50 border-t-2 border-sky-200">
            <p class="text-xs font-black text-sky-500 uppercase tracking-widest mb-3">POSISI KAS</p>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between items-center">
                <span class="text-sky-700">Modal Awal</span>
                <span class="font-semibold text-money text-sky-800">${App.formatRupiah(modalAwal)}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sky-700">+ Total Pemasukan (Net Diterima)</span>
                <span class="font-semibold text-money text-sky-800">${App.formatRupiah(totalPemasukan)}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sky-700">− Total Pengeluaran (HPP + Iklan + Ops)</span>
                <span class="font-semibold text-money text-red-600">${App.formatRupiah(totalPengeluaran)}</span>
              </div>
            </div>
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-sky-200">
              <span class="font-black text-base text-sky-800">SISA KAS</span>
              <span class="font-black text-xl text-money ${sisaKas >= 0 ? 'text-sky-700' : 'text-red-700'}">${App.formatRupiah(sisaKas)}</span>
            </div>
          </div>
        </div>

        <!-- Order summary -->
        <div class="card mt-4">
          <p class="card-title mb-3">Ringkasan Pesanan Dibayar</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            ${[['Pesanan di Income', uniqueOrders, ''], ['Item Terjual (Qty)', qtyTerjual, 'text-blue-600'], ['Tanpa Data Qty', Math.max(unmatchedCount, 0), unmatchedCount > 0 ? 'text-orange-600' : 'text-gray-400']].map(([l, v, c]) => `
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500">${l}</p>
              <p class="text-xl font-bold ${c}">${App.formatNumber(v)}</p>
            </div>`).join('')}
          </div>
          ${unmatchedCount > 0 ? `<p class="text-xs text-orange-600 mt-3">${unmatchedCount} pesanan ada di file Income tapi tidak ditemukan sebagai pesanan status "Dibayar" di tabel Pesanan (HPP/Freebie-nya tidak terhitung).</p>` : ''}
        </div>
      </div>`;
    } catch (err) {
      el.innerHTML = `<div class="card text-red-600 text-sm p-6">Gagal menghitung: ${err.message}</div>`;
    }
  },

  _section(title, items) {
    return `<div class="px-5 py-3 bg-gray-50 border-b border-gray-100">
      <p class="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">${title}</p>
      ${items.map(i => `<div class="flex justify-between items-center py-1">
        <span class="text-sm ${i.main ? 'font-semibold text-gray-800' : 'text-gray-600'}">${i.label}</span>
        <span class="font-semibold text-sm text-money ${+i.value < 0 ? 'text-red-600' : 'text-gray-800'}">${App.formatRupiah(i.value)}</span>
      </div>`).join('')}
    </div>`;
  },

  _subsection(title, items) {
    const hasValues = items.some(i => +i.value !== 0);
    if (!hasValues) return '';
    return `<div class="px-5 py-2 bg-white border-b border-gray-100">
      <p class="text-xs text-gray-400 mb-1 ml-2">${title}</p>
      ${items.filter(i => +i.value !== 0).map(i => `<div class="flex justify-between items-center py-0.5 ml-4">
        <span class="text-xs text-gray-500">${i.label}</span>
        <span class="text-xs text-money text-red-500">${App.formatRupiah(i.value)}</span>
      </div>`).join('')}
    </div>`;
  },

  _total(label, value, colorClass) {
    return `<div class="flex justify-between items-center px-5 py-3 border-b border-gray-200 bg-white">
      <span class="font-bold text-sm text-gray-700">${label}</span>
      <span class="font-bold text-base text-money ${colorClass}">${App.formatRupiah(value)}</span>
    </div>`;
  },

  _print() {
    const area = document.getElementById('lr-print-area');
    if (!area) { App.toast('Tidak ada data untuk diprint.', 'warning'); return; }
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Laba Rugi — Nova Gear</title>
      <style>
        body { font-family: system-ui; margin: 2rem; font-size: 13px; color: #111; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
        .money { font-variant-numeric: tabular-nums; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 8px; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>${area.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  },
};
