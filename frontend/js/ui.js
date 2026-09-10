/* ═══════════════════════════════════════════════════════════
   V.I.E.W — UI layer: renderers, modals, toasts, HUD scenes
═══════════════════════════════════════════════════════════ */

const $  = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ── toasts ────────────────────────────────────────────── */
function toast(msg, type = 'ok', sub = '') {
  const icons = { ok: '✓', warn: '⚠', err: '✕' };
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="t-ico ${type}">${icons[type]}</div>
    <div><div class="t-msg">${msg}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}</div>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3800);
}

/* ── modals ────────────────────────────────────────────── */
function openModal(id) {
  $('#modal-backdrop').classList.add('show');
  document.getElementById(id).classList.add('show');
}
function closeModals() {
  $('#modal-backdrop').classList.remove('show');
  $$('.modal').forEach(m => m.classList.remove('show'));
  Hud.stopPreview();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModals();
  if (e.target.id === 'modal-backdrop') closeModals();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

/* ── helpers ───────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(ts)) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return ts;                                  // already locale string
  return d.toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function levelClass(lv) { return ['HIGH','MEDIUM','LOW','VERIFIED','INFO'].includes(lv) ? lv : 'INFO'; }

function countUp(el, target, dur = 900) {
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ── renderers ─────────────────────────────────────────── */
const UI = {
  store: null,
  selectedCam: 'cam-01',
  selectedAlert: null,

  renderAll(store) {
    this.store = store;
    this.renderSensors();
    this.renderAlerts();
    this.renderMinis();
    this.renderStats();
    this.renderThreat(store.stats.activeThreatLevel);
    this.renderSystem();
  },

  renderSensors() {
    const list = $('#sensor-list');
    const cams = this.store.cameras || [];
    list.innerHTML = cams.map(c => `
      <div class="sensor-item ${c.id === this.selectedCam ? 'sel' : ''}" data-id="${c.id}">
        <span class="sd-dot ${c.status}"></span>
        <div class="sd-info">
          <div class="sd-name">${esc(c.name)}</div>
          <div class="sd-meta">${esc(c.feedType)} · ${esc(c.location.split('(')[1]?.replace(')', '') || c.location)}</div>
        </div>
        <span class="sd-fps">${c.fps} FPS</span>
      </div>`).join('');
    const online = cams.filter(c => c.status !== 'offline').length;
    $('#sensor-count').textContent = `${online} ONLINE`;
    $('#sensor-count').className = 'sp ' + (online === cams.length ? 'sp-green' : 'sp-gold');

    list.querySelectorAll('.sensor-item').forEach(el => {
      el.addEventListener('click', () => this.selectCamera(el.dataset.id));
      el.addEventListener('dblclick', () => this.openCameraModal(el.dataset.id));
    });
  },

  selectCamera(id) {
    this.selectedCam = id;
    const cam = (this.store.cameras || []).find(c => c.id === id);
    $$('.sensor-item').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
    if (cam) {
      $('#feed-name').innerHTML = `${esc(cam.name)}<small>${esc(cam.resolution)} · ${esc(cam.location)}</small>`;
      Hud.setPrimary(id);
    }
  },

  openCameraModal(id) {
    const cam = (this.store.cameras || []).find(c => c.id === id);
    if (!cam) return;
    $('#mcam-name').textContent  = cam.name;
    $('#mcam-status').innerHTML  = `<span class="sp ${cam.status === 'active' ? 'sp-green' : cam.status === 'warning' ? 'sp-gold' : 'sp-red'}">${cam.status.toUpperCase()}</span>`;
    $('#mcam-type').textContent  = cam.feedType.toUpperCase();
    $('#mcam-fps').textContent   = cam.fps + ' FPS';
    $('#mcam-res').textContent   = cam.resolution;
    $('#mcam-loc').textContent   = cam.location;
    $('#mcam-rtsp').textContent  = cam.rtsp_url;
    $('#mcam-primary').onclick   = () => { this.selectCamera(id); closeModals(); toast('Primary feed reassigned', 'ok', cam.name); };
    openModal('modal-camera');
    Hud.startPreview($('#mcam-canvas'));
  },

  renderAlerts() {
    const alerts = (this.store.alerts || []).slice(0, 20);
    const list = $('#alerts-list');
    list.innerHTML = alerts.length ? alerts.map(a => `
      <div class="alert-item ${a.id === this.selectedAlert ? 'sel' : ''}" data-id="${esc(a.id)}">
        <span class="ai-stripe lv-${levelClass(a.level)}"></span>
        <div class="ai-body">
          <div class="ai-title">${esc(a.message)}</div>
          <div class="ai-meta"><span>${esc(a.cameraName || '')}</span>·<span>${esc(a.zoneName || a.module || '')}</span>·<span>${timeAgo(a.timestamp)}</span>
            ${a.status !== 'open' ? `<span class="ai-ack">[${a.status.toUpperCase()}]</span>` : ''}</div>
        </div>
        <span class="ai-lv lv-${levelClass(a.level)}">${levelClass(a.level)}</span>
      </div>`).join('') : '<div class="empty-note">NO INCIDENTS RECORDED</div>';

    const open = alerts.filter(a => a.status === 'open').length;
    $('#open-count').textContent = open + ' OPEN';
    $('#open-count').style.display = open ? '' : 'none';

    list.querySelectorAll('.alert-item').forEach(el =>
      el.addEventListener('click', () => this.openAlertModal(el.dataset.id)));
  },

  openAlertModal(id) {
    const a = (this.store.alerts || []).find(x => x.id === id);
    if (!a) return;
    this.selectedAlert = id;
    $$('.alert-item').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
    const tag = $('#malert-tag');
    tag.textContent = `ALERT · ${levelClass(a.level)}`;
    tag.className = 'm-tag lv-' + levelClass(a.level);
    $('#malert-title').textContent = (a.message || '').replace(/[🚨⚠️✅]\s*/, '').slice(0, 80);
    $('#malert-id').textContent     = a.id;
    $('#malert-module').textContent = a.module || '—';
    $('#malert-cam').textContent    = a.cameraName || '—';
    $('#malert-time').textContent   = fmtTime(a.timestamp);
    $('#malert-msg').textContent    = a.message || '—';
    $('#malert-zone').textContent   = a.zoneName || '—';
    $('#malert-entity').textContent = a.entityId || 'UNIDENTIFIED';
    $('#malert-notes').value = '';
    openModal('modal-alert');
  },

  prependAlert(a, fresh = true) {
    if (!this.store) return;
    const norm = {
      id: a.id || `alert-${Date.now().toString().slice(-5)}`,
      level: levelClass(a.level || 'HIGH'),
      module: a.module || a.pipeline_module || 'VIRTUAL_FENCE',
      message: a.message || 'Intrusion event',
      cameraName: a.cameraName || a.camera_name || '—',
      zoneName: a.zoneName || a.zone_id || undefined,
      entityId: a.entityId || a.entity_id || undefined,
      status: a.status || 'open',
      timestamp: a.timestamp || a.timestamp_utc || Date.now(),
    };
    this.store.alerts.unshift(norm);
    if (this.store.alerts.length > 20) this.store.alerts.length = 20;
    this.renderAlerts();
    if (fresh) {
      const el = document.querySelector(`.alert-item[data-id="${CSS.escape(norm.id)}"]`);
      if (el) el.classList.add('fresh');
    }
  },

  renderMinis() {
    const cams = (this.store.cameras || []).slice(0, 4);
    $('#minis').innerHTML = cams.map(c => `
      <div class="mini" data-id="${c.id}">
        <canvas class="mini-canvas" data-cam="${c.id}"></canvas>
        <div class="mini-flash"></div>
        <div class="mini-tag"><span class="mdot ${c.status}"></span>${c.id.toUpperCase()} · LIVE</div>
        <div class="mini-name">${esc(c.name.split('—')[0].trim())}</div>
      </div>`).join('');
    $$('.mini').forEach(el => el.addEventListener('click', () => this.selectCamera(el.dataset.id)));
    Hud.bindMinis();
  },

  renderStats(animate = true) {
    const s = this.store.stats || {};
    const map = { 'st-cams': s.camerasOnline, 'st-pers': s.personnelOnDuty, 'st-veh': s.vehiclesScannedToday, 'st-intr': s.intrusionsBlocked };
    Object.entries(map).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) animate ? countUp(el, v ?? 0) : el.textContent = v ?? 0;
    });
  },

  renderThreat(lv = 'ELEVATED') {
    const pill = $('#threat-pill');
    pill.className = 'pill threat-pill t-' + lv.toLowerCase();
    $('#threat-label').textContent = lv;
    $('#threat-val').textContent = lv;
    $$('#threat-bar .tb-seg, #modal-system .tb-seg').forEach(s =>
      s.classList.toggle('on', s.dataset.lv === lv));
  },

  renderRoster() {
    $('#roster-tbody').innerHTML = (this.store.personnel || []).map(p => `
      <tr>
        <td class="td-mono">${esc(p.serviceNumber)}</td>
        <td><strong>${esc(p.name)}</strong><br><span style="font-size:10px;color:var(--muted)">${esc(p.rank)}</span></td>
        <td>${esc(p.unit)}</td>
        <td>${esc(p.station)}</td>
        <td><span class="sp ${p.status === 'off-duty' ? 'sp-dim' : p.status === 'on-patrol' ? 'sp-gold' : 'sp-green'}">${p.status.toUpperCase()}</span></td>
        <td class="td-mono">${esc(p.lastVerified)}</td>
      </tr>`).join('');
  },

  renderVehicles() {
    $('#vehicles-tbody').innerHTML = (this.store.vehicles || []).map(v => `
      <tr>
        <td class="td-mono" style="font-weight:700;color:var(--white)">${esc(v.plateNumber)}</td>
        <td>${esc(v.type)} — ${esc(v.model)}</td>
        <td>${esc(v.unit)}</td>
        <td class="td-mono">${esc(v.lastCheckpoint)}</td>
        <td><span class="sp ${v.status === 'verified' ? 'sp-green' : v.status === 'flagged' ? 'sp-red' : 'sp-gold'}">${v.status.toUpperCase()}</span></td>
      </tr>`).join('');
  },

  renderZones() {
    const zc = { RED: 'R', AMBER: 'A', GREEN: 'G', CORRIDOR: 'C' };
    $('#zones-list').innerHTML = (this.store.zones || []).map(z => `
      <div class="zone-card">
        <div class="zone-swatch ${z.type}">${zc[z.type] || 'Z'}</div>
        <div class="zc-info">
          <div class="zc-name">${esc(z.name)}</div>
          <div class="zc-meta">${z.type} ZONE · DWELL ${z.dwellThreshold}s · ${esc(z.cameraId)}</div>
        </div>
        <span class="sp ${z.type === 'RED' ? 'sp-red' : z.type === 'AMBER' ? 'sp-gold' : 'sp-green'}">${z.type}</span>
      </div>`).join('');
  },

  renderSystem() {
    const s = this.store.stats || {};
    $('#sys-cams').textContent  = (s.camerasOnline ?? '—') + ' / ' + (this.store.cameras || []).length;
    $('#sys-pers').textContent  = s.personnelOnDuty ?? '—';
    $('#sys-veh').textContent   = s.vehiclesScannedToday ?? '—';
    $('#sys-intr').textContent  = s.intrusionsBlocked ?? '—';
  },

  renderHealth(h) {
    const map = { 'ss-pg': 'postgres', 'ss-redis': 'redis', 'ss-mqtt': 'mqtt' };
    Object.entries(map).forEach(([id, k]) => {
      const el = document.getElementById(id);
      if (el) el.className = 'ss-dot ' + (h && h.services?.[k] === 'ok' ? 'ok' : 'err');
    });
    const ai = $('#ss-ai');
    if (ai) ai.className = 'ss-dot ' + (this.socketUp ? 'ok' : 'warn');
  },

  flashMini(camId) {
    const el = document.querySelector(`.mini[data-id="${CSS.escape(camId)}"]`);
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 260);
  },
};

