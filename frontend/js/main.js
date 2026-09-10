/* ═══════════════════════════════════════════════════════════
   V.I.E.W — App controller & boot sequence
═══════════════════════════════════════════════════════════ */

let frameCounter = 1042;
let bootDone = false;

/* ── offline fallback so the console never renders empty ─ */
const FALLBACK = {
  stats: { camerasOnline: 4, personnelOnDuty: 5, vehiclesScannedToday: 42, intrusionsBlocked: 3, activeThreatLevel: 'ELEVATED' },
  cameras: [
    { id: 'cam-01', name: 'Sector 4 — North Border Fence', location: 'Grid Ref 32.74N 74.88E', rtsp_url: 'rtsp://—', status: 'active', fps: 30, resolution: '1920x1080 Thermal', feedType: 'thermal' },
    { id: 'cam-02', name: 'Checkpost Alpha — Main Access Gate', location: 'Grid Ref 32.72N 74.85E', rtsp_url: 'rtsp://—', status: 'active', fps: 30, resolution: '2560x1440 ANPR', feedType: 'optical' },
    { id: 'cam-03', name: 'Tower Bravo — Riverine Basin', location: 'Grid Ref 32.76N 74.91E', rtsp_url: 'rtsp://—', status: 'warning', fps: 25, resolution: '1920x1080 IR', feedType: 'ir' },
    { id: 'cam-04', name: 'Patrol Corridor Charlie', location: 'Grid Ref 32.70N 74.82E', rtsp_url: 'rtsp://—', status: 'active', fps: 30, resolution: '1920x1080 NV', feedType: 'optical' },
  ],
  zones: [
    { id: 'z1', cameraId: 'cam-01', name: 'Zero-Line Restricted Zone', type: 'RED', dwellThreshold: 0 },
    { id: 'z2', cameraId: 'cam-04', name: 'Ridge Patrol Buffer', type: 'AMBER', dwellThreshold: 15 },
    { id: 'z3', cameraId: 'cam-02', name: 'Safe Holding Area', type: 'GREEN', dwellThreshold: 60 },
    { id: 'z4', cameraId: 'cam-02', name: 'Inbound Supply Channel', type: 'CORRIDOR', dwellThreshold: 10 },
  ],
  personnel: [
    { id: 'p1', serviceNumber: 'BSF-2021-4401', name: 'SM Rajesh Kumar', rank: 'Officer', unit: '14th Rajputana', station: 'Post Alpha', status: 'on-duty', lastVerified: '2 mins ago' },
    { id: 'p2', serviceNumber: 'BSF-2022-8112', name: 'HAV Amit Sharma', rank: 'NCO', unit: '8th Mountain Div', station: 'Gate 1', status: 'on-duty', lastVerified: '4 mins ago' },
    { id: 'p3', serviceNumber: 'BSF-2023-1094', name: 'NK Gurpreet Singh', rank: 'OR', unit: '14th Sikh LI', station: 'Tower Bravo', status: 'on-patrol', lastVerified: '1 min ago' },
    { id: 'p4', serviceNumber: 'BSF-2023-5520', name: 'L/NK Vikram Rathore', rank: 'OR', unit: 'Sector 4 QRT', station: 'Ridge Delta', status: 'on-patrol', lastVerified: '3 mins ago' },
    { id: 'p5', serviceNumber: 'BSF-2024-9182', name: 'SEP Sunil Soren', rank: 'OR', unit: 'Border Guard Unit', station: 'Post Alpha', status: 'on-duty', lastVerified: 'Just now' },
  ],
  vehicles: [
    { id: 'v1', plateNumber: '22D 109284K', type: 'Patrol', model: 'Mahindra Marksman', unit: 'QRT', status: 'verified', lastCheckpoint: 'Checkpost Alpha 08:32' },
    { id: 'v2', plateNumber: '19B 847219M', type: 'Combat', model: 'BMP-2 Sarath', unit: '4th Armoured', status: 'verified', lastCheckpoint: 'Sector 4 07:15' },
    { id: 'v3', plateNumber: '20C 551928L', type: 'Transport', model: 'Ashok Leyland Stallion', unit: 'Logistics', status: 'verified', lastCheckpoint: 'Gate 1 09:12' },
    { id: 'v4', plateNumber: 'DL 01 AB 4912', type: 'Patrol', model: 'Civilian SUV', unit: 'UNKNOWN', status: 'flagged', lastCheckpoint: 'Checkpost Alpha FLAGGED' },
  ],
  alerts: [
    { id: 'alert-101', level: 'HIGH', module: 'VIRTUAL_FENCE', message: '🚨 INTRUSION: Unknown entity crossed Zero-Line Restricted Zone', cameraName: 'Sector 4 — North Border Fence', zoneName: 'Zero-Line Restricted Zone', entityId: 'UNIDENTIFIED-091', status: 'open', timestamp: Date.now() - 35000 },
    { id: 'alert-102', level: 'MEDIUM', module: 'VEHICLE', message: '⚠️ ANPR MISMATCH: Civilian SUV DL 01 AB 4912 without Base Pass', cameraName: 'Checkpost Alpha — Main Access Gate', entityId: 'DL 01 AB 4912', status: 'open', timestamp: Date.now() - 120000 },
    { id: 'alert-103', level: 'VERIFIED', module: 'HUMAN', message: '✅ TROOP VERIFIED: SM Rajesh Kumar (BSF-2021-4401)', cameraName: 'Sector 4 — North Border Fence', entityId: 'BSF-2021-4401', status: 'resolved', timestamp: Date.now() - 300000 },
  ],
};

