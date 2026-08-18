/* ═══════════════════════════════════════════════════════
   Nova Gear — Dashboard Module
═══════════════════════════════════════════════════════ */
'use strict';

const Dashboard = {
  _charts: {},
  _bulanNames: ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],

  async onLoad() {
    const now = new Date();
    const el  = document.getElementById('page-dashboard');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Ringkasan performa toko — per bulan</p>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
          <select id="db-bulan" class="input !py-1 text-xs">
            ${this._bulanNames.map((m, i) => i === 0 ? '' : `<option value="${i}" ${i === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <input id="db-tahun" type="number" class="input !py-1 text-xs w-24" value="${now.getFullYear()}" min="2020" max="2035"/>
          <button onclick="Dashboard._render()" class="btn-primary text-xs">Tampilkan</button>
          <button onclick="Dashboard._render()" class="btn-secondary text-xs">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>
      </div>
      <div id="db-content">${this._skeleton()}</div>`;
    await this._render();
  },

  async _render() {
    const bulan = parseInt(document.getElementById('db-bulan')?.value) || (new Date().getMonth() + 1);
    const tahun = parseInt(document.getElementById('db-tahun')?.value) || new Date().getFullYear();
    const el    = document.getElementById('db-content');
    el.innerHTML = this._skeleton();

    try {
      const db = App.db();
      const [
        { data: orders,    error: e1 },
        { data: hppData,   error: e2 },
        { data: adsData,   error: e3 },
        { data: opData,    error: e4 },
        { data: scanToday, error: e5 },
        { data: releases,  error: e6 },
        { data: adsImport, error: e7 },
        { data: kasPribadi, error: e8 },
        { data: hutangBayar, error: e9 },
        { data: penarikanSaldo, error: e10 },
        { data: uangMuka, error: e11 },
        { data: penyesuaianShopee, error: e12 },
      ] = await Promise.all([
        db.from('orders').select('id,order_no,status,created_at,order_date,qty,sku,source,selling_price,metode_bayar'),
        db.from('hpp_items').select('sku,cost_per_unit,total_cost,created_at').order('created_at', { ascending: false }),
        db.from('ads').select('cost,ad_date,sumber_bayar,sudah_potong_income,cc_dibayar'),
        db.from('operational').select('cost,op_date'),
        db.from('scan_logs').select('id,expedition,is_cancelled,scan_date').eq('scan_date', App.todayISO()),
        db.from('income_releases').select('order_no,gross_amount,discount,voucher_seller,net_amount,release_date,created_at'),
        db.from('ads_expenses').select('biaya,month,year,sumber_bayar,sudah_potong_income,cc_dibayar'),
        db.from('kas_pribadi').select('tipe,jumlah'),
        db.from('hutang_pembayaran').select('sumber_kas_bisnis'),
        db.from('penarikan_saldo').select('jumlah'),
        db.from('uang_muka_pembelian').select('jumlah,terpakai'),
        db.from('penyesuaian_shopee').select('jenis,jumlah'),
      ]);
      if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11 || e12) throw new Error((e1||e2||e3||e4||e5||e6||e7||e8||e9||e10||e11||e12).message);

      // order_import_log (MIGRASI v21) — query terpisah dari Promise.all di atas dan TIDAK
      // ikut throw kalau error, supaya Dashboard tetap jalan kalau migrasinya belum dijalankan
      // (KPI "Dikirim Hari Ini" otomatis fallback ke created_at, lihat di bawah). Semua
      // jenis_import diambil sekaligus (bukan cuma 'harian') supaya bisa dipakai juga oleh
      // panel "Status Import" di bawah.
      const { data: importLogAllData } = await db.from('order_import_log')
        .select('order_no, tanggal_import, jenis_import');
      const importLogAll = importLogAllData || [];
      const importLog = importLogAll.filter(l => l.jenis_import === 'harian');

      // Fallback untuk panel "Status Import": kalau jenis_import 'retur' belum pernah tercatat
      // di order_import_log (mis. sebelum fitur pencatatan retur ini ada), pakai created_at
      // terbaru dari tabel returns. Best-effort — tabel ini opsional/legacy di sebagian setup.
      const { data: lastReturnRow } = await db.from('returns')
        .select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();

      const settings  = await App.getSettings();
      const modalAwalBca    = parseFloat(settings.modal_awal_bca || 0);
      const modalAwalShopee = parseFloat(settings.modal_awal_shopee || 0);

      // Rentang tanggal bulan yang dipilih (sama seperti Laba Rugi)
      const dateFrom  = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
      const nextMonth = new Date(tahun, bulan, 1); // bulan 1-based → index ini = bulan berikutnya
      const dateTo    = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const inRange   = (d) => !!d && d >= dateFrom && d < dateTo;

      const today     = App.todayISO();
      const all       = orders || [];
      const sum       = (arr, key) => arr.reduce((s, r) => s + (+r[key] || 0), 0);
      // KPI status pesanan (Dikirim Hari Ini, Total Diproses, Berhasil, dst.) satuannya
      // pesanan, bukan baris — satu order_no bisa punya beberapa baris SKU (mis. bundling
      // "Any 2 at Rp250.000"). Hitung order_no unik, bukan .length array baris. Baris tanpa
      // order_no (pesanan Manual/Offline lama) dianggap pesanan sendiri via fallback ke id.
      const countPesanan = arr => new Set(arr.map(o => o.order_no || o.id)).size;

      const hppMap = {};
      (hppData || []).forEach(r => {
        const k = r.sku;
        if (!k || k in hppMap) return; // sudah diurutkan terbaru dulu → pertama ditemukan = terbaru
        hppMap[k] = +r.cost_per_unit || 0;
      });
      const freebieDefault = App.getFreebieDefaultPrice(settings);
      const hppFor = (o) => {
        const qty = +o.qty || 1;
        return App.isFreebieSku(o.sku) ? qty * freebieDefault : qty * App.resolveHppUnit(hppMap, o.sku);
      };
      // HPP = qty pesanan (Selesai/Diproses) yang order_no-nya match income_releases pada rentang
      // yang diberikan × HPP terbaru per SKU — persis logic "orderLines" di Laba Rugi, supaya
      // Total Pengeluaran & Laba Bersih di kedua halaman selalu sinkron.
      const hppFromReleases = (relSubset) => {
        const nos = new Set(relSubset.map(r => r.order_no).filter(Boolean));
        return all
          .filter(o => nos.has(o.order_no) && (o.status === 'Selesai' || o.status === 'Diproses'))
          .reduce((s, o) => s + hppFor(o), 0);
      };

      const allReleases = releases || [];

      // Pesanan Manual/Offline (source = 'offline') tidak pernah muncul di income_releases
      // karena bukan transaksi Shopee — tidak ada potongan platform, jadi Net Diterima-nya
      // = Harga Jual penuh (selling_price × qty). Ditambahkan terpisah ke Omzet & Net Diterima.
      const isManualLunas = (o) => o.source === 'offline' && (o.status === 'Selesai' || o.status === 'Diproses');
      const manualAll       = all.filter(isManualLunas);
      const manualAmount    = (o) => (+o.selling_price || 0) * (+o.qty || 1);
      // Pesanan offline "Tunai" (default, termasuk baris lama tanpa metode_bayar) tetap
      // dikecualikan total dari Saldo BCA/Shopee — uangnya tidak pernah lewat rekening/Shopee.
      // "Transfer BCA"/"Transfer Shopee" berarti uangnya benar-benar masuk ke sana, jadi
      // ikut ditambahkan (all-time, sama seperti komponen saldo lain). Lihat js/penjualan.js.
      //
      // Metode Pembayaran berlaku 1 PESANAN, bukan per baris/item (satu order_no bisa
      // punya beberapa baris, mis. per SKU + baris Ongkir terpisah) — supaya omzet
      // pesanan (dijumlahkan dari seluruh barisnya) tidak salah hitung kalau ada baris
      // yang metode_bayar-nya kebetulan belum sinkron, kelompokkan dulu per order_no
      // (baris tanpa order_no dianggap pesanan sendiri) dan pakai metode_bayar baris
      // PERTAMA dalam grup itu sebagai metode pesanan tsb. Lihat js/penjualan.js (saveManual).
      const manualGroups = {};
      manualAll.forEach(o => {
        const key = o.order_no || `__row_${o.sku || ''}_${o.created_at || ''}`;
        (manualGroups[key] || (manualGroups[key] = [])).push(o);
      });
      let manualTransferBcaAllTime = 0;
      let manualTransferShopeeAllTime = 0;
      Object.values(manualGroups).forEach(items => {
        const metode = items[0].metode_bayar || 'Tunai';
        if (metode !== 'Transfer BCA' && metode !== 'Transfer Shopee') return;
        const total = items.reduce((s, o) => s + manualAmount(o), 0);
        if (metode === 'Transfer BCA') manualTransferBcaAllTime += total;
        else manualTransferShopeeAllTime += total;
      });

      // ── Saldo Shopee & Saldo BCA: akumulasi SEMUA WAKTU, tidak ikut filter bulan ──
      // Basis kas riil (bukan accrual/matching seperti Laba Rugi): HPP yang dihitung adalah
      // TOTAL SEMUA PEMBELIAN STOK (SUM total_cost hpp_items), bukan cuma yang sudah terjual —
      // karena uang belanja stok sudah keluar dari kas sejak tanggal beli, terlepas laku atau belum.
      // Semua pengeluaran (HPP, Operasional, Prive, Bayar Hutang) diasumsikan selalu
      // dibayar dari Saldo BCA — Owner selalu tarik dana dari Shopee ke BCA dulu baru bayar-bayar.
      // Iklan (ads & ads_expenses) HANYA dikurangkan dari Saldo BCA/Shopee kalau field
      // sumber_bayar-nya "Saldo BCA"/"Saldo Shopee" (dipilih di form Tambah Iklan / Import CSV
      // Iklan) — default "Kartu Kredit" TETAP tidak dikurangkan sama sekali dari kas manapun,
      // karena kartu kredit dilunasi terpisah lewat tagihan (dicatat manual sebagai Operasional
      // oleh Owner saat dibayar — baru masuk ke totalOpAllTime di bawah). Lihat js/iklan.js.
      //
      // Uang Muka Pembelian (DP ke supplier, dibayar sebelum barang+HPP-nya diinput):
      // uang keluar dari Saldo BCA SAAT DIBAYAR, terlepas nanti dipakai atau belum.
      // Begitu Uang Muka di-link ke suatu hpp_batches (terpakai=true), total_cost batch
      // itu di hpp_items TETAP dihitung penuh (utuh, tidak dikurangi) — supaya HPP/COGS
      // per unit tidak berubah. Supaya tidak dobel potong Saldo BCA, HANYA Uang Muka yang
      // BELUM terpakai yang dikurangkan di sini; begitu di-link, potongannya otomatis
      // "pindah" jadi bagian dari totalPembelianHPPAllTime (yang sudah termasuk porsi DP-nya).
      const totalPembelianHPPAllTime = sum(hppData || [], 'total_cost');
      const totalOpAllTime  = sum(opData  || [], 'cost');
      const totalUangMukaBelumTerpakai = (uangMuka || []).filter(u => !u.terpakai).reduce((s, u) => s + (+u.jumlah || 0), 0);
      // HANYA dari income_releases (transaksi Shopee) — pesanan Manual/Offline dibayar
      // cash/transfer langsung ke BCA atau kantong pribadi, uangnya tidak pernah masuk
      // ke Saldo Shopee. Net Diterima manual tetap dihitung di KPI "Net Diterima" bulanan
      // (untuk Laba Rugi/accrual) via manualGrossMonth di bawah — hanya dikecualikan di sini.
      const netRevAllTime   = sum(allReleases, 'net_amount');
      const totalPriveAllTime   = (kasPribadi || []).filter(r => r.tipe === 'prive').reduce((s, r) => s + (+r.jumlah || 0), 0);
      const totalSetoranAllTime = (kasPribadi || []).filter(r => r.tipe === 'setoran').reduce((s, r) => s + (+r.jumlah || 0), 0);
      // Hanya porsi yang sumbernya Kas Bisnis yang mengurangi Saldo BCA — porsi yang dibayar
      // dari Setoran Pribadi tidak dikurangi lagi karena uangnya memang tidak pernah keluar
      // dari Kas Bisnis (dibayar langsung dari kantong pribadi Owner).
      const totalBayarHutangKasBisnisAllTime = sum(hutangBayar || [], 'sumber_kas_bisnis');
      const totalPenarikanAllTime = sum(penarikanSaldo || [], 'jumlah');
      // Penyesuaian Shopee: transaksi "Penyesuaian" dari laporan Saldo Shopee yang bukan
      // penghasilan pesanan (tidak ada di Import Income) — mis. kompensasi barang hilang
      // (masuk) atau potongan biaya premi Gagal Kirim (keluar). Lihat js/penyesuaianshopee.js.
      const totalPenyesuaianMasukAllTime  = (penyesuaianShopee || []).filter(p => p.jenis === 'masuk').reduce((s, p) => s + (+p.jumlah || 0), 0);
      const totalPenyesuaianKeluarAllTime = (penyesuaianShopee || []).filter(p => p.jenis === 'keluar').reduce((s, p) => s + (+p.jumlah || 0), 0);
      // Iklan yang sumber_bayar-nya "Saldo BCA"/"Saldo Shopee" — lihat catatan di atas.
      const totalAdsBcaAllTime = sum((adsData || []).filter(a => a.sumber_bayar === 'Saldo BCA'), 'cost')
        + sum((adsImport || []).filter(a => a.sumber_bayar === 'Saldo BCA'), 'biaya');
      // Iklan bersumber "Kartu Kredit" TIDAK langsung mengurangi Saldo BCA — uangnya baru
      // keluar saat tagihan CC dibayar (biasanya bulan berikutnya), dicatat via cc_dibayar
      // (checkbox "Tandai Sudah Dibayar" di js/iklan.js). Begitu dicentang, tagihan itu
      // dianggap sudah ditarik dari Saldo BCA hari itu, terlepas kapan biayanya sendiri
      // dicatat/tayang — sama seperti totalBayarHutangKasBisnisAllTime di atas (basis kas
      // riil, bukan accrual). Laba Rugi TIDAK terpengaruh (labarugi.js totalAds tidak
      // difilter cc_dibayar) — flag ini HANYA mempengaruhi kas Saldo BCA di sini.
      const totalAdsCcDibayarAllTime = sum((adsData || []).filter(a => a.sumber_bayar === 'Kartu Kredit' && a.cc_dibayar), 'cost')
        + sum((adsImport || []).filter(a => a.sumber_bayar === 'Kartu Kredit' && a.cc_dibayar), 'biaya');
      // Kecualikan baris yang sudah_potong_income = true — biaya iklan (mis. Isi Ulang Saldo
      // Iklan Otomatis) yang nilainya SUDAH otomatis terpotong dari net_amount per pesanan di
      // Income/Penghasilan, sehingga sudah ikut mengurangi netRevAllTime di atas. Kalau ikut
      // dikurangkan lagi di sini, Saldo Shopee dobel potong. Biaya tetap dicatat penuh di Laba
      // Rugi (labarugi.js totalAds tidak difilter sudah_potong_income) — flag ini HANYA
      // mempengaruhi kas Saldo Shopee di sini. Lihat js/iklan.js (checkbox "Sudah otomatis
      // terpotong lewat Income Shopee").
      const totalAdsShopeeAllTime = sum((adsData || []).filter(a => a.sumber_bayar === 'Saldo Shopee' && !a.sudah_potong_income), 'cost')
        + sum((adsImport || []).filter(a => a.sumber_bayar === 'Saldo Shopee' && !a.sudah_potong_income), 'biaya');

      const saldoShopee = modalAwalShopee + netRevAllTime - totalPenarikanAllTime
        + totalPenyesuaianMasukAllTime - totalPenyesuaianKeluarAllTime
        - totalAdsShopeeAllTime
        + manualTransferShopeeAllTime;
      const saldoBCA = modalAwalBca + totalPenarikanAllTime
        - totalPembelianHPPAllTime - totalOpAllTime
        - totalUangMukaBelumTerpakai
        - totalPriveAllTime + totalSetoranAllTime
        - totalBayarHutangKasBisnisAllTime
        - totalAdsBcaAllTime
        - totalAdsCcDibayarAllTime
        + manualTransferBcaAllTime;
      const sisaKas = saldoShopee + saldoBCA;

      // ── Sisanya: mengikuti filter bulan yang dipilih ──
      // "Berhasil" = Selesai ATAU Dibayar (Dibayar diset oleh Import Income untuk pesanan Selesai yang dananya sudah dirilis)
      const monthOrders = all.filter(o => inRange((o.created_at || '').slice(0, 10)));
      const selesai   = monthOrders.filter(o => o.status === 'Selesai' || o.status === 'Dibayar');
      const batal     = monthOrders.filter(o => o.status === 'Batal');
      const gagal     = monthOrders.filter(o => o.status === 'Gagal Kirim');
      const retur     = monthOrders.filter(o => o.status === 'Dikembalikan');
      const diproses  = monthOrders.filter(o => o.status === 'Diproses');

      // "Dikirim Hari Ini" ikut sumber Rekap Harian (order_import_log, MIGRASI v21) supaya
      // konsisten: order_no yang muncul di file Import Harian hari ini dihitung hari ini,
      // bukan berdasarkan created_at. order_no yang tidak pernah tercatat di log (mis. pesanan
      // Manual/Offline) fallback ke created_at seperti sebelumnya.
      const loggedOrderNos = new Set(importLog.map(l => l.order_no));
      const loggedToday    = new Set(importLog.filter(l => l.tanggal_import === today).map(l => l.order_no));
      const diprosesHariIni = diproses.filter(o => o.order_no && loggedOrderNos.has(o.order_no)
        ? loggedToday.has(o.order_no)
        : (o.created_at || '').slice(0, 10) === today);

      // Omzet: LANGSUNG dari tabel orders, berbasis order_date (kapan pesanan dibuat) —
      // BUKAN release_date/income_releases (kapan dana Shopee cair). release_date bisa
      // beda bulan dari order_date, sehingga pesanan bulan lalu yang baru cair bulan ini
      // dulu ikut kehitung sebagai omzet bulan ini. Semua status KECUALI 'Batal' dihitung
      // (Diproses/Gagal Kirim/Dikembalikan/Selesai/Dibayar tetap masuk — cuma Batal yang
      // dibuang, sesuai definisi "omzet kotor").
      const omzetOrders = all.filter(o => inRange((o.order_date || '').slice(0, 10)) && o.status !== 'Batal');
      const omzetLineAmount = (o) => (+o.selling_price || 0) * (+o.qty || 1);
      const omzet = omzetOrders.reduce((s, o) => s + omzetLineAmount(o), 0);

      // Net Diterima & Potongan Shopee: ikut berbasis order_date juga, supaya konsisten
      // dengan Omzet. Untuk pesanan Shopee (source ≠ 'offline'), net riil per pesanan
      // hanya diketahui dari income_releases (net_amount) — dicocokkan via order_no
      // (BUKAN difilter release_date), sehingga tetap dilekatkan ke bulan order_date-nya.
      // Pesanan yang dana-nya belum cair (belum ada baris income_releases utk order_no
      // itu) belum ikut Net Diterima — otomatis nambah begitu Import Income berikutnya
      // jalan dan halaman ini di-refresh. Pesanan Manual/Offline: Net = Gross penuh
      // (tidak ada potongan platform, lihat isManualLunas di atas).
      const shopeeOrderNos = new Set(
        omzetOrders.filter(o => o.source !== 'offline' && o.order_no).map(o => o.order_no)
      );
      const matchedReleases  = allReleases.filter(r => shopeeOrderNos.has(r.order_no));
      const manualMonth      = omzetOrders.filter(o => o.source === 'offline');
      const manualGrossMonth = manualMonth.reduce((s, o) => s + omzetLineAmount(o), 0);
      const netRev    = sum(matchedReleases, 'net_amount') + manualGrossMonth;
      const potShopee = omzet - netRev;

      // HPP = qty pesanan (Selesai/Diproses) yang order_no-nya match matchedReleases ×
      // HPP terbaru per SKU — matchedReleases di atas sudah berbasis order_date, jadi
      // HPP & Laba Bersih otomatis ikut konsisten.
      const totalHPP = hppFromReleases(matchedReleases);

      const adsMonth       = (adsData   || []).filter(a => inRange(a.ad_date));
      const opMonth        = (opData    || []).filter(o => inRange(o.op_date));
      const adsImportMonth = (adsImport || []).filter(a => +a.month === bulan && +a.year === tahun);
      const totalAds  = sum(adsMonth, 'cost') + sum(adsImportMonth, 'biaya');
      const totalOp   = sum(opMonth, 'cost');
      const totalExp  = totalHPP + totalAds + totalOp;
      const labaB     = netRev - totalExp;

      const scans     = (scanToday || []).filter(s => !s.is_cancelled);
      const returnRate = countPesanan(selesai) > 0 ? (countPesanan(retur) / countPesanan(selesai) * 100).toFixed(1) : '0.0';

      // Tren omzet harian untuk bulan yang dipilih — berbasis order_date, sama seperti
      // kartu Omzet/Net Diterima di atas. Omzet: langsung dari tiap baris omzetOrders.
      // Net: pesanan Manual = gross (langsung di loop yang sama); pesanan Shopee = net_amount
      // dari matchedReleases, ditambahkan SEKALI per order_no (bukan per baris SKU) supaya
      // tidak dobel-hitung kalau satu order_no punya beberapa baris.
      const dailyMap = {};
      omzetOrders.forEach(o => {
        const d = (o.order_date || '').slice(0, 10);
        if (!d) return;
        if (!dailyMap[d]) dailyMap[d] = { omzet: 0, net: 0 };
        const amt = omzetLineAmount(o);
        dailyMap[d].omzet += amt;
        if (o.source === 'offline') dailyMap[d].net += amt;
      });
      const orderDateByNo = {};
      omzetOrders.forEach(o => {
        if (o.source === 'offline' || !o.order_no) return;
        if (!(o.order_no in orderDateByNo)) orderDateByNo[o.order_no] = (o.order_date || '').slice(0, 10);
      });
      matchedReleases.forEach(r => {
        const d = orderDateByNo[r.order_no];
        if (!d) return;
        if (!dailyMap[d]) dailyMap[d] = { omzet: 0, net: 0 };
        dailyMap[d].net += +r.net_amount || 0;
      });
      const daysInMonth = new Date(tahun, bulan, 0).getDate();
      const lastDay     = (tahun === new Date().getFullYear() && bulan === new Date().getMonth() + 1)
        ? new Date().getDate() : daysInMonth;
      const days = Array.from({ length: lastDay }, (_, i) => `${tahun}-${String(bulan).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
      const chartLabel = `${this._bulanNames[bulan]} ${tahun}`;

    // Expedition breakdown today
    const expMap = {};
    scans.forEach(s => {
      const e = s.expedition || 'Lainnya';
      expMap[e] = (expMap[e] || 0) + 1;
    });

    // Admin hanya boleh lihat status pesanan & scanner — data finansial (omzet, laba,
    // pengeluaran) dan grafik tren disembunyikan, termasuk dari Owner-only Row 1/3/Rincian.
    const isAdmin = App.isAdmin();

    // ── Panel "Status Import" — kapan terakhir kali tiap jenis import dijalankan, supaya
    // Owner langsung sadar kalau ada jenis import yang lupa/belum dijalankan (mis. Mingguan
    // terlewat berminggu-minggu bikin status pesanan di Dashboard jadi tidak akurat tanpa
    // disadari). Sumber utama: order_import_log (semua jenis_import, all-time, tidak ikut
    // filter bulan/tahun di atas). Kalau suatu jenis belum pernah tercatat di sana (mis.
    // sebelum fitur pencatatannya ada), fallback ke created_at terbaru tabel terkait —
    // income_releases untuk Income, returns untuk Retur. Harian & Mingguan tidak punya
    // fallback tabel lain yang relevan: kalau tidak ada di log, memang belum pernah dijalankan.
    const lastImportByType = {};
    importLogAll.forEach(l => {
      if (!l.tanggal_import || !l.jenis_import) return;
      if (!lastImportByType[l.jenis_import] || l.tanggal_import > lastImportByType[l.jenis_import]) {
        lastImportByType[l.jenis_import] = l.tanggal_import;
      }
    });
    if (!lastImportByType.retur && lastReturnRow?.created_at) {
      lastImportByType.retur = String(lastReturnRow.created_at).slice(0, 10);
    }
    if (!lastImportByType.income && allReleases.length) {
      const lastIncomeCreated = allReleases.reduce((max, r) => (r.created_at && r.created_at > max) ? r.created_at : max, '');
      if (lastIncomeCreated) lastImportByType.income = lastIncomeCreated.slice(0, 10);
    }
    const msPerDay  = 24 * 60 * 60 * 1000;
    const todayDate = new Date(`${today}T00:00:00`);
    const importStatus = [
      { key: 'harian',   label: 'Import Harian' },
      { key: 'mingguan', label: 'Import Mingguan' },
      { key: 'retur',    label: 'Import Retur' },
      { key: 'income',   label: 'Import Income' },
    ].map(t => {
      const lastDate = lastImportByType[t.key] || null;
      const days = lastDate ? Math.max(0, Math.round((todayDate - new Date(`${lastDate}T00:00:00`)) / msPerDay)) : null;
      const color = days === null ? 'red' : days < 7 ? 'green' : days <= 14 ? 'yellow' : 'red';
      return { ...t, lastDate, days, color };
    });
    const mingguanStatus  = importStatus.find(s => s.key === 'mingguan');
    const mingguanStale   = mingguanStatus.days === null || mingguanStatus.days > 7;

    el.innerHTML = `
      <!-- Status Import -->
      <div class="card mb-4">
        <div class="card-header mb-3">
          <span class="card-title">Status Import</span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          ${importStatus.map(s => this._importStatusCard(s)).join('')}
        </div>
      </div>

      ${isAdmin ? '' : `
      <!-- Row 1: Financial -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        ${this._bigCard('Omzet', App.formatRupiah(omzet), 'Total penjualan kotor', 'bg-emerald-50','text-emerald-600','M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 6v1m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z')}
        ${this._bigCard('Net Diterima', App.formatRupiah(netRev), `Pot. Shopee ${App.formatRupiah(potShopee)}`, 'bg-blue-50','text-blue-600','M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z')}
        ${this._bigCard('Total Pengeluaran', App.formatRupiah(totalExp), 'HPP + Iklan + Operasional', 'bg-amber-50','text-amber-600','M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z')}
        ${this._bigCard('Laba Bersih', App.formatRupiah(labaB), 'Net − HPP − Iklan − Ops', labaB>=0?'bg-green-50':'bg-red-50', labaB>=0?'text-green-600':'text-red-600','M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z')}
      </div>

      <!-- Row 1b: Saldo & Penarikan -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        ${this._bigCard('Saldo Shopee', App.formatRupiah(saldoShopee), 'Modal Awal + Net Diterima Shopee - Penarikan + Penyesuaian - Iklan + Manual/Offline metode Transfer Shopee (all-time, Tunai dikecualikan)', 'bg-orange-50','text-orange-600','M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z')}
        ${this._bigCard('Saldo BCA', App.formatRupiah(saldoBCA), 'Modal Awal + Penarikan - HPP/Ops/Prive/Hutang/UangMuka - Iklan (Saldo BCA + Kartu Kredit yang sudah dibayar) + Manual/Offline metode Transfer BCA (all-time, Iklan Kartu Kredit belum dibayar/Saldo Shopee & Manual Tunai dikecualikan)', 'bg-indigo-50','text-indigo-600','M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z')}
        ${this._bigCard('Sisa Kas', App.formatRupiah(sisaKas), 'Saldo Shopee + Saldo BCA (total gabungan)', sisaKas>=0?'bg-sky-50':'bg-red-50', sisaKas>=0?'text-sky-600':'text-red-600','M9 8h6m-5 4h4m1 8H8a2 2 0 01-2-2V6a2 2 0 012-2h4.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V18a2 2 0 01-2 2z')}
      </div>`}

      ${mingguanStale ? `
      <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
        ⚠️ Status pesanan mungkin belum akurat — Import Mingguan ${mingguanStatus.days === null ? 'belum pernah dijalankan' : `terakhir ${mingguanStatus.days} hari lalu`}.
      </div>` : ''}

      <!-- Row 2: Order Status -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        ${this._miniCard('Dikirim Hari Ini', countPesanan(diprosesHariIni), 'bg-blue-50 border-blue-100', 'text-blue-700')}
        ${this._miniCard('Total Diproses', countPesanan(diproses), 'bg-indigo-50 border-indigo-100', 'text-indigo-700')}
        ${this._miniCard('Berhasil', countPesanan(selesai), 'bg-green-50 border-green-100', 'text-green-700')}
        ${this._miniCard('Dibatalkan', countPesanan(batal), 'bg-gray-50 border-gray-200', 'text-gray-600')}
        ${this._miniCard('Gagal Kirim', countPesanan(gagal), 'bg-red-50 border-red-100', 'text-red-700')}
        ${this._miniCard('Retur/Rusak', countPesanan(retur), 'bg-orange-50 border-orange-100', 'text-orange-700')}
        ${this._miniCard('Return Rate', returnRate + '%', 'bg-purple-50 border-purple-100', 'text-purple-700')}
      </div>

      ${isAdmin ? '' : `
      <!-- Row 3: Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div class="card lg:col-span-2">
          <div class="card-header mb-3">
            <span class="card-title">Tren Omzet — ${chartLabel}</span>
          </div>
          <div style="height:200px;position:relative"><canvas id="chart-revenue"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header mb-3">
            <span class="card-title">Distribusi Status</span>
          </div>
          <div style="height:190px;position:relative"><canvas id="chart-status"></canvas></div>
        </div>
      </div>`}

      <!-- Row 4: Scanner + Expense breakdown -->
      <div class="grid grid-cols-1 ${isAdmin ? '' : 'lg:grid-cols-2'} gap-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Scanner Hari Ini</span>
            <span class="badge badge-blue">${scans.length} paket</span>
          </div>
          ${Object.keys(expMap).length === 0
            ? `<div class="empty-state py-8"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg><p>Belum ada scan hari ini</p></div>`
            : `<div class="mt-1 space-y-1">${Object.entries(expMap).sort((a,b)=>b[1]-a[1]).map(([e,c])=>`
                <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span class="text-sm text-gray-700">${e}</span>
                  <span class="badge badge-blue">${c} paket</span>
                </div>`).join('')}</div>`}
        </div>
        ${isAdmin ? '' : `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Rincian Pengeluaran</span>
          </div>
          <div class="space-y-4 mt-1">
            ${this._expBar('HPP (Modal)', totalHPP, totalExp, 'bg-blue-500')}
            ${this._expBar('Iklan & Marketing', totalAds, totalExp, 'bg-purple-500')}
            ${this._expBar('Operasional', totalOp, totalExp, 'bg-amber-500')}
          </div>
          <div class="border-t border-gray-100 mt-4 pt-3 flex justify-between">
            <span class="text-sm font-semibold text-gray-700">Total</span>
            <span class="font-bold text-money">${App.formatRupiah(totalExp)}</span>
          </div>
        </div>`}
      </div>`;

      if (!isAdmin) {
        this._initChartRevenue(days, dailyMap);
        this._initChartStatus(countPesanan(selesai), countPesanan(batal), countPesanan(gagal), countPesanan(retur));
      }
    } catch (err) {
      console.error(err);
      App.toast('Gagal memuat dashboard: ' + err.message, 'error');
      el.innerHTML = `<div class="card text-red-600 text-sm p-6">Gagal memuat dashboard: ${err.message}</div>`;
    }
  },

  _importStatusCard(s) {
    const badgeClass = { green: 'badge-green', yellow: 'badge-yellow', red: 'badge-red' }[s.color];
    const text = s.days === null ? 'Belum pernah' : s.days === 0 ? 'Hari ini' : `${s.days} hari lalu`;
    const sub  = s.lastDate ? App.formatDate(s.lastDate) : '-';
    return `<div class="stat-card border border-gray-100">
      <p class="stat-label">${s.label}</p>
      <div class="flex items-center gap-2 mt-1">
        <span class="badge ${badgeClass}">${text}</span>
      </div>
      <p class="stat-sub mt-1">${sub}</p>
    </div>`;
  },

  _bigCard(title, value, sub, bg, tc, path) {
    return `<div class="stat-card">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="stat-label">${title}</p>
          <p class="stat-value text-money truncate">${value}</p>
          <p class="stat-sub truncate" title="${sub}">${sub}</p>
        </div>
        <div class="w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg class="w-5 h-5 ${tc}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/>
          </svg>
        </div>
      </div>
    </div>`;
  },

  _miniCard(label, value, bg, tc) {
    return `<div class="stat-card border ${bg}">
      <p class="stat-label">${label}</p>
      <p class="text-xl font-bold ${tc} text-money">${value}</p>
    </div>`;
  },

  _expBar(label, value, total, color) {
    const pct = total > 0 ? Math.min(100, Math.round(value / total * 100)) : 0;
    return `<div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="text-gray-600">${label}</span>
        <span class="font-semibold text-gray-800 text-money">${App.formatRupiah(value)}</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-1.5">
        <div class="${color} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
      </div>
    </div>`;
  },

  _skeleton() {
    return `<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      ${Array(4).fill('<div class="stat-card"><div class="skeleton h-3 w-20 mb-3 rounded"></div><div class="skeleton h-7 w-32 mb-2 rounded"></div><div class="skeleton h-3 w-24 rounded"></div></div>').join('')}
    </div>
    <div class="skeleton h-40 w-full rounded-xl mb-5"></div>`;
  },

  _initChartRevenue(days, dailyMap) {
    const ctx = document.getElementById('chart-revenue');
    if (!ctx || typeof Chart === 'undefined') return;
    if (this._charts.revenue) this._charts.revenue.destroy();
    this._charts.revenue = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [
          { label: 'Omzet',        data: days.map(d => dailyMap[d]?.omzet || 0), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.07)', fill: true, tension: 0.4, pointRadius: 2 },
          { label: 'Net Diterima', data: days.map(d => dailyMap[d]?.net   || 0), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.05)',  fill: true, tension: 0.4, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: c => App.formatRupiah(c.raw) } },
        },
        scales: {
          y: { ticks: { callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? (v/1e3).toFixed(0)+'rb' : v, font: { size: 10 } }, grid: { color: '#f3f4f6' } },
          x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
        },
      },
    });
  },

  _initChartStatus(selesai, batal, gagal, retur) {
    const ctx = document.getElementById('chart-status');
    if (!ctx || typeof Chart === 'undefined') return;
    if (this._charts.status) this._charts.status.destroy();
    this._charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Berhasil', 'Dibatalkan', 'Gagal', 'Retur'],
        datasets: [{ data: [selesai, batal, gagal, retur], backgroundColor: ['#22c55e','#9ca3af','#ef4444','#f97316'], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 6 } } },
        cutout: '62%',
      },
    });
  },
};