/* ═══════════════════════════════════════════════════════════
   HUD — procedural cinematic feed renderer (canvas 2D)
═══════════════════════════════════════════════════════════ */
const Hud = (() => {
  const scenes = [];
  let primaryId = 'cam-01';
  let preview = null;
  let raf = null;

  const PALETTES = {
    'cam-01': { accent: '#e8b931', zone: 'ZERO-LINE RESTRICTED', targets: 2 },
    'cam-02': { accent: '#f4f3ee', zone: 'ANPR GATE 1 SCAN ZONE', targets: 1 },
    'cam-03': { accent: '#f0a03c', zone: 'RIVERINE BASIN OVERWATCH', targets: 1 },
    'cam-04': { accent: '#e8b931', zone: 'RIDGE BUFFER CORRIDOR', targets: 2 },
  };

  class Scene {
    constructor(canvas, camId, mini = false) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.camId = camId; this.mini = mini;
      this.t = Math.random() * 100; this.sweep = Math.random() * 6;
      this.resize(); this.running = true;
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      const d = Math.min(2, window.devicePixelRatio || 1);
      this.w = r.width; this.h = r.height;
      this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    draw() {
      const { ctx, w, h } = this;
      const p = PALETTES[this.camId] || PALETTES['cam-01'];
      this.t += 0.016; this.sweep += 0.012;

      // base
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0b0d0f'); g.addColorStop(0.6, '#070809'); g.addColorStop(1, '#050606');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // terrain contours
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const base = h * (0.35 + i * 0.13);
        for (let x = 0; x <= w; x += 8) {
          const y = base + Math.sin(x * 0.012 + this.t * (0.3 + i * 0.1) + i * 2) * (6 + i * 3);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (!this.mini) {
        // radar sweep
        const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.42;
        const grad = ctx.createConicGradient ? null : null;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.sweep);
        const sg = ctx.createLinearGradient(0, 0, R, 0);
        sg.addColorStop(0, 'rgba(232,185,49,0)'); sg.addColorStop(1, 'rgba(232,185,49,0.10)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -0.5, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        // rings
        ctx.strokeStyle = 'rgba(232,185,49,0.12)';
        [0.33, 0.66, 1].forEach(f => { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, 7); ctx.stroke(); });
        ctx.strokeStyle = 'rgba(232,185,49,0.07)';
        ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      }

      // zone polygon (lower band)
      ctx.strokeStyle = p.accent; ctx.globalAlpha = 0.55; ctx.setLineDash([7, 6]); ctx.lineWidth = 1.2;
      ctx.beginPath();
      const zy = h * 0.72, pts = [[0.04, zy + 24], [0.36, zy], [0.72, zy - 12], [0.97, zy + 8], [0.97, h * 0.97], [0.04, h * 0.97]];
      pts.forEach(([px, py], i) => i ? ctx.lineTo(w * px, py) : ctx.moveTo(w * px, py));
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = p.accent; ctx.globalAlpha = 0.05; ctx.fill();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (!this.mini) {
        ctx.fillStyle = p.accent; ctx.font = `700 ${Math.max(8, w * 0.012)}px "JetBrains Mono"`;
        ctx.fillText('◈ ' + p.zone, w * 0.05, zy + 16);
      }

      // targets
      const n = this.mini ? 1 : p.targets;
      for (let i = 0; i < n; i++) {
        const seed = i * 37 + this.camId.length * 11;
        const bx = w * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 0.21 + seed)));
        const by = h * (0.42 + 0.2 * (0.5 + 0.5 * Math.cos(this.t * 0.17 + seed * 2)));
        const bw = this.mini ? 26 : 46, bh = this.mini ? 40 : 78, c = 8;
        ctx.strokeStyle = i === 0 ? '#e5484d' : p.accent; ctx.lineWidth = 1.4;
        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
        // corners
        ctx.lineWidth = 2;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.moveTo(bx + sx * bw / 2, by + sy * bh / 2 - sy * c);
          ctx.lineTo(bx + sx * bw / 2, by + sy * bh / 2);
          ctx.lineTo(bx + sx * bw / 2 - sx * c, by + sy * bh / 2);
          ctx.stroke();
        });
        if (!this.mini) {
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          const lbl = `TGT_0${i + 9}${i} · ${i === 0 ? 'UNIDENTIFIED' : 'PATROL'} [${(93 + Math.sin(this.t + i) * 2).toFixed(1)}%]`;
          ctx.font = '700 9px "JetBrains Mono"';
          const tw = ctx.measureText(lbl).width;
          ctx.fillRect(bx - bw / 2 - 2, by - bh / 2 - 16, tw + 8, 13);
          ctx.fillStyle = i === 0 ? '#e5484d' : p.accent;
          ctx.fillText(lbl, bx - bw / 2 + 2, by - bh / 2 - 6);
        }
      }

      // noise flicker
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.012})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function tick() {
    scenes.forEach(s => { if (s.running && s.cv.isConnected) s.draw(); else s.running = false; });
    for (let i = scenes.length - 1; i >= 0; i--) if (!scenes[i].running) scenes.splice(i, 1);
    if (preview && preview.cv.isConnected) preview.draw(); else preview = null;
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => scenes.forEach(s => s.resize()));

  return {
    start() {
      const cv = $('#hud-canvas');
      scenes.push(new Scene(cv, primaryId));
      if (!raf) tick();
    },
    bindMinis() {
      $$('.mini-canvas').forEach(cv => scenes.push(new Scene(cv, cv.dataset.cam, true)));
    },
    setPrimary(camId) {
      primaryId = camId;
      const s = scenes.find(x => !x.mini);
      if (s) s.camId = camId;
    },
    startPreview(canvas) {
      preview = new Scene(canvas, primaryId, false);
    },
    stopPreview() { preview = null; },
    bumpFrame(n) {
      const el = $('#feed-frame');
      if (el && n) el.textContent = 'FRM ' + String(n).padStart(7, '0');
    },
  };
})();