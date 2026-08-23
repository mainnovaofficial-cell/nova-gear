/* ═══════════════════════════════════════════════════════
   Nova Gear — Stok Module (v2)
   Stok awal manual + masuk dari HPP + keluar dari pesanan
   + history perubahan + penyesuaian manual
═══════════════════════════════════════════════════════ */
'use strict';

const Stok = {
  _tab: 'rekap',
  _rowData: {},
  _showHidden: false,
  _showHiddenRiwayat: false,
  _riwayatDate: '',
  _riwayatRaw: null,

  async onLoad() {
    const el = document.getElementById('page-stok');
    this._riwayatRaw = null; // paksa reload data Riwayat Stok saat Refresh ditekan
    el.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Stok</h2>
        <p>Manajemen stok per SKU — stok awal, masuk HPP, keluar pesanan</p>
      </div>
      <div class="flex gap-2">
        <button onclick="Stok.openTambahProduk()" class="btn-secondary text-xs">Tambah Produk</button>
        <button onclick="Stok.openAdjust()" class="btn-secondary text-xs">Penyesuaian Manual</button>
        <button onclick="Stok.onLoad()" class="btn-primary text-xs">Refresh</button>
      </div>
    </div>
    <div class="tabs mb-0">
      <button class="tab-btn active" onclick="Stok._switchTab('rekap', this)">Rekap Stok</button>
      <button class="tab-btn"        onclick="Stok._switchTab('history', this)">History Perubahan</button>
      <button class="tab-btn"        onclick="Stok._switchTab('riwayat', this)">Riwayat Stok</button>
    </div>
    <div id="stok-content"><div class="skeleton h-40 w-full rounded-xl mt-4"></div></div>`;
    if (!this._menuListenerBound) {
      document.addEventListener('click', () => this._closeAllMenus());
      this._menuListenerBound = true;
    }
    await this._render();
  },

  /* ── Dropdown aksi per baris ── */
  _toggleMenu(event, id) {
    event.stopPropagation();
    const target = document.getElementById(id);
    if (!target) return;
    const wasHidden = target.classList.contains('hidden');
    this._closeAllMenus();
    if (wasHidden) target.classList.remove('hidden');
  },

  _closeAllMenus() {
    document.querySelectorAll('.stok-action-menu').forEach(m => m.classList.add('hidden'));
  },

  _switchTab(tab, btn) {
    this._tab = tab;
    document.querySelectorAll('#page-stok .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._render();
  },

  async _render() {
    if (this._tab === 'rekap')   await this._renderRekap();
    if (this._tab === 'history') await this._renderHistory();
    if (this._tab === 'riwayat') await this._renderRiwayat();
  },

  /* ── TAB: REKAP STOK ── */
  async _renderRekap() {
    const el = document.getElementById('stok-content');
    el.innerHTML = `<div class="skeleton h-40 w-full rounded-xl mt-4"></div>`;

    try {
      const db = App.db();
      const [
        { data: hppData  },
        orders,
        { data: adjusts  },
        { data: stokAwal },
      ] = await Promise.all([
        db.from('hpp_items').select('sku,product_name,qty'),
        // Posisi stok = akumulasi SEMUA WAKTU (awal + masuk - keluar + adjust), jadi butuh
        // SELURUH baris orders, bukan sebagian — App.fetchAllRows() supaya tidak diam-diam
        // kepotong row cap default PostgREST/Supabase (biasanya 1000 baris) begitu tabelnya
        // tumbuh besar (lihat catatan yang sama di js/dashboard.js & js/analisis.js).
        App.fetchAllRows((from, to) => db.from('orders')
          .select('sku,product_name,qty,stok_action,status').range(from, to)),
        db.from('stok_adjust').select('sku,qty').then(r => r, () => ({ data: [] })),
        db.from('stok_awal').select('sku,product_name,qty,parent_sku,hidden').then(r => r, () => ({ data: [] })),
      ]);
      App.warnIfRowCap(hppData, 'stok (Rekap Stok): hpp_items');

      // Normalisasi SKU (trim + uppercase) supaya SKU yang sama dari sumber berbeda
      // (stok_awal, hpp_items, orders, stok_adjust) selalu cocok satu sama lain —
      // tanpa ini, SKU dengan casing berbeda dianggap produk lain dan tombol Hapus
      // (yang menghapus berdasarkan SKU persis) tidak akan menemukan baris di stok_awal.
      const normSku = raw => (raw || '').toString().trim().toUpperCase() || 'TANPA-SKU';

      // Resolusi SKU varian → Parent SKU (varian dengan stok fisik sama digabung)
      const parentMap = {};
      this._skuMeta = {};
      (stokAwal || []).forEach(r => {
        const sku = normSku(r.sku);
        this._skuMeta[sku] = { name: r.product_name || sku, awal: +r.qty || 0, parentSku: r.parent_sku || '', hidden: r.hidden === true };
        if (r.parent_sku) parentMap[sku] = normSku(r.parent_sku);
      });
      const groupKey = sku => parentMap[sku] || sku;
      // SKU yang tidak punya baris stok_awal sama sekali (hanya tercatat dari HPP/Pesanan)
      // otomatis tersembunyi. Baris SKU kosong/null di orders (mis. baris "Ongkir" atau
      // pesanan lama yang SKU-nya gagal terbaca saat import) selalu dianggap tersembunyi —
      // tidak berguna untuk manajemen stok, meski suatu saat pernah ada baris stok_awal
      // dengan SKU literal "TANPA-SKU".
      const isHidden = sku => sku === 'TANPA-SKU' ? true : (this._skuMeta[sku] ? this._skuMeta[sku].hidden : true);

      // Group map: { groupKey → { name, awal, masuk, keluar, adjust, members } }
      const map = {};
      const ensure = (sku, name = '') => {
        const key = groupKey(sku);
        if (!map[key]) map[key] = { sku: key, name: name || key, awal: 0, masuk: 0, keluar: 0, adjust: 0, members: new Set() };
        map[key].members.add(sku);
        if (name && map[key].name === key) map[key].name = name;
      };

      (stokAwal || []).forEach(r => {
        const sku = normSku(r.sku);
        ensure(sku, r.product_name);
        map[groupKey(sku)].awal += +r.qty || 0;
      });

      (hppData || []).forEach(r => {
        const sku = normSku(r.sku);
        ensure(sku, r.product_name);
        map[groupKey(sku)].masuk += +r.qty || 0;
      });

      const DEDUCT = new Set(['keluar', 'sudah_keluar_tidak_balik', 'menunggu_barang_kembali']);
      (orders || []).forEach(r => {
        const sku = normSku(r.sku);
        ensure(sku, r.product_name);
        // Backward compat: old Selesai orders without stok_action
        const action = r.stok_action || (r.status === 'Selesai' ? 'keluar' : null);
        if (DEDUCT.has(action)) map[groupKey(sku)].keluar += +r.qty || 0;
      });

      (adjusts || []).forEach(r => {
        const sku = normSku(r.sku);
        ensure(sku);
        map[groupKey(sku)].adjust += +r.qty || 0;
      });

      const rows = Object.values(map).sort((a, b) => a.sku.localeCompare(b.sku));
      // Produk grup dianggap tersembunyi hanya jika SEMUA SKU anggotanya tersembunyi.
      rows.forEach(r => { r.hidden = [...r.members].every(m => isHidden(m)); });
      this._rowData = {};
      rows.forEach(r => { r.members.forEach(m => { this._rowData[m] = r; }); });

      const visibleRows = this._showHidden ? rows : rows.filter(r => !r.hidden);
      const hiddenCount = rows.filter(r => r.hidden).length;

      const toggleBar = `
      <div class="flex items-center justify-between mb-3">
        <label class="inline-flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" id="stok-show-hidden" ${this._showHidden ? 'checked' : ''} onchange="Stok._toggleShowHidden(this.checked)"/>
          Tampilkan produk tersembunyi ${hiddenCount ? `(${hiddenCount})` : ''}
        </label>
      </div>`;

      if (!visibleRows.length) {
        el.innerHTML = toggleBar + `<div class="empty-state card py-16 mt-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-gray-300 mx-auto mb-3">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <p>Belum ada data stok. Tambah HPP atau pesanan terlebih dahulu.</p>
        </div>`;
        return;
      }

      el.innerHTML = toggleBar + `
      <div class="table-wrapper mt-4">
        <table class="data-table">
          <thead><tr>
            <th>SKU</th>
            <th>Nama Produk</th>
            <th class="text-right">Stok Awal</th>
            <th class="text-right">Masuk (HPP)</th>
            <th class="text-right">Keluar (Pesanan)</th>
            <th class="text-right">Penyesuaian</th>
            <th class="text-right">Sisa Stok</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>${visibleRows.map((r, rIdx) => {
            const sisa = r.awal + r.masuk - r.keluar + r.adjust;
            const [sc, sl] = sisa <= 0 ? ['badge-red','Habis'] : sisa <= 5 ? ['badge-yellow','Hampir Habis'] : ['badge-green','Tersedia'];
            const members = [...r.members].sort();
            return `<tr class="${r.hidden ? 'bg-gray-50' : ''}">
              <td class="font-mono text-xs font-semibold text-gray-600">
                ${r.sku}
                ${r.hidden ? `<span class="badge badge-gray text-[10px] ml-1">Tersembunyi</span>` : ''}
                ${members.length > 1 ? `<div class="text-[10px] text-gray-400 font-normal mt-0.5">${members.join(', ')}</div>` : ''}
              </td>
              <td class="font-medium">${r.name}</td>
              <td class="text-right text-gray-500 font-semibold">${App.formatNumber(r.awal)}</td>
              <td class="text-right text-green-700 font-semibold">${App.formatNumber(r.masuk)}</td>
              <td class="text-right text-red-600 font-semibold">${App.formatNumber(r.keluar)}</td>
              <td class="text-right ${r.adjust >= 0 ? 'text-blue-600' : 'text-orange-600'} font-semibold">${r.adjust > 0 ? '+' : ''}${App.formatNumber(r.adjust)}</td>
              <td class="text-right font-bold text-lg text-money">${App.formatNumber(sisa)}</td>
              <td><span class="badge ${sc}">${sl}</span></td>
              <td>
                ${members.map((m, mIdx) => {
                  const esc   = m.replace(/'/g, "\\'");
                  const menuId = `stok-menu-${rIdx}-${mIdx}`;
                  return `
                <div class="relative inline-block ${members.length > 1 ? 'block mb-1' : ''}">
                  <button onclick="Stok._toggleMenu(event, '${menuId}')"
                          class="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded px-2 py-0.5 text-sm font-bold leading-none"
                          title="${members.length > 1 ? 'Aksi ' + m : 'Aksi'}">
                    ⋮${members.length > 1 ? `<span class="text-[10px] text-gray-400 font-normal ml-1">${m}</span>` : ''}
                  </button>
                  <div id="${menuId}" class="stok-action-menu hidden absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-lg shadow-lg z-50 py-1 text-xs">
                    <button onclick="Stok.editStokAwal('${esc}')" class="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-blue-600">Edit Stok Awal</button>
                    ${App.isOwner() ? `
                    <button onclick="Stok.toggleHidden('${esc}', ${!isHidden(m)})" class="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-600">${isHidden(m) ? 'Tampilkan' : 'Sembunyikan'}</button>
                    <button onclick="Stok.deleteProduk('${esc}')" class="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-red-500">Hapus</button>` : ''}
                  </div>
                </div>`;
                }).join('')}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p class="text-xs text-gray-400 mt-2 px-1">
        Sisa = Stok Awal + Masuk (HPP) − Keluar (Pesanan Selesai/Terkirim) + Penyesuaian.
        Produk dengan Parent SKU yang sama digabung jadi satu baris stok bersama.
        Produk tersembunyi tidak ditampilkan di sini, tapi data penjualan dan HPP-nya tetap terhitung di Laba Rugi.
      </p>`;

    } catch (err) {
      el.innerHTML = `<div class="card mt-4 p-4 text-red-600 text-sm">Error memuat data stok: ${err.message}</div>`;
    }
  },

  _toggleShowHidden(checked) {
    this._showHidden = checked;
    this._renderRekap();
  },

  /* ── TAB: HISTORY PERUBAHAN ── */
  async _renderHistory() {
    const el = document.getElementById('stok-content');
    el.innerHTML = `<div class="skeleton h-40 w-full rounded-xl mt-4"></div>`;

    try {
      const db = App.db();
      const [
        { data: hppBatches },
        { data: orders   },
        { data: adjusts  },
      ] = await Promise.all([
        db.from('hpp_batches').select('purchase_date,batch_no,notes,hpp_items(sku,product_name,qty)').order('purchase_date', { ascending: false }),
        db.from('orders').select('sku,product_name,qty,stok_action,status,order_date,order_no,cancel_reason').order('order_date', { ascending: false }),
        db.from('stok_adjust').select('sku,qty,notes,created_at').order('created_at', { ascending: false }).then(r => r, () => ({ data: [] })),
      ]);

      const DEDUCT = new Set(['keluar', 'sudah_keluar_tidak_balik', 'menunggu_barang_kembali']);

      const events = [];

      (hppBatches || []).forEach(b => {
        (b.hpp_items || []).forEach(r => {
          events.push({
            tanggal: b.purchase_date || '',
            sku: r.sku || 'TANPA-SKU',
            nama: r.product_name || r.sku || '-',
            masuk: +r.qty || 0,
            keluar: 0,
            tipe: 'masuk_hpp',
            keterangan: `Pembelian HPP${b.batch_no ? ` (${b.batch_no})` : ''}${b.notes ? ' — ' + b.notes : ''}`,
          });
        });
      });

      (orders || []).forEach(r => {
        const action = r.stok_action || (r.status === 'Selesai' ? 'keluar' : null);
        if (!DEDUCT.has(action)) return;
        const labelMap = {
          keluar:                   'Pesanan Keluar',
          sudah_keluar_tidak_balik: 'Paket Hilang',
          menunggu_barang_kembali:  'Gagal Kirim (menunggu retur)',
        };
        events.push({
          tanggal: r.order_date || '',
          sku: r.sku || 'TANPA-SKU',
          nama: r.product_name || r.sku || '-',
          masuk: 0,
          keluar: +r.qty || 0,
          tipe: action,
          keterangan: `${labelMap[action] || 'Keluar'}${r.order_no ? ' — ' + r.order_no : ''}${r.cancel_reason ? ' | ' + r.cancel_reason : ''}`,
        });
      });

      (adjusts || []).forEach(r => {
        const qty = +r.qty || 0;
        events.push({
          tanggal: (r.created_at || '').slice(0, 10),
          sku: r.sku || 'TANPA-SKU',
          nama: r.sku || '-',
          masuk:  qty > 0 ? qty : 0,
          keluar: qty < 0 ? Math.abs(qty) : 0,
          tipe: 'adjust',
          keterangan: `Penyesuaian manual${r.notes ? ' — ' + r.notes : ''}`,
        });
      });

      events.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.tipe.localeCompare(a.tipe));

      const tipeBadge = tipe => {
        const m = {
          masuk_hpp:               ['badge-green', 'Masuk HPP'],
          keluar:                  ['badge-red',   'Keluar Pesanan'],
          sudah_keluar_tidak_balik:['badge-orange','Paket Hilang'],
          menunggu_barang_kembali: ['badge-yellow','Gagal Kirim'],
          adjust:                  ['badge-blue',  'Penyesuaian'],
        };
        const [cls, lbl] = m[tipe] || ['badge-gray', tipe];
        return `<span class="badge ${cls} text-xs">${lbl}</span>`;
      };

      if (!events.length) {
        el.innerHTML = `<div class="empty-state card py-16 mt-4"><p>Belum ada history perubahan stok.</p></div>`;
        return;
      }

      el.innerHTML = `
      <div class="table-wrapper mt-4">
        <table class="data-table">
          <thead><tr>
            <th>Tanggal</th><th>SKU</th><th>Nama</th>
            <th class="text-right text-green-700">Masuk</th>
            <th class="text-right text-red-600">Keluar</th>
            <th>Tipe</th><th>Keterangan</th>
          </tr></thead>
          <tbody>${events.map(e => `<tr>
            <td class="whitespace-nowrap">${App.formatDate(e.tanggal)}</td>
            <td class="font-mono text-xs text-gray-600">${e.sku}</td>
            <td class="max-w-[160px] truncate text-sm" title="${e.nama}">${e.nama}</td>
            <td class="text-right font-semibold ${e.masuk  ? 'text-green-700' : 'text-gray-300'}">${e.masuk  ? '+' + App.formatNumber(e.masuk)  : '—'}</td>
            <td class="text-right font-semibold ${e.keluar ? 'text-red-600'   : 'text-gray-300'}">${e.keluar ? '−' + App.formatNumber(e.keluar) : '—'}</td>
            <td>${tipeBadge(e.tipe)}</td>
            <td class="text-xs text-gray-500 max-w-[220px] truncate" title="${e.keterangan}">${e.keterangan}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;

    } catch (err) {
      el.innerHTML = `<div class="card mt-4 p-4 text-red-600 text-sm">Error memuat history: ${err.message}</div>`;
    }
  },

  /* ── TAB: RIWAYAT STOK ── */
  // Fitur 1: posisi stok semua SKU per tanggal (kumulatif <= tanggal terpilih).
  // Fitur 2: klik SKU → pergerakan harian 30 hari terakhir + no. pesanan penyebab keluar.
  async _renderRiwayat() {
    const el = document.getElementById('stok-content');
    el.innerHTML = `<div class="skeleton h-40 w-full rounded-xl mt-4"></div>`;

    try {
      if (!this._riwayatRaw) await this._loadRiwayatData();
      if (!this._riwayatDate) this._riwayatDate = App.todayISO();
      el.innerHTML = this._riwayatShell();
    } catch (err) {
      el.innerHTML = `<div class="card mt-4 p-4 text-red-600 text-sm">Error memuat riwayat stok: ${err.message}</div>`;
    }
  },

  // Ambil semua data mentah sekali (masuk HPP per tanggal batch, keluar pesanan per
  // tanggal efektif, penyesuaian manual per tanggal) lalu simpan sebagai flat event list
  // supaya perhitungan per-tanggal / per-SKU cukup di-filter di client tanpa query ulang.
  async _loadRiwayatData() {
    const db = App.db();
    const [
      { data: stokAwal   },
      { data: hppBatches },
      { data: orders     },
      { data: adjusts    },
      importLog,
    ] = await Promise.all([
      db.from('stok_awal').select('sku,product_name,qty,parent_sku,hidden').then(r => r, () => ({ data: [] })),
      db.from('hpp_batches').select('purchase_date,hpp_items(sku,product_name,qty)'),
      db.from('orders').select('sku,product_name,qty,stok_action,status,order_no,created_at'),
      db.from('stok_adjust').select('sku,qty,created_at').then(r => r, () => ({ data: [] })),
      // Dipakai utk MIN(tanggal_import) per order_no lintas SELURUH histori (Riwayat Stok
      // bisa ditanya utk tanggal berapapun di masa lalu), jadi ORDER BY saja tidak cukup —
      // kalau tabelnya melebihi row cap default PostgREST (biasanya 1000 baris) query biasa
      // bisa kepotong & diam-diam menghilangkan sebagian order_no dari hasil. Pakai
      // App.fetchAllRows (pagination lewat .range()) supaya SELURUH baris tetap terambil;
      // .order() ascending sekadar jaga-jaga tambahan (defense-in-depth), bukan solusi utama.
      App.fetchAllRows(
        (from, to) => db.from('order_import_log').select('order_no,tanggal_import')
          .order('tanggal_import', { ascending: true }).range(from, to)
      ).catch(() => []),
    ]);

    const normSku = raw => (raw || '').toString().trim().toUpperCase() || 'TANPA-SKU';
    const parentMap = {};
    const skuMeta = {};
    (stokAwal || []).forEach(r => {
      const sku = normSku(r.sku);
      skuMeta[sku] = { name: r.product_name || sku, awal: +r.qty || 0, hidden: r.hidden === true };
      if (r.parent_sku) parentMap[sku] = normSku(r.parent_sku);
    });
    const groupKey = sku => parentMap[sku] || sku;

    // Tanggal keluar = min(tanggal_import) dari order_import_log utk order_no tsb
    // (lintas jenis_import), fallback ke orders.created_at::date kalau order_no
    // tidak pernah tercatat di log — konsisten dgn pendekatan Rekap Harian.
    const minImportDate = {};
    (importLog || []).forEach(l => {
      if (!l.order_no || !l.tanggal_import) return;
      if (!minImportDate[l.order_no] || l.tanggal_import < minImportDate[l.order_no]) {
        minImportDate[l.order_no] = l.tanggal_import;
      }
    });
    const effDate = o => (o.order_no && minImportDate[o.order_no]) ? minImportDate[o.order_no] : (o.created_at || '').slice(0, 10);

    const DEDUCT = new Set(['keluar', 'sudah_keluar_tidak_balik', 'menunggu_barang_kembali']);

    const masukEvents = [];
    (hppBatches || []).forEach(b => {
      const tanggal = b.purchase_date || '';
      (b.hpp_items || []).forEach(r => {
        const sku = normSku(r.sku);
        masukEvents.push({ sku, group: groupKey(sku), name: r.product_name, tanggal, qty: +r.qty || 0 });
      });
    });

    const keluarEvents = [];
    (orders || []).forEach(r => {
      const action = r.stok_action || (r.status === 'Selesai' ? 'keluar' : null);
      if (!DEDUCT.has(action)) return;
      const sku = normSku(r.sku);
      keluarEvents.push({ sku, group: groupKey(sku), name: r.product_name, tanggal: effDate(r), qty: +r.qty || 0, order_no: r.order_no || '(manual)' });
    });

    const adjustEvents = [];
    (adjusts || []).forEach(r => {
      const sku = normSku(r.sku);
      adjustEvents.push({ sku, group: groupKey(sku), tanggal: (r.created_at || '').slice(0, 10), qty: +r.qty || 0 });
    });

    this._riwayatRaw = { skuMeta, groupKey, masukEvents, keluarEvents, adjustEvents };
  },

  _riwayatShell() {
    const today = App.todayISO();
    const sel = this._riwayatDate;
    return `
    <div class="card mt-4 !py-3">
      <div class="flex flex-wrap gap-3 items-center">
        <label class="text-sm font-medium text-gray-600">Posisi stok per tanggal:</label>
        <input type="date" value="${sel}" max="${today}" class="input w-40 !py-1.5 text-xs"
               onchange="Stok._setRiwayatDate(this.value)"/>
        ${sel !== today ? `<button onclick="Stok._setRiwayatDate('${today}')" class="btn-secondary text-xs !py-1.5">Hari Ini</button>` : ''}
      </div>
    </div>
    <div id="riwayat-table">${this._riwayatTableHtml()}</div>`;
  },

  _setRiwayatDate(d) {
    this._riwayatDate = d;
    document.getElementById('riwayat-table').innerHTML = this._riwayatTableHtml();
  },

  _toggleShowHiddenRiwayat(checked) {
    this._showHiddenRiwayat = checked;
    document.getElementById('riwayat-table').innerHTML = this._riwayatTableHtml();
  },

  // Bangun tabel posisi stok semua SKU per this._riwayatDate (kumulatif, difilter <=).
  _riwayatTableHtml() {
    const sel = this._riwayatDate;
    const { skuMeta, groupKey, masukEvents, keluarEvents, adjustEvents } = this._riwayatRaw;

    const map = {};
    const ensure = (group, name) => {
      if (!map[group]) map[group] = { sku: group, name: name || group, awal: 0, masuk: 0, adjust: 0, keluar: 0, members: new Set() };
      if (name && map[group].name === group) map[group].name = name;
    };

    Object.entries(skuMeta).forEach(([sku, meta]) => {
      const group = groupKey(sku);
      ensure(group, meta.name);
      map[group].awal += meta.awal;
      map[group].members.add(sku);
    });
    masukEvents.forEach(e => {
      if (!e.tanggal || e.tanggal > sel) return;
      ensure(e.group, e.name);
      map[e.group].masuk += e.qty;
      map[e.group].members.add(e.sku);
    });
    adjustEvents.forEach(e => {
      if (!e.tanggal || e.tanggal > sel) return;
      ensure(e.group);
      map[e.group].adjust += e.qty;
      map[e.group].members.add(e.sku);
    });
    keluarEvents.forEach(e => {
      if (!e.tanggal || e.tanggal > sel) return;
      ensure(e.group, e.name);
      map[e.group].keluar += e.qty;
      map[e.group].members.add(e.sku);
    });

    // Baris SKU kosong/null (mis. "Ongkir" atau pesanan lama yang SKU-nya gagal terbaca
    // saat import) selalu dianggap tersembunyi — data di orders tidak diubah, hanya
    // disembunyikan dari tampilan Stok.
    const hiddenSet = new Set(Object.entries(skuMeta).filter(([, m]) => m.hidden).map(([sku]) => sku));
    hiddenSet.add('TANPA-SKU');
    const rows = Object.values(map).sort((a, b) => a.sku.localeCompare(b.sku));
    rows.forEach(r => { r.hidden = [...r.members].every(m => hiddenSet.has(m)); });

    const visibleRows = this._showHiddenRiwayat ? rows : rows.filter(r => !r.hidden);
    const hiddenCount = rows.filter(r => r.hidden).length;

    if (!visibleRows.length) {
      return `<div class="empty-state card py-16 mt-4"><p>Belum ada data stok sampai tanggal ini.</p></div>`;
    }

    const toggleBar = `
    <div class="flex items-center justify-between mb-3 mt-4">
      <label class="inline-flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" ${this._showHiddenRiwayat ? 'checked' : ''} onchange="Stok._toggleShowHiddenRiwayat(this.checked)"/>
        Tampilkan produk tersembunyi ${hiddenCount ? `(${hiddenCount})` : ''}
      </label>
    </div>`;

    return toggleBar + `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>SKU</th>
          <th>Nama Produk</th>
          <th class="text-right">Stok Awal</th>
          <th class="text-right">Masuk</th>
          <th class="text-right">Penyesuaian</th>
          <th class="text-right">Keluar</th>
          <th class="text-right">Stok Akhir</th>
        </tr></thead>
        <tbody>${visibleRows.map(r => {
          const akhir = r.awal + r.masuk + r.adjust - r.keluar;
          const escSku = r.sku.replace(/'/g, "\\'");
          return `<tr class="cursor-pointer ${r.hidden ? 'bg-gray-50' : ''}" onclick="Stok._openPergerakan('${escSku}')">
            <td class="font-mono text-xs font-semibold text-gray-600">
              ${r.sku}${r.hidden ? ` <span class="badge badge-gray text-[10px] ml-1">Tersembunyi</span>` : ''}
            </td>
            <td class="font-medium">${r.name}</td>
            <td class="text-right text-gray-500 font-semibold">${App.formatNumber(r.awal)}</td>
            <td class="text-right text-green-700 font-semibold">${App.formatNumber(r.masuk)}</td>
            <td class="text-right ${r.adjust >= 0 ? 'text-blue-600' : 'text-orange-600'} font-semibold">${r.adjust > 0 ? '+' : ''}${App.formatNumber(r.adjust)}</td>
            <td class="text-right text-red-600 font-semibold">${App.formatNumber(r.keluar)}</td>
            <td class="text-right font-bold text-lg text-money">${App.formatNumber(akhir)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    <p class="text-xs text-gray-400 mt-2 px-1">
      Stok Akhir = Stok Awal + Masuk + Penyesuaian − Keluar, dihitung sampai tanggal terpilih.
      Klik baris SKU untuk melihat pergerakan harian 30 hari terakhir.
    </p>`;
  },

  // Fitur 2 — modal pergerakan harian 30 hari terakhir (berakhir di this._riwayatDate) utk satu grup SKU.
  _openPergerakan(group) {
    const sel = this._riwayatDate || App.todayISO();
    const endD = new Date(sel + 'T12:00:00');
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(endD);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const startDate = days[0];

    const { skuMeta, groupKey, masukEvents, keluarEvents, adjustEvents } = this._riwayatRaw;
    const members = new Set();
    Object.keys(skuMeta).forEach(sku => { if (groupKey(sku) === group) members.add(sku); });
    [...masukEvents, ...keluarEvents, ...adjustEvents].forEach(e => { if (e.group === group) members.add(e.sku); });

    let running = 0;
    Object.entries(skuMeta).forEach(([sku, m]) => { if (groupKey(sku) === group) running += m.awal; });
    const sumBefore = list => list.filter(e => e.group === group && e.tanggal && e.tanggal < startDate).reduce((s, e) => s + e.qty, 0);
    running += sumBefore(masukEvents) + sumBefore(adjustEvents) - sumBefore(keluarEvents);

    const meta = skuMeta[group] || { name: group };

    const rows = days.map(d => {
      const masuk = masukEvents.filter(e => e.group === group && e.tanggal === d).reduce((s, e) => s + e.qty, 0);
      const keluarList = keluarEvents.filter(e => e.group === group && e.tanggal === d);
      const keluar = keluarList.reduce((s, e) => s + e.qty, 0);
      const adjust = adjustEvents.filter(e => e.group === group && e.tanggal === d).reduce((s, e) => s + e.qty, 0);
      running += masuk + adjust - keluar;
      return { tanggal: d, masuk, keluar, adjust, akhir: running, orderNos: [...new Set(keluarList.map(e => e.order_no))] };
    });

    const body = `
    <p class="text-sm text-gray-500 mb-3">
      <span class="font-mono">${group}</span>${members.size > 1 ? ` <span class="text-xs text-gray-400">(gabungan: ${[...members].sort().join(', ')})</span>` : ''}
      — pergerakan 30 hari terakhir sampai ${App.formatDate(sel)}.
    </p>
    <div class="table-wrapper" style="max-height:60vh; overflow-y:auto;">
      <table class="data-table">
        <thead><tr>
          <th>Tanggal</th>
          <th class="text-right text-green-700">Masuk</th>
          <th class="text-right text-red-600">Keluar</th>
          <th class="text-right">Penyesuaian</th>
          <th class="text-right">Stok Akhir</th>
          <th>No. Pesanan (Keluar)</th>
        </tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="whitespace-nowrap text-xs">${App.formatDate(r.tanggal)}</td>
          <td class="text-right font-semibold ${r.masuk  ? 'text-green-700' : 'text-gray-300'}">${r.masuk  ? '+' + App.formatNumber(r.masuk)  : '—'}</td>
          <td class="text-right font-semibold ${r.keluar ? 'text-red-600'   : 'text-gray-300'}">${r.keluar ? '−' + App.formatNumber(r.keluar) : '—'}</td>
          <td class="text-right font-semibold ${r.adjust ? (r.adjust > 0 ? 'text-blue-600' : 'text-orange-600') : 'text-gray-300'}">${r.adjust ? (r.adjust > 0 ? '+' : '') + App.formatNumber(r.adjust) : '—'}</td>
          <td class="text-right font-bold text-money">${App.formatNumber(r.akhir)}</td>
          <td class="text-xs text-gray-500 max-w-[220px] truncate" title="${r.orderNos.join(', ')}">${r.orderNos.length ? r.orderNos.join(', ') : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

    App.openModal({
      title: `Pergerakan Stok — ${meta.name || group}`,
      body,
      footer: `<button onclick="App.closeModal()" class="btn-secondary">Tutup</button>`,
      size: 'max-w-3xl',
    });
  },

  /* ── EDIT STOK AWAL ── */
  editStokAwal(sku) {
    const meta = (this._skuMeta && this._skuMeta[sku]) || { name: sku, awal: 0, parentSku: '' };
    const escapedSku = sku.replace(/'/g, "\\'");
    App.openModal({
      title: 'Edit Stok Awal',
      body: `
        <p class="text-sm text-gray-500 mb-4">Stok awal adalah jumlah fisik barang sebelum ada pencatatan HPP di sistem.</p>
        <div class="space-y-3">
          <div>
            <label class="label">SKU</label>
            <input class="input bg-gray-50" value="${sku}" disabled/>
          </div>
          <div>
            <label class="label">Nama Produk</label>
            <input id="sa-nama" class="input" placeholder="Nama produk (opsional)"/>
          </div>
          <div>
            <label class="label">Parent SKU</label>
            <input id="sa-parent" class="input" placeholder="Opsional — untuk varian dengan stok fisik sama"/>
          </div>
          <div>
            <label class="label">Stok Awal *</label>
            <input id="sa-qty" type="number" min="0" class="input" value="${meta.awal}" placeholder="0"/>
          </div>
          <div>
            <label class="label">Catatan</label>
            <input id="sa-notes" class="input" placeholder="Opsional"/>
          </div>
        </div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Stok.saveStokAwal('${escapedSku}')" class="btn-primary">Simpan</button>`,
    });
    // Set nama & parent setelah DOM render untuk menghindari HTML injection
    setTimeout(() => {
      const nameEl = document.getElementById('sa-nama');
      if (nameEl) nameEl.value = meta.name && meta.name !== sku ? meta.name : '';
      const parentEl = document.getElementById('sa-parent');
      if (parentEl) parentEl.value = meta.parentSku || '';
    }, 0);
  },

  async saveStokAwal(sku) {
    const qty       = parseInt(document.getElementById('sa-qty').value);
    const nama      = document.getElementById('sa-nama').value.trim();
    const notes     = document.getElementById('sa-notes').value.trim();
    const parentSku = document.getElementById('sa-parent').value.trim().toUpperCase();

    if (isNaN(qty) || qty < 0) { App.toast('Jumlah stok awal tidak valid.', 'warning'); return; }

    const { error } = await App.db().from('stok_awal').upsert(
      { sku, product_name: nama || sku, qty, notes, parent_sku: parentSku || null, updated_at: new Date().toISOString() },
      { onConflict: 'sku' }
    );

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        App.toast('Tabel stok_awal belum dibuat. Jalankan SQL migrasi v3 di Supabase.', 'warning');
      } else {
        App.toast('Gagal simpan: ' + error.message, 'error');
      }
      return;
    }

    App.closeModal();
    App.toast(`Stok awal SKU ${sku} diset ke ${qty} unit.`, 'success');
    this._renderRekap();
  },

  async deleteProduk(sku) {
    if (!App.isOwner()) { App.toast('Hanya Owner yang bisa menghapus data.', 'warning'); return; }
    const ok = await App.confirm(`Hapus data produk "${sku}" dari Stok? Tindakan ini tidak bisa dibatalkan.`);
    if (!ok) return;
    const { data, error } = await App.db().from('stok_awal').delete().eq('sku', sku).select();
    if (error) { App.toast('Gagal hapus: ' + error.message, 'error'); return; }
    if (!data || !data.length) {
      App.toast(`Tidak ada data Stok Awal untuk SKU ${sku} (produk ini hanya tercatat dari HPP/Pesanan).`, 'warning');
      return;
    }
    App.toast(`Produk ${sku} dihapus dari Stok Awal.`, 'success');
    this._renderRekap();
  },

  async toggleHidden(sku, hide) {
    if (!App.isOwner()) { App.toast('Hanya Owner yang bisa menyembunyikan produk.', 'warning'); return; }
    const meta = (this._skuMeta && this._skuMeta[sku]) || { name: sku, awal: 0, parentSku: '' };
    const { error } = await App.db().from('stok_awal').upsert(
      { sku, product_name: meta.name || sku, qty: meta.awal || 0, parent_sku: meta.parentSku || null, hidden: hide, updated_at: new Date().toISOString() },
      { onConflict: 'sku' }
    );
    if (error) { App.toast('Gagal ubah visibilitas: ' + error.message, 'error'); return; }
    App.toast(hide ? `Produk ${sku} disembunyikan.` : `Produk ${sku} ditampilkan.`, 'success');
    this._renderRekap();
  },

  /* ── TAMBAH PRODUK BARU ── */
  openTambahProduk() {
    App.openModal({
      title: 'Tambah Produk Baru',
      body: `
        <p class="text-sm text-gray-500 mb-4">Input stok awal untuk produk yang belum tercatat di sistem.</p>
        <div class="space-y-3">
          <div>
            <label class="label">SKU *</label>
            <input id="tp-sku" class="input" placeholder="Kode SKU produk"/>
          </div>
          <div>
            <label class="label">Nama Produk</label>
            <input id="tp-nama" class="input" placeholder="Nama produk (opsional)"/>
          </div>
          <div>
            <label class="label">Parent SKU</label>
            <input id="tp-parent" class="input" placeholder="Opsional — untuk varian dengan stok fisik sama"/>
          </div>
          <div>
            <label class="label">Stok Awal *</label>
            <input id="tp-qty" type="number" min="0" class="input" value="0" placeholder="0"/>
          </div>
          <div>
            <label class="label">Catatan</label>
            <input id="tp-notes" class="input" placeholder="Opsional"/>
          </div>
        </div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Stok.saveTambahProduk()" class="btn-primary">Simpan</button>`,
    });
  },

  async saveTambahProduk() {
    const sku       = document.getElementById('tp-sku').value.trim().toUpperCase();
    const nama       = document.getElementById('tp-nama').value.trim();
    const parentSku  = document.getElementById('tp-parent').value.trim().toUpperCase();
    const qty        = parseInt(document.getElementById('tp-qty').value);
    const notes      = document.getElementById('tp-notes').value.trim();

    if (!sku) { App.toast('SKU wajib diisi.', 'warning'); return; }
    if (isNaN(qty) || qty < 0) { App.toast('Stok awal tidak valid.', 'warning'); return; }

    const { error } = await App.db().from('stok_awal').upsert(
      { sku, product_name: nama || sku, qty, notes, parent_sku: parentSku || null, updated_at: new Date().toISOString() },
      { onConflict: 'sku' }
    );

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        App.toast('Tabel stok_awal belum dibuat. Jalankan SQL migrasi v3 di Supabase.', 'warning');
      } else {
        App.toast('Gagal simpan: ' + error.message, 'error');
      }
      return;
    }

    App.closeModal();
    App.toast(`Produk ${sku} ditambahkan dengan stok awal ${qty} unit.`, 'success');
    this._renderRekap();
  },

  /* ── PENYESUAIAN MANUAL ── */
  openAdjust() {
    App.openModal({
      title: 'Penyesuaian Stok Manual',
      body: `
        <p class="text-sm text-gray-500 mb-4">Nilai positif = tambah stok, negatif = kurangi stok.</p>
        <div class="space-y-3">
          <div><label class="label">SKU *</label><input id="adj-sku" class="input" placeholder="Kode SKU produk"/></div>
          <div><label class="label">Jumlah (+ tambah / − kurangi) *</label><input id="adj-qty" type="number" class="input" placeholder="Contoh: 10 atau -3"/></div>
          <div><label class="label">Keterangan</label><input id="adj-notes" class="input" placeholder="Opsional"/></div>
        </div>`,
      footer: `
        <button onclick="App.closeModal()" class="btn-secondary">Batal</button>
        <button onclick="Stok.saveAdjust()" class="btn-primary">Simpan</button>`,
    });
  },

  async saveAdjust() {
    const sku   = document.getElementById('adj-sku').value.trim();
    const qty   = +document.getElementById('adj-qty').value;
    const notes = document.getElementById('adj-notes').value.trim();
    if (!sku || !qty) { App.toast('SKU dan jumlah wajib diisi.', 'warning'); return; }

    const { error } = await App.db().from('stok_adjust').insert({ sku, qty, notes });
    if (error) {
      App.toast('Gagal simpan penyesuaian: ' + error.message + '\n\nJika tabel belum ada, jalankan SQL: CREATE TABLE stok_adjust (id uuid primary key default gen_random_uuid(), sku text, qty integer, notes text, created_at timestamptz default now());', 'warning');
      return;
    }
    App.closeModal();
    App.toast('Penyesuaian stok disimpan.', 'success');
    this.onLoad();
  },
};
