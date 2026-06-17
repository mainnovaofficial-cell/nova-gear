/* ═══════════════════════════════════════════════════════
   Nova Gear — Stok Module (v2)
   Stok awal manual + masuk dari HPP + keluar dari pesanan
   + history perubahan + penyesuaian manual
═══════════════════════════════════════════════════════ */
'use strict';

const Stok = {
  _tab: 'rekap',
  _rowData: {},

  async onLoad() {
    const el = document.getElementById('page-stok');
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
    </div>
    <div id="stok-content"><div class="skeleton h-40 w-full rounded-xl mt-4"></div></div>`;
    await this._render();
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
  },

  /* ── TAB: REKAP STOK ── */
  async _renderRekap() {
    const el = document.getElementById('stok-content');
    el.innerHTML = `<div class="skeleton h-40 w-full rounded-xl mt-4"></div>`;

    try {
      const db = App.db();
      const [
        { data: hppData  },
        { data: orders   },
        { data: adjusts  },
        { data: stokAwal },
      ] = await Promise.all([
        db.from('hpp_items').select('sku,product_name,qty'),
        db.from('orders').select('sku,product_name,qty,stok_action,status'),
        db.from('stok_adjust').select('sku,qty').then(r => r, () => ({ data: [] })),
        db.from('stok_awal').select('sku,product_name,qty').then(r => r, () => ({ data: [] })),
      ]);

      // SKU map: { sku → { name, awal, masuk, keluar, adjust } }
      const map = {};
      const ensure = (sku, name = '') => {
        if (!map[sku]) map[sku] = { sku, name: name || sku, awal: 0, masuk: 0, keluar: 0, adjust: 0 };
        if (name && !map[sku].name || map[sku].name === sku) map[sku].name = name;
      };

      (stokAwal || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku, r.product_name);
        map[sku].awal = +r.qty || 0;
      });

      (hppData || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku, r.product_name);
        map[sku].masuk += +r.qty || 0;
      });

      const DEDUCT = new Set(['keluar', 'sudah_keluar_tidak_balik', 'menunggu_barang_kembali']);
      (orders || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku, r.product_name);
        // Backward compat: old Selesai orders without stok_action
        const action = r.stok_action || (r.status === 'Selesai' ? 'keluar' : null);
        if (DEDUCT.has(action)) map[sku].keluar += +r.qty || 0;
      });

      (adjusts || []).forEach(r => {
        const sku = r.sku || 'TANPA-SKU';
        ensure(sku);
        map[sku].adjust += +r.qty || 0;
      });

      const rows = Object.values(map).sort((a, b) => a.sku.localeCompare(b.sku));
      this._rowData = {};
      rows.forEach(r => { this._rowData[r.sku] = r; });

      if (!rows.length) {
        el.innerHTML = `<div class="empty-state card py-16 mt-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-gray-300 mx-auto mb-3">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          <p>Belum ada data stok. Tambah HPP atau pesanan terlebih dahulu.</p>
        </div>`;
        return;
      }

      el.innerHTML = `
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
          <tbody>${rows.map(r => {
            const sisa = r.awal + r.masuk - r.keluar + r.adjust;
            const [sc, sl] = sisa <= 0 ? ['badge-red','Habis'] : sisa <= 5 ? ['badge-yellow','Hampir Habis'] : ['badge-green','Tersedia'];
            return `<tr>
              <td class="font-mono text-xs font-semibold text-gray-600">${r.sku}</td>
              <td class="font-medium">${r.name}</td>
              <td class="text-right text-gray-500 font-semibold">${App.formatNumber(r.awal)}</td>
              <td class="text-right text-green-700 font-semibold">${App.formatNumber(r.masuk)}</td>
              <td class="text-right text-red-600 font-semibold">${App.formatNumber(r.keluar)}</td>
              <td class="text-right ${r.adjust >= 0 ? 'text-blue-600' : 'text-orange-600'} font-semibold">${r.adjust > 0 ? '+' : ''}${App.formatNumber(r.adjust)}</td>
              <td class="text-right font-bold text-lg text-money">${App.formatNumber(sisa)}</td>
              <td><span class="badge ${sc}">${sl}</span></td>
              <td>
                <button onclick="Stok.editStokAwal('${r.sku.replace(/'/g, "\\'")}')"
                        class="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap">
                  Edit Stok Awal
                </button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p class="text-xs text-gray-400 mt-2 px-1">
        Sisa = Stok Awal + Masuk (HPP) − Keluar (Pesanan Selesai/Terkirim) + Penyesuaian
      </p>`;

    } catch (err) {
      el.innerHTML = `<div class="card mt-4 p-4 text-red-600 text-sm">Error memuat data stok: ${err.message}</div>`;
    }
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

  /* ── EDIT STOK AWAL ── */
  editStokAwal(sku) {
    const row = this._rowData[sku] || { name: sku, awal: 0 };
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
            <label class="label">Stok Awal *</label>
            <input id="sa-qty" type="number" min="0" class="input" value="${row.awal}" placeholder="0"/>
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
    // Set nama after DOM render to avoid HTML injection
    setTimeout(() => {
      const el = document.getElementById('sa-nama');
      if (el) el.value = row.name !== sku ? row.name : '';
    }, 0);
  },

  async saveStokAwal(sku) {
    const qty   = parseInt(document.getElementById('sa-qty').value);
    const nama  = document.getElementById('sa-nama').value.trim();
    const notes = document.getElementById('sa-notes').value.trim();

    if (isNaN(qty) || qty < 0) { App.toast('Jumlah stok awal tidak valid.', 'warning'); return; }

    const { error } = await App.db().from('stok_awal').upsert(
      { sku, product_name: nama || sku, qty, notes, updated_at: new Date().toISOString() },
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
    const sku   = document.getElementById('tp-sku').value.trim().toUpperCase();
    const nama  = document.getElementById('tp-nama').value.trim();
    const qty   = parseInt(document.getElementById('tp-qty').value);
    const notes = document.getElementById('tp-notes').value.trim();

    if (!sku) { App.toast('SKU wajib diisi.', 'warning'); return; }
    if (isNaN(qty) || qty < 0) { App.toast('Stok awal tidak valid.', 'warning'); return; }

    const { error } = await App.db().from('stok_awal').upsert(
      { sku, product_name: nama || sku, qty, notes, updated_at: new Date().toISOString() },
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
