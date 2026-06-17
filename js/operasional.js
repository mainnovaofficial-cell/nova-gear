/* ═══════════════════════════════════════════════════════
   Nova Gear — Operasional Module
═══════════════════════════════════════════════════════ */
'use strict';

const Operasional = {
  _data: [],
  _categories: ['Packaging', 'Gaji & Honor', 'Listrik', 'Internet', 'Sewa', 'Transportasi', 'Peralatan', 'Lainnya'],

  async onLoad() {
    const el = document.getElementById('page-operasional');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Operasional</h2><p>Catat semua biaya operasional toko</p></div>
      <div class="flex gap-2">
        <button onclick="Operasional.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Biaya
        </button>
      </div>
    </div>
    <div id="ops-summary" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5"></div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card lg:col-span-2">
        <div class="card-header mb-3">
          <span class="card-title">Riwayat Pengeluaran</span>
          <button onclick="Operasional._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
        </div>
        <div id="ops-table"></div>
      </div>
      <div class="card">
        <div class="card-header mb-3"><span class="card-title">Rekap per Kategori</span></div>
        <div id="ops-category"></div>
      </div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('operational').select('*').order('op_date', { ascending: false });
    if (error) { App.toast('Gagal memuat operasional.', 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
    this._renderCategory();
  },

  _renderSummary() {
    const d = this._data;
    const total   = d.reduce((s,r) => s+(+r.cost||0), 0);
    const thisMonth = d.filter(r => (r.op_date||'').slice(0,7) === App.todayISO().slice(0,7));
    const monthTotal = thisMonth.reduce((s,r) => s+(+r.cost||0), 0);
    document.getElementById('ops-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Operasional</p><p class="stat-value text-money">${App.formatRupiah(total)}</p><p class="stat-sub">semua waktu</p></div>
      <div class="stat-card"><p class="stat-label">Bulan Ini</p><p class="stat-value text-money">${App.formatRupiah(monthTotal)}</p><p class="stat-sub">${App.todayISO().slice(0,7)}</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('ops-table');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg><p>Belum ada biaya operasional</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th class="text-right">Biaya</th><th>Rutin</th><th></th></tr></thead>
        <tbody>${this._data.map(r => `<tr>
          <td class="whitespace-nowrap">${App.formatDate(r.op_date)}</td>
          <td><span class="badge badge-gray">${r.category||'-'}</span></td>
          <td class="max-w-[200px] truncate">${r.description||'-'}</td>
          <td class="text-right font-semibold text-money">${App.formatRupiah(r.cost)}</td>
          <td>${r.recurring ? `<span class="badge badge-blue">Rutin</span>` : ''}</td>
          <td><button onclick="Operasional.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  _renderCategory() {
    const el = document.getElementById('ops-category');
    const map = {};
    this._data.forEach(r => {
      const c = r.category || 'Lainnya';
      map[c] = (map[c] || 0) + (+r.cost || 0);
    });
    const total   = Object.values(map).reduce((s,v) => s+v, 0);
    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]);
    if (!entries.length) { el.innerHTML = `<p class="text-gray-400 text-sm text-center py-4">Tidak ada data</p>`; return; }
    el.innerHTML = `<div class="space-y-3">${entries.map(([cat, val]) => {
      const pct = total > 0 ? Math.round(val/total*100) : 0;
      return `<div>
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-600 font-medium">${cat}</span>
          <span class="font-semibold text-money">${App.formatRupiah(val)}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-1.5">
          <div class="bg-amber-500 h-1.5 rounded-full" style="width:${pct}%"></div>
        </div>
        <p class="text-xs text-gray-400 mt-0.5">${pct}% dari total</p>
      </div>`;
    }).join('')}</div>`;
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Biaya Operasional',
      body: `
      <div class="space-y-4">
        <div><label class="label">Tanggal *</label><input id="op-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Kategori *</label>
          <select id="op-cat" class="input">
            ${this._categories.map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div><label class="label">Deskripsi *</label><input id="op-desc" class="input" placeholder="Detail pengeluaran"/></div>
        <div><label class="label">Biaya (Rp) *</label><input id="op-cost" type="number" class="input" placeholder="0"/></div>
        <div class="flex items-center gap-3">
          <input id="op-recurring" type="checkbox" class="w-4 h-4 rounded text-blue-600"/>
          <label for="op-recurring" class="text-sm text-gray-600">Biaya rutin (bulanan)</label>
        </div>
        <div><label class="label">Catatan</label><input id="op-notes" class="input" placeholder="Opsional"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Operasional.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const desc = document.getElementById('op-desc').value.trim();
    const cost = +document.getElementById('op-cost').value || 0;
    if (!desc || !cost) { App.toast('Deskripsi dan biaya wajib diisi.', 'warning'); return; }
    const payload = {
      op_date:     document.getElementById('op-date').value,
      category:    document.getElementById('op-cat').value,
      description: desc,
      cost,
      recurring:   document.getElementById('op-recurring').checked,
      notes:       document.getElementById('op-notes').value.trim() || null,
    };
    const { error } = await App.db().from('operational').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Biaya operasional disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus biaya operasional ini?');
    if (!ok) return;
    const { error } = await App.db().from('operational').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
    this._renderCategory();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.op_date, kategori: r.category, deskripsi: r.description,
      biaya: r.cost, rutin: r.recurring ? 'Ya' : 'Tidak',
    })), 'operasional-export.csv');
  },
};
