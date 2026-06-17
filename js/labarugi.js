/* ═══════════════════════════════════════════════════════
   Nova Gear — Laba Rugi Module
   Laporan P&L otomatis dari semua data
═══════════════════════════════════════════════════════ */
'use strict';

const LabaRugi = {
  async onLoad() {
    const now = App.todayISO();
    const el  = document.getElementById('page-labarugi');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Laba Rugi</h2><p>Laporan otomatis dari seluruh data toko</p></div>
      <div class="flex gap-2 flex-wrap items-center">
        <input id="lr-from" type="date" class="input !py-1 text-xs w-36" value="${now.slice(0,7)+'-01'}"/>
        <input id="lr-to"   type="date" class="input !py-1 text-xs w-36" value="${now}"/>
        <button onclick="LabaRugi._render()" class="btn-primary text-xs">Hitung</button>
        <button onclick="LabaRugi._print()" class="btn-secondary text-xs">Print / PDF</button>
      </div>
    </div>
    <div id="lr-content"><div class="skeleton h-60 rounded-xl"></div></div>`;
    await this._render();
  },

  async _render() {
    const from = document.getElementById('lr-from')?.value || '';
    const to   = document.getElementById('lr-to')?.value   || '';
    const el   = document.getElementById('lr-content');
    el.innerHTML = `<div class="skeleton h-60 rounded-xl"></div>`;

    try {
      const db = App.db();
      const settings  = await App.getSettings();
      const modalAwal = parseFloat(settings.modal_awal || 0);

      let ordersQ = db.from('orders').select('status,gross_revenue,net_revenue,shopee_commission,shopee_service_fee,shopee_ads_fee,shopee_other_fee,qty,sku');
      let hppQ    = db.from('hpp_batches').select('purchase_date,hpp_items(total_cost)');
      let adsQ    = db.from('ads').select('cost,ad_date');
      let opQ     = db.from('operational').select('cost,op_date');

      if (from) {
        ordersQ = ordersQ.gte('order_date', from);
        hppQ    = hppQ.gte('purchase_date', from);
        adsQ    = adsQ.gte('ad_date', from);
        opQ     = opQ.gte('op_date', from);
      }
      if (to) {
        ordersQ = ordersQ.lte('order_date', to);
        hppQ    = hppQ.lte('purchase_date', to);
        adsQ    = adsQ.lte('ad_date', to);
        opQ     = opQ.lte('op_date', to);
      }

      const [{ data: orders }, { data: hppBatches }, { data: ads }, { data: ops }] = await Promise.all([ordersQ, hppQ, adsQ, opQ]);

      const hpp = (hppBatches || []).flatMap(b => b.hpp_items || []);

      const sum = (arr, key) => (arr||[]).reduce((s,r) => s+(+r[key]||0), 0);

      const all      = orders || [];
      const selesai  = all.filter(o => o.status === 'Selesai');
      const batal    = all.filter(o => o.status === 'Batal');
      const gagal    = all.filter(o => o.status === 'Gagal Kirim');
      const retur    = all.filter(o => o.status === 'Dikembalikan');

      const omzet      = sum(selesai, 'gross_revenue');
      const potKomisi  = sum(selesai, 'shopee_commission');
      const potLayanan = sum(selesai, 'shopee_service_fee');
      const potIklan   = sum(selesai, 'shopee_ads_fee');
      const potLain    = sum(selesai, 'shopee_other_fee');
      const totalPot   = potKomisi + potLayanan + potIklan + potLain;
      const netRev     = sum(selesai, 'net_revenue') || (omzet - totalPot);

      // HPP per unit = HPP dari hpp_items + freebie (kalau SKU pesanan berakhiran "-F")
      const freebieDefault = App.getFreebieDefaultPrice(settings);
      const purchaseHPP    = sum(hpp, 'total_cost');
      const totalFreebie   = selesai
        .filter(o => App.isFreebieSku(o.sku))
        .reduce((s,o) => s + (+o.qty || 1) * freebieDefault, 0);
      const totalHPP   = purchaseHPP + totalFreebie;
      const labaKotor  = netRev - totalHPP;

      const totalAds   = sum(ads, 'cost');
      const totalOps   = sum(ops, 'cost');
      const totalBeban = totalAds + totalOps;

      const labaBersih      = labaKotor - totalBeban;
      const marginPct       = omzet > 0 ? (labaBersih / omzet * 100) : 0;
      const totalPemasukan  = netRev;
      const totalPengeluaran = totalHPP + totalAds + totalOps;
      const sisaKas         = modalAwal + totalPemasukan - totalPengeluaran;

      const label = from && to ? `${App.formatDate(from)} – ${App.formatDate(to)}` : 'Semua Waktu';

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
          ${this._section('PENDAPATAN', [
            { label: 'Omzet Kotor (Gross Revenue)', value: omzet, main: true },
          ])}
          ${this._subsection('Potongan Shopee', [
            { label: 'Komisi Shopee', value: -potKomisi },
            { label: 'Biaya Layanan', value: -potLayanan },
            { label: 'Biaya Program Iklan Shopee', value: -potIklan },
            { label: 'Biaya Lainnya', value: -potLain },
          ])}
          ${this._total('Net Diterima (setelah potongan)', netRev, netRev >= 0 ? 'text-blue-700' : 'text-red-600')}

          <!-- HPP -->
          ${this._section('HARGA POKOK PENJUALAN', [
            { label: 'Modal Barang (Pembelian)', value: -purchaseHPP, main: true },
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
          <p class="card-title mb-3">Ringkasan Pesanan</p>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            ${[['Total Pesanan',all.length,''],['Selesai',selesai.length,'text-green-600'],['Dibatalkan',batal.length,'text-gray-500'],['Gagal',gagal.length,'text-red-600'],['Retur',retur.length,'text-orange-600']].map(([l,v,c])=>`
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500">${l}</p>
              <p class="text-xl font-bold ${c}">${App.formatNumber(v)}</p>
            </div>`).join('')}
          </div>
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