/* ── audio alert (WebAudio, no asset needed) ───────────── */
let actx = null;
function alertTone(freq = 880, dur = 0.18, vol = 0.06) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}

/* ── connection state ──────────────────────────────────── */
function setConnState(up) {
  UI.socketUp = up;
  $('#ws-pill').classList.toggle('on', up);
  $('#ws-label').textContent = up ? 'LIVE' : 'LINK';
  $('#rail-ws').className = 'rail-ws ' + (up ? 'on' : 'off');
  $('#conn-banner').classList.toggle('show', !up && bootDone);
  $('#ss-ai')?.classList.toggle('ok', up);
}

/* ── socket handlers ───────────────────────────────────── */
const handlers = {
  onConnect() {
    setConnState(true);
    if (bootDone) toast('Uplink restored', 'ok', 'Socket.IO reconnected');
  },
  onDisconnect() { setConnState(false); },
  onUnavailable() { setConnState(false); },

  onLatency(ms) {
    const el = $('#ss-lat'); if (el) el.textContent = ms + ' ms';
  },

  onInit(store) {
    UI.renderAll(store);
    UI.renderHealth(lastHealth);
  },

  onHuman(p) {
    frameCounter = p.frame_index || frameCounter + 3;
    Hud.bumpFrame(frameCounter);
    $('#ss-frames').textContent = `FRM ${String(frameCounter).padStart(7, '0')} · PIPE A`;
    UI.flashMini(p.camera_id);
    const person = UI.store?.personnel?.find(x => x.serviceNumber === p.entity_id);
    if (person) person.lastVerified = 'Just now';
    if (p.verified) toast(p.message || 'Troop verified', 'ok', `${p.entity_id ?? ''} · ${(p.confidence * 100).toFixed(0)}% conf`);
    else { toast(p.message || 'Unidentified personnel', 'warn', p.camera_name); alertTone(660); }
  },

  onVehicle(p) {
    frameCounter = p.frame_index || frameCounter + 3;
    Hud.bumpFrame(frameCounter);
    $('#ss-frames').textContent = `FRM ${String(frameCounter).padStart(7, '0')} · PIPE B`;
    UI.flashMini(p.camera_id);
    if (p.verified) toast(p.message || 'ANPR verified', 'ok', `${p.entity_id} · ${(p.confidence * 100).toFixed(0)}% OCR`);
    else {
      toast(p.message || 'ANPR mismatch — plate not in registry', 'warn', p.entity_id);
      alertTone(520);
      UI.prependAlert({
        id: `alert-${Date.now().toString().slice(-5)}`, level: 'MEDIUM', module: 'VEHICLE',
        message: `⚠️ ANPR FLAG: ${p.entity_id} (${p.model || 'unknown vehicle'})`,
        cameraName: p.camera_name, entityId: p.entity_id, status: 'open', timestamp: Date.now(),
      });
    }
  },

  onFence(p) {
    frameCounter = p.frame_index || frameCounter + 3;
    Hud.bumpFrame(frameCounter);
    $('#ss-frames').textContent = `FRM ${String(frameCounter).padStart(7, '0')} · PIPE C`;
    UI.flashMini(p.camera_id);
    alertTone(880, 0.25, 0.09); setTimeout(() => alertTone(880, 0.25, 0.09), 280);
    toast('VIRTUAL FENCE BREACH', 'err', `Zone ${p.zone_id || '—'} · ${p.entity_type || 'UNKNOWN'}`);
  },

  onAlert(p) {
    UI.prependAlert(p);
    if (UI.store?.stats) UI.store.stats.intrusionsBlocked = (UI.store.stats.intrusionsBlocked || 0) + (p.module === 'VIRTUAL_FENCE' ? 1 : 0);
    UI.renderStats(false);
    UI.renderSystem();
    if (p.level === 'HIGH') { alertTone(880, 0.3, 0.1); setTimeout(() => alertTone(660, 0.3, 0.1), 300); }
    UI.openAlertModal(p.id);
  },
};

