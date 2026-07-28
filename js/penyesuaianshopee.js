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
    const now = new Date();
    const el = document.getElementById('page-penyesuaianshopee');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Penyesuaian Shopee</h2><p>Catatan transaksi Penyesuaian dari laporan Saldo Shopee</p></div>
      <div class="flex gap-2 flex-wrap items-center">
        <select id="pys-bulan" class="input !py-1 text-xs">
          ${App.bulanOptionsHTML(now.getMonth() + 1)}
        </select>
        <input id="pys-tahun" type="number" class="input !py-1 text-xs w-24" value="${now.getFullYear()}" min="2020" max="2035"/>
        <button onclick="PenyesuaianShopee._applyPeriod()" class="btn-secondary text-xs">Tampilkan</button>
        <button onclick="PenyesuaianShopee.openImport()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Import Penyesuaian
        </button>
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
    this._applyPeriod();
  },

  _applyPeriod() {
    this._renderSummary();
    this._renderTable();
  },

  // value "0" pada dropdown Bulan = "Semua" (tidak difilter periode).
  _periodFiltered() {
    const bulan = parseInt(document.getElementById('pys-bulan')?.value) || 0;
    const tahun = parseInt(document.getElementById('pys-tahun')?.value) || new Date().getFullYear();
    if (!bulan) return this._data;
    const { dateFrom, dateTo } = App.monthRange(bulan, tahun);
    return this._data.filter(r => r.tanggal && r.tanggal >= dateFrom && r.tanggal < dateTo);
  },

  _renderSummary() {
    const d = this._periodFiltered();
    const totalMasuk  = d.filter(r => r.jenis === 'masuk').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const totalKeluar = d.filter(r => r.jenis === 'keluar').reduce((s, r) => s + (+r.jumlah || 0), 0);
    const net = totalMasuk - totalKeluar;
    document.getElementById('pys-summary').innerHTML = `
      <div class="stat-card border-l-4 border-green-400"><p class="stat-label text-green-600">Total Masuk</p><p class="stat-value text-green-600 text-money">${App.formatRupiah(totalMasuk)}</p><p class="stat-sub">kompensasi / penyesuaian masuk</p></div>
      <div class="stat-card border-l-4 border-red-400"><p class="stat-label text-red-600">Total Keluar</p><p class="stat-value text-red-600 text-money">${App.formatRupiah(totalKeluar)}</p><p class="stat-sub">potongan / penyesuaian keluar</p></div>
      <div class="stat-card border-l-4 ${net >= 0 ? 'border-sky-400' : 'border-orange-400'}"><p class="stat-label ${net >= 0 ? 'text-sky-600' : 'text-orange-600'}">Net</p><p class="stat-value ${net >= 0 ? 'text-sky-600' : 'text-orange-600'} text-money">${App.formatRupiah(net)}</p><p class="stat-sub">Masuk − Keluar (ikut Saldo Shopee)</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('pys-table');
    const data = this._periodFiltered();
    if (!data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-3m-2 6h10a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg><p>Belum ada data Penyesuaian Shopee untuk periode ini</p></div>`;
      return;
    }
    const jenisBadge = j => j === 'masuk'
      ? `<span class="badge badge-green">Masuk</span>`
      : `<span class="badge badge-red">Keluar</span>`;
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Deskripsi</th><th>No. Pesanan</th><th>Jenis</th><th class="text-right">Jumlah</th><th></th></tr></thead>
        <tbody>${data.map(r => `<tr>
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

  /* ═══════════════════════════════════════════════
     IMPORT PENYESUAIAN — dari my_balance_transaction_report Shopee
  ═══════════════════════════════════════════════ */
  openImport() {
    App.openModal({
      title: 'Import Penyesuaian Shopee',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.xlsx</strong> laporan Saldo Shopee
        (<span class="font-mono text-xs">my_balance_transaction_report...</span>) dari Seller Centre.
        Hanya baris dengan Tipe Transaksi <strong>"Penyesuaian"</strong> yang akan diambil — baris lain
        (Penghasilan dari Pesanan, Penarikan Dana, dll) dilewati. Baris yang tanggal + deskripsi +
        jumlahnya sudah pernah diimport tidak akan digandakan.</p>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
             onclick="document.getElementById('pys-imp-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .xlsx ke sini</p>
          <input id="pys-imp-file" type="file" accept=".xlsx,.xls" class="hidden"
                 onchange="PenyesuaianShopee.importFile(this.files[0])"/>
        </div>
        <div id="pys-imp-progress" class="hidden mt-4 text-sm text-blue-600 text-center font-medium"></div>
        <div id="pys-imp-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importFile(file) {
    if (!file) return;
    const prog = document.getElementById('pys-imp-progress');
    const res  = document.getElementById('pys-imp-result');
    prog.textContent = 'Membaca file...';
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      const normHeader = h => String(h || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const findColIdx = (headerRow, ...terms) => {
        for (const term of terms) {
          const t = normHeader(term);
          const idx = headerRow.findIndex(h => normHeader(h).includes(t));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // Cari baris header tabel (kolom "Tipe Transaksi") secara dinamis — biasanya baris
      // ke-18 (index 17) karena baris 1-16 berisi info rekening/ringkasan, tapi dicari dulu
      // supaya tetap jalan kalau jumlah baris header laporan Shopee berubah di masa depan.
      const HEADER_SEARCH_RANGE = 30;
      let headerRowIdx = rows.findIndex((row, i) =>
        i < HEADER_SEARCH_RANGE && Array.isArray(row) && row.some(c => normHeader(c).includes('tipe transaksi')));
      if (headerRowIdx === -1) headerRowIdx = 17; // fallback: pola default laporan Shopee
      const headerRow = rows[headerRowIdx] || [];

      const colTanggal   = findColIdx(headerRow, 'tanggal transaksi');
      const colTipe      = findColIdx(headerRow, 'tipe transaksi');
      const colDeskripsi = findColIdx(headerRow, 'deskripsi');
      const colOrderNo   = findColIdx(headerRow, 'no. pesanan', 'no pesanan');
      const colJumlah    = findColIdx(headerRow, 'jumlah');

      if (colTipe === -1 || colJumlah === -1) {
        throw new Error('Format file tidak dikenali — kolom "Tipe Transaksi" / "Jumlah" tidak ditemukan.');
      }

      const records = [];
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.length) continue;
        const tipe = String(row[colTipe] || '').trim();
        if (tipe.toLowerCase() !== 'penyesuaian') continue; // abaikan tipe lain (sudah ditangani menu lain)

        const tanggal = this._toDate(row[colTanggal]);
        if (!tanggal) continue;
        const jumlahRaw = this._toNum(row[colJumlah]);
        if (!jumlahRaw) continue;

        const deskripsi = String(colDeskripsi !== -1 ? row[colDeskripsi] : '').trim() || null;
        let orderNo = colOrderNo !== -1 ? String(row[colOrderNo] || '').trim() : '';
        if (!orderNo || orderNo === '-') orderNo = '';
        if (!orderNo && deskripsi) {
          // Beberapa baris (mis. biaya premi Gagal Kirim) tidak mengisi kolom No. Pesanan —
          // no. pesanannya ada di teks Deskripsi, mis. "...Gagal Terkirim: 260629BTQ6Q5AA".
          const m = deskripsi.match(/:\s*([A-Z0-9]{8,})\s*$/i);
          if (m) orderNo = m[1];
        }

        records.push({
          tanggal,
          deskripsi,
          jenis:    jumlahRaw > 0 ? 'masuk' : 'keluar',
          jumlah:   Math.abs(jumlahRaw),
          order_no: orderNo || null,
        });
      }

      if (!records.length) {
        res.innerHTML = `<p class="text-orange-700">Tidak ada baris dengan Tipe Transaksi "Penyesuaian" ditemukan di file ini.</p>`;
        res.className = 'mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm';
        res.classList.remove('hidden');
        prog.classList.add('hidden');
        return;
      }

      // ── Cegah duplikat: cek data existing di rentang tanggal file ini, kunci = tanggal+deskripsi+jumlah ──
      prog.textContent = 'Mengecek data existing...';
      const dates  = records.map(r => r.tanggal);
      const minDate = dates.reduce((m, d) => d < m ? d : m, dates[0]);
      const maxDate = dates.reduce((m, d) => d > m ? d : m, dates[0]);
      const { data: existing, error: exErr } = await App.db()
        .from('penyesuaian_shopee')
        .select('tanggal,deskripsi,jumlah')
        .gte('tanggal', minDate)
        .lte('tanggal', maxDate);
      if (exErr) throw exErr;

      const dupKey = r => `${r.tanggal}||${(r.deskripsi || '').trim()}||${(+r.jumlah).toFixed(2)}`;
      const seenKeys = new Set((existing || []).map(dupKey));

      const toInsert = [];
      let nSkip = 0;
      for (const rec of records) {
        const key = dupKey(rec);
        if (seenKeys.has(key)) { nSkip++; continue; }
        seenKeys.add(key); // baris duplikat di DALAM file yang sama juga tidak boleh dobel-insert
        toInsert.push(rec);
      }

      let nMasuk = 0, nKeluar = 0;
      if (toInsert.length) {
        prog.textContent = `Menyimpan ${toInsert.length} data...`;
        const BATCH = 500;
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const batch = toInsert.slice(i, i + BATCH);
          const { error } = await App.db().from('penyesuaian_shopee').insert(batch);
          if (error) throw new Error(`Gagal simpan: ${error.message}`);
        }
        nMasuk  = toInsert.filter(r => r.jenis === 'masuk').length;
        nKeluar = toInsert.filter(r => r.jenis === 'keluar').length;
      }

      res.innerHTML = `
        <div class="space-y-2">
          <p class="font-semibold text-green-700">Import selesai!</p>
          <div class="grid grid-cols-3 gap-2 text-xs text-center">
            <div class="bg-green-50 border border-green-100 rounded-lg p-2"><p class="font-bold text-xl text-green-600">${nMasuk}</p><p class="text-green-500 mt-0.5">Masuk</p></div>
            <div class="bg-red-50 border border-red-100 rounded-lg p-2"><p class="font-bold text-xl text-red-600">${nKeluar}</p><p class="text-red-500 mt-0.5">Keluar</p></div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-2"><p class="font-bold text-xl text-gray-600">${nSkip}</p><p class="text-gray-500 mt-0.5">Dilewati (duplikat)</p></div>
          </div>
        </div>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');
      App.toast(`Import selesai: ${nMasuk} Masuk · ${nKeluar} Keluar · ${nSkip} dilewati (duplikat)`, 'success');

      await this._load();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="font-semibold text-red-600">Error</p><p class="text-red-700 text-xs mt-1 whitespace-pre-wrap">${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  _toNum(v) {
    const s = String(v).trim();
    if (!s) return 0;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  },

  _toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
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
    App.exportCSV(this._periodFiltered().map(r => ({
      tanggal: r.tanggal, deskripsi: r.deskripsi, order_no: r.order_no, jenis: r.jenis, jumlah: r.jumlah,
    })), 'penyesuaian-shopee-export.csv');
  },
};
