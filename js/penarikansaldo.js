/* ═══════════════════════════════════════════════════════
   Nova Gear — Penarikan Saldo Module
   Catat penarikan dana dari Saldo Shopee ke Saldo BCA
═══════════════════════════════════════════════════════ */
'use strict';

const PenarikanSaldo = {
  _data: [],

  async onLoad() {
    const el = document.getElementById('page-penarikansaldo');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Penarikan Saldo</h2><p>Catat penarikan dana dari Saldo Shopee ke Saldo BCA</p></div>
      <div class="flex gap-2">
        <button onclick="PenarikanSaldo.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Penarikan
        </button>
      </div>
    </div>
    <div id="ps-summary" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Penarikan Saldo</span>
        <button onclick="PenarikanSaldo._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
      </div>
      <div id="ps-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('penarikan_saldo').select('*').order('tanggal', { ascending: false });
    if (error) { App.toast('Gagal memuat Penarikan Saldo: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _renderSummary() {
    const total = this._data.reduce((s, r) => s + (+r.jumlah || 0), 0);
    document.getElementById('ps-summary').innerHTML = `
      <div class="stat-card border-l-4 border-indigo-400"><p class="stat-label text-indigo-600">Total Penarikan</p><p class="stat-value text-indigo-600 text-money">${App.formatRupiah(total)}</p><p class="stat-sub">semua waktu — dari Shopee ke BCA</p></div>
      <div class="stat-card"><p class="stat-label">Jumlah Transaksi</p><p class="stat-value text-money">${this._data.length}</p><p class="stat-sub">catatan penarikan</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('ps-table');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg><p>Belum ada data Penarikan Saldo</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Keterangan</th><th class="text-right">Jumlah</th><th></th></tr></thead>
        <tbody>${this._data.map(r => `<tr>
          <td class="whitespace-nowrap">${App.formatDate(r.tanggal)}</td>
          <td class="max-w-[300px] truncate">${r.keterangan || '-'}</td>
          <td class="text-right font-semibold text-money">${App.formatRupiah(r.jumlah)}</td>
          <td><button onclick="PenarikanSaldo.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Penarikan Saldo',
      body: `
      <div class="space-y-4">
        <div><label class="label">Tanggal *</label><input id="ps-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Jumlah (Rp) *</label><input id="ps-jumlah" type="number" class="input" placeholder="0"/></div>
        <div><label class="label">Keterangan</label><input id="ps-ket" class="input" placeholder="Opsional"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="PenarikanSaldo.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const jumlah = +document.getElementById('ps-jumlah').value || 0;
    if (!jumlah) { App.toast('Jumlah wajib diisi.', 'warning'); return; }
    const payload = {
      tanggal:    document.getElementById('ps-date').value,
      jumlah,
      keterangan: document.getElementById('ps-ket').value.trim() || null,
    };
    const { error } = await App.db().from('penarikan_saldo').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Penarikan Saldo disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus catatan penarikan saldo ini?');
    if (!ok) return;
    const { error } = await App.db().from('penarikan_saldo').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.tanggal, jumlah: r.jumlah, keterangan: r.keterangan,
    })), 'penarikan-saldo-export.csv');
  },
};
