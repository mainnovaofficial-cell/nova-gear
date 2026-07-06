/* ═══════════════════════════════════════════════════════
   Nova Gear — Snapshot & Restore Module
   Snapshot otomatis tabel orders sebelum tiap proses import,
   supaya Owner bisa membatalkan hasil import yang salah.
═══════════════════════════════════════════════════════ */
'use strict';

const Snapshot = {
  _list: [],

  async onLoad() {
    if (!App.isOwner()) {
      document.getElementById('page-snapshot').innerHTML = `
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h3 class="text-gray-700 font-semibold mb-1">Akses Terbatas</h3>
          <p class="text-gray-400 text-sm">Halaman Snapshot hanya dapat diakses oleh <strong>Owner</strong>.</p>
        </div>`;
      return;
    }
    await this._load();
  },

  async _load() {
    const el = document.getElementById('page-snapshot');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Riwayat Snapshot</h2><p>Snapshot otomatis tabel Pesanan sebelum tiap proses import — maksimal 20 tersimpan</p></div>
    </div>
    <div id="snap-list" class="card"><p class="text-sm text-gray-400 text-center py-8">Memuat...</p></div>`;

    const { data, error } = await App.db()
      .from('orders_snapshot')
      .select('id, snapshot_label, row_count, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      document.getElementById('snap-list').innerHTML = `<p class="text-sm text-red-600 text-center py-8">Gagal memuat riwayat snapshot: ${error.message}</p>`;
      return;
    }

    this._list = data || [];
    this._render();
  },

  _render() {
    const listEl = document.getElementById('snap-list');
    if (!this._list.length) {
      listEl.innerHTML = `<p class="text-sm text-gray-400 text-center py-8">Belum ada snapshot. Snapshot akan otomatis dibuat sebelum proses import berikutnya.</p>`;
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Label</th><th>Tanggal & Jam</th><th class="text-right">Jumlah Pesanan</th><th></th></tr></thead>
          <tbody>${this._list.map(s => `<tr>
            <td>${s.snapshot_label}</td>
            <td class="whitespace-nowrap">${App.formatDateTime(s.created_at)}</td>
            <td class="text-right">${App.formatNumber(s.row_count)}</td>
            <td class="text-right">
              <button onclick="Snapshot.restore('${s.id}')" class="btn-danger text-xs">Restore ke Snapshot Ini</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  },

  async restore(id) {
    const snap = this._list.find(s => s.id === id);
    if (!snap) return;

    const ok = await App.confirm(
      `Ini akan mengembalikan <strong>SEMUA</strong> data pesanan ke kondisi saat <strong>${snap.snapshot_label}</strong>. ` +
      `Perubahan setelah itu akan hilang. Lanjutkan?`
    );
    if (!ok) return;

    try {
      App.toast('Memulihkan snapshot...', 'info');
      const { error } = await App.db().rpc('restore_orders_snapshot', { p_snapshot_id: id });
      if (error) throw error;
      App.toast('Snapshot berhasil dipulihkan!', 'success');
      await this._load();
    } catch (err) {
      App.toast('Gagal restore: ' + err.message, 'error');
    }
  },

  /* ── Dipanggil dari Penjualan sebelum tiap proses import (Harian, Mingguan,
     Retur Lengkap, Income) — SEBELUM insert/update apapun ke tabel orders.
     Best-effort: kalau gagal (mis. migrasi v12 belum dijalankan), import tetap
     dilanjutkan supaya fitur snapshot yang belum siap tidak memblokir alur kerja
     inti (import harian/mingguan) yang kritikal untuk bisnis. ── */
  async createBeforeImport(processName) {
    const label = this._label(processName);
    try {
      const { error } = await App.db().rpc('create_orders_snapshot', { p_label: label });
      if (error) throw error;
    } catch (err) {
      App.toast(`Snapshot sebelum ${processName} gagal dibuat (${err.message}). Import tetap dilanjutkan.`, 'warning', 5000);
    }
  },

  _label(processName) {
    const now = new Date();
    const bulanNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = bulanNames[now.getMonth()];
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `Sebelum ${processName} — ${dd} ${mm} ${now.getFullYear()} ${hh}:${mi}`;
  },
};
