/* ═══════════════════════════════════════════════════════
   Nova Gear — Iklan & Marketing Module
═══════════════════════════════════════════════════════ */
'use strict';

const Iklan = {
  _data: [],
  _expenses: [],
  _bulanNames: ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],

  async onLoad() {
    const now = new Date();
    const el = document.getElementById('page-iklan');
    el.innerHTML = `
    <div class="page-header">
      <div><h2>Iklan & Marketing</h2><p>Import biaya iklan Shopee per produk dan catat biaya manual lainnya</p></div>
      <div class="flex gap-2 flex-wrap items-center">
        <select id="ik-bulan" class="input !py-1 text-xs">
          ${App.bulanOptionsHTML(now.getMonth() + 1)}
        </select>
        <input id="ik-tahun" type="number" class="input !py-1 text-xs w-24" value="${now.getFullYear()}" min="2020" max="2035"/>
        <button onclick="Iklan._applyPeriod()" class="btn-secondary text-xs">Tampilkan</button>
        <button onclick="Iklan.openImportAds()" class="btn-primary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Import CSV Iklan
        </button>
        <button onclick="Iklan.openAdd()" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Iklan
        </button>
      </div>
    </div>

    <div id="iklan-cc-summary" class="grid grid-cols-1 sm:max-w-xs gap-3 mb-5"></div>

    <div class="card mb-5">
      <div class="card-header mb-3 flex-wrap gap-2">
        <span class="card-title">Iklan Shopee per Produk</span>
        <div class="flex gap-2">
          <button onclick="Iklan._openMarkMonthCcPaid()" class="btn-secondary text-xs !py-1 text-blue-600">Tandai Tagihan CC Bulan Ini Dibayar</button>
          <button onclick="Iklan._deleteExpensesMonth()" class="btn-secondary text-xs !py-1 text-red-600">Hapus Data Bulan Ini</button>
        </div>
      </div>
      <div id="iklan-exp-summary" class="grid grid-cols-1 sm:max-w-xs gap-3 mb-4"></div>
      <div id="iklan-exp-table"></div>
    </div>

    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Riwayat Iklan Manual</span>
        <button onclick="Iklan._exportCSV()" class="btn-secondary text-xs !py-1">Export CSV</button>
      </div>
      <div id="iklan-summary" class="grid grid-cols-1 sm:max-w-xs gap-3 mb-3"></div>
      <div id="iklan-table"></div>
    </div>`;
    await Promise.all([this._loadExpenses(), this._load(), this._loadCcUnpaid()]);
  },

  // value "0" pada dropdown Bulan = "Semua" (tidak difilter periode).
  _period() {
    const bulan = parseInt(document.getElementById('ik-bulan')?.value) || 0;
    const tahun = parseInt(document.getElementById('ik-tahun')?.value) || new Date().getFullYear();
    return { bulan, tahun };
  },

  async _applyPeriod() {
    await this._loadExpenses();
    this._renderSummary();
    this._renderTable();
  },

  /* ═══════════════════════════════════════════════
     IMPORT CSV IKLAN SHOPEE (Iklanku) — per produk
  ═══════════════════════════════════════════════ */
  openImportAds() {
    const now = new Date();
    App.openModal({
      title: 'Import File Iklan Shopee',
      size: 'max-w-xl',
      body: `
        <p class="text-sm text-gray-600 mb-3">Upload file <strong>.csv</strong> dari Shopee Seller Centre menu <strong>Iklanku</strong>.</p>
        <div class="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs text-orange-800 mb-4">
          <p class="font-semibold mb-1">Kolom yang diambil:</p>
          <p>Nama Iklan · Biaya · Konversi · Omzet Penjualan · Persentase Biaya Iklan terhadap Penjualan (ACOS)</p>
          <p class="mt-2 text-orange-700">Import ulang untuk bulan &amp; tahun yang sama akan menimpa data produk yang sama (tidak duplikat).</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div><label class="label">Bulan</label>
            <select id="imp-ik-bulan" class="input">
              ${this._bulanNames.map((m, i) => i === 0 ? '' : `<option value="${i}" ${i === now.getMonth()+1 ? 'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
          <div><label class="label">Tahun</label>
            <input id="imp-ik-tahun" type="number" class="input" value="${now.getFullYear()}" min="2020" max="2035"/>
          </div>
          <div class="col-span-2"><label class="label">Sumber Pembayaran *</label>
            <select id="imp-ik-sumber" class="input" onchange="Iklan._toggleSudahPotongVisibility('imp-ik-sumber','imp-ik-sudah-potong-wrap')">
              <option>Kartu Kredit</option>
              <option>Saldo BCA</option>
              <option>Saldo Shopee</option>
            </select>
            <p class="text-xs text-gray-400 mt-1">Berlaku untuk semua produk di file ini — sesuaikan dari mana Isi Ulang Saldo Iklan bulan ini didanai.</p>
          </div>
          <div id="imp-ik-sudah-potong-wrap" class="col-span-2 hidden bg-amber-50 border border-amber-100 rounded-lg p-3">
            <label class="flex items-start gap-2 text-sm text-gray-700">
              <input id="imp-ik-sudah-potong" type="checkbox" class="mt-0.5"/>
              <span>Sudah otomatis terpotong lewat Income Shopee — jangan kurangi Saldo Shopee lagi</span>
            </label>
            <p class="text-xs text-gray-500 mt-1 ml-6">Centang HANYA untuk Isi Ulang Saldo Iklan Otomatis yang nilainya sudah ikut mengurangi net_amount per pesanan di file Income/Penghasilan (biasanya muncul di laporan Saldo Shopee sebagai tipe transaksi "Pembayaran dengan Saldo Penjual"). Biaya tetap dicatat penuh di Laba Rugi — centang ini hanya mencegah Saldo Shopee dikurangi dua kali. JANGAN centang untuk iklan yang benar-benar dibayar terpisah dari Income (mis. top up manual lewat transfer terpisah).</p>
          </div>
        </div>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer
                    hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
             onclick="document.getElementById('imp-ik-file').click()">
          <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p class="text-sm text-gray-500">Klik atau seret file .csv ke sini</p>
          <input id="imp-ik-file" type="file" accept=".csv,.xlsx,.xls" class="hidden"
                 onchange="Iklan.importAdsFile(this.files[0])"/>
        </div>
        <div id="ik-imp-progress" class="hidden mt-4 text-sm text-orange-600 text-center font-medium"></div>
        <div id="ik-imp-result"   class="hidden mt-3 p-3 rounded-lg text-sm"></div>`,
    });
  },

  async importAdsFile(file) {
    if (!file) return;
    const prog  = document.getElementById('ik-imp-progress');
    const res   = document.getElementById('ik-imp-result');
    const bulan  = parseInt(document.getElementById('imp-ik-bulan').value);
    const tahun  = parseInt(document.getElementById('imp-ik-tahun').value);
    const sumber = document.getElementById('imp-ik-sumber').value;
    // Checkbox hanya tampil (dan cuma relevan) kalau sumber === 'Saldo Shopee' — lihat _toggleSudahPotongVisibility.
    const sudahPotongIncome = sumber === 'Saldo Shopee' && !!document.getElementById('imp-ik-sudah-potong')?.checked;

    prog.textContent = 'Membaca file...';
    prog.classList.remove('hidden');
    res.classList.add('hidden');

    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', raw: false });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

      const normHeader = h => String(h || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      // Header Iklanku punya banyak kolom mirip ("Biaya" vs "Biaya per Konversi" vs
      // "Persentase Biaya Iklan terhadap Penjualan") — cocokkan exact match dulu,
      // baru startsWith, baru substring, supaya "biaya" tidak nyangkut ke "biaya per konversi".
      const findColIdx = (headerRow, ...terms) => {
        const normed = headerRow.map(normHeader);
        for (const term of terms) {
          const t = normHeader(term);
          const idx = normed.findIndex(h => h === t);
          if (idx !== -1) return idx;
        }
        for (const term of terms) {
          const t = normHeader(term);
          const idx = normed.findIndex(h => h.startsWith(t));
          if (idx !== -1) return idx;
        }
        for (const term of terms) {
          const t = normHeader(term);
          const idx = normed.findIndex(h => h.includes(t));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      // File export Iklanku diawali 7 baris info laporan (nama toko, rentang tanggal, dll)
      // yang kadang berisi sel persis "Nama Iklan" sebagai label (mis. "Nama Iklan,Semua")
      // — itu bikin baris header kolom asli (baris ke-8 / index 7) salah terdeteksi.
      // Maka pencarian header kolom dimulai dari index 7, bukan dari awal file.
      const HEADER_SKIP_ROWS = 7;
      const headerOffsetIdx = rows.slice(HEADER_SKIP_ROWS).findIndex(r => r.some(c => normHeader(c) === 'nama iklan'));
      if (headerOffsetIdx === -1) throw new Error('Kolom "Nama Iklan" tidak ditemukan di file. Pastikan ini file export Iklanku dari Shopee Seller Centre.');
      const headerRowIdx = HEADER_SKIP_ROWS + headerOffsetIdx;
      const headerRow = rows[headerRowIdx];

      const colName  = findColIdx(headerRow, 'nama iklan');
      const colBiaya = findColIdx(headerRow, 'biaya');
      const colKonv  = findColIdx(headerRow, 'konversi');
      const colOmzet = findColIdx(headerRow, 'omzet penjualan', 'omzet');
      const colAcos  = findColIdx(headerRow, 'persentase biaya iklan terhadap penjualan dari iklan (acos)', 'persentase biaya iklan terhadap penjualan', 'acos');

      const records = [];
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const name = String(row[colName] || '').trim();
        if (!name) continue;
        records.push({
          month:        bulan,
          year:         tahun,
          product_name: name,
          biaya:        colBiaya !== -1 ? this._toNum(row[colBiaya]) : 0,
          konversi:     colKonv  !== -1 ? Math.round(this._toNum(row[colKonv])) : 0,
          omzet_iklan:  colOmzet !== -1 ? this._toNum(row[colOmzet]) : 0,
          acos:         colAcos  !== -1 ? this._toPercent(row[colAcos]) : 0,
          sumber_bayar: sumber,
          sudah_potong_income: sudahPotongIncome,
        });
      }

      if (!records.length) throw new Error('Tidak ada baris data produk yang valid di file ini.');

      prog.textContent = `Menyimpan ${records.length} produk...`;
      const { error } = await App.db().from('ads_expenses').upsert(records, { onConflict: 'month,year,product_name' });
      if (error) throw new Error('Gagal simpan ke database: ' + error.message);

      const totalBiaya = records.reduce((s, r) => s + r.biaya, 0);
      res.innerHTML = `
        <p class="font-semibold text-green-700">Import Iklan ${this._bulanNames[bulan]} ${tahun} berhasil!</p>
        <p class="text-xs text-gray-700 mt-1">${records.length} produk · Total biaya iklan: <strong>${App.formatRupiah(totalBiaya)}</strong></p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-sm';
      res.classList.remove('hidden');
      prog.classList.add('hidden');
      App.toast(`Import iklan ${records.length} produk berhasil!`, 'success');

      const bulanSel = document.getElementById('ik-bulan');
      const tahunSel = document.getElementById('ik-tahun');
      if (bulanSel) bulanSel.value = bulan;
      if (tahunSel) tahunSel.value = tahun;
      await this._refreshAfterCcChange();

    } catch (err) {
      prog.classList.add('hidden');
      res.innerHTML = `<p class="text-red-600">Error: ${err.message}</p>`;
      res.className = 'mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm';
      res.classList.remove('hidden');
    }
  },

  _toNum(v) {
    const s = String(v ?? '').replace(/[^\d,.\-]/g, '').trim();
    if (!s) return 0;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  },

  // Checkbox "sudah terpotong Income" hanya relevan untuk sumber "Saldo Shopee" — potongan
  // otomatis (mis. Isi Ulang Saldo Iklan) cuma bisa "sudah tercermin di Income" kalau memang
  // Income yang dimaksud (net_amount per pesanan Shopee) dari dompet yang sama. Tampilkan/
  // sembunyikan wrap-nya sesuai pilihan Sumber Pembayaran, dan uncheck kalau disembunyikan
  // supaya tidak submit true secara tidak sengaja saat sumbernya bukan Saldo Shopee.
  _toggleSudahPotongVisibility(sumberSelectId, wrapId) {
    const sumberEl = document.getElementById(sumberSelectId);
    const wrapEl   = document.getElementById(wrapId);
    if (!sumberEl || !wrapEl) return;
    const show = sumberEl.value === 'Saldo Shopee';
    wrapEl.classList.toggle('hidden', !show);
    if (!show) {
      const cb = wrapEl.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
    }
  },

  // ACOS pakai format desimal titik langsung dari Shopee (mis. "25.90%"),
  // beda dari kolom Rupiah yang pakai titik sebagai pemisah ribuan — jangan pakai _toNum.
  _toPercent(v) {
    const s = String(v ?? '').replace(/[^\d.\-]/g, '').trim();
    if (!s) return 0;
    return parseFloat(s) || 0;
  },

  async _loadExpenses() {
    const { bulan, tahun } = this._period();
    let query = App.db().from('ads_expenses').select('*').order('biaya', { ascending: false });
    if (bulan) query = query.eq('month', bulan).eq('year', tahun); // 0 = Semua → tidak difilter
    const { data, error } = await query;
    if (error) { App.toast('Gagal memuat data iklan: ' + error.message, 'error'); return; }
    this._expenses = data || [];
    this._renderExpenses();
  },

  async _deleteExpensesMonth() {
    const { bulan, tahun } = this._period();
    if (!bulan) { App.toast('Pilih bulan tertentu dulu (bukan "Semua") untuk menghapus data.', 'warning'); return; }
    const ok = await App.confirm(`Hapus semua data iklan Shopee per produk untuk ${App.BULAN_NAMES[bulan]} ${tahun}? Tindakan ini tidak dapat dibatalkan.`);
    if (!ok) return;
    const { error } = await App.db().from('ads_expenses').delete().eq('month', bulan).eq('year', tahun);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data iklan bulan ini dihapus.', 'success');
    await this._refreshAfterCcChange();
  },

  /* ═══════════════════════════════════════════════
     STATUS PEMBAYARAN KARTU KREDIT (Belum/Sudah Dibayar)
     Iklan bersumber "Kartu Kredit" tidak langsung mengurangi Saldo BCA —
     uangnya baru keluar saat tagihan CC dibayar (biasanya bulan berikutnya).
     Laba Rugi TIDAK terpengaruh oleh status ini (tetap akrual, dicatat penuh
     di bulan iklan tayang) — lihat js/labarugi.js (totalAds tidak difilter
     cc_dibayar) dan js/dashboard.js (totalAdsCcDibayarAllTime).
  ═══════════════════════════════════════════════ */
  async _refreshAfterCcChange() {
    await Promise.all([this._loadExpenses(), this._load(), this._loadCcUnpaid()]);
  },

  async _loadCcUnpaid() {
    const el = document.getElementById('iklan-cc-summary');
    if (!el) return;
    const [{ data: adsUnpaid, error: e1 }, { data: expUnpaid, error: e2 }] = await Promise.all([
      App.db().from('ads').select('cost').eq('sumber_bayar', 'Kartu Kredit').eq('cc_dibayar', false),
      App.db().from('ads_expenses').select('biaya').eq('sumber_bayar', 'Kartu Kredit').eq('cc_dibayar', false),
    ]);
    if (e1 || e2) { App.toast('Gagal memuat tagihan CC: ' + (e1 || e2).message, 'error'); return; }
    const total = (adsUnpaid || []).reduce((s, r) => s + (+r.cost || 0), 0)
      + (expUnpaid || []).reduce((s, r) => s + (+r.biaya || 0), 0);
    el.innerHTML = `
      <div class="stat-card border-l-4 border-red-400">
        <p class="stat-label text-red-600">Tagihan CC Belum Dibayar</p>
        <p class="stat-value text-red-600 text-money">${App.formatRupiah(total)}</p>
        <p class="stat-sub">semua waktu — biaya iklan sumber Kartu Kredit yang tagihannya belum dibayar</p>
      </div>`;
  },

  // Badge status CC — hanya tampil untuk entri bersumber "Kartu Kredit". Klik untuk
  // toggle: "Belum Dibayar" → buka modal isi tanggal; "Dibayar" → konfirmasi batalkan.
  _ccBadge(table, r) {
    if (r.sumber_bayar !== 'Kartu Kredit') return '';
    if (r.cc_dibayar) {
      return ` <span class="badge badge-green" style="cursor:pointer" title="Klik untuk batalkan status Sudah Dibayar" onclick="Iklan._undoCcPaid('${table}','${r.id}')">CC - Dibayar ${App.formatDate(r.cc_tanggal_bayar)}</span>`;
    }
    return ` <span class="badge badge-red" style="cursor:pointer" title="Klik untuk tandai Sudah Dibayar" onclick="Iklan._openMarkCcPaid('${table}','${r.id}')">CC - Belum Dibayar</span>`;
  },

  _openMarkCcPaid(table, id) {
    App.openModal({
      title: 'Tandai Tagihan CC Sudah Dibayar',
      body: `
        <p class="text-sm text-gray-600 mb-3">Biaya iklan ini akan ditandai sudah dibayar lewat kartu kredit, dan mulai mengurangi Saldo BCA. Laba Rugi tidak berubah.</p>
        <div><label class="label">Tanggal Dibayar *</label><input id="cc-pay-date" type="date" class="input" value="${App.todayISO()}"/></div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Iklan._confirmMarkCcPaid('${table}','${id}')" class="btn-primary">Tandai Dibayar</button>`,
    });
  },

  async _confirmMarkCcPaid(table, id) {
    const tanggal = document.getElementById('cc-pay-date').value;
    if (!tanggal) { App.toast('Tanggal wajib diisi.', 'warning'); return; }
    const { error } = await App.db().from(table).update({ cc_dibayar: true, cc_tanggal_bayar: tanggal }).eq('id', id);
    if (error) { App.toast('Gagal menyimpan: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Tagihan ditandai sudah dibayar.', 'success');
    await this._refreshAfterCcChange();
  },

  async _undoCcPaid(table, id) {
    const ok = await App.confirm('Batalkan status "Sudah Dibayar"? Biaya ini akan kembali dianggap belum dibayar dan tidak mengurangi Saldo BCA.');
    if (!ok) return;
    const { error } = await App.db().from(table).update({ cc_dibayar: false, cc_tanggal_bayar: null }).eq('id', id);
    if (error) { App.toast('Gagal menyimpan: ' + error.message, 'error'); return; }
    App.toast('Status dibatalkan.', 'success');
    await this._refreshAfterCcChange();
  },

  // Tandai bulan berjalan (filter Iklan Shopee per Produk) sekaligus — CSV Iklanku bisa
  // berisi puluhan produk per bulan, menandai satu-satu tidak praktis. Hanya menyentuh
  // baris sumber "Kartu Kredit" yang belum dibayar; baris yang sudah dibayar tidak diubah.
  _openMarkMonthCcPaid() {
    const { bulan, tahun } = this._period();
    if (!bulan) { App.toast('Pilih bulan tertentu dulu (bukan "Semua") untuk menandai tagihan.', 'warning'); return; }
    const unpaidCount = this._expenses.filter(r => r.sumber_bayar === 'Kartu Kredit' && !r.cc_dibayar).length;
    if (!unpaidCount) { App.toast('Tidak ada tagihan Kartu Kredit yang belum dibayar di bulan ini.', 'info'); return; }
    App.openModal({
      title: 'Tandai Tagihan CC Bulan Ini Sudah Dibayar',
      body: `
        <p class="text-sm text-gray-600 mb-3">${unpaidCount} produk iklan bersumber Kartu Kredit di ${this._bulanNames[bulan]} ${tahun} akan ditandai sudah dibayar, dan mulai mengurangi Saldo BCA. Laba Rugi tidak berubah.</p>
        <div><label class="label">Tanggal Dibayar *</label><input id="cc-pay-month-date" type="date" class="input" value="${App.todayISO()}"/></div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Iklan._confirmMarkMonthCcPaid()" class="btn-primary">Tandai Dibayar</button>`,
    });
  },

  async _confirmMarkMonthCcPaid() {
    const { bulan, tahun } = this._period();
    const tanggal = document.getElementById('cc-pay-month-date').value;
    if (!tanggal) { App.toast('Tanggal wajib diisi.', 'warning'); return; }
    const { error } = await App.db().from('ads_expenses')
      .update({ cc_dibayar: true, cc_tanggal_bayar: tanggal })
      .eq('month', bulan).eq('year', tahun)
      .eq('sumber_bayar', 'Kartu Kredit')
      .eq('cc_dibayar', false);
    if (error) { App.toast('Gagal menyimpan: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Tagihan CC bulan ini ditandai sudah dibayar.', 'success');
    await this._refreshAfterCcChange();
  },

  _renderExpenses() {
    const { bulan } = this._period();
    const totalBiaya = this._expenses.reduce((s, r) => s + (+r.biaya || 0), 0);
    document.getElementById('iklan-exp-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Biaya Iklan Shopee</p><p class="stat-value text-money">${App.formatRupiah(totalBiaya)}</p><p class="stat-sub">${this._expenses.length} produk — ${bulan ? 'periode terpilih' : 'semua waktu'}</p></div>`;

    const el = document.getElementById('iklan-exp-table');
    if (!this._expenses.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><p>Belum ada data import iklan untuk periode ini</p></div>`;
      return;
    }
    const sumberColor = { 'Saldo BCA': 'badge-blue', 'Saldo Shopee': 'badge-orange', 'default': 'badge-gray' };
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Nama Iklan</th><th class="text-right">Biaya</th><th>Sumber Bayar</th><th class="text-right">Konversi</th>
          <th class="text-right">Omzet Iklan</th><th class="text-right">ACOS</th>
        </tr></thead>
        <tbody>${this._expenses.map(r => `
          <tr>
            <td class="max-w-[260px] truncate">${r.product_name}</td>
            <td class="text-right font-semibold text-money">${App.formatRupiah(r.biaya)}</td>
            <td><span class="badge ${sumberColor[r.sumber_bayar]||sumberColor.default}">${r.sumber_bayar||'Kartu Kredit'}</span>${r.sudah_potong_income ? ` <span class="badge badge-gray" title="Sudah otomatis terpotong lewat Income Shopee — tidak mengurangi Saldo Shopee lagi">✓ di Income</span>` : ''}${this._ccBadge('ads_expenses', r)}</td>
            <td class="text-right">${App.formatNumber(r.konversi || 0)}</td>
            <td class="text-right text-money">${App.formatRupiah(r.omzet_iklan)}</td>
            <td class="text-right">${(+r.acos || 0).toFixed(2)}%</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  /* ═══════════════════════════════════════════════
     RIWAYAT IKLAN MANUAL (input bebas per platform)
  ═══════════════════════════════════════════════ */
  async _load() {
    const { data, error } = await App.db().from('ads').select('*').order('ad_date', { ascending: false });
    if (error) { App.toast('Gagal memuat data iklan.', 'error'); return; }
    this._data = data || [];
    this._renderSummary();
    this._renderTable();
  },

  _periodFilteredAds() {
    const { bulan, tahun } = this._period();
    if (!bulan) return this._data;
    const { dateFrom, dateTo } = App.monthRange(bulan, tahun);
    return this._data.filter(r => r.ad_date && r.ad_date >= dateFrom && r.ad_date < dateTo);
  },

  _renderSummary() {
    const d = this._periodFilteredAds();
    const totalCost = d.reduce((s,r) => s+(+r.cost||0), 0);

    document.getElementById('iklan-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Biaya Iklan Manual</p><p class="stat-value text-money">${App.formatRupiah(totalCost)}</p><p class="stat-sub">semua platform — periode terpilih</p></div>`;
  },

  _renderTable() {
    const el = document.getElementById('iklan-table');
    const data = this._periodFilteredAds();
    if (!data.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><p>Belum ada data iklan untuk periode ini</p></div>`;
      return;
    }
    const platformColor = {
      'Shopee Ads': 'badge-orange', 'Meta': 'badge-blue', 'TikTok': 'badge-gray',
      'Google': 'badge-green', 'default': 'badge-blue',
    };
    const sumberColor = { 'Saldo BCA': 'badge-blue', 'Saldo Shopee': 'badge-orange', 'default': 'badge-gray' };
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Tanggal</th><th>Platform</th><th>Kampanye</th>
          <th class="text-right">Biaya</th><th>Sumber Bayar</th><th class="text-right">Impresi</th>
          <th class="text-right">Klik</th><th class="text-right">Order</th><th class="text-right">CPO</th><th></th>
        </tr></thead>
        <tbody>${data.map(r => {
          const cpo = (+r.orders_count||0) > 0 ? (+r.cost||0) / (+r.orders_count) : 0;
          return `<tr>
            <td class="whitespace-nowrap">${App.formatDate(r.ad_date)}</td>
            <td><span class="badge ${platformColor[r.platform]||platformColor.default}">${r.platform||'-'}</span></td>
            <td class="max-w-[160px] truncate">${r.campaign_name||'-'}</td>
            <td class="text-right font-semibold text-money">${App.formatRupiah(r.cost)}</td>
            <td><span class="badge ${sumberColor[r.sumber_bayar]||sumberColor.default}">${r.sumber_bayar||'Kartu Kredit'}</span>${r.sudah_potong_income ? ` <span class="badge badge-gray" title="Sudah otomatis terpotong lewat Income Shopee — tidak mengurangi Saldo Shopee lagi">✓ di Income</span>` : ''}${this._ccBadge('ads', r)}</td>
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
        <div><label class="label">Biaya (Rp) *</label><input id="ik-cost" type="number" class="input" placeholder="0"/></div>
        <div><label class="label">Sumber Pembayaran *</label>
          <select id="ik-sumber" class="input" onchange="Iklan._toggleSudahPotongVisibility('ik-sumber','ik-sudah-potong-wrap')">
            <option>Kartu Kredit</option>
            <option>Saldo BCA</option>
            <option>Saldo Shopee</option>
          </select>
        </div>
        <div class="col-span-2"><label class="label">Catatan</label><input id="ik-notes" class="input" placeholder="Opsional"/></div>
        <div id="ik-sudah-potong-wrap" class="col-span-2 hidden bg-amber-50 border border-amber-100 rounded-lg p-3">
          <label class="flex items-start gap-2 text-sm text-gray-700">
            <input id="ik-sudah-potong" type="checkbox" class="mt-0.5"/>
            <span>Sudah otomatis terpotong lewat Income Shopee — jangan kurangi Saldo Shopee lagi</span>
          </label>
          <p class="text-xs text-gray-500 mt-1 ml-6">Centang HANYA untuk Isi Ulang Saldo Iklan Otomatis yang nilainya sudah ikut mengurangi net_amount per pesanan di file Income/Penghasilan (biasanya muncul di laporan Saldo Shopee sebagai tipe transaksi "Pembayaran dengan Saldo Penjual"). Biaya tetap dicatat penuh di Laba Rugi — centang ini hanya mencegah Saldo Shopee dikurangi dua kali. JANGAN centang untuk iklan yang benar-benar dibayar terpisah dari Income (mis. top up manual lewat transfer terpisah).</p>
        </div>
      </div>`,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Batal</button>
               <button onclick="Iklan.save()" class="btn-primary">Simpan</button>`,
    });
  },

  async save() {
    const cost = +document.getElementById('ik-cost').value || 0;
    if (!cost) { App.toast('Biaya wajib diisi.', 'warning'); return; }
    const sumber = document.getElementById('ik-sumber').value;
    const payload = {
      ad_date:       document.getElementById('ik-date').value,
      platform:      document.getElementById('ik-platform').value,
      campaign_name: document.getElementById('ik-campaign').value.trim() || null,
      cost,
      sumber_bayar:  sumber,
      // Checkbox hanya tampil (dan cuma relevan) kalau sumber === 'Saldo Shopee' — lihat _toggleSudahPotongVisibility.
      sudah_potong_income: sumber === 'Saldo Shopee' && !!document.getElementById('ik-sudah-potong')?.checked,
      notes:         document.getElementById('ik-notes').value.trim() || null,
    };
    const { error } = await App.db().from('ads').insert(payload);
    if (error) { App.toast('Error: ' + error.message, 'error'); return; }
    App.closeModal();
    App.toast('Biaya iklan disimpan!', 'success');
    await this._refreshAfterCcChange();
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
    await this._loadCcUnpaid();
  },

  _exportCSV() {
    App.exportCSV(this._periodFilteredAds().map(r => ({
      tanggal: r.ad_date, platform: r.platform, kampanye: r.campaign_name,
      biaya: r.cost, sumber_bayar: r.sumber_bayar || 'Kartu Kredit',
      impresi: r.impressions, klik: r.clicks, order: r.orders_count,
    })), 'iklan-export.csv');
  },
};