/* ── actions ───────────────────────────────────────────── */
async function acknowledgeSelected() {
  const id = UI.selectedAlert;
  if (!id || !UI.store) return;
  const a = UI.store.alerts.find(x => x.id === id);
  if (!a || a.status !== 'open') { closeModals(); return; }
  try {
    await api.acknowledge(id);
    a.status = 'acknowledged';
    toast('Alert acknowledged', 'ok', id);
  } catch {
    a.status = 'acknowledged';                    // optimistic fallback
    toast('Alert acknowledged (local)', 'warn', 'API unreachable');
  }
  UI.renderAlerts(); UI.renderSystem(); closeModals();
}

async function triggerBreach() {
  const btn = $('#btn-breach');
  btn.disabled = true; btn.textContent = 'Broadcasting…';
  try {
    const { alert } = await api.triggerBreach();
    toast('Incursion simulation broadcast', 'err', alert.id);
  } catch {
    UI.prependAlert({ level: 'HIGH', module: 'VIRTUAL_FENCE', message: '🚨 MANUAL TEST: Boundary Line Crossed — Forward Post Alpha', cameraName: 'Sector 4 — North Border Fence', zoneName: 'Zero-Line Restricted Zone', entityId: 'INTRUDER-99', status: 'open', timestamp: Date.now() });
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Simulate Incursion'; }, 900);
}

/* ── rail navigation ───────────────────────────────────── */
function wireRail() {
  const map = {
    'rail-overview': () => { closeModals(); },
    'rail-sensors':  () => UI.openCameraModal(UI.selectedCam),
    'rail-alerts':   () => { UI.renderAlerts(); toast('Incident feed refreshed', 'ok'); },
    'rail-roster':   () => { UI.renderRoster(); openModal('modal-roster'); },
    'rail-vehicles': () => { UI.renderVehicles(); openModal('modal-vehicles'); },
    'rail-zones':    () => { UI.renderZones(); openModal('modal-zones'); },
    'rail-system':   () => { UI.renderSystem(); openModal('modal-system'); },
  };
  Object.entries(map).forEach(([id, fn]) => {
    document.getElementById(id).addEventListener('click', () => {
      $$('.rail-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      fn();
    });
  });
  $('#op-chip').addEventListener('click', () => { UI.renderSystem(); openModal('modal-system'); });
}

/* ── feed toolbar ──────────────────────────────────────── */
function wireFeedTools() {
  $('#ft-rec').addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('rec-on');
    toast(e.currentTarget.classList.contains('rec-on') ? 'Snapshot capture armed' : 'Snapshot capture disarmed', 'ok');
  });
  $('#ft-max').addEventListener('click', () => {
    const feed = document.querySelector('.feed-panel');
    document.fullscreenElement ? document.exitFullscreen() : feed.requestFullscreen?.();
  });
}

/* ── clocks & tickers ──────────────────────────────────── */
let lastHealth = null;
function startTickers() {
  setInterval(() => {
    const t = new Date().toLocaleTimeString('en-IN', { hour12: false });
    $('#top-clock').innerHTML = `${t}<small>IST</small>`;
    $('#feed-clock').textContent = t;
    $('#feed-fps').textContent = (29.7 + Math.random() * 0.6).toFixed(1) + ' FPS';
  }, 1000);

  setInterval(async () => { lastHealth = await api.health(); UI.renderHealth(lastHealth); }, 15000);

  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    $('#ss-uptime').textContent = `UP ${hh}:${mm}`;
  }, 1000);
}

/* ── BOOT ──────────────────────────────────────────────── */
async function boot() {
  startTickers();
  wireRail();
  wireFeedTools();
  Hud.start();

  $('#btn-breach').addEventListener('click', triggerBreach);
  $('#malert-ack').addEventListener('click', acknowledgeSelected);
  $('#malert-escalate').addEventListener('click', () => {
    toast('Escalated to Sector Command', 'warn', UI.selectedAlert || '');
    closeModals();
  });

  initSocket(handlers);

  const [health, summary] = await Promise.all([api.health(), api.summary().catch(() => null)]);
  lastHealth = health;
  UI.renderHealth(health);

  const store = summary || FALLBACK;
  if (!summary) toast('Backend unreachable — offline fallback active', 'err', 'Start pnpm dev on port 3000');
  UI.renderAll(store);

  setTimeout(() => {
    $('#boot-screen').classList.add('gone');
    bootDone = true;
    if (!UI.socketUp) setConnState(false);
  }, 1750);
}

document.addEventListener('DOMContentLoaded', boot);