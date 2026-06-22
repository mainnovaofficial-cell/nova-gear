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
      <div class="flex gap-2">
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

    <div class="card mb-5">
      <div class="card-header mb-3 flex-wrap gap-2">
        <span class="card-title">Iklan Shopee per Produk</span>
        <div class="flex gap-2 items-center">
          <select id="ik-bulan" class="input !py-1 text-xs">
            ${this._bulanNames.map((m, i) => i === 0 ? '' : `<option value="${i}" ${i === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <input id="ik-tahun" type="number" class="input !py-1 text-xs w-24" value="${now.getFullYear()}" min="2020" max="2035"/>
          <button onclick="Iklan._loadExpenses()" class="btn-secondary text-xs !py-1">Tampilkan</button>
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
    await Promise.all([this._loadExpenses(), this._load()]);
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
    const bulan = parseInt(document.getElementById('imp-ik-bulan').value);
    const tahun = parseInt(document.getElementById('imp-ik-tahun').value);

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
          acos:         colAcos  !== -1 ? this._toNum(row[colAcos]) : 0,
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
      await this._loadExpenses();

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

  async _loadExpenses() {
    const bulan = parseInt(document.getElementById('ik-bulan')?.value) || (new Date().getMonth() + 1);
    const tahun = parseInt(document.getElementById('ik-tahun')?.value) || new Date().getFullYear();
    const { data, error } = await App.db().from('ads_expenses').select('*')
      .eq('month', bulan).eq('year', tahun).order('biaya', { ascending: false });
    if (error) { App.toast('Gagal memuat data iklan: ' + error.message, 'error'); return; }
    this._expenses = data || [];
    this._renderExpenses();
  },

  async _deleteExpensesMonth() {
    const bulan = parseInt(document.getElementById('ik-bulan')?.value) || (new Date().getMonth() + 1);
    const tahun = parseInt(document.getElementById('ik-tahun')?.value) || new Date().getFullYear();
    const ok = await App.confirm(`Hapus semua data iklan Shopee per produk untuk ${this._bulanNames[bulan]} ${tahun}? Tindakan ini tidak dapat dibatalkan.`);
    if (!ok) return;
    const { error } = await App.db().from('ads_expenses').delete().eq('month', bulan).eq('year', tahun);
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    App.toast('Data iklan bulan ini dihapus.', 'success');
    await this._loadExpenses();
  },

  _renderExpenses() {
    const totalBiaya = this._expenses.reduce((s, r) => s + (+r.biaya || 0), 0);
    document.getElementById('iklan-exp-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Biaya Iklan Bulan Ini</p><p class="stat-value text-money">${App.formatRupiah(totalBiaya)}</p><p class="stat-sub">${this._expenses.length} produk</p></div>`;

    const el = document.getElementById('iklan-exp-table');
    if (!this._expenses.length) {
      el.innerHTML = `<div class="empty-state py-10"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><p>Belum ada data import iklan untuk bulan ini</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Nama Iklan</th><th class="text-right">Biaya</th><th class="text-right">Konversi</th>
          <th class="text-right">Omzet Iklan</th><th class="text-right">ACOS</th>
        </tr></thead>
        <tbody>${this._expenses.map(r => `
          <tr>
            <td class="max-w-[260px] truncate">${r.product_name}</td>
            <td class="text-right font-semibold text-money">${App.formatRupiah(r.biaya)}</td>
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

  _renderSummary() {
    const d = this._data;
    const totalCost = d.reduce((s,r) => s+(+r.cost||0), 0);

    document.getElementById('iklan-summary').innerHTML = `
      <div class="stat-card"><p class="stat-label">Total Biaya Iklan Manual</p><p class="stat-value text-money">${App.formatRupiah(totalCost)}</p><p class="stat-sub">semua platform</p></div>`;
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
