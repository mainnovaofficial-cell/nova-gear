/* ═══════════════════════════════════════════════════════
   Nova Gear — Penyesuaian Shopee Module
   Catat transaksi "Penyesuaian" dari laporan Saldo Shopee yang tidak
   terkait pesanan (kompensasi, potongan premi, dll) — supaya Saldo
   Shopee di sistem cocok dengan Saldo Shopee real di aplikasi Shopee.
═══════════════════════════════════════════════════════ */
'use strict';

const PenyesuaianShopee = {
  _data: [],

  async onLoad() {
    const el = document.getElementById('page-penyesuaianshopee');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Penyesuaian Shopee</h2><p>Catatan transaksi Penyesuaian dari laporan Saldo Shopee</p></div>
      <div class="flex gap-2">
        <button onclick="PenyesuaianShopee.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Penyesuaian
        </button>
      </div>
    </div>
    <div class="bg-blue-50 rounded-lg px-3 py-2.5 text-xs text-blue-700 mb-5">
      Transaksi penyesuaian dari Shopee yang tidak terkait pesanan — misalnya kompensasi barang
      hilang, atau potongan biaya premi. Transaksi ini tidak ikut di Import Income, jadi perlu
      dicatat di sini supaya Saldo Shopee cocok dengan aplikasi Shopee.
    </div>
    <div id="pys-summary" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"></div>
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Penyesuaian Shopee</span>
        <button onclick="PenyesuaianShopee._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
      </div>
      <div id="pys-table"></div>
    </div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db().from('penyesuaian_shopee').select('*').order('tanggal', { ascending: false });
    if (error) { App.toast('Gagal memuat Penyesuaian Shopee: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _renderSummary() {
    const totalMasuk  = this._data.filter(r => r.jenis === 'masuk').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const totalKeluar = this._data.filter(r => r.jenis === 'keluar').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const net = totalMasuk - totalKeluar;
    document.getElementById('pys-summary').innerHTML = `
      <div class="stat-card border-l-4 border-green-400"><p class="stat-label text-green-600">Total Masuk</p><p class="stat-value text-green-600 text-money">${App.formatRupiah(totalMasuk)}</p><p class="stat-sub">kompensasi / penyesuaian masuk</p></div>
      <div class="stat-card border-l-4 border-red-400"><p class="stat-label text-red-600">Total Keluar</p><p class="stat-value text-red-600 text-money">${App.formatRupiah(totalKeluar)}</p><p class="stat-sub">potongan / penyesuaian keluar</p></div>
      <div class="stat-card border-l-4 ${net >= 0 ? 'border-sky-400' : 'border-orange-400'}"><p class="stat-label ${net >= 0 ? 'text-sky-600' : 'text-orange-600'}">Net</p><p class="stat-value ${net >= 0 ? 'text-sky-600' : 'text-orange-600'} text-money">${App.formatRupiah(net)}</p><p class="stat-sub">Masuk − Keluar (ikut Saldo Shopee)</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('pys-table');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-3m-2 6h10a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg><p>Belum ada data Penyesuaian Shopee</p></div>`;
      return;
    }
    const jenisBadge = j => j === 'masuk'
      ? `<span class="badge badge-green">Masuk</span>`
      : `<span class="badge badge-red">Keluar</span>`;
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Deskripsi</th><th>No. Pesanan</th><th>Jenis</th><th class="text-right">Jumlah</th><th></th></tr></thead>
        <tbody>${this._data.map(r => `<tr>
          <td class="whitespace-nowrap">${App.formatDate(r.tanggal)}</td>
          <td class="max-w-[320px] truncate" title="${r.deskripsi || ''}">${r.deskripsi || '-'}</td>
          <td class="font-mono text-xs text-gray-500">${r.order_no || '-'}</td>
          <td>${jenisBadge(r.jenis)}</td>
          <td class="text-right font-semibold text-money ${r.jenis === 'masuk' ? 'text-green-600' : 'text-red-600'}">${r.jenis === 'masuk' ? '+' : '−'}${App.formatRupiah(r.jumlah)}</td>
          <td><button onclick="PenyesuaianShopee.delete('${r.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Penyesuaian Shopee',
      body: `
      <div class="space-y-4">
        <div><label class="label">Tanggal *</label><input id="pys-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Deskripsi *</label><input id="pys-desc" class="input" placeholder="mis. Kompensasi barang hilang Program Kilat"/></div>
        <div><label class="label">Jenis *</label>
          <select id="pys-jenis" class="input">
            <option value="masuk">Masuk (kompensasi / penyesuaian +)</option>
            <option value="keluar">Keluar (potongan / penyesuaian -)</option>
          </select>
        </div>
        <div><label class="label">Jumlah (Rp) *</label><input id="pys-jumlah" type="number" class="input" placeholder="0"/></div>
        <div><label class="label">No. Pesanan</label><input id="pys-order-no" class="input" placeholder="Opsional — jika penyesuaian terkait pesanan tertentu"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="PenyesuaianShopee.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const deskripsi = document.getElementById('pys-desc').value.trim();
    const jumlah    = +document.getElementById('pys-jumlah').value || 0;
    if (!deskripsi) { App.toast('Deskripsi wajib diisi.', 'warning'); return; }
    if (!jumlah)    { App.toast('Jumlah wajib diisi.', 'warning'); return; }
    const payload = {
      tanggal:   document.getElementById('pys-date').value,
      deskripsi,
      jenis:     document.getElementById('pys-jenis').value,
      jumlah,
      order_no:  document.getElementById('pys-order-no').value.trim() || null,
    };
    const { error } = await App.db().from('penyesuaian_shopee').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Penyesuaian Shopee disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus catatan penyesuaian ini?');
    if (!ok) return;
    const { error } = await App.db().from('penyesuaian_shopee').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data dihapus.', 'success');
    this._data = this._data.filter(r => r.id !== id);
    this._renderSummary();
    this._renderTable();
  },

  _exportCSV() {
    App.exportCSV(this._data.map(r => ({
      tanggal: r.tanggal, deskripsi: r.deskripsi, order_no: r.order_no, jenis: r.jenis, jumlah: r.jumlah,
    })), 'penyesuaian-shopee-export.csv');
  },
};
