// ═══════════════════════════════════════════════════════
// MI MEJOR VERSIÓN — Core App v5
// Set logging · Check-ins · Streaks · RPE · Rest timer
// ═══════════════════════════════════════════════════════

const STATE = {
  currentTab: 'today',
  planStartDate: localStorage.getItem('planStartDate') || null,
  currentWeek: 1,
  travelMode: localStorage.getItem('travelMode') === 'true',
  pausedWeek: parseInt(localStorage.getItem('pausedWeek') || '1'),
  cyclePhase: localStorage.getItem('cyclePhase') || 'follicular',
  notifTime: localStorage.getItem('notifTime') || '07:30',
  notifsEnabled: localStorage.getItem('notifsEnabled') === 'true',
  weights: JSON.parse(localStorage.getItem('weights') || '{}'),
  completedDays: JSON.parse(localStorage.getItem('completedDays') || '{}'),
  setLogs: JSON.parse(localStorage.getItem('setLogs') || '{}'),       // real per-set logging
  checkins: JSON.parse(localStorage.getItem('checkins') || '[]'),     // monthly check-ins
  openCards: {},
  checks: JSON.parse(localStorage.getItem('checks') || '{}'),          // checklists (calentamiento, postura...)
  sessions: JSON.parse(localStorage.getItem('sessions') || '{}'),      // { fecha: {start,end} }
  dayFactor: JSON.parse(localStorage.getItem('dayFactor') || '{}'),    // ajuste puntual del bot por día
  restAlarm: localStorage.getItem('restAlarm') !== 'off',
  units: JSON.parse(localStorage.getItem('units') || '{}'),            // kg | lb por ejercicio/máquina
};

const RPE_DATA = JSON.parse(localStorage.getItem('rpeHistory') || '{}');

// ── Utils ────────────────────────────────────────────
function save(k, v) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayDow() { return new Date().getDay(); }
function getDayName(d) { return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d]; }
function getDayShort(d) { return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d]; }
function getFaseName(w) { return FASES[getFase(w)].name + (isDeload(w) ? ' · Descarga' : ''); }
function getMonthDay(dateStr) { const d = new Date(dateStr+'T12:00:00'); return `${d.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]}`; }

function computeWeek() {
  if (!STATE.planStartDate) return 1;
  const start = new Date(STATE.planStartDate + 'T00:00:00');
  const diff = Math.floor((new Date() - start) / 604800000);
  let w = Math.max(1, Math.min(TOTAL_WEEKS, diff + 1));
  if (STATE.travelMode) w = STATE.pausedWeek;
  return w;
}

function getCycleAdj() { return CYCLE_ADJUSTMENTS[STATE.cyclePhase] || CYCLE_ADJUSTMENTS.follicular; }
function getWeightKey(exId, week) { return `${exId}_w${week}`; }
function weekOfDate(dateStr) {
  if (!STATE.planStartDate) return STATE.currentWeek || 1;
  const diff = Math.floor((new Date(dateStr + 'T12:00:00') - new Date(STATE.planStartDate + 'T00:00:00')) / 604800000);
  return Math.max(1, Math.min(TOTAL_WEEKS, diff + 1));
}
function roundHalf(x) { return Math.round(x * 2) / 2; }
const LB = 2.20462;
// Todo se guarda en kg (canónico); la unidad es solo de visualización/entrada, por ejercicio
function exUnit(ex, dateStr) {
  if (STATE.units[ex.id]) return STATE.units[ex.id];
  return 'kg';
}
function toKg(v, unit) { return unit === 'lb' ? Math.round(v / LB * 1000) / 1000 : v; }
function fmtNum(x) { return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10); }
// exact=true → muestra lo que realmente levantaste; false → redondea a un salto cómodo de la máquina
function dispW(kg, unit, exact) {
  if (kg == null || kg === '') return '';
  if (unit === 'lb') { const lb = kg * LB; return exact ? Math.round(lb * 2) / 2 : Math.round(lb / 5) * 5; }
  return exact ? Math.round(kg * 10) / 10 : roundHalf(kg);
}
function fmtW(kg, unit, exact) { return fmtNum(dispW(kg, unit, exact)) + ' ' + unit; }
function getSetCount(ex, week) { return isDeload(week) ? Math.max(2, ex.sets - 1) : ex.sets; }

// Sesiones pasadas con series hechas (más reciente primero)
function getPastSessions(ex, dateStr) {
  const out = [];
  Object.entries(STATE.setLogs).forEach(([key, sets]) => {
    const [d, id] = key.split('|');
    if (id !== ex.id || d >= dateStr) return;
    const done = sets.filter(s => s.done && s.reps > 0 && (ex.bw || s.weight > 0));
    if (done.length) out.push({ date: d, sets: done });
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// DOBLE PROGRESIÓN a partir de lo ÚLTIMO que realmente levantaste (no del plan)
function getSuggestion(ex, dateStr, week) {
  const U = exUnit(ex, dateStr), F = (x, exact) => fmtW(x, U, exact);
  const past = getPastSessions(ex, dateStr);
  if (!past.length) return { weight: null, reps: ex.repMin, first: true, reason: '' };
  const base = past.find(p => !isDeload(weekOfDate(p.date))) || past[0];

  if (ex.bw) {
    const minReps = Math.min(...base.sets.map(s => s.reps));
    const step = ex.unit === 'seg' ? 5 : 1;
    const target = Math.max(ex.repMin, minReps + step);
    return { weight: null, reps: isDeload(week) ? ex.repMin : target, first: false,
      reason: `Última vez: ${minReps} ${ex.unit === 'seg' ? 's' : 'reps'}. Intenta ${isDeload(week) ? ex.repMin : target}.` };
  }

  const top = Math.max(...base.sets.map(s => s.weight));
  const atTop = base.sets.filter(s => s.weight === top);
  const minReps = Math.min(...atTop.map(s => s.reps));
  let w = top, reps, reason;

  if (atTop.every(s => s.reps >= ex.repMax) && atTop.length >= Math.max(2, ex.sets - 1)) {
    w = top + ex.inc; reps = ex.repMin;
    reason = `Completaste ${ex.repMax} reps con ${F(top, true)} → subes a ${F(w)}.`;
  } else if (minReps < ex.repMin && past.length >= 2 &&
             Math.max(...past[1].sets.map(s => s.weight)) === top &&
             Math.min(...past[1].sets.filter(s => s.weight === top).map(s => s.reps)) < ex.repMin) {
    w = Math.max(0, top - ex.inc); reps = ex.repMin;
    reason = `Dos sesiones por debajo de ${ex.repMin} reps con ${F(top, true)} → bajas a ${F(w)} para volver a progresar.`;
  } else {
    reps = Math.min(ex.repMax, Math.max(ex.repMin, minReps + 1));
    reason = `Última vez: ${F(top, true)} × ${minReps}. Mismo peso, intenta ${reps} reps.`;
  }

  // Dificultad percibida de esa sesión (RPE)
  const rpe = RPE_DATA[base.date]?.rpe;
  if (rpe && rpe <= 3 && w === top) { w = top + ex.inc; reps = ex.repMin; reason = `Esa sesión te pareció muy fácil → subes a ${F(w)}.`; }
  if (rpe && rpe >= 10) { w = top * 0.925; reason = `Esa sesión fue al límite → bajas ~7% (${F(w)}).`; }

  if (isDeload(week)) { w = top * 0.9; reps = ex.repMin; reason = `Semana de descarga: 90% de ${F(top, true)} y una serie menos. Recupera tus articulaciones.`; }

  const cyc = Math.min(1, getCycleAdj().factor);
  const df = STATE.dayFactor[dateStr] || 1;
  const changed = w !== top || cyc < 1 || df < 1;
  w = changed ? roundHalf(w * cyc * df) : top;
  if (cyc < 1 || df < 1) reason += ' (ajustado por tu ciclo/cansancio de hoy)';
  return { weight: w, reps, first: false, reason, exact: !changed };
}
function setWeight(exId, week, val) { STATE.weights[getWeightKey(exId, week)] = val; save('weights', STATE.weights); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Streak calculation ───────────────────────────────
function getStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dow = d.getDay();
    const isWorkoutDay = !!DAY_WORKOUT_MAP[dow];
    if (isWorkoutDay) {
      if (STATE.completedDays[ds]) streak++;
      else if (DAY_WORKOUT_MAP[dow].optional) { /* el sábado extra no rompe la racha */ }
      else if (ds !== today()) break; // today doesn't break streak yet
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function getTotalVolume(dateStr) {
  // Sum weight × reps for all logged sets on a date
  let vol = 0;
  Object.entries(STATE.setLogs).forEach(([key, sets]) => {
    if (key.startsWith(dateStr)) {
      sets.forEach(s => { if (s.done && s.weight && s.reps) vol += s.weight * s.reps; });
    }
  });
  return vol;
}

// ── Set logging ──────────────────────────────────────
function getSetLogKey(dateStr, exId) { return `${dateStr}|${exId}`; }

function getSets(dateStr, exId, ex, week) {
  const key = getSetLogKey(dateStr, exId);
  if (STATE.setLogs[key]) return STATE.setLogs[key];
  const sug = getSuggestion(ex, dateStr, week);
  const n = getSetCount(ex, week);
  const U = exUnit(ex, dateStr);
  const w0 = sug.weight == null ? null : (U === 'lb' && !sug.exact ? toKg(dispW(sug.weight, 'lb', false), 'lb') : sug.weight);
  const sets = Array.from({ length: n }, () => ex.bw ? { reps: sug.reps, done: false } : { weight: w0, unit: U, reps: sug.reps, done: false });
  STATE.setLogs[key] = sets;
  return sets;
}

function updateSet(dateStr, exId, idx, field, val) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  const arr = STATE.setLogs[key];
  const old = arr[idx][field];
  let v = parseFloat(String(val).replace(',', '.')) || 0;
  if (field === 'weight') v = toKg(v, arr[idx].unit || 'kg');
  arr[idx][field] = v;
  // el peso de la serie 1 se copia a las series siguientes que aún no has hecho
  if (field === 'weight') {
    for (let j = idx + 1; j < arr.length; j++) {
      if (!arr[j].done && (!arr[j].weight || arr[j].weight === old)) { arr[j].weight = v; arr[j].unit = arr[idx].unit || 'kg'; }
    }
  }
  save('setLogs', STATE.setLogs);
  if (field === 'weight') renderToday();
}

function touchSession(dateStr) {
  if (!STATE.sessions[dateStr]) STATE.sessions[dateStr] = { start: Date.now() };
  STATE.sessions[dateStr].last = Date.now();
  save('sessions', STATE.sessions);
}
function toggleSet(dateStr, exId, idx, restSec) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  const s = STATE.setLogs[key][idx];
  s.done = !s.done;
  if (s.done) { s.t = Date.now(); touchSession(dateStr); }
  save('setLogs', STATE.setLogs);
  if (s.done) {
    if (restSec && idx < STATE.setLogs[key].length - 1) startRest(restSec);
    if (navigator.vibrate) navigator.vibrate(30);
  }
  renderToday();
}
function setUnit(dateStr, exId, unit) {
  STATE.units[exId] = unit; save('units', STATE.units);
  const arr = STATE.setLogs[getSetLogKey(dateStr, exId)] || [];
  arr.forEach(st => {
    if (!('weight' in st)) return;
    st.unit = unit;
    if (!st.done && st.weight) st.weight = unit === 'lb' ? toKg(Math.round(st.weight * LB / 5) * 5, 'lb') : roundHalf(st.weight);
  });
  save('setLogs', STATE.setLogs);
  renderToday();
}
function toggleCheck(dateStr, id, inSession) {
  const k = dateStr + '|' + id;
  STATE.checks[k] = !STATE.checks[k];
  if (!STATE.checks[k]) delete STATE.checks[k];
  else if (inSession) touchSession(dateStr);
  save('checks', STATE.checks);
  renderToday();
}

function addSet(dateStr, exId) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  const last = STATE.setLogs[key][STATE.setLogs[key].length - 1];
  const ns = { reps: last?.reps || 10, done: false };
  if (last && 'weight' in last) { ns.weight = last.weight || 0; ns.unit = last.unit || 'kg'; }
  STATE.setLogs[key].push(ns);
  save('setLogs', STATE.setLogs);
  renderToday();
}

// ── Rest timer (por hora de fin + audio que suena aunque salgas de la app) ──
const REST = { endAt: 0, iv: null, audio: null, url: null };
(function restoreRest() { const e = parseInt(localStorage.getItem('restEnd') || '0'); if (e > Date.now()) REST.endAt = e; })();

function makeAlarmWav(totalSec, beepAtSec) {
  // WAV mono 8 kHz 8-bit: silencio y, al final, 3 pitidos fuertes
  const sr = 8000, n = Math.floor((beepAtSec + 2.2) * sr);
  const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  const u = new Uint8Array(buf, 44).fill(128);
  [0, 0.7, 1.4].forEach(off => {
    const s0 = Math.floor((beepAtSec + off) * sr), len = Math.floor(0.4 * sr);
    for (let i = 0; i < len && s0 + i < n; i++) u[s0 + i] = 128 + Math.round(Math.sin(2 * Math.PI * 1000 * i / sr) * 120);
  });
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function stopRestAudio() {
  try { if (REST.audio) { REST.audio.pause(); REST.audio = null; } if (REST.url) { URL.revokeObjectURL(REST.url); REST.url = null; } } catch (e) {}
}
function playRestAudio(remainingSec) {
  stopRestAudio();
  if (!STATE.restAlarm) return;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    REST.url = makeAlarmWav(remainingSec + 2.2, Math.max(0.2, remainingSec));
    REST.audio = new Audio(REST.url);
    REST.audio.volume = 1;
    REST.audio.play().catch(() => {});
  } catch (e) {}
}
function startRest(seconds) {
  REST.endAt = Date.now() + seconds * 1000;
  localStorage.setItem('restEnd', String(REST.endAt));
  document.getElementById('rest-timer').classList.add('show');
  playRestAudio(seconds);
  clearInterval(REST.iv);
  REST.iv = setInterval(restTick, 250);
  restTick();
}
function addRest(sec) {
  if (!REST.endAt) return;
  REST.endAt += sec * 1000;
  localStorage.setItem('restEnd', String(REST.endAt));
  playRestAudio(Math.max(0.5, (REST.endAt - Date.now()) / 1000));
  restTick();
}
function restTick() {
  if (!REST.endAt) return;
  const rem = Math.ceil((REST.endAt - Date.now()) / 1000);
  if (rem <= 0) return finishRest();
  const timeEl = document.getElementById('rest-time');
  timeEl.textContent = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;
  document.getElementById('rest-timer').classList.add('show');
}
function finishRest() {
  clearInterval(REST.iv);
  REST.endAt = 0; localStorage.removeItem('restEnd');
  document.getElementById('rest-timer').classList.remove('show');
  showToast('⏰ ¡Descanso terminado — siguiente serie!');
  if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(r => r.showNotification('⏰ Descanso terminado', { body: 'Siguiente serie 💪', tag: 'rest', vibrate: [300, 120, 300, 120, 300] })).catch(() => {});
  }
  setTimeout(stopRestAudio, 3000);
}
function skipRest() {
  clearInterval(REST.iv);
  REST.endAt = 0; localStorage.removeItem('restEnd');
  stopRestAudio();
  document.getElementById('rest-timer').classList.remove('show');
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && REST.endAt) restTick(); });
if (REST.endAt) { REST.iv = setInterval(restTick, 250); setTimeout(restTick, 0); }

function parseRestSeconds(restStr) {
  const s = String(restStr);
  const n = parseFloat((s.match(/[\d.]+/) || [])[0]);
  if (!n) return 90;
  return /min/i.test(s) ? Math.round(n * 60) : n;
}

// ── Tabs ─────────────────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  STATE.currentTab = name;
  ({today: renderToday, week: renderWeek, progress: renderProgress, profile: renderProfile})[name]();
}

// ── Daily quote ──────────────────────────────────────
function getDailyQuote() {
  const seed = parseInt(today().replace(/-/g,''));
  return MOTIVATIONAL_MESSAGES[seed % MOTIVATIONAL_MESSAGES.length];
}

// ── Check-in logic ───────────────────────────────────
function isCheckinDue() {
  if (!STATE.planStartDate) return false;
  const week = STATE.currentWeek;
  const mine = STATE.checkins.filter(c => c.planV === PLAN_VERSION);
  const last = mine[mine.length - 1];
  const currentDue = [...CHECKIN_WEEKS].reverse().find(w => week >= w);
  if (!currentDue) return false;
  if (!last) return true;
  return last.week < currentDue;
}

// ══════════════════════════════════════════════════════
// SCREEN: HOY
// ══════════════════════════════════════════════════════
function isSkipped(ex) {
  try {
    const list = JSON.parse(localStorage.getItem('skippedExercises') || '{}')[today()] || [];
    const n = ex.name.toLowerCase();
    return list.some(s => { const t = String(s).toLowerCase(); return n.includes(t) || t.includes(n); });
  } catch (e) { return false; }
}
function dose(it, week) { return typeof it.dose === 'function' ? it.dose(week) : it.dose; }

function renderChecklist(items, dateStr, week, inSession) {
  return items.map(it => {
    const on = !!STATE.checks[dateStr + '|' + it.id];
    return `<div class="chk ${on ? 'on' : ''}" onclick="toggleCheck('${dateStr}','${it.id}',${inSession})">
      <div class="chk-box">${on ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:600">${it.name} <span style="font-weight:500;color:var(--coral);font-size:12px">· ${dose(it, week)}</span></div>
        <div style="font-size:11.5px;color:var(--text2);line-height:1.5;margin-top:2px">${it.note}</div>
      </div></div>`;
  }).join('');
}
function countChecks(items, dateStr) { return items.filter(it => STATE.checks[dateStr + '|' + it.id]).length; }

function collapsible(id, title, sub, badge, bodyHtml, defaultOpen) {
  const open = STATE.openCards[id] === undefined ? !!defaultOpen : STATE.openCards[id];
  return `<div class="card" style="padding:0;overflow:hidden">
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer" onclick="STATE.openCards['${id}']=${!open};renderToday()">
      <div style="flex:1"><div style="font-weight:700;font-size:14px">${title}</div><div style="font-size:11.5px;color:var(--text2);margin-top:2px">${sub}</div></div>
      <span class="pill pill-gray">${badge}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);transform:rotate(${open ? 180 : 0}deg);transition:.2s"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    ${open ? `<div style="padding:0 16px 12px">${bodyHtml}</div>` : ''}
  </div>`;
}

function dailyBlockHtml(dateStr, week) {
  const all = [...DAILY_POSTURA, ...DAILY_HIPO];
  const done = countChecks(all, dateStr);
  return collapsible('daily', '🧍‍♀️ Rutina diaria · Postura + Hipopresivos', '≈ 12 min · todos los días (mejor por la mañana)', `${done}/${all.length}`,
    `<div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:4px 0">Postura</div>
     ${renderChecklist(DAILY_POSTURA, dateStr, week, false)}
     <div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:14px 0 4px">Hipopresivos · ${hipoDose(week)}</div>
     ${renderChecklist(DAILY_HIPO, dateStr, week, false)}
     <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:8px">ℹ️ ${HIPO_EXPECT}</div>
     <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:6px">⚠️ ${HIPO_SAFETY}</div>
     <div style="font-size:11px;color:var(--text3);line-height:1.5;margin-top:6px">💡 Pon una alarma cada 1–2 h: nuca, hombros y glúteos contra la pared 20 s. Es el mejor “ejercicio” para la postura.</div>`,
    false);
}

function painRuleHtml() {
  return collapsible('pain', '🩹 Regla de dolor (rodillas y hombros)', 'Cuándo seguir, cambiar o parar', 'Seguridad',
    `<div style="font-size:12.5px;color:var(--text2);line-height:1.6">
      <b style="color:var(--text)">Molestia leve (≤3/10)</b> que mejora al calentar → sigue con rango controlado.<br>
      <b style="color:var(--text)">Dolor punzante o que sube serie a serie</b> → cambia el ejercicio (cada uno trae su alternativa) o salta esa serie.<br>
      <b style="color:var(--text)">Dolor que dura más de 2 semanas</b> o te despierta de noche → consulta a un fisioterapeuta. Esta app no sustituye una valoración.<br>
      El calentamiento y el estiramiento de cada sesión son parte del entrenamiento, no son opcionales.<br><br><b style="color:var(--text)">Postura en “S”:</b> si al verte de espalda la columna se curva hacia los lados (no solo de perfil), pide una valoración de fisioterapia antes de cargar pesado.</div>`, false);
}

function needsEarlyDeload() {
  const week = STATE.currentWeek;
  if (isDeload(week) || week <= 2 || week === TEST_WEEK) return false;
  const lastExtra = parseInt(localStorage.getItem('extraDeloadWeek') || '0');
  if (lastExtra && week - lastExtra < 3) return false;
  const r = Object.entries(RPE_DATA).sort((x, y) => y[0].localeCompare(x[0])).slice(0, 3).map(([, v]) => v.rpe);
  return r.length === 3 && r.filter(n => n >= 9).length >= 2;
}
function activateEarlyDeload() {
  localStorage.setItem('extraDeloadWeek', String(STATE.currentWeek));
  Object.keys(STATE.setLogs).forEach(k => { if (k.startsWith(today() + '|') && !STATE.setLogs[k].some(s => s.done)) delete STATE.setLogs[k]; });
  save('setLogs', STATE.setLogs);
  showToast('Descarga activada para esta semana');
  renderToday();
}

function renderToday() {
  const el = document.getElementById('screen-today');
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  const week = STATE.currentWeek;
  const dateStr = today();
  const streak = getStreak();
  const adj = getCycleAdj();
  const deload = isDeload(week);

  const checkinBanner = isCheckinDue() ? `
    <div class="checkin-banner" onclick="openCheckin()">
      <div class="ci-icon">📸</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:var(--gold)">Check-in pendiente</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Peso, medidas (cintura, glúteo) y fotos — 3 minutos</div>
      </div>
      <div style="color:var(--gold);font-size:18px">→</div>
    </div>` : '';
  const deloadBanner = deload ? `<div style="margin:0 16px 12px;background:rgba(125,184,232,.12);border:1px solid rgba(125,184,232,.4);border-radius:var(--r-md);padding:12px 15px"><div style="font-size:12.5px;font-weight:700;color:#7db8e8">Semana de descarga</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Pesos al 90% y una serie menos. Tus articulaciones y tu sistema nervioso se recuperan; la próxima semana vuelves más fuerte.</div></div>`
    : week === TEST_WEEK ? `<div style="margin:0 16px 12px;background:var(--gold-dim);border:1px solid rgba(232,182,76,.4);border-radius:var(--r-md);padding:12px 15px"><div style="font-size:12.5px;font-weight:700;color:var(--gold)">🏆 Semana de marcas</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Última semana del plan: intenta superar tu mejor serie en cada ejercicio, con buena técnica. Haz el check-in final.</div></div>`
    : needsEarlyDeload() ? `<div style="margin:0 16px 12px;background:rgba(125,184,232,.12);border:1px solid rgba(125,184,232,.4);border-radius:var(--r-md);padding:12px 15px"><div style="font-size:12.5px;font-weight:700;color:#7db8e8">¿Descarga anticipada?</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Tus últimas sesiones fueron muy duras (dificultad 9–10). Si además sientes cansancio o molestias en rodillas u hombros, haz esta semana de descarga.</div><button class="btn btn-secondary btn-sm" style="margin-top:9px" onclick="activateEarlyDeload()">Activar descarga esta semana</button></div>` : '';

  if (!workout) {
    el.innerHTML = `
      <div class="hdr"><h1>${getDayName(dow)}</h1><p>Semana ${week} · ${getFaseName(week)}</p></div>
      ${checkinBanner}${deloadBanner}
      <div class="rest-view" style="padding-bottom:6px">
        <div style="font-size:50px">🌙</div>
        <div>
          <div style="font-family:var(--f-display);font-size:21px;font-weight:600">Día de recuperación activa</div>
          <p style="color:var(--text2);margin-top:8px;font-size:14px;max-width:300px">Hoy no hay pesas. Haz tu rutina diaria de postura + hipopresivos${dow === 3 ? ' y una caminata inclinada de 25–30 min' : ' y una caminata suave'}.</p>
        </div>
      </div>
      ${dailyBlockHtml(dateStr, week)}
      ${dow === 3 ? `<div class="card"><div style="font-weight:700;color:var(--gold);margin-bottom:4px">🏃 Caminata inclinada · 25–30 min</div><div style="font-size:13px;color:var(--text2)">Inclinación ${FASES[getFase(week)].incline}, 5–5.5 km/h. Quema grasa sin estrés para tus rodillas.</div></div>` : ''}
      <div class="quote-card"><div class="quote-text">${getDailyQuote()}</div></div>`;
    return;
  }

  const isDone = STATE.completedDays[dateStr];
  const exs = workout.exercises.filter(e => !isSkipped(e));
  const main = exs.filter(e => !e.isCore), core = exs.filter(e => e.isCore);
  let exDoneCount = 0;
  exs.forEach(ex => {
    const sets = STATE.setLogs[getSetLogKey(dateStr, ex.id)];
    if (sets && sets.length && sets.every(s => s.done)) exDoneCount++;
  });
  const todayVol = getTotalVolume(dateStr);
  const cardio = workout.cardio ? cardioFor(week) : null;
  const cardioOn = !!STATE.checks[dateStr + '|cardio'];
  let idx = 0;

  el.innerHTML = `
    <div class="hero">
      <div class="hero-week">Semana ${week} · ${getFaseName(week)}${workout.optional ? ' · SESIÓN EXTRA' : ''}</div>
      <div class="hero-title">${workout.emoji} ${workout.name}</div>
      <div class="hero-sub">${workout.focus} · ${workout.duration}</div>
    </div>

    <div class="streak-row">
      <div class="streak-chip ${streak >= 3 ? 'fire' : ''}"><strong>${streak >= 3 ? '🔥' : ''}${streak}</strong><small>Racha</small></div>
      <div class="streak-chip"><strong>${exDoneCount}/${exs.length}</strong><small>Ejercicios</small></div>
      <div class="streak-chip"><strong>${todayVol >= 1000 ? (todayVol/1000).toFixed(1)+'t' : todayVol}</strong><small>Volumen kg</small></div>
      <div class="streak-chip"><strong style="color:${adj.color}">${Math.round(adj.factor*100)}%</strong><small>Ciclo</small></div>
    </div>

    ${checkinBanner}${deloadBanner}

    ${adj.factor < 1 ? `
    <div style="margin:0 16px 12px;background:${adj.color}18;border:1px solid ${adj.color}45;border-radius:var(--r-md);padding:12px 15px">
      <div style="font-size:12px;font-weight:700;color:${adj.color}">${adj.label} · pesos al ${Math.round(adj.factor*100)}%</div>
      <div style="font-size:12px;color:var(--text2);margin-top:2px">${adj.tip}</div>
    </div>` : ''}

    ${STATE.travelMode ? `<div style="margin:0 16px 12px;background:var(--gold-dim);border:1px solid rgba(232,182,76,.35);border-radius:var(--r-md);padding:11px 15px;font-size:13px;color:var(--gold)">✈️ Plan pausado · Semana ${STATE.pausedWeek} congelada</div>` : ''}

    <div class="quote-card"><div class="quote-text">${getDailyQuote()}</div></div>

    ${dailyBlockHtml(dateStr, week)}
    ${painRuleHtml()}

    <div class="sect">1 · Calentamiento (≈6 min)</div>
    ${collapsible('warm', 'Prepara rodillas, caderas y hombros', 'Después, en el primer ejercicio, haz 2 series de aproximación (50% y 75% del peso).', `${countChecks(workout.warmup, dateStr)}/${workout.warmup.length}`,
      renderChecklist(workout.warmup, dateStr, week, true), !isDone)}

    <div class="sect">2 · Fuerza — registra cada serie</div>
    <div style="margin:0 20px 10px;font-size:12px;color:var(--text2);line-height:1.5">Meta de esfuerzo: básicos ${rirFor(week)} · aislamiento ${rirFor(week, { iso: true })}. La app te propone la carga según <b>lo último que levantaste</b>.<br>Las <b>superseries</b> (A1 + A2) se hacen alternando: serie de A1, 15 s, serie de A2, descanso, y repites.</div>
    ${main.map(ex => renderExerciseCard(ex, idx++, week, dateStr)).join('')}

    <div class="sect">3 · Core y cintura</div>
    ${core.map(ex => renderExerciseCard(ex, idx++, week, dateStr)).join('')}

    ${cardio ? `
    <div class="sect">4 · Cardio inclinado (sin HIIT)</div>
    <div class="card" style="background:linear-gradient(135deg,var(--gold-dim),var(--card));border-color:rgba(232,182,76,.3);cursor:pointer" onclick="toggleCheck('${dateStr}','cardio',true)">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="chk-box ${cardioOn ? 'on' : ''}" style="${cardioOn ? 'background:var(--coral);border-color:var(--coral)' : ''}">${cardioOn ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
        <div><div style="font-weight:700;color:var(--gold);margin-bottom:4px">🏃 ${cardio.type} · ${cardio.duration} min</div>
        <div style="font-size:13px;color:var(--text2)">${cardio.desc}</div></div>
      </div>
    </div>` : ''}

    <div class="sect">${cardio ? '5' : '4'} · Estiramiento final (≈6 min)</div>
    ${collapsible('cool', 'Suelta lo que trabajaste', 'Mantén cada estiramiento sin rebotar', `${countChecks(workout.cooldown, dateStr)}/${workout.cooldown.length}`,
      renderChecklist(workout.cooldown, dateStr, week, true), !isDone)}

    <div style="padding:10px 16px 6px;display:flex;flex-direction:column;gap:8px">
      <button class="btn ${isDone ? 'btn-secondary' : 'btn-primary'} btn-full" onclick="markDayComplete('${dateStr}')">
        ${isDone ? '✓ Sesión registrada' : '🏁 Terminar y ver resumen'}
      </button>
      ${isDone ? `<button class="btn btn-ghost btn-full" onclick="openSummary('${dateStr}')">📊 Ver resumen de hoy</button>` : ''}
    </div>
  `;
}

function renderExerciseCard(ex, index, week, dateStr) {
  const open = STATE.openCards[ex.id];
  const sets = getSets(dateStr, ex.id, ex, week);
  const allDone = sets.length && sets.every(s => s.done);
  const doneCount = sets.filter(s => s.done).length;
  const sug = getSuggestion(ex, dateStr, week);
  const restSec = parseRestSeconds(ex.rest);
  const nSets = getSetCount(ex, week);
  const unit = ex.unit === 'seg' ? 'seg' : 'reps';
  const WU = exUnit(ex, dateStr);
  const last = getPastSessions(ex, dateStr)[0];
  let ssPill = '', ssNote = '';
  if (ex.ss) {
    const wk = DAY_WORKOUT_MAP[new Date(dateStr + 'T12:00:00').getDay()];
    const partner = wk && wk.exercises.find(o => o.ss && o.ss[0] === ex.ss[0] && o.id !== ex.id);
    ssPill = `<span class="pill pill-coral">Superserie ${ex.ss}</span>`;
    if (partner) ssNote = ex.ss[1] === '1'
      ? `<div style="font-size:12px;color:var(--coral);padding:2px 0 6px">🔁 Tras cada serie, descansa 15 s y haz una serie de <b>${partner.name}</b>.</div>`
      : `<div style="font-size:12px;color:var(--coral);padding:2px 0 6px">🔁 Va alternada con <b>${partner.name}</b>. Después de esta serie, descansa ${ex.rest}.</div>`;
  }
  const lastTop = last ? (ex.bw ? { reps: Math.max(...last.sets.map(s => s.reps)) } : last.sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a)) : null;

  let tag;
  if (sug.first && !ex.bw) {
    tag = `<div class="suggested-tag">🆕 Primera vez: elige un peso con el que llegues a ${ex.repMin}–${ex.repMax} reps dejando ${rirFor(week, ex).split(' (')[0]} (repeticiones en reserva). Lo guardamos y desde la próxima sesión te digo cuánto subir.</div>`;
  } else if (ex.bw) {
    tag = `<div class="suggested-tag">💡 ${sug.first ? `Meta: ${ex.repMin}–${ex.repMax} ${unit === 'seg' ? 's' : 'reps'}` : sug.reason}</div>`;
  } else {
    tag = `<div class="suggested-tag">💡 Hoy: <b>${fmtW(sug.weight, WU, sug.exact)} × ${sug.reps}</b><br><span style="font-size:11.5px;opacity:.85">${sug.reason}</span></div>`;
  }

  return `
  <div class="exc ${ex.isGlute ? 'glute' : ''} ${allDone ? 'done' : ''}">
    <div class="exc-head" onclick="toggleCard('${ex.id}')">
      <div class="exc-num">${allDone ? '✓' : index + 1}</div>
      <div class="exc-info">
        <div class="exc-name">${ex.isGlute ? '🍑 ' : ''}${ex.name}</div>
        <div class="exc-equip">${ex.equipment}</div>
        <div class="exc-meta">
          ${ssPill}
          <span class="pill pill-gray">${nSets}×${ex.reps}</span>
          ${ex.tempo && ex.tempo !== '—' ? `<span class="pill pill-gray">tempo ${ex.tempo}</span>` : ''}
          <span class="pill pill-gray">⏱ ${ex.rest}</span>
          <span class="pill pill-gray">${rirFor(week, ex).split(' (')[0]}</span>
          ${lastTop ? `<span class="pill pill-gold">Antes: ${ex.bw ? lastTop.reps + (unit === 'seg' ? ' s' : '') : fmtW(lastTop.weight, WU, true) + ' × ' + lastTop.reps}</span>` : ''}
          ${doneCount > 0 && !allDone ? `<span class="pill pill-coral">${doneCount}/${sets.length} series</span>` : ''}
        </div>
      </div>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0;transform:rotate(${open ? 180 : 0}deg);transition:.2s;margin-top:4px"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="exc-body" style="display:${open ? 'block' : 'none'}">
      ${ssNote}${tag}
      <div class="sets-wrap">
        <div class="sets-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Registro de series</span>
          ${ex.bw ? '' : `<span style="display:inline-flex;border:1px solid var(--border2);border-radius:100px;overflow:hidden" onclick="event.stopPropagation()">
            <button style="padding:4px 12px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:${WU === 'kg' ? 'var(--coral)' : 'transparent'};color:${WU === 'kg' ? '#fff' : 'var(--text3)'}" onclick="setUnit('${dateStr}','${ex.id}','kg')">kg</button>
            <button style="padding:4px 12px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:${WU === 'lb' ? 'var(--coral)' : 'transparent'};color:${WU === 'lb' ? '#fff' : 'var(--text3)'}" onclick="setUnit('${dateStr}','${ex.id}','lb')">lb</button></span>`}
        </div>
        ${sets.map((s, i) => `
        <div class="set-row ${s.done ? 'logged' : ''}">
          <div class="set-idx">${i + 1}</div>
          ${ex.bw ? '' : `<input class="set-input" type="number" step="0.5" inputmode="decimal" value="${s.weight ? dispW(s.weight, s.unit || 'kg', true) : ''}" placeholder="${s.unit || 'kg'}"
            onchange="updateSet('${dateStr}','${ex.id}',${i},'weight',this.value)" onclick="event.stopPropagation()">
          <span class="set-x">${s.unit || 'kg'} ×</span>`}
          <input class="set-input" type="number" inputmode="numeric" value="${s.reps ?? ''}" placeholder="${unit}" style="width:54px"
            onchange="updateSet('${dateStr}','${ex.id}',${i},'reps',this.value)" onclick="event.stopPropagation()">
          ${ex.bw ? `<span class="set-x">${unit === 'seg' ? 'seg' : 'reps'}</span><span style="flex:1"></span>` : ''}
          <button class="set-check ${s.done ? 'on' : ''}" onclick="event.stopPropagation();toggleSet('${dateStr}','${ex.id}',${i},${restSec})">
            ${s.done ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>
        </div>`).join('')}
        <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="event.stopPropagation();addSet('${dateStr}','${ex.id}')">+ Añadir serie</button>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.55;padding:12px 0 4px">${ex.notes}</div>
      ${ex.alt ? `<div style="font-size:12px;color:#e8b64c;line-height:1.5;padding:2px 0 4px">🩹 ${ex.alt}</div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
        <a href="${DOSE_URL(ex.q || ex.name + ' técnica')}" target="_blank" rel="noopener" class="photo-btn" style="color:#ff6b5e;border-color:rgba(255,90,69,.3);text-decoration:none" onclick="event.stopPropagation()">
          ▶ Ver técnica en YouTube
        </a>
        ${!ex.isCore ? `
        <button class="photo-btn" onclick="event.stopPropagation();triggerPhotoCapture('${ex.id}',${week})">
          📷 ${getPhoto(ex.id, week) ? 'Cambiar foto' : 'Foto del peso'}
        </button>` : ''}
      </div>
      ${getPhoto(ex.id, week) ? `<img class="photo-thumb" src="${getPhoto(ex.id, week)}" onclick="event.stopPropagation();viewPhotoFullscreen(this.src)">` : ''}
    </div>
  </div>`;
}

function getBestSetLastOccurrence(exId, currentDate) {
  // Find most recent previous date with logged sets for this exercise
  let best = null, bestDate = null;
  Object.entries(STATE.setLogs).forEach(([key, sets]) => {
    const [d, id] = key.split('|');
    if (id === exId && d < currentDate) {
      if (!bestDate || d > bestDate) {
        const doneSets = sets.filter(s => s.done && s.weight);
        if (doneSets.length) {
          bestDate = d;
          best = doneSets.reduce((a, b) => (b.weight > a.weight ? b : a));
        }
      }
    }
  });
  return best;
}

function toggleCard(id) {
  STATE.openCards[id] = !STATE.openCards[id];
  renderToday();
}

function markDayComplete(dateStr) {
  STATE.completedDays[dateStr] = true;
  save('completedDays', STATE.completedDays);
  const s = STATE.sessions[dateStr] || (STATE.sessions[dateStr] = { start: Date.now() });
  // el final cuenta hasta tu última acción (+ 3 min de margen) para no inflar el tiempo si terminas tarde
  s.end = Math.min(Date.now(), (s.last || Date.now()) + 3 * 60000);
  save('sessions', STATE.sessions);
  renderToday();
  setTimeout(() => openSummary(dateStr, true), 250);
}

function buildSummary(dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  const workout = DAY_WORKOUT_MAP[dow];
  if (!workout) return null;
  const week = weekOfDate(dateStr);
  let planned = 0, done = 0, vol = 0, prs = 0, ups = 0, same = 0, downs = 0;
  const rows = [], nextUps = [];
  workout.exercises.forEach(ex => {
    planned += getSetCount(ex, week);
    const sets = (STATE.setLogs[getSetLogKey(dateStr, ex.id)] || []).filter(s => s.done);
    if (!sets.length) return;
    done += Math.min(sets.length, getSetCount(ex, week));
    sets.forEach(s => { if (s.weight && s.reps) vol += s.weight * s.reps; });
    const best = ex.bw ? { reps: Math.max(...sets.map(s => s.reps)) } : sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
    const past = getPastSessions(ex, dateStr);
    let delta = '', cls = 'pill-gray', pr = false;
    if (past.length) {
      const prev = ex.bw ? { reps: Math.max(...past[0].sets.map(s => s.reps)) } : past[0].sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
      if (!ex.bw) {
        const allMax = Math.max(...past.flatMap(p => p.sets.map(s => s.weight)));
        if (best.weight > allMax) { pr = true; prs++; }
        if (best.weight > prev.weight) { delta = `+${fmtW(best.weight - prev.weight, exUnit(ex), false)}`; cls = 'pill-sage'; ups++; }
        else if (best.weight < prev.weight) { delta = `-${fmtW(prev.weight - best.weight, exUnit(ex), false)}`; cls = 'pill-coral'; downs++; }
        else if (best.reps > prev.reps) { delta = `+${best.reps - prev.reps} rep${best.reps - prev.reps > 1 ? 's' : ''}`; cls = 'pill-sage'; ups++; }
        else if (best.reps < prev.reps) { delta = `${best.reps - prev.reps} reps`; cls = 'pill-coral'; downs++; }
        else { delta = '= igual'; same++; }
      } else {
        if (best.reps > prev.reps) { delta = `+${best.reps - prev.reps}`; cls = 'pill-sage'; ups++; }
        else if (best.reps < prev.reps) { delta = `${best.reps - prev.reps}`; cls = 'pill-coral'; downs++; }
        else { delta = '= igual'; same++; }
      }
    }
    rows.push({ ex, best, delta, cls, pr, n: sets.length });
    if (!ex.bw && sets.length >= 2 && sets.every(s => s.reps >= ex.repMax) && !isDeload(week))
      nextUps.push(`${ex.name} → ${fmtW(best.weight + ex.inc, exUnit(ex), false)}`);
  });
  const warmDone = countChecks(workout.warmup, dateStr), coolDone = countChecks(workout.cooldown, dateStr);
  const cardioDone = !!STATE.checks[dateStr + '|cardio'];
  const sess = STATE.sessions[dateStr] || {};
  const mins = sess.start && sess.end ? Math.max(1, Math.round((sess.end - sess.start) / 60000)) : null;
  const completion = planned ? Math.round(done / planned * 100) : 0;
  const weekStartDow = new Date(dateStr + 'T12:00:00');
  const sessionsTotal = Object.values(STATE.completedDays).filter(Boolean).length;
  return { workout, week, rows, planned, done, vol, prs, ups, same, downs, warmDone, coolDone, cardioDone, mins, completion, nextUps, sessionsTotal, rpe: RPE_DATA[dateStr] };
}

function summaryVerdict(S) {
  const parts = [];
  if (S.completion >= 90 && S.ups + S.prs > 0) parts.push(`Vas muy bien 🔥 Completaste el ${S.completion}% de las series y progresaste en ${S.ups} ejercicio${S.ups === 1 ? '' : 's'}${S.prs ? ` (¡${S.prs} récord${S.prs > 1 ? 's' : ''} de peso!)` : ''}.`);
  else if (S.completion >= 90) parts.push(`Sesión sólida 💪 Completaste el ${S.completion}% de las series. Hoy no subiste carga, y está bien: consolidar también es progresar.`);
  else if (S.completion >= 60) parts.push(`Buena sesión 👏 Hiciste el ${S.completion}% de las series. Lo que más cambia el cuerpo es repetir esto cada semana.`);
  else parts.push(`Sesión corta, pero apareciste — y eso es lo que cuenta. Mañana lo retomamos con ganas. ✨`);
  if (S.downs > 1) parts.push('Bajaste carga en varios ejercicios: revisa sueño, comida y ciclo; no es un retroceso, es información.');
  if (S.mins) {
    if (S.mins <= 90) parts.push(`Duración: ${S.mins} min, dentro de tu límite de 1:30 h ✅`);
    else parts.push(`Duración: ${S.mins} min (te pasaste ${S.mins - 90}). Prueba acortar el descanso de los ejercicios de aislamiento a 45–60 s.`);
  }
  if (S.warmDone < S.workout.warmup.length || S.coolDone < S.workout.cooldown.length)
    parts.push('Te faltó parte del calentamiento o del estiramiento: es lo que protege tus rodillas y hombros. 🩹');
  return parts;
}

function openSummary(dateStr, afterFinish) {
  const S = buildSummary(dateStr);
  if (!S) return;
  const modal = document.getElementById('day-modal-content');
  const fmtKg = v => v >= 1000 ? (v / 1000).toFixed(1) + ' t' : v + ' kg';
  const verdict = summaryVerdict(S);
  modal.innerHTML = `
    <div class="handle"></div>
    <div style="font-size:10.5px;color:var(--coral);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Resumen · ${getMonthDay(dateStr)} · Semana ${S.week}</div>
    <h2 style="margin:4px 0 12px">${S.workout.emoji} ${S.workout.name}</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div class="streak-chip"><strong>${S.mins ? S.mins + ' min' : '—'}</strong><small>Duración</small></div>
      <div class="streak-chip"><strong>${S.done}/${S.planned}</strong><small>Series</small></div>
      <div class="streak-chip"><strong>${fmtKg(S.vol)}</strong><small>Volumen</small></div>
    </div>
    <div style="background:var(--bg3);border-radius:var(--r-md);padding:14px;margin-bottom:14px;font-size:13.5px;line-height:1.6">${verdict.join('<br><br>')}</div>

    <div style="margin:0 0 8px;font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700">Lo que levantaste</div>
    ${S.rows.length ? S.rows.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--border)">
        <div style="min-width:0"><div style="font-size:13px;font-weight:600">${r.pr ? '🏆 ' : ''}${r.ex.name}</div>
        <div style="font-size:11.5px;color:var(--text2)">${r.ex.bw ? r.best.reps + (r.ex.unit === 'seg' ? ' s' : ' reps') : fmtW(r.best.weight, exUnit(r.ex), true) + ' × ' + r.best.reps} · ${r.n} serie${r.n > 1 ? 's' : ''}</div></div>
        ${r.delta ? `<span class="pill ${r.cls}">${r.delta}</span>` : '<span class="pill pill-gray">1ª vez</span>'}
      </div>`).join('') : '<div style="font-size:13px;color:var(--text2)">No registraste series hoy.</div>'}

    <div style="margin:14px 0 8px;font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700">Cuidado y recuperación</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <span class="pill ${S.warmDone === S.workout.warmup.length ? 'pill-sage' : 'pill-gold'}">Calentamiento ${S.warmDone}/${S.workout.warmup.length}</span>
      <span class="pill ${S.coolDone === S.workout.cooldown.length ? 'pill-sage' : 'pill-gold'}">Estiramiento ${S.coolDone}/${S.workout.cooldown.length}</span>
      ${S.workout.cardio ? `<span class="pill ${S.cardioDone ? 'pill-sage' : 'pill-gold'}">Cardio ${S.cardioDone ? '✓' : 'pendiente'}</span>` : ''}
      ${S.rpe ? `<span class="pill" style="background:${getRpeConfig(S.rpe.rpe).color}22;color:${getRpeConfig(S.rpe.rpe).color}">Dificultad ${S.rpe.rpe}/10</span>` : ''}
    </div>
    ${S.nextUps.length ? `<div style="margin-top:14px;background:var(--gold-dim);border-radius:var(--r-md);padding:12px 14px;font-size:12.5px"><b style="color:var(--gold)">Próxima vez subes:</b><br>${S.nextUps.join('<br>')}</div>` : ''}
    <div style="font-size:11.5px;color:var(--text3);margin-top:12px">Sesión #${S.sessionsTotal} del plan · Racha ${getStreak()}</div>
    ${afterFinish && !S.rpe ? `<button class="btn btn-primary btn-full" style="margin-top:14px" onclick="closeDayModal();setTimeout(()=>openRpe('${dateStr}'),200)">¿Qué tan difícil fue? →</button>` : ''}
    <button class="btn btn-secondary btn-full" style="margin-top:10px" onclick="closeDayModal()">Cerrar</button>`;
  document.getElementById('day-overlay').style.display = 'flex';
}

// ══════════════════════════════════════════════════════
// RPE
// ══════════════════════════════════════════════════════
let pendingRpeDate = null, pendingRpeAdjustment = null;

const RPE_CONFIG = [
  { range:[1,3], color:'#7db8e8', label:'Muy fácil', feedback:'Fue demasiado suave — tu cuerpo puede más.', adj:{ msg:'La próxima vez de este día subo la carga un escalón extra.' }},
  { range:[4,5], color:'#8fc79a', label:'Moderado', feedback:'Buen trabajo — hay margen para crecer.', adj:{ msg:'Sigues con la doble progresión: subes cuando completes el tope de repeticiones.' }},
  { range:[6,7], color:'#e8b64c', label:'Desafiante', feedback:'¡Perfecto! Este es el rango ideal para cambiar el cuerpo.', adj:{ msg:'Mantengo la progresión normal — estás en la zona ideal.' }},
  { range:[8,9], color:'#ff8a65', label:'Muy duro', feedback:'Muy intenso. Está bien de vez en cuando; si es frecuente, consolida.', adj:{ msg:'Sin cambios: consolida antes de subir más.' }},
  { range:[10,10], color:'#ff5a45', label:'Al límite', feedback:'Demasiado. El objetivo es rendir sostenidamente, no destruirte.', adj:{ msg:'La próxima vez bajo ~7% la carga de este día.' }},
];
function getRpeConfig(n) { return RPE_CONFIG.find(c => n >= c.range[0] && n <= c.range[1]); }

function openRpe(dateStr) {
  pendingRpeDate = dateStr;
  pendingRpeAdjustment = null;
  document.getElementById('rpe-feedback').style.display = 'none';
  document.getElementById('rpe-actions').style.display = 'none';
  document.getElementById('rpe-grid').innerHTML = [1,2,3,4,5,6,7,8,9,10].map(n => {
    const c = getRpeConfig(n);
    return `<button class="rpe-n" id="rpe-${n}" style="color:${c.color}" onclick="selectRpe(${n})">${n}</button>`;
  }).join('');
  document.getElementById('rpe-overlay').style.display = 'flex';
}
function closeRpe() { document.getElementById('rpe-overlay').style.display = 'none'; }

function selectRpe(n) {
  const c = getRpeConfig(n);
  [1,2,3,4,5,6,7,8,9,10].forEach(i => {
    const b = document.getElementById(`rpe-${i}`);
    b.style.background = i === n ? getRpeConfig(i).color + '28' : '';
    b.style.borderColor = i === n ? getRpeConfig(i).color : 'var(--border)';
  });
  const fb = document.getElementById('rpe-feedback');
  fb.style.display = 'block';
  fb.innerHTML = `
    <div style="font-weight:800;color:${c.color};font-family:var(--f-display);font-size:15px;margin-bottom:6px">${n}/10 — ${c.label}</div>
    <div style="color:var(--text2)">${c.feedback}</div>
    <div style="margin-top:11px;padding:11px;background:var(--bg4);border-radius:10px;font-size:12.5px">📊 <strong>Ajuste:</strong> ${c.adj.msg}</div>`;
  document.getElementById('rpe-actions').style.display = 'block';
  pendingRpeAdjustment = c.adj;
  RPE_DATA[pendingRpeDate] = { rpe: n, label: c.label, ts: Date.now() };
  save('rpeHistory', RPE_DATA);
}

function applyRpeAdjustment() {
  closeRpe();
  showToast('✅ Guardado — lo uso para ajustar tu próxima sesión');
  if (STATE.currentTab === 'today') renderToday();
}

// ══════════════════════════════════════════════════════
// SCREEN: SEMANA (todos los días accesibles)
// ══════════════════════════════════════════════════════
function renderWeek() {
  const el = document.getElementById('screen-week');
  const week = STATE.currentWeek;
  const tdow = todayDow();
  const todayStr = today();
  const now = new Date();

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - tdow + i);
    days.push({ dow: i, dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, d });
  }
  const doneCount = days.filter(x => STATE.completedDays[x.dateStr] && DAY_WORKOUT_MAP[x.dow] && !DAY_WORKOUT_MAP[x.dow].optional).length;
  const workCount = days.filter(x => DAY_WORKOUT_MAP[x.dow] && !DAY_WORKOUT_MAP[x.dow].optional).length;

  el.innerHTML = `
    <div class="hdr"><h1>Esta semana</h1><p>Semana ${week} · ${getFaseName(week)} · ${doneCount}/${workCount} sesiones</p></div>

    <div class="card" style="padding:15px">
      <div style="display:flex;justify-content:space-between;margin-bottom:9px">
        <span style="font-size:13px;color:var(--text2);font-weight:500">Progreso semanal</span>
        <span style="font-weight:700;font-family:var(--f-display);font-size:13px">${doneCount}/${workCount}</span>
      </div>
      <div style="height:7px;background:var(--bg4);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${workCount ? doneCount/workCount*100 : 0}%;background:linear-gradient(90deg,var(--coral),var(--gold));border-radius:4px;transition:width .6s"></div>
      </div>
    </div>

    <div style="padding:0 20px 10px;font-size:12px;color:var(--text3)">Toca cualquier día para ver su rutina completa con anticipación →</div>

    ${days.map(({dow, dateStr, d}) => {
      const w = DAY_WORKOUT_MAP[dow];
      const isToday = dateStr === todayStr;
      const isDone = STATE.completedDays[dateStr];
      const rpe = RPE_DATA[dateStr];
      return `
      <div class="wk-day ${isToday ? 'today' : ''} ${!w ? 'rest' : ''} ${isDone ? 'done' : ''}"
           onclick="openDayModal(${dow},'${dateStr}','${getDayName(dow)} ${d.getDate()}')">
        <div class="wk-dot"><span>${getDayShort(dow)}</span><strong>${d.getDate()}</strong></div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${w ? w.emoji + ' ' + w.name : 'Descanso'}${w && w.optional ? ' <span class="pill pill-gray" style="margin-left:4px">Extra</span>' : ''}</div>
          <div style="font-size:11.5px;color:var(--text2);margin-top:2px">${w ? w.focus : dow === 3 ? 'Caminata inclinada + rutina diaria' : 'Descanso + rutina diaria'}</div>
          ${rpe ? `<div style="font-size:11px;color:${getRpeConfig(rpe.rpe).color};margin-top:2px;font-weight:600">Dificultad ${rpe.rpe}/10</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
          <span style="font-size:16px">${isDone ? '✅' : !w ? '·' : '○'}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3)"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('')}
  `;
}

function openDayModal(dow, dateStr, dayLabel) {
  const workout = DAY_WORKOUT_MAP[dow];
  const week = weekOfDate(dateStr);
  const modal = document.getElementById('day-modal-content');
  const rpe = RPE_DATA[dateStr];
  const isDone = STATE.completedDays[dateStr];

  if (!workout) {
    modal.innerHTML = `
      <div class="handle"></div>
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:46px;margin-bottom:12px">🌙</div>
        <div style="font-family:var(--f-display);font-size:19px;font-weight:600">${dayLabel}</div>
        <div style="color:var(--text2);margin-top:8px;font-size:13.5px;line-height:1.5">Recuperación activa: rutina diaria de postura + hipopresivos${dow === 3 ? ' y caminata inclinada 25–30 min' : ''}.</div>
      </div>
      <button class="btn btn-secondary btn-full" onclick="closeDayModal()">Cerrar</button>`;
  } else {
    const cardio = workout.cardio ? cardioFor(week) : null;
    modal.innerHTML = `
      <div class="handle"></div>
      <div style="font-size:10.5px;color:var(--coral);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${dayLabel} · Semana ${week}</div>
      <h2 style="margin:4px 0 2px">${workout.emoji} ${workout.name}</h2>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${workout.focus} · ${workout.duration}</div>
      ${isDone ? '<span class="pill pill-sage">✓ Completado</span>' : ''}
      ${rpe ? `<span class="pill" style="background:${getRpeConfig(rpe.rpe).color}22;color:${getRpeConfig(rpe.rpe).color}">Dificultad ${rpe.rpe}/10</span>` : ''}
      <div style="font-size:12.5px;color:var(--text2);margin-top:10px;line-height:1.5">🔥 Calentamiento: ${workout.warmup.map(w => w.name).slice(0, 4).join(' · ')}…</div>

      <div style="margin:16px 0 8px;font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700">Ejercicios (carga según tu última sesión)</div>
      ${workout.exercises.map(ex => {
        const sug = getSuggestion(ex, dateStr, week);
        const right = ex.bw ? '' : sug.first ? '<span style="font-size:11px;color:var(--text3)">1ª vez</span>' : `<div style="font-family:var(--f-display);font-weight:800;font-size:15px">${fmtNum(dispW(sug.weight, exUnit(ex), sug.exact))}<span style="font-size:10px;font-weight:400;color:var(--text3)"> ${exUnit(ex)}</span></div>`;
        return `
        <div style="background:var(--bg3);border-radius:var(--r-md);padding:13px;margin-bottom:8px;${ex.isGlute ? 'box-shadow:inset 3px 0 0 var(--coral)' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div><div style="font-weight:600;font-size:13.5px">${ex.isGlute ? '🍑 ' : ''}${ex.name}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${ex.equipment}</div></div>
            <div style="text-align:right;flex-shrink:0">${right}</div>
          </div>
          <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">
            <span class="pill pill-gray">${getSetCount(ex, week)}×${ex.reps}</span>
            <span class="pill pill-gray">⏱ ${ex.rest}</span>
            ${ex.ss ? `<span class="pill pill-coral">Superserie ${ex.ss}</span>` : ''}
            ${ex.isCore ? '<span class="pill pill-gold">Core</span>' : ''}
          </div>
        </div>`;
      }).join('')}
      ${cardio ? `<div style="background:var(--gold-dim);border:1px solid rgba(232,182,76,.3);border-radius:var(--r-md);padding:12px;margin-top:4px"><div style="font-weight:700;color:var(--gold);font-size:13px">🏃 ${cardio.type} ${cardio.duration} min</div><div style="font-size:12px;color:var(--text2);margin-top:2px">${cardio.desc}</div></div>` : ''}
      ${isDone ? `<button class="btn btn-primary btn-full" style="margin-top:14px" onclick="openSummary('${dateStr}')">📊 Ver resumen del día</button>` : ''}
      <button class="btn btn-secondary btn-full" style="margin-top:10px" onclick="closeDayModal()">Cerrar</button>`;
  }
  document.getElementById('day-overlay').style.display = 'flex';
}
function closeDayModal() { document.getElementById('day-overlay').style.display = 'none'; }

// ══════════════════════════════════════════════════════
// CHECK-IN MENSUAL
// ══════════════════════════════════════════════════════
let ciDraft = {};

function openCheckin() {
  ciDraft = { week: STATE.currentWeek, date: today(), photos: {} };
  renderCheckinStep(1);
  document.getElementById('checkin-overlay').style.display = 'flex';
}
function closeCheckin() { document.getElementById('checkin-overlay').style.display = 'none'; }

function renderCheckinStep(step) {
  const el = document.getElementById('checkin-content');
  const last = STATE.checkins[STATE.checkins.length - 1];

  if (step === 1) {
    el.innerHTML = `
      <div class="handle"></div>
      <div style="font-size:10.5px;color:var(--gold);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Check-in · Paso 1 de 3</div>
      <h2 style="margin:4px 0 14px">Peso y composición</h2>
      <div class="field"><label>Peso corporal (kg)</label>
        <input type="number" step="0.1" inputmode="decimal" id="ci-peso" placeholder="${last?.peso || '48.0'}" value="${ciDraft.peso || ''}"></div>
      <div class="field"><label>% Grasa corporal (si tu báscula lo mide)</label>
        <input type="number" step="0.1" inputmode="decimal" id="ci-grasa" placeholder="${last?.grasa || '21.9'}" value="${ciDraft.grasa || ''}"></div>
      <div class="field"><label>Masa muscular (kg, opcional)</label>
        <input type="number" step="0.1" inputmode="decimal" id="ci-musculo" placeholder="${last?.musculo || '35.6'}" value="${ciDraft.musculo || ''}"></div>
      <button class="btn btn-primary btn-full" onclick="ciNext(1)">Siguiente → Medidas</button>
      <button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="closeCheckin()">Más tarde</button>`;
  }
  else if (step === 2) {
    el.innerHTML = `
      <div class="handle"></div>
      <div style="font-size:10.5px;color:var(--gold);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Check-in · Paso 2 de 3</div>
      <h2 style="margin:4px 0 4px">Medidas (cm)</h2>
      <p style="font-size:12px;color:var(--text2);margin-bottom:14px">Usa cinta métrica, siempre en el mismo punto y sin apretar</p>
      <div class="field"><label>🍑 Perímetro glúteo (punto más ancho)</label>
        <input type="number" step="0.5" inputmode="decimal" id="ci-gluteo" placeholder="${last?.gluteo || '86'}" value="${ciDraft.gluteo || ''}"></div>
      <div class="field"><label>Muslo (parte más ancha)</label>
        <input type="number" step="0.5" inputmode="decimal" id="ci-muslo" placeholder="${last?.muslo || '50.5'}" value="${ciDraft.muslo || ''}"></div>
      <div class="field"><label>Cintura</label>
        <input type="number" step="0.5" inputmode="decimal" id="ci-cintura" placeholder="${last?.cintura || '68'}" value="${ciDraft.cintura || ''}"></div>
      <div class="field"><label>Bíceps contraído</label>
        <input type="number" step="0.5" inputmode="decimal" id="ci-biceps" placeholder="${last?.biceps || '24.5'}" value="${ciDraft.biceps || ''}"></div>
      <button class="btn btn-primary btn-full" onclick="ciNext(2)">Siguiente → Fotos</button>
      <button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="renderCheckinStep(1)">← Atrás</button>`;
  }
  else if (step === 3) {
    el.innerHTML = `
      <div class="handle"></div>
      <div style="font-size:10.5px;color:var(--gold);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Check-in · Paso 3 de 3</div>
      <h2 style="margin:4px 0 4px">Fotos de progreso</h2>
      <p style="font-size:12px;color:var(--text2);margin-bottom:8px">Misma ropa, misma luz, mismo lugar cada mes. Son solo tuyas — se guardan en tu teléfono.</p>
      <div class="ci-photo-grid">
        ${['frente','lado','espalda'].map(pos => `
        <div class="ci-photo-slot" onclick="ciCapturePhoto('${pos}')">
          ${ciDraft.photos[pos] ? `<img src="${ciDraft.photos[pos]}">` : `<div style="font-size:22px">📷</div><div style="text-transform:capitalize">${pos}</div>`}
        </div>`).join('')}
      </div>
      <button class="btn btn-primary btn-full" onclick="ciFinish()">💾 Guardar check-in</button>
      <button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="renderCheckinStep(2)">← Atrás</button>`;
  }
}

function ciNext(fromStep) {
  if (fromStep === 1) {
    ciDraft.peso = parseFloat(document.getElementById('ci-peso').value) || null;
    ciDraft.grasa = parseFloat(document.getElementById('ci-grasa').value) || null;
    ciDraft.musculo = parseFloat(document.getElementById('ci-musculo').value) || null;
    renderCheckinStep(2);
  } else if (fromStep === 2) {
    ciDraft.gluteo = parseFloat(document.getElementById('ci-gluteo').value) || null;
    ciDraft.muslo = parseFloat(document.getElementById('ci-muslo').value) || null;
    ciDraft.cintura = parseFloat(document.getElementById('ci-cintura').value) || null;
    ciDraft.biceps = parseFloat(document.getElementById('ci-biceps').value) || null;
    renderCheckinStep(3);
  }
}

function ciCapturePhoto(pos) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    compressImage(f, dataUrl => {
      ciDraft.photos[pos] = dataUrl;
      renderCheckinStep(3);
    });
  };
  input.click();
}

function ciFinish() {
  STATE.checkins.push({ ...ciDraft, planV: PLAN_VERSION, ts: Date.now() });
  try { save('checkins', STATE.checkins); }
  catch(e) {
    // Storage full — drop oldest photos
    STATE.checkins.forEach((c, i) => { if (i < STATE.checkins.length - 3) c.photos = {}; });
    save('checkins', STATE.checkins);
  }
  closeCheckin();
  showToast('🎉 Check-in guardado — ¡sigue así!');
  renderTab(STATE.currentTab === 'today' ? 'today' : STATE.currentTab);
}

function renderTab(name) {
  ({today: renderToday, week: renderWeek, progress: renderProgress, profile: renderProfile})[name]();
}

// ══════════════════════════════════════════════════════
// SCREEN: PROGRESO (con gráficas)
// ══════════════════════════════════════════════════════
function sparkline(values, color, w = 300, h = 52) {
  if (!values || values.length < 2) return `<div style="font-size:12px;color:var(--text3);padding:14px 0">Registra al menos 2 puntos para ver la gráfica</div>`;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((v - min) / range) * (h - 14);
    return `${x},${y}`;
  });
  const lastPt = pts[pts.length - 1].split(',');
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="g${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="4,${h} ${pts.join(' ')} ${w-4},${h}" fill="url(#g${color.replace('#','')})"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="4" fill="${color}"/>
  </svg>`;
}

function getExerciseHistory(exId) {
  // Weight history from set logs (max logged weight per date)
  const hist = [];
  Object.entries(STATE.setLogs).forEach(([key, sets]) => {
    const [d, id] = key.split('|');
    if (id === exId) {
      const done = sets.filter(s => s.done && s.weight);
      if (done.length) hist.push({ date: d, weight: Math.max(...done.map(s => s.weight)) });
    }
  });
  return hist.sort((a, b) => a.date.localeCompare(b.date));
}

function renderProgress() {
  const el = document.getElementById('screen-progress');
  const week = STATE.currentWeek;
  const pct = Math.round(week / TOTAL_WEEKS * 100);
  const totalSessions = Object.values(STATE.completedDays).filter(Boolean).length;
  const streak = getStreak();

  // Total volume all-time
  let allVol = 0;
  Object.values(STATE.setLogs).forEach(sets => sets.forEach(s => { if (s.done && s.weight && s.reps) allVol += s.weight * s.reps; }));

  const keyLifts = [
    ['hip-thrust', '🍑 Hip Thrust'],
    ['rdl', '🍑 Peso muerto RDL'],
    ['sentadilla-smith', 'Sentadilla'],
    ['prensa-pies-altos', 'Prensa'],
    ['jalon', 'Jalón al pecho'],
    ['press-hombro', 'Press de hombro'],
  ];

  const checkins = STATE.checkins;
  const lastCi = checkins[checkins.length - 1];
  const prevCi = checkins[checkins.length - 2];

  function deltaTag(curr, prev, invert = false) {
    if (curr == null || prev == null) return '';
    const d = Math.round((curr - prev) * 10) / 10;
    if (d === 0) return '<span class="delta" style="color:var(--text3)">=</span>';
    const good = invert ? d < 0 : d > 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`;
  }

  el.innerHTML = `
    <div class="hdr"><h1>Progreso</h1><p>Semana ${week} de ${TOTAL_WEEKS} · ${pct}% del plan</p></div>

    <div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <span style="font-weight:600;font-size:14px">${getFaseName(week)}</span>
        <span class="pill pill-coral">S${week}/${TOTAL_WEEKS}</span>
      </div>
      <div style="height:7px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-bottom:7px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--coral),var(--gold));border-radius:4px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)"><span>Base</span><span>Construcción</span><span>Definición</span></div>
    </div>

    <div class="streak-row" style="padding-top:0">
      <div class="streak-chip ${streak >= 3 ? 'fire' : ''}"><strong>${streak >= 3 ? '🔥' : ''}${streak}</strong><small>Racha</small></div>
      <div class="streak-chip"><strong>${totalSessions}</strong><small>Sesiones</small></div>
      <div class="streak-chip"><strong>${allVol >= 1000 ? (allVol/1000).toFixed(1)+'t' : allVol}</strong><small>Vol. total</small></div>
    </div>

    ${isCheckinDue() ? `
    <div class="checkin-banner" onclick="openCheckin()">
      <div class="ci-icon">📸</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:var(--gold)">Check-in pendiente</div>
        <div style="font-size:12px;color:var(--text2)">Peso, medidas y fotos</div>
      </div><div style="color:var(--gold)">→</div>
    </div>` : ''}

    <div class="sect">Levantamientos clave — datos reales (en kg)</div>
    ${keyLifts.map(([id, name]) => {
      const hist = getExerciseHistory(id);
      const last = hist[hist.length - 1];
      return `
      <div class="chart-card">
        <div class="chart-head">
          <span class="chart-title">${name}</span>
          <span class="chart-val">${last ? last.weight + ' kg' : '—'}</span>
        </div>
        ${sparkline(hist.map(h => h.weight), '#ff5a45')}
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${hist.length} sesiones registradas${last ? ` · último: ${getMonthDay(last.date)}` : ''}</div>
      </div>`;
    }).join('')}

    <div class="sect">Composición corporal</div>
    ${lastCi ? `
    <div class="card">
      <div style="font-size:11px;color:var(--text3);margin-bottom:11px">Último check-in: semana ${lastCi.week} · ${getMonthDay(lastCi.date)}</div>
      ${[['Peso', 'peso', 'kg', false], ['% Grasa', 'grasa', '%', true], ['Masa muscular', 'musculo', 'kg', false],
         ['🍑 Glúteo', 'gluteo', 'cm', false], ['Muslo', 'muslo', 'cm', false], ['Cintura', 'cintura', 'cm', true], ['Bíceps', 'biceps', 'cm', false]]
        .filter(([_, k]) => lastCi[k] != null)
        .map(([label, k, unit, invert]) => `
        <div class="p-row">
          <span class="p-label">${label}</span>
          <span class="p-value">${lastCi[k]} ${unit}${prevCi ? deltaTag(lastCi[k], prevCi[k], invert) : ''}</span>
        </div>`).join('')}
    </div>
    ${checkins.length >= 2 ? `
    <div class="chart-card">
      <div class="chart-head"><span class="chart-title">🍑 Evolución glúteo</span>
        <span class="chart-val">${lastCi.gluteo || '—'} cm</span></div>
      ${sparkline(checkins.filter(c => c.gluteo).map(c => c.gluteo), '#e8b64c')}
    </div>` : ''}
    ${checkins.length >= 2 ? `
    <div class="chart-card">
      <div class="chart-head"><span class="chart-title">📏 Evolución cintura</span>
        <span class="chart-val">${lastCi.cintura || '—'} cm</span></div>
      ${sparkline(checkins.filter(c => c.cintura).map(c => c.cintura), '#8fc79a')}
    </div>` : ''}
    ` : `
    <div class="card" style="text-align:center;padding:24px 18px">
      <div style="font-size:32px;margin-bottom:8px">📸</div>
      <div style="font-weight:600;margin-bottom:4px">Aún no hay check-ins</div>
      <div style="font-size:12.5px;color:var(--text2);margin-bottom:14px">El primer check-in crea tu punto de partida para medir todo el progreso</div>
      <button class="btn btn-primary" onclick="openCheckin()">Hacer mi primer check-in</button>
    </div>`}

    ${checkins.some(c => Object.keys(c.photos || {}).length) ? `
    <div class="sect">Fotos de progreso</div>
    <div class="card">
      ${checkins.filter(c => Object.keys(c.photos || {}).length).map(c => `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Semana ${c.week} · ${getMonthDay(c.date)}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            ${['frente','lado','espalda'].map(p => c.photos[p] ? `<img src="${c.photos[p]}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:9px;cursor:pointer" onclick="viewPhotoFullscreen(this.src)">` : '').join('')}
          </div>
        </div>`).join('')}
    </div>` : ''}
    <div style="height:12px"></div>
  `;
}

// ══════════════════════════════════════════════════════
// SCREEN: PERFIL
// ══════════════════════════════════════════════════════
function renderProfile() {
  const el = document.getElementById('screen-profile');
  const adj = getCycleAdj();
  const week = STATE.currentWeek;

  el.innerHTML = `
    <div class="hdr"><h1>Perfil</h1><p>Ciclo · Viajes · Recordatorios · Plan</p></div>

    <div class="sect">Fase del ciclo (según Flo)</div>
    <div class="card">
      <p style="font-size:12px;color:var(--text2);margin-bottom:11px">Los pesos sugeridos se ajustan automáticamente a tu fase</p>
      ${Object.entries(CYCLE_ADJUSTMENTS).map(([key, d]) => `
        <div class="cycle-opt" style="${key === STATE.cyclePhase ? `border-color:${d.color};background:${d.color}15` : ''}" onclick="setCyclePhase('${key}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600;font-size:14px;color:${key === STATE.cyclePhase ? d.color : 'var(--text)'}">${d.label}</span>
            <span style="font-size:12px;font-weight:800;color:${d.color};font-family:var(--f-display)">${d.factor >= 1 ? '+' : ''}${Math.round((d.factor-1)*100)}%</span>
          </div>
          ${key === STATE.cyclePhase ? `<div style="font-size:12px;color:var(--text2);margin-top:5px">${d.tip}</div>` : ''}
        </div>`).join('')}
    </div>

    <div class="sect">Modo viaje</div>
    <div class="card">
      ${STATE.travelMode ? `
        <div style="background:var(--gold-dim);border:1px solid rgba(232,182,76,.35);border-radius:var(--r-sm);padding:11px 14px;margin-bottom:12px;font-size:13px;color:var(--gold)">✈️ Plan pausado · Semana ${STATE.pausedWeek} congelada</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:13px">Al volver retomas exactamente donde ibas — sin perder progreso.</p>
        <button class="btn btn-primary btn-full" onclick="endTravel()">🏠 Regresé — Reanudar plan</button>
      ` : `
        <p style="font-size:13px;color:var(--text2);margin-bottom:13px">✈️ Menos de 1 semana sin entrenar no pierde músculo. El plan se congela y retomas donde ibas.</p>
        <button class="btn btn-ghost btn-full" onclick="startTravel()">Salir de viaje — Pausar plan</button>
      `}
    </div>

    <div class="sect">Recordatorios y motivación</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:4px">🔔 Recordatorio diario</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:11px">Mensaje motivacional + rutina del día a la hora que elijas</div>
      <div style="display:flex;gap:9px;align-items:center">
        <input type="time" value="${STATE.notifTime}" onchange="STATE.notifTime=this.value;save('notifTime',this.value);if(STATE.notifsEnabled)scheduleDailyNotif()" style="flex:1">
        <button class="btn ${STATE.notifsEnabled ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="requestNotifications()">
          ${STATE.notifsEnabled ? '✓ Activo' : 'Activar'}
        </button>
      </div>
      ${STATE.notifsEnabled ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="sendTestNotif()">Probar notificación</button>` : `<div style="margin-top:10px;font-size:11.5px;color:var(--text3)">Requiere iOS 16.4+ con la app instalada en pantalla de inicio</div>`}
    </div>

    <div class="sect">Calendario</div>
    <div class="card">
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Añade la sesión de hoy a tu calendario del iPhone</p>
      <button class="btn btn-secondary btn-full" onclick="downloadCalendarEvent()">📅 Descargar evento (.ics)</button>
    </div>

    <div class="sect">Cronómetro de descanso</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:4px">🔔 Alarma aunque salgas de la app</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:11px;line-height:1.5">Al terminar el descanso suena una alarma aunque cambies de app o bloquees el iPhone. Mientras dura el descanso se pausará tu música. El iPhone no permite vibración desde apps web: usa el sonido (sube el volumen).</div>
      <button class="btn ${STATE.restAlarm ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="toggleRestAlarm()">${STATE.restAlarm ? '✓ Alarma de sonido activa' : 'Activar alarma de sonido'}</button>
    </div>

    <div class="sect">Alimentación base (orientativa)</div>
    <div class="card">
      ${[['Calorías', '≈ 2,000–2,100 kcal/día (déficit pequeño)'], ['Proteína', '110–120 g/día (repartida en 3–4 comidas)'], ['Pasos', '8,000–10,000/día'], ['Agua', '2–2.5 L/día'], ['Sueño', '7–8 h'] ]
        .map(([l, v]) => `<div class="p-row"><span class="p-label">${l}</span><span class="p-value" style="text-align:right">${v}</span></div>`).join('')}
      <div style="font-size:11.5px;color:var(--text3);line-height:1.5;margin-top:8px">Es una estimación, no una prescripción. Meta: bajar ~0.25–0.4 kg por semana sin perder fuerza. Si en 3 semanas la cintura no baja, quita ~150 kcal; si pierdes fuerza o rindes mal, súmalas. Una nutricionista puede personalizarlo.</div>
    </div>

    <div class="sect">Mi plan</div>
    <div class="card">
      ${[['Semana', `${week} de ${TOTAL_WEEKS}`], ['Fase', getFaseName(week)],
         ['Inicio', STATE.planStartDate ? getMonthDay(STATE.planStartDate) : '—'],
         ['Check-ins hechos', STATE.checkins.length],
         ['Ciclo', adj.label], ['Viaje', STATE.travelMode ? '✈️ Pausado' : 'Activo']]
        .map(([l, v]) => `<div class="p-row"><span class="p-label">${l}</span><span class="p-value">${v}</span></div>`).join('')}
    </div>
    <div style="height:16px"></div>
  `;
}

function toggleRestAlarm() {
  STATE.restAlarm = !STATE.restAlarm;
  save('restAlarm', STATE.restAlarm ? 'on' : 'off');
  showToast(STATE.restAlarm ? '🔔 Alarma de descanso activada' : 'Alarma desactivada');
  renderProfile();
}

function setCyclePhase(phase) {
  STATE.cyclePhase = phase;
  save('cyclePhase', phase);
  if (STATE.currentTab === 'profile') renderProfile();
  showToast(`Ciclo: ${CYCLE_ADJUSTMENTS[phase].label}`);
}

function startTravel() {
  STATE.travelMode = true;
  STATE.pausedWeek = STATE.currentWeek;
  save('travelMode', 'true'); save('pausedWeek', String(STATE.pausedWeek));
  showToast('✈️ Plan pausado. ¡Buen viaje!');
  if (STATE.currentTab === 'profile') renderProfile();
}
function endTravel() {
  STATE.travelMode = false;
  save('travelMode', 'false');
  showToast(`🏠 Plan reanudado en semana ${STATE.pausedWeek}`);
  if (STATE.currentTab === 'profile') renderProfile();
}

// ── Notifications ────────────────────────────────────
async function requestNotifications() {
  if (!('Notification' in window)) return showToast('Este navegador no soporta notificaciones');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    STATE.notifsEnabled = true;
    save('notifsEnabled', 'true');
    scheduleDailyNotif();
    showToast('🔔 Recordatorios activados');
    renderProfile();
  } else showToast('Permiso denegado — actívalo en Ajustes');
}

function scheduleDailyNotif() {
  // Check every minute if it's notification time (works while app/PWA is open or in SW)
  save('nextNotifCheck', STATE.notifTime);
}

function checkNotifTime() {
  if (!STATE.notifsEnabled) return;
  const now = new Date();
  const [h, m] = STATE.notifTime.split(':').map(Number);
  const lastSent = localStorage.getItem('lastNotifDate');
  if (now.getHours() === h && now.getMinutes() === m && lastSent !== today()) {
    localStorage.setItem('lastNotifDate', today());
    sendDailyNotif();
  }
}
setInterval(checkNotifTime, 30000);

function sendDailyNotif() {
  const dow = todayDow();
  const w = DAY_WORKOUT_MAP[dow];
  const quote = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
  const body = w ? `${w.emoji} Hoy: ${w.name} — ${w.focus}\n${quote}` : `😴 Hoy descansas. ${quote}`;
  try { new Notification('Mi Mejor Versión 🔥', { body, icon: '/icon-192.png' }); } catch(e) {}
}

function sendTestNotif() {
  sendDailyNotif();
  showToast('Notificación enviada ✓');
}

// ── Calendar ─────────────────────────────────────────
function downloadCalendarEvent() {
  const dow = todayDow();
  const w = DAY_WORKOUT_MAP[dow];
  if (!w) return showToast('Hoy es descanso');
  const [h, m] = STATE.notifTime.split(':').map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const end = new Date(start.getTime() + 90 * 60000);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,
    `SUMMARY:${w.emoji} ${w.name} — Mi Mejor Versión`,`DESCRIPTION:${w.focus} · Semana ${STATE.currentWeek}`,
    'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `entreno-${today()}.ics`;
  a.click();
  showToast('📅 Evento descargado');
}

// ── Onboarding & init ────────────────────────────────
function finishOnboarding() {
  const val = document.getElementById('startDateInput').value || today();
  STATE.planStartDate = val;
  save('planStartDate', val);
  save('planVersion', PLAN_VERSION);
  STATE.currentWeek = computeWeek();
  document.getElementById('onboarding').style.display = 'none';
  renderToday();
  showToast(`🚀 Semana ${STATE.currentWeek} — ¡vamos!`);
}

function migratePlan() {
  if (localStorage.getItem('planVersion') === PLAN_VERSION) return;
  // Plan nuevo: conserva historial de cargas (sirve para sugerir pesos), limpia series sin hacer y reinicia fechas
  Object.keys(STATE.setLogs).forEach(k => { if (!STATE.setLogs[k].some(s => s.done)) delete STATE.setLogs[k]; });
  save('setLogs', STATE.setLogs);
  STATE.planStartDate = null;
  localStorage.removeItem('planStartDate');
  STATE.travelMode = false; save('travelMode', 'false');
  STATE.pausedWeek = 1; save('pausedWeek', '1');
}

function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  migratePlan();
  if (!STATE.planStartDate) {
    const ob = document.getElementById('onboarding');
    ob.style.display = 'flex';
    const inp = document.getElementById('startDateInput');
    inp.value = today(); inp.max = today();
  } else {
    STATE.currentWeek = computeWeek();
    renderToday();
  }
}
init();
