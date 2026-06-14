/* ═══════════════════════════════════════════════════════
   Nova Gear — Scanner Packing Module
   Kamera HP + Barcode USB, cek duplikat, beep, log harian
═══════════════════════════════════════════════════════ */
'use strict';

const Scanner = {
  _active:     false,
  _cameraOn:   false,
  _html5QrCode: null,
  _usbBuffer:  '',
  _usbTimer:   null,
  _filterDate: '',
  _logs:       [],

  async onLoad() {
    this._filterDate = App.todayISO();
    const el = document.getElementById('page-scanner');
    el.innerHTML = this._shell();
    await this._loadLogs();
    this._startUsbListener();
    this._active = true;
  },

  _shell() {
    return `
    <div class="page-header">
      <div><h2>Scanner Packing</h2><p>Scan kamera HP atau barcode USB — cek duplikat otomatis</p></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <!-- Scanner Panel -->
      <div class="card lg:col-span-1">
        <div class="card-header mb-3">
          <span class="card-title">Scanner</span>
          <span id="scan-status-badge" class="badge badge-gray">Non-aktif</span>
        </div>

        <!-- Camera area -->
        <div id="qr-reader" class="w-full rounded-lg overflow-hidden bg-gray-900 mb-3" style="min-height:180px;display:flex;align-items:center;justify-content:center;">
          <p class="text-gray-500 text-sm text-center px-4">Tekan <strong>Aktifkan Kamera</strong> untuk mulai scan via kamera</p>
        </div>

        <div class="flex gap-2 mb-3">
          <button id="btn-camera" onclick="Scanner.toggleCamera()" class="btn-primary flex-1 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
            Aktifkan Kamera
          </button>
        </div>

        <!-- Manual input (USB fallback visible input) -->
        <div class="mb-3">
          <label class="label">Scan Manual / USB</label>
          <div class="flex gap-2">
            <input id="usb-input" type="text" class="input flex-1 text-xs font-mono"
              placeholder="Fokus di sini lalu scan..."
              onkeydown="Scanner._onUsbKey(event)"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
            <button onclick="Scanner._submitManualInput()" class="btn-primary text-xs px-3">Scan</button>
          </div>
        </div>

        <!-- Expedition select -->
        <div>
          <label class="label">Ekspedisi</label>
          <select id="scan-expedition" class="input text-xs">
            <option value="">-- Pilih Ekspedisi --</option>
            <option>JNE</option><option>J&T</option><option>SiCepat</option>
            <option>Anteraja</option><option>IDExpress</option><option>SAP</option>
            <option>Ninja Xpress</option><option>Lion Parcel</option><option>Gosend</option><option>Lainnya</option>
          </select>
        </div>

        <!-- Last scan feedback -->
        <div id="last-scan-box" class="hidden mt-3 p-3 rounded-lg text-sm font-medium"></div>
      </div>

      <!-- Stats + Recap -->
      <div class="lg:col-span-2 space-y-4">

        <!-- Today stats -->
        <div class="grid grid-cols-3 gap-3">
          <div class="stat-card border bg-blue-50 border-blue-100">
            <p class="stat-label">Scan Hari Ini</p>
            <p id="scan-count-today" class="text-2xl font-bold text-blue-700 text-money">0</p>
          </div>
          <div class="stat-card border bg-green-50 border-green-100">
            <p class="stat-label">Berhasil</p>
            <p id="scan-count-ok" class="text-2xl font-bold text-green-700 text-money">0</p>
          </div>
          <div class="stat-card border bg-red-50 border-red-100">
            <p class="stat-label">Duplikat</p>
            <p id="scan-count-dup" class="text-2xl font-bold text-red-700 text-money">0</p>
          </div>
        </div>

        <!-- Expedition recap today -->
        <div class="card">
          <div class="card-header mb-2">
            <span class="card-title">Rekap per Ekspedisi — Hari Ini</span>
          </div>
          <div id="exp-recap"></div>
        </div>
      </div>
    </div>

    <!-- Log table -->
    <div class="card">
      <div class="card-header mb-3">
        <span class="card-title">Log Scan</span>
        <div class="flex items-center gap-2">
          <input id="scan-filter-date" type="date" class="input !py-1 text-xs w-36"
            value="${this._filterDate}" onchange="Scanner._onDateFilter(this.value)"/>
          <button onclick="Scanner._exportLog()" class="btn-secondary text-xs !py-1">Export CSV</button>
        </div>
      </div>
      <div id="scan-log-table"></div>
    </div>`;
  },

  /* ── USB Scanner listener ── */
  _startUsbListener() {
    if (this._usbListenerAttached) return;
    this._usbListenerAttached = true;
    document.addEventListener('keydown', this._usbKeyHandler.bind(this));
  },

  _usbKeyHandler(e) {
    if (!this._active) return;
    // Only intercept when NOT inside an input/select/textarea (unless it's our usb-input)
    const tag = document.activeElement?.id;
    if (tag !== 'usb-input') {
      const tagName = document.activeElement?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
    }
    if (tag === 'usb-input') return; // handled by _onUsbKey
    this._onUsbChar(e);
  },

  _onUsbKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = document.getElementById('usb-input').value.trim();
      if (val) {
        this.processBarcode(val);
        document.getElementById('usb-input').value = '';
      }
    }
  },

  _onUsbChar(e) {
    if (e.key === 'Enter') {
      if (this._usbBuffer.length > 2) {
        this.processBarcode(this._usbBuffer);
      }
      this._usbBuffer = '';
      if (this._usbTimer) clearTimeout(this._usbTimer);
      return;
    }
    if (e.key.length !== 1) return;
    this._usbBuffer += e.key;
    if (this._usbTimer) clearTimeout(this._usbTimer);
    this._usbTimer = setTimeout(() => { this._usbBuffer = ''; }, 120);
  },

  _submitManualInput() {
    const val = document.getElementById('usb-input')?.value.trim();
    if (val) {
      this.processBarcode(val);
      document.getElementById('usb-input').value = '';
    }
  },

  /* ── Camera scanner ── */
  async toggleCamera() {
    if (this._cameraOn) {
      await this._stopCamera();
    } else {
      await this._startCamera();
    }
  },

  async _startCamera() {
    if (typeof Html5Qrcode === 'undefined') {
      App.toast('Library kamera tidak tersedia.', 'error');
      return;
    }
    try {
      this._html5QrCode = new Html5Qrcode('qr-reader');
      await this._html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 240, height: 100 }, aspectRatio: 1.78 },
        (decoded) => { this.processBarcode(decoded); },
        () => {}
      );
      this._cameraOn = true;
      const btn = document.getElementById('btn-camera');
      if (btn) { btn.textContent = '⏹ Matikan Kamera'; btn.className = 'btn-danger flex-1 text-xs'; }
      document.getElementById('scan-status-badge').className   = 'badge badge-green';
      document.getElementById('scan-status-badge').textContent = 'Kamera Aktif';
    } catch (err) {
      App.toast('Tidak bisa akses kamera: ' + err.message, 'error');
    }
  },

  async _stopCamera() {
    try {
      if (this._html5QrCode) {
        await this._html5QrCode.stop();
        this._html5QrCode = null;
      }
    } catch {}
    this._cameraOn = false;
    const btn = document.getElementById('btn-camera');
    if (btn) {
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg> Aktifkan Kamera`;
      btn.className = 'btn-primary flex-1 text-xs';
    }
    const badge = document.getElementById('scan-status-badge');
    if (badge) { badge.className = 'badge badge-gray'; badge.textContent = 'Non-aktif'; }
    const qrDiv = document.getElementById('qr-reader');
    if (qrDiv) qrDiv.innerHTML = '<p class="text-gray-500 text-sm text-center px-4">Tekan <strong>Aktifkan Kamera</strong> untuk mulai scan via kamera</p>';
  },

  /* ── Process barcode ── */
  async processBarcode(code) {
    code = code.trim();
    if (!code) return;

    const exp = document.getElementById('scan-expedition')?.value || '';

    // Check duplicate in today's scans
    const existingToday = this._logs.find(l => !l.is_cancelled && l.order_no === code && l.scan_date === App.todayISO());
    if (existingToday) {
      this._beep('error');
      this._showFeedback(`DUPLIKAT: ${code} — sudah discan hari ini!`, 'error');
      this._incrementCounter('scan-count-dup');
      App.toast(`Duplikat! ${code} sudah discan.`, 'error');
      return;
    }

    // Save to scan_logs
    const payload = { order_no: code, expedition: exp, scan_date: App.todayISO() };
    const { data, error } = await App.db().from('scan_logs').insert(payload).select().single();
    if (error) {
      App.toast('Gagal simpan scan: ' + error.message, 'error');
      return;
    }

    this._logs.unshift(data);
    this._beep('success');
    this._showFeedback(`✓ SCAN OK: ${code}${exp ? ' — ' + exp : ''}`, 'success');
    this._incrementCounter('scan-count-today');
    this._incrementCounter('scan-count-ok');
    this._renderLog();
    this._renderExpRecap();
  },

  _showFeedback(msg, type) {
    const box = document.getElementById('last-scan-box');
    if (!box) return;
    box.textContent = msg;
    box.className   = `mt-3 p-3 rounded-lg text-sm font-medium ${type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`;
    box.classList.remove('hidden');
    if (box._timer) clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.add('hidden'), 4000);
  },

  _incrementCounter(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = (+el.textContent || 0) + 1;
  },

  /* ── Audio Feedback (Web Audio API) ── */
  _beep(type) {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.value = 1046; // C6
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.value = 220; // A3
        osc.type = 'square';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
      }
      setTimeout(() => ctx.close(), 600);
    } catch {}
  },

  /* ── Load logs ── */
  async _loadLogs() {
    const { data, error } = await App.db()
      .from('scan_logs')
      .select('*')
      .eq('scan_date', this._filterDate)
      .order('scan_time', { ascending: false });
    if (error) { App.toast('Gagal memuat log scan.', 'error'); return; }
    this._logs = data || [];
    this._updateCounters();
    this._renderLog();
    this._renderExpRecap();
  },

  _updateCounters() {
    const today = this._logs.filter(l => l.scan_date === App.todayISO());
    const ok    = today.filter(l => !l.is_cancelled);
    const el    = document.getElementById('scan-count-today');
    const elOk  = document.getElementById('scan-count-ok');
    const elDup = document.getElementById('scan-count-dup');
    if (el)    el.textContent    = ok.length;
    if (elOk)  elOk.textContent  = ok.length;
    if (elDup) elDup.textContent = 0; // duplicates tracked in-session only
  },

  _renderLog() {
    const el = document.getElementById('scan-log-table');
    if (!el) return;
    const logs = this._logs;
    if (!logs.length) {
      el.innerHTML = `<div class="empty-state py-8"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Tidak ada log untuk tanggal ini</p></div>`;
      return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>#</th><th>No. Pesanan</th><th>Ekspedisi</th><th>Waktu Scan</th><th>Status</th><th></th></tr></thead>
        <tbody>${logs.map((l, i) => `<tr class="${l.is_cancelled ? 'opacity-40' : ''}">
          <td class="text-gray-400">${i + 1}</td>
          <td class="font-mono font-semibold text-gray-800">${l.order_no}</td>
          <td>${l.expedition || '-'}</td>
          <td class="whitespace-nowrap text-xs text-gray-500">${App.formatDateTime(l.scan_time)}</td>
          <td>${l.is_cancelled ? `<span class="badge badge-red">Dibatalkan</span>` : `<span class="badge badge-green">OK</span>`}</td>
          <td>${!l.is_cancelled ? `<button onclick="Scanner.cancelScan('${l.id}')" class="text-gray-300 hover:text-red-400 transition-colors text-xs" title="Batalkan scan">Batal</button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  },

  _renderExpRecap() {
    const el = document.getElementById('exp-recap');
    if (!el) return;
    const active = this._logs.filter(l => !l.is_cancelled && l.scan_date === App.todayISO());
    const map = {};
    active.forEach(l => {
      const e = l.expedition || 'Tanpa Ekspedisi';
      map[e] = (map[e] || 0) + 1;
    });
    const entries = Object.entries(map).sort((a,b) => b[1]-a[1]);
    if (!entries.length) {
      el.innerHTML = `<p class="text-gray-400 text-sm text-center py-4">Belum ada scan hari ini</p>`;
      return;
    }
    el.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${entries.map(([e,c]) => `
      <div class="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg">
        <span class="text-sm text-gray-700 font-medium">${e}</span>
        <span class="badge badge-blue">${c}</span>
      </div>`).join('')}</div>`;
  },

  async cancelScan(id) {
    const ok = await App.confirm('Batalkan scan ini?');
    if (!ok) return;
    const { error } = await App.db().from('scan_logs').update({
      is_cancelled: true,
      cancel_time:  new Date().toISOString(),
    }).eq('id', id);
    if (error) { App.toast('Gagal batalkan: ' + error.message, 'error'); return; }
    const log = this._logs.find(l => l.id === id);
    if (log) { log.is_cancelled = true; log.cancel_time = new Date().toISOString(); }
    App.toast('Scan dibatalkan.', 'success');
    this._renderLog();
    this._renderExpRecap();
  },

  _onDateFilter(val) {
    this._filterDate = val;
    this._loadLogs();
  },

  _exportLog() {
    App.exportCSV(
      this._logs.map(l => ({
        order_no: l.order_no, expedition: l.expedition||'',
        scan_date: l.scan_date, scan_time: l.scan_time,
        is_cancelled: l.is_cancelled ? 'Ya' : 'Tidak',
      })),
      `scan-log-${this._filterDate}.csv`
    );
  },

  // Clean up when navigating away
  onUnload() {
    this._active = false;
    this._stopCamera();
  },
};
