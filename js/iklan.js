/* ═══════════════════════════════════════════════════════
   Nova Gear — Iklan & Marketing Module
═══════════════════════════════════════════════════════ */
'use strict';

const Iklan = {
  _data: [],

  async onLoad() {
    const el = document.getElementById('page-iklan');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Iklan & Marketing</h2><p>Catat biaya iklan per platform dan kampanye</p></div>
      <div class="flex gap-2">
        <button onclick="Iklan.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Iklan
        </button>
      </div>
    </div>
    <div id="iklan-summary" class="grid grid-cols-1 sm:max-w-xs gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Iklan</span>
        <button onclick="Iklan._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
      </div>
      <div id="iklan-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('ads').select('*').order('ad_date', { ascending: false });
    if (error) { App.toast('Gagal memuat data iklan.', 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _renderSummary() {
    const d = this._data;
    const totalCost = d.reduce((s,r) => s+(+r.cost||0), 0);

    document.getElementById('iklan-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Biaya Iklan</p><p class="stat-value text-money">${App.formatRupiah(totalCost)}</p><p class="stat-sub">semua platform</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('iklan-table');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><p>Belum ada data iklan</p></div>`;
      return;
    }
    const platformColor = {
      'Shopee Ads': 'badge-orange', 'Meta': 'badge-blue', 'TikTok': 'badge-gray',
      'Google': 'badge-green', 'default': 'badge-blue',
    };
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Tanggal</th><th>Platform</th><th>Kampanye</th>
          <th class="text-right">Biaya</th><th class="text-right">Impresi</th>
          <th class="text-right">Klik</th><th class="text-right">Order</th><th class="text-right">CPO</th><th></th>
        </tr></thead>
        <tbody>${this._data.map(r => {
          const cpo = (+r.orders_count||0) > 0 ? (+r.cost||0) / (+r.orders_count) : 0;
          return `<tr>
            <td class="whitespace-nowrap">${App.formatDate(r.ad_date)}</td>
            <td><span class="badge ${platformColor[r.platform]||platformColor.default}">${r.platform||'-'}</span></td>
            <td class="max-w-[160px] truncate">${r.campaign_name||'-'}</td>
            <td class="text-right font-semibold text-money">${App.formatRupiah(r.cost)}</td>
            <td class="text-right text-gray-500">${App.formatNumber(r.impressions||0)}</td>
            <td class="text-right text-gray-500">${App.formatNumber(r.clicks||0)}</td>
            <td class="text-right">${App.formatNumber(r.orders_count||0)}</td>
            <td class="text-right text-xs text-money">${cpo > 0 ? App.formatRupiah(cpo) : '-'}</td>
            <td><button onclick="Iklan.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Biaya Iklan',
      body: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="label">Tanggal *</label><input id="ik-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Platform *</label>
          <select id="ik-platform" class="input">
            <option>Shopee Ads</option><option>Meta (FB/IG)</option><option>TikTok</option>
            <option>Google</option><option>Twitter/X</option><option>Lainnya</option>
          </select>
        </div>
        <div class="col-span-2"><label class="label">Nama Kampanye</label><input id="ik-campaign" class="input" placeholder="Opsional"/></div>
        <div class="col-span-2"><label class="label">Biaya (Rp) *</label><input id="ik-cost" type="number" class="input" placeholder="0"/></div>
        <div class="col-span-2"><label class="label">Catatan</label><input id="ik-notes" class="input" placeholder="Opsional"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Iklan.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const cost = +document.getElementById('ik-cost').value || 0;
    if (!cost) { App.toast('Biaya wajib diisi.', 'warning'); return; }
    const payload = {
      ad_date:       document.getElementById('ik-date').value,
      platform:      document.getElementById('ik-platform').value,
      campaign_name: document.getElementById('ik-campaign').value.trim() || null,
      cost,
      notes:         document.getElementById('ik-notes').value.trim() || null,
    };
    const { error } = await App.db().from('ads').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Biaya iklan disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus entri iklan ini?');
    if (!ok) return;
    const { error } = await App.db().from('ads').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.ad_date, platform: r.platform, kampanye: r.campaign_name,
      biaya: r.cost, impresi: r.impressions, klik: r.clicks, order: r.orders_count,
    })), 'iklan-export.csv');
  },
};
