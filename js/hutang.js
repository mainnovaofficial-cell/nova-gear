/* ═══════════════════════════════════════════════════════
   Nova Gear — Hutang & Cicilan Module
═══════════════════════════════════════════════════════ */
'use strict';

const Hutang = {
  _data: [],

  async onLoad() {
    const el = document.getElementById('page-hutang');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Hutang & Cicilan</h2><p>Pantau pinjaman dan progres pembayaran cicilan</p></div>
      <div class="flex gap-2">
        <button onclick="Hutang.openAdd()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Hutang
        </button>
      </div>
    </div>
    <div id="hu-summary" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"></div>
    <div id="hu-list" class="space-y-4"></div>`;
    await this._load();
  },

  async _load() {
    const { data, error } = await App.db()
      .from('hutang')
      .select('*, hutang_pembayaran(*)')
      .order('created_at', { ascending: false });
    if (error) { App.toast('Gagal memuat Hutang: ' + error.message, 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderList();
  },

  _sisaHutang(h) {
    const dibayar = (h.hutang_pembayaran || []).reduce((s, p) => s + (+p.jumlah || 0), 0);
    return (+h.jumlah_total || 0) - dibayar;
  },

  _renderSummary() {
    const totalHutang = this._data.reduce((s, h) => s + (+h.jumlah_total || 0), 0);
    const totalSisa    = this._data.reduce((s, h) => s + Math.max(this._sisaHutang(h), 0), 0);
    const totalLunas   = this._data.filter(h => this._sisaHutang(h) <= 0).length;
    document.getElementById('hu-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Hutang</p><p class="stat-value text-money">${App.formatRupiah(totalHutang)}</p><p class="stat-sub">${this._data.length} hutang tercatat</p></div>
      <div class="stat-card border-l-4 border-red-400"><p class="stat-label text-red-600">Sisa Hutang</p><p class="stat-value text-red-500 text-money">${App.formatRupiah(totalSisa)}</p><p class="stat-sub">belum lunas</p></div>
      <div class="stat-card border-l-4 border-green-400"><p class="stat-label text-green-600">Lunas</p><p class="stat-value text-green-600">${totalLunas} / ${this._data.length}</p><p class="stat-sub">hutang selesai dibayar</p></div>`;
  },

  _renderList() {
    const el = document.getElementById('hu-list');
    if (!this._data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>Belum ada data hutang</p></div>`;
      return;
    }
    el.innerHTML = this._data.map(h => {
      const payments  = (h.hutang_pembayaran || []).slice().sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      const sisa      = this._sisaHutang(h);
      const lunas     = sisa <= 0;
      const total     = +h.jumlah_total || 0;
      const pct       = total > 0 ? Math.min(100, Math.round((total - sisa) / total * 100)) : 0;
      const cicilanKe = Math.min(payments.length, +h.jumlah_cicilan || 1);
      return `
      <div class="card">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-gray-800">${h.nama_hutang}</p>
              ${lunas ? '<span class="badge badge-green">Lunas</span>' : '<span class="badge badge-red">Berjalan</span>'}
            </div>
            <p class="text-xs text-gray-400 mt-0.5">Cicilan ke ${cicilanKe} dari ${h.jumlah_cicilan || 1} &middot; Total ${App.formatRupiah(total)}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            ${lunas ? '' : `<button onclick="Hutang.openBayar('${h.id}')" class="btn-primary text-xs !py-1">Bayar Cicilan</button>`}
            <button onclick="Hutang.delete('${h.id}')" class="text-gray-300 hover:text-red-500 transition-colors" title="Hapus Hutang">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2 mb-1.5">
          <div class="${lunas ? 'bg-green-500' : 'bg-amber-500'} h-2 rounded-full transition-all" style="width:${pct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500 mb-3">
          <span>Terbayar ${App.formatRupiah(total - sisa)} (${pct}%)</span>
          <span class="font-semibold ${lunas ? 'text-green-600' : 'text-red-500'} text-money">Sisa ${App.formatRupiah(Math.max(sisa, 0))}</span>
        </div>
        ${payments.length ? `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Keterangan</th><th class="text-right">Kas Bisnis</th><th class="text-right">Setoran Pribadi</th><th class="text-right">Jumlah</th><th></th></tr></thead>
            <tbody>${payments.map(p => `<tr>
              <td class="whitespace-nowrap">${App.formatDate(p.tanggal)}</td>
              <td class="max-w-[180px] truncate">${p.keterangan || '-'}</td>
              <td class="text-right text-money">${App.formatRupiah(p.sumber_kas_bisnis)}</td>
              <td class="text-right text-money">${App.formatRupiah(p.sumber_setoran_pribadi)}</td>
              <td class="text-right font-semibold text-money">${App.formatRupiah(p.jumlah)}</td>
              <td><button onclick="Hutang.deletePembayaran('${p.id}')" class="text-gray-300 hover:text-red-500 transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>` : `<p class="text-xs text-gray-400">Belum ada pembayaran cicilan.</p>`}
      </div>`;
    }).join('');
  },

  openAdd() {
    App.openModal({
      title: 'Tambah Hutang',
      body: `
      <div class="space-y-4">
        <div><label class="label">Nama Hutang *</label><input id="hu-nama" class="input" placeholder="mis. Pinjaman Bank Cicilan 6x"/></div>
        <div><label class="label">Jumlah Total (Rp) *</label><input id="hu-total" type="number" class="input" placeholder="0"/></div>
        <div><label class="label">Jumlah Cicilan *</label><input id="hu-cicilan" type="number" class="input" placeholder="6" value="1" min="1"/></div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Hutang.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const nama  = document.getElementById('hu-nama').value.trim();
    const total = +document.getElementById('hu-total').value || 0;
    const cicilan = +document.getElementById('hu-cicilan').value || 1;
    if (!nama || !total) { App.toast('Nama dan jumlah total wajib diisi.', 'warning'); return; }
    const payload = { nama_hutang: nama, jumlah_total: total, jumlah_cicilan: cicilan };
    const { error } = await App.db().from('hutang').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Hutang disimpan!', 'success');
    await this._load();
  },

  async delete(id) {
    const ok = await App.confirm('Hapus hutang ini beserta seluruh riwayat pembayarannya?');
    if (!ok) return;
    const { error } = await App.db().from('hutang').delete().eq('id', id);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Hutang dihapus.', 'success');
    await this._load();
  },

  openBayar(hutangId) {
    const h = this._data.find(x => x.id === hutangId);
    if (!h) return;
    const sisa = Math.max(this._sisaHutang(h), 0);
    App.openModal({
      title: `Bayar Cicilan — ${h.nama_hutang}`,
      body: `
      <div class="space-y-4">
        <div class="bg-blue-50 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
          <span class="text-blue-700">Sisa Hutang Saat Ini</span>
          <span class="font-bold text-money text-blue-700">${App.formatRupiah(sisa)}</span>
        </div>
        <div><label class="label">Tanggal *</label><input id="hb-date" type="date" class="input" value="${App.todayISO()}"/></div>
        <div><label class="label">Dari Kas Bisnis (Rp)</label><input id="hb-kas" type="number" class="input" placeholder="0" oninput="Hutang._recalcBayar()"/></div>
        <div><label class="label">Dari Setoran Pribadi (Rp)</label><input id="hb-setoran" type="number" class="input" placeholder="0" oninput="Hutang._recalcBayar()"/></div>
        <div><label class="label">Keterangan</label><input id="hb-ket" class="input" placeholder="Opsional"/></div>
        <div class="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
          <span class="text-gray-600">Total Pembayaran</span>
          <span id="hb-total" class="font-bold text-money">Rp 0</span>
        </div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Hutang.saveBayar('${hutangId}')" class="btn-primary">Simpan Pembayaran</button>`,
    });
  },

  _recalcBayar() {
    const kas     = +document.getElementById('hb-kas')?.value || 0;
    const setoran = +document.getElementById('hb-setoran')?.value || 0;
    const totalEl = document.getElementById('hb-total');
    if (totalEl) totalEl.textContent = App.formatRupiah(kas + setoran);
  },

  async saveBayar(hutangId) {
    const kas     = +document.getElementById('hb-kas').value || 0;
    const setoran = +document.getElementById('hb-setoran').value || 0;
    const total   = kas + setoran;
    if (!total) { App.toast('Isi minimal salah satu sumber dana.', 'warning'); return; }
    const payload = {
      hutang_id:              hutangId,
      tanggal:                document.getElementById('hb-date').value,
      jumlah:                 total,
      sumber_kas_bisnis:      kas,
      sumber_setoran_pribadi: setoran,
      keterangan:             document.getElementById('hb-ket').value.trim() || null,
    };
    const { error } = await App.db().from('hutang_pembayaran').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Pembayaran cicilan disimpan!', 'success');
    await this._load();
  },

  async deletePembayaran(paymentId) {
    const ok = await App.confirm('Hapus pembayaran cicilan ini?');
    if (!ok) return;
    const { error } = await App.db().from('hutang_pembayaran').delete().eq('id', paymentId);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Pembayaran dihapus.', 'success');
    await this._load();
  },
};
