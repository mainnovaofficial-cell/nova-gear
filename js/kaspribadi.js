/* ═══════════════════════════════════════════════════════
   Nova Gear — Kas Pribadi Module (Prive & Setoran)
═══════════════════════════════════════════════════════ */
'use strict';

const KasPribadi = {
  _data: [],
  _filter: 'semua', // 'semua' | 'prive' | 'setoran'

  async onLoad() {
    const el = document.getElementById('page-kaspribadi');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Kas Pribadi</h2><p>Catat penarikan pribadi (Prive) dan modal masuk (Setoran)</p></div>
      <div class="flex gap-2">
        <button onclick="KasPribadi.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Transaksi
        </button>
      </div>
    </div>
    <div id="kp-summary" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Kas Pribadi</span>
        <div class="flex gap-2 items-center">
          <select id="kp-filter" class="input !py-1 text-xs" onchange="KasPribadi._setFilter(this.value)">
            <option value="semua">Semua Tipe</option>
            <option value="prive">Prive saja</option>
            <option value="setoran">Setoran saja</option>
          </select>
          <button onclick="KasPribadi._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
        </div>
      </div>
      <div id="kp-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('kas_pribadi').select('*').order('tanggal', { ascending: false });
    if (error) { App.toast('Gagal memuat Kas Pribadi: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _setFilter(val) {
    this._filter = val;
    this._renderTable();
  },

  _renderSummary() {
    const totalPrive   = this._data.filter(r => r.tipe === 'prive').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const totalSetoran = this._data.filter(r => r.tipe === 'setoran').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const selisih = totalSetoran - totalPrive;
    document.getElementById('kp-summary').innerHTML = `
      <div class="stat-card border-l-4 border-red-400"><p class="stat-label text-red-600">Total Prive</p><p class="stat-value text-red-500 text-money">${App.formatRupiah(totalPrive)}</p><p class="stat-sub">semua waktu — penarikan pribadi</p></div>
      <div class="stat-card border-l-4 border-green-400"><p class="stat-label text-green-600">Total Setoran</p><p class="stat-value text-green-600 text-money">${App.formatRupiah(totalSetoran)}</p><p class="stat-sub">semua waktu — modal masuk</p></div>
      <div class="stat-card"><p class="stat-label">Selisih (Setoran − Prive)</p><p class="stat-value text-money ${selisih>=0?'text-blue-600':'text-red-500'}">${App.formatRupiah(selisih)}</p><p class="stat-sub">dampak bersih ke Kas Bisnis</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('kp-table');
    const rows = this._filter === 'semua' ? this._data : this._data.filter(r => r.tipe === this._filter);
    if (!rows.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg><p>Belum ada data Kas Pribadi</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Tipe</th><th>Keterangan</th><th class="text-right">Jumlah</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="whitespace-nowrap">${App.formatDate(r.tanggal)}</td>
          <td><span class="badge ${r.tipe === 'prive' ? 'badge-red' : 'badge-green'}">${r.tipe === 'prive' ? 'Prive' : 'Setoran'}</span></td>
          <td class="max-w-[260px] truncate">${r.keterangan || '-'}</td>
          <td class="text-right font-semibold text-money">${App.formatRupiah(r.jumlah)}</td>
          <td><button onclick="KasPribadi.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Transaksi Kas Pribadi',
      body: `
      <div class="space-y-4">
        <div><label class="label">Tanggal *</label><input id="kp-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Tipe *</label>
          <select id="kp-tipe" class="input">
            <option value="prive">Prive (Penarikan Pribadi)</option>
            <option value="setoran">Setoran (Modal Masuk)</option>
          </select>
        </div>
        <div><label class="label">Jumlah (Rp) *</label><input id="kp-jumlah" type="number" class="input" placeholder="0"/></div>
        <div><label class="label">Keterangan</label><input id="kp-ket" class="input" placeholder="Opsional"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="KasPribadi.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const jumlah = +document.getElementById('kp-jumlah').value || 0;
    if (!jumlah) { App.toast('Jumlah wajib diisi.', 'warning'); return; }
    const payload = {
      tanggal:    document.getElementById('kp-date').value,
      tipe:       document.getElementById('kp-tipe').value,
      jumlah,
      keterangan: document.getElementById('kp-ket').value.trim() || null,
    };
    const { error } = await App.db().from('kas_pribadi').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Transaksi Kas Pribadi disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus transaksi Kas Pribadi ini?');
    if (!ok) return;
    const { error } = await App.db().from('kas_pribadi').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.tanggal, tipe: r.tipe, jumlah: r.jumlah, keterangan: r.keterangan,
    })), 'kas-pribadi-export.csv');
  },
};
