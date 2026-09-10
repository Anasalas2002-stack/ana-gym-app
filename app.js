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
};

const RPE_DATA = JSON.parse(localStorage.getItem('rpeHistory') || '{}');

// ── Utils ────────────────────────────────────────────
function save(k, v) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayDow() { return new Date().getDay(); }
function getDayName(d) { return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d]; }
function getDayShort(d) { return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d]; }
function getFaseName(w) { return w <= 8 ? 'Fase 1 · Adaptación' : w <= 17 ? 'Fase 2 · Hipertrofia' : 'Fase 3 · Intensidad'; }
function getMonthDay(dateStr) { const d = new Date(dateStr+'T12:00:00'); return `${d.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]}`; }

function computeWeek() {
  if (!STATE.planStartDate) return 1;
  const start = new Date(STATE.planStartDate + 'T00:00:00');
  const diff = Math.floor((new Date() - start) / 604800000);
  let w = Math.max(1, Math.min(26, diff + 1));
  if (STATE.travelMode) w = STATE.pausedWeek;
  return w;
}

function getCycleAdj() { return CYCLE_ADJUSTMENTS[STATE.cyclePhase] || CYCLE_ADJUSTMENTS.follicular; }
function getWeightKey(exId, week) { return `${exId}_w${week}`; }
function getWeight(exId, week, progression) {
  const k = getWeightKey(exId, week);
  if (STATE.weights[k] !== undefined) return STATE.weights[k];
  if (!progression) return null;
  return getSuggestedWeight(progression, week);
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
  // Initialize with suggested values
  const nSets = parseInt(String(ex.sets).replace(/[^\d]/g, '').charAt(0)) || 3;
  const adj = getCycleAdj();
  const raw = ex.progression ? getSuggestedWeight(ex.progression, week) : null;
  const sugW = raw ? Math.round(raw * adj.factor * 2) / 2 : null;
  const repsNum = parseInt(String(ex.reps).match(/\d+/)?.[0] || '12');
  const sets = Array.from({length: nSets}, () => ({ weight: sugW, reps: repsNum, done: false }));
  STATE.setLogs[key] = sets;
  return sets;
}

function updateSet(dateStr, exId, idx, field, val) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  STATE.setLogs[key][idx][field] = parseFloat(val) || 0;
  save('setLogs', STATE.setLogs);
}

function toggleSet(dateStr, exId, idx, restSec) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  const s = STATE.setLogs[key][idx];
  s.done = !s.done;
  save('setLogs', STATE.setLogs);
  if (s.done) {
    if (restSec && idx < STATE.setLogs[key].length - 1) startRest(restSec);
    // haptic-ish feedback
    if (navigator.vibrate) navigator.vibrate(30);
  }
  renderToday();
}

function addSet(dateStr, exId) {
  const key = getSetLogKey(dateStr, exId);
  if (!STATE.setLogs[key]) return;
  const last = STATE.setLogs[key][STATE.setLogs[key].length - 1];
  STATE.setLogs[key].push({ weight: last?.weight || 0, reps: last?.reps || 12, done: false });
  save('setLogs', STATE.setLogs);
  renderToday();
}

// ── Rest timer ───────────────────────────────────────
let restInterval = null;
function startRest(seconds) {
  clearInterval(restInterval);
  let remaining = seconds;
  const el = document.getElementById('rest-timer');
  const timeEl = document.getElementById('rest-time');
  el.classList.add('show');
  const tick = () => {
    const m = Math.floor(remaining / 60), s = remaining % 60;
    timeEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
    if (remaining <= 0) {
      clearInterval(restInterval);
      el.classList.remove('show');
      showToast('⏰ ¡Descanso terminado — siguiente serie!');
      if (navigator.vibrate) navigator.vibrate([100,50,100]);
    }
    remaining--;
  };
  tick();
  restInterval = setInterval(tick, 1000);
}
function skipRest() {
  clearInterval(restInterval);
  document.getElementById('rest-timer').classList.remove('show');
}

function parseRestSeconds(restStr) {
  const m = String(restStr).match(/(\d+)/);
  return m ? parseInt(m[1]) : 90;
}

// ── Tabs ─────────────────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  STATE.currentTab = name;
  ({today: renderToday, week: renderWeek, progress: renderProgress, profile: renderProfile, face: renderFace})[name]();
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
  const lastCheckin = STATE.checkins[STATE.checkins.length - 1];
  // Due every 4 weeks: weeks 1, 5, 9, 13, 17, 21, 25
  const dueWeeks = [1,5,9,13,17,21,25];
  const currentDue = [...dueWeeks].reverse().find(w => week >= w);
  if (!currentDue) return false;
  if (!lastCheckin) return true;
  return lastCheckin.week < currentDue;
}

// ══════════════════════════════════════════════════════
// SCREEN: HOY
// ══════════════════════════════════════════════════════
function renderToday() {
  const el = document.getElementById('screen-today');
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  const week = STATE.currentWeek;
  const dateStr = today();
  const streak = getStreak();
  const adj = getCycleAdj();
  const totalSessions = Object.values(STATE.completedDays).filter(Boolean).length;

  const checkinBanner = isCheckinDue() ? `
    <div class="checkin-banner" onclick="openCheckin()">
      <div class="ci-icon">📸</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:var(--gold)">Check-in mensual pendiente</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Peso, medidas y fotos de progreso — 3 minutos</div>
      </div>
      <div style="color:var(--gold);font-size:18px">→</div>
    </div>` : '';

  if (!workout) {
    el.innerHTML = `
      <div class="hdr"><h1>${getDayName(dow)}</h1><p>Semana ${week} · ${getFaseName(week)}</p></div>
      ${checkinBanner}
      <div class="rest-view">
        <div style="font-size:56px">🌙</div>
        <div>
          <div style="font-family:var(--f-display);font-size:21px;font-weight:600">Día de recuperación</div>
          <p style="color:var(--text2);margin-top:8px;font-size:14px;max-width:280px">El músculo se construye descansando. Hoy tu única tarea es cuidarte.</p>
        </div>
        ${dow === 3 ? `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-md);padding:13px 17px;font-size:13px;color:var(--text2)">🚶 Opcional: caminata suave de 20–30 min</div>` : ''}
        <div class="quote-card" style="margin:0;width:100%"><div class="quote-text">${getDailyQuote()}</div></div>
      </div>`;
    return;
  }

  const isDone = STATE.completedDays[dateStr];

  // Compute per-exercise completion from set logs
  const workExercises = workout.exercises.filter(e => !e.isWarmup);
  let exDoneCount = 0;
  workExercises.forEach(ex => {
    const sets = STATE.setLogs[getSetLogKey(dateStr, ex.id)];
    if (sets && sets.length && sets.every(s => s.done)) exDoneCount++;
  });
  const todayVol = getTotalVolume(dateStr);

  el.innerHTML = `
    <div class="hero">
      <div class="hero-week">Semana ${week} · ${getFaseName(week)}</div>
      <div class="hero-title">${workout.emoji} ${workout.name}</div>
      <div class="hero-sub">${workout.focus} · ${workout.duration}</div>
    </div>

    <div class="streak-row">
      <div class="streak-chip ${streak >= 3 ? 'fire' : ''}">
        <strong>${streak >= 3 ? '🔥' : ''}${streak}</strong><small>Racha</small>
      </div>
      <div class="streak-chip"><strong>${exDoneCount}/${workExercises.length}</strong><small>Ejercicios</small></div>
      <div class="streak-chip"><strong>${todayVol >= 1000 ? (todayVol/1000).toFixed(1)+'t' : todayVol}</strong><small>Volumen kg</small></div>
      <div class="streak-chip"><strong style="color:${adj.color}">${Math.round(adj.factor*100)}%</strong><small>Ciclo</small></div>
    </div>

    ${checkinBanner}

    ${adj.factor !== 1 ? `
    <div style="margin:0 16px 12px;background:${adj.color}18;border:1px solid ${adj.color}45;border-radius:var(--r-md);padding:12px 15px">
      <div style="font-size:12px;font-weight:700;color:${adj.color}">${adj.label} · pesos al ${Math.round(adj.factor*100)}%</div>
      <div style="font-size:12px;color:var(--text2);margin-top:2px">${adj.tip}</div>
    </div>` : ''}

    ${STATE.travelMode ? `<div style="margin:0 16px 12px;background:var(--gold-dim);border:1px solid rgba(232,182,76,.35);border-radius:var(--r-md);padding:11px 15px;font-size:13px;color:var(--gold)">✈️ Plan pausado · Semana ${STATE.pausedWeek} congelada</div>` : ''}

    <div class="quote-card"><div class="quote-text">${getDailyQuote()}</div></div>

    <div class="sect">Tu sesión — registra cada serie</div>
    ${workout.exercises.map((ex, i) => renderExerciseCard(ex, i, week, dateStr)).join('')}

    ${workout.cardio ? `
    <div class="sect">Cardio post-sesión</div>
    <div class="card" style="background:linear-gradient(135deg,var(--gold-dim),var(--card));border-color:rgba(232,182,76,.3)">
      <div style="font-weight:700;color:var(--gold);margin-bottom:4px">🏃 ${workout.cardio.type} · ${workout.cardio.duration} min</div>
      <div style="font-size:13px;color:var(--text2)">${workout.cardio.desc}</div>
    </div>` : ''}

    <div style="padding:10px 16px 6px">
      <button class="btn ${isDone ? 'btn-secondary' : 'btn-primary'} btn-full" onclick="markDayComplete('${dateStr}')">
        ${isDone ? '✓ Sesión registrada' : '🏁 Terminar y evaluar sesión'}
      </button>
    </div>
  `;
}

function renderExerciseCard(ex, index, week, dateStr) {
  const open = STATE.openCards[ex.id];
  const sets = getSets(dateStr, ex.id, ex, week);
  const allDone = sets.length && sets.every(s => s.done);
  const doneCount = sets.filter(s => s.done).length;
  const adj = getCycleAdj();
  const raw = ex.progression ? getSuggestedWeight(ex.progression, week) : null;
  const sugW = raw ? Math.round(raw * adj.factor * 2) / 2 : null;
  const restSec = parseRestSeconds(ex.rest);
  const lastWeekBest = getBestSetLastOccurrence(ex.id, dateStr);

  return `
  <div class="exc ${ex.isGlute ? 'glute' : ''} ${allDone ? 'done' : ''}">
    <div class="exc-head" onclick="toggleCard('${ex.id}')">
      <div class="exc-num">${allDone ? '✓' : index + 1}</div>
      <div class="exc-info">
        <div class="exc-name">${ex.isGlute ? '🍑 ' : ''}${ex.name}</div>
        <div class="exc-equip">${ex.equipment}</div>
        <div class="exc-meta">
          <span class="pill pill-gray">${ex.sets}×${ex.reps}</span>
          ${ex.tempo && ex.tempo !== '—' ? `<span class="pill pill-gray">tempo ${ex.tempo}</span>` : ''}
          ${ex.rest && ex.rest !== '—' ? `<span class="pill pill-gray">⏱ ${ex.rest}</span>` : ''}
          ${ex.isWarmup ? '<span class="pill pill-gold">Activación</span>' : ''}
          ${doneCount > 0 && !allDone ? `<span class="pill pill-coral">${doneCount}/${sets.length} series</span>` : ''}
        </div>
      </div>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0;transform:rotate(${open ? 180 : 0}deg);transition:.2s;margin-top:4px"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="exc-body" style="display:${open ? 'block' : 'none'}">
      ${sugW ? `<div class="suggested-tag">💡 Sugerido para hoy: <b>${sugW} kg</b>${lastWeekBest ? ` · Anterior: ${lastWeekBest.weight} kg × ${lastWeekBest.reps}` : ''}</div>` : ''}
      <div class="sets-wrap">
        <div class="sets-title">Registro de series</div>
        ${sets.map((s, i) => `
        <div class="set-row ${s.done ? 'logged' : ''}">
          <div class="set-idx">${i + 1}</div>
          <input class="set-input" type="number" step="0.5" inputmode="decimal" value="${s.weight ?? ''}" placeholder="kg"
            onchange="updateSet('${dateStr}','${ex.id}',${i},'weight',this.value)" onclick="event.stopPropagation()">
          <span class="set-x">kg ×</span>
          <input class="set-input" type="number" inputmode="numeric" value="${s.reps ?? ''}" placeholder="reps" style="width:54px"
            onchange="updateSet('${dateStr}','${ex.id}',${i},'reps',this.value)" onclick="event.stopPropagation()">
          <button class="set-check ${s.done ? 'on' : ''}" onclick="event.stopPropagation();toggleSet('${dateStr}','${ex.id}',${i},${restSec})">
            ${s.done ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>
        </div>`).join('')}
        <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="event.stopPropagation();addSet('${dateStr}','${ex.id}')">+ Añadir serie</button>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.55;padding:12px 0 4px">${ex.notes}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
        ${EXERCISE_VIDEOS[ex.videoId] ? `
        <a href="https://www.youtube.com/watch?v=${EXERCISE_VIDEOS[ex.videoId]}" target="_blank" rel="noopener" class="photo-btn" style="color:#ff6b5e;border-color:rgba(255,90,69,.3);text-decoration:none" onclick="event.stopPropagation()">
          ▶ Video del ejercicio
        </a>` : ''}
        ${!ex.isWarmup ? `
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
  renderToday();
  setTimeout(() => openRpe(dateStr), 500);
}

// ══════════════════════════════════════════════════════
// RPE
// ══════════════════════════════════════════════════════
let pendingRpeDate = null, pendingRpeAdjustment = null;

const RPE_CONFIG = [
  { range:[1,3], color:'#7db8e8', label:'Muy fácil', feedback:'Fue demasiado suave — tu cuerpo puede más. La próxima sesión de este tipo te exigiré más.', adj:{ f:1.075, msg:'Subo los pesos +7.5% en tu próxima sesión de este tipo.' }},
  { range:[4,5], color:'#8fc79a', label:'Moderado', feedback:'Buen trabajo — hay margen para crecer. Subimos gradualmente.', adj:{ f:1.05, msg:'Subo los pesos +5%. Progresión sólida.' }},
  { range:[6,7], color:'#e8b64c', label:'Desafiante', feedback:'¡Perfecto! Este es el rango ideal para hipertrofia. El plan está bien calibrado.', adj:{ f:1.025, msg:'Subo +2.5% — progresión fina, estás en la zona ideal.' }},
  { range:[8,9], color:'#ff8a65', label:'Muy duro', feedback:'Muy intenso. Está bien de vez en cuando, pero si es frecuente hay que consolidar.', adj:{ f:1.0, msg:'Mantengo los pesos — consolida antes de subir.' }},
  { range:[10,10], color:'#ff5a45', label:'Al límite', feedback:'Demasiado. El objetivo es rendir sostenidamente, no destruirte. Bajamos un poco.', adj:{ f:0.925, msg:'Bajo los pesos -7.5% para que rindas bien cada sesión.' }},
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
  if (!pendingRpeAdjustment || !pendingRpeDate) return closeRpe();
  const dow = new Date(pendingRpeDate + 'T12:00:00').getDay();
  const workout = DAY_WORKOUT_MAP[dow];
  const nextWeek = STATE.currentWeek + 1;
  if (workout && pendingRpeAdjustment.f !== 1.0) {
    workout.exercises.forEach(ex => {
      if (ex.progression) {
        const base = getSuggestedWeight(ex.progression, nextWeek);
        if (base) setWeight(ex.id, nextWeek, Math.round(base * pendingRpeAdjustment.f * 2) / 2);
      }
    });
    showToast(`✅ Plan ajustado para la semana ${nextWeek}`);
  }
  closeRpe();
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
  const doneCount = days.filter(x => STATE.completedDays[x.dateStr] && DAY_WORKOUT_MAP[x.dow]).length;
  const workCount = days.filter(x => DAY_WORKOUT_MAP[x.dow]).length;

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
          <div style="font-weight:600;font-size:14px">${w ? w.emoji + ' ' + w.name : 'Descanso'}</div>
          <div style="font-size:11.5px;color:var(--text2);margin-top:2px">${w ? w.focus : dow === 3 ? 'Activo opcional' : 'Recuperación'}</div>
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
  const week = STATE.currentWeek;
  const modal = document.getElementById('day-modal-content');
  const adj = getCycleAdj();
  const rpe = RPE_DATA[dateStr];
  const isDone = STATE.completedDays[dateStr];

  if (!workout) {
    modal.innerHTML = `
      <div class="handle"></div>
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:46px;margin-bottom:12px">🌙</div>
        <div style="font-family:var(--f-display);font-size:19px;font-weight:600">${dayLabel}</div>
        <div style="color:var(--text2);margin-top:8px;font-size:13.5px">Día de recuperación</div>
      </div>
      <button class="btn btn-secondary btn-full" onclick="closeDayModal()">Cerrar</button>`;
  } else {
    modal.innerHTML = `
      <div class="handle"></div>
      <div style="font-size:10.5px;color:var(--coral);font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${dayLabel} · Semana ${week}</div>
      <h2 style="margin:4px 0 2px">${workout.emoji} ${workout.name}</h2>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${workout.focus} · ${workout.duration}</div>
      ${isDone ? '<span class="pill pill-sage">✓ Completado</span>' : ''}
      ${rpe ? `<span class="pill" style="background:${getRpeConfig(rpe.rpe).color}22;color:${getRpeConfig(rpe.rpe).color}">Dificultad ${rpe.rpe}/10</span>` : ''}

      <div style="margin:16px 0 8px;font-size:10.5px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700">Ejercicios</div>
      ${workout.exercises.map(ex => {
        const raw = ex.progression ? getSuggestedWeight(ex.progression, week) : null;
        const w = raw ? Math.round(raw * adj.factor * 2) / 2 : null;
        return `
        <div style="background:var(--bg3);border-radius:var(--r-md);padding:13px;margin-bottom:8px;${ex.isGlute ? 'box-shadow:inset 3px 0 0 var(--coral)' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div>
              <div style="font-weight:600;font-size:13.5px">${ex.isGlute ? '🍑 ' : ''}${ex.name}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${ex.equipment}</div>
            </div>
            ${w ? `<div style="text-align:right;flex-shrink:0"><div style="font-family:var(--f-display);font-weight:800;font-size:15px">${w}<span style="font-size:10px;font-weight:400;color:var(--text3)"> kg</span></div></div>` : ''}
          </div>
          <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">
            <span class="pill pill-gray">${ex.sets}×${ex.reps}</span>
            ${ex.tempo && ex.tempo !== '—' ? `<span class="pill pill-gray">${ex.tempo}</span>` : ''}
            ${ex.isWarmup ? '<span class="pill pill-gold">Activación</span>' : ''}
          </div>
        </div>`;
      }).join('')}
      ${workout.cardio ? `<div style="background:var(--gold-dim);border:1px solid rgba(232,182,76,.3);border-radius:var(--r-md);padding:12px;margin-top:4px"><div style="font-weight:700;color:var(--gold);font-size:13px">🏃 ${workout.cardio.type} ${workout.cardio.duration} min</div><div style="font-size:12px;color:var(--text2);margin-top:2px">${workout.cardio.desc}</div></div>` : ''}
      <button class="btn btn-secondary btn-full" style="margin-top:14px" onclick="closeDayModal()">Cerrar</button>`;
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
  STATE.checkins.push({ ...ciDraft, ts: Date.now() });
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
  ({today: renderToday, week: renderWeek, progress: renderProgress, profile: renderProfile, face: renderFace})[name]();
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
  const pct = Math.round(week / 26 * 100);
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
    <div class="hdr"><h1>Progreso</h1><p>Semana ${week} de 26 · ${pct}% del plan</p></div>

    <div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <span style="font-weight:600;font-size:14px">${getFaseName(week)}</span>
        <span class="pill pill-coral">S${week}/26</span>
      </div>
      <div style="height:7px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-bottom:7px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--coral),var(--gold));border-radius:4px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3)"><span>F1</span><span>F2</span><span>F3</span></div>
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
        <div style="font-weight:700;font-size:14px;color:var(--gold)">Check-in mensual pendiente</div>
        <div style="font-size:12px;color:var(--text2)">Peso, medidas y fotos</div>
      </div><div style="color:var(--gold)">→</div>
    </div>` : ''}

    <div class="sect">Levantamientos clave — datos reales</div>
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

    <div class="sect">Mi plan</div>
    <div class="card">
      ${[['Semana', `${week} de 26`], ['Fase', getFaseName(week)],
         ['Inicio', STATE.planStartDate ? getMonthDay(STATE.planStartDate) : '—'],
         ['Check-ins hechos', STATE.checkins.length],
         ['Ciclo', adj.label], ['Viaje', STATE.travelMode ? '✈️ Pausado' : 'Activo']]
        .map(([l, v]) => `<div class="p-row"><span class="p-label">${l}</span><span class="p-value">${v}</span></div>`).join('')}
    </div>
    <div style="height:16px"></div>
  `;
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
  const end = new Date(start.getTime() + 70 * 60000);
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
  STATE.currentWeek = computeWeek();
  document.getElementById('onboarding').style.display = 'none';
  renderToday();
  showToast(`🚀 Semana ${STATE.currentWeek} — ¡vamos!`);
}

function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
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

// ══════════════════════════════════════════════════════
// SCREEN: YOGA FACIAL
// ══════════════════════════════════════════════════════
const FACE_LOG = JSON.parse(localStorage.getItem('faceLog') || '{}'); // { dateStr: { exId: true, ... } }
const FACE_METRICS = JSON.parse(localStorage.getItem('faceMetrics') || '{}'); // { dateStr: { headache: bool, tension: 1-10 } }

function getFaceDailyQuote() {
  const seed = parseInt(today().replace(/-/g,''));
  return FACE_QUOTES[seed % FACE_QUOTES.length];
}

function getFaceStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const log = FACE_LOG[ds];
    const didAny = log && Object.values(log).some(Boolean);
    if (didAny) streak++;
    else if (ds !== today()) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function toggleFaceExercise(exId) {
  const ds = today();
  if (!FACE_LOG[ds]) FACE_LOG[ds] = {};
  FACE_LOG[ds][exId] = !FACE_LOG[ds][exId];
  save('faceLog', FACE_LOG);
  renderFace();
  if (FACE_LOG[ds][exId] && navigator.vibrate) navigator.vibrate(25);
}

function logFaceMetric(field, val) {
  const ds = today();
  if (!FACE_METRICS[ds]) FACE_METRICS[ds] = {};
  FACE_METRICS[ds][field] = val;
  save('faceMetrics', FACE_METRICS);
  renderFace();
}

function getFaceWeekSummary() {
  const days = [];
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(ds);
    d.setDate(d.getDate() - 1);
  }
  const headaches = days.filter(ds => FACE_METRICS[ds]?.headache).length;
  const tensions = days.map(ds => FACE_METRICS[ds]?.tension).filter(t => t != null);
  const avgTension = tensions.length ? (tensions.reduce((a,b) => a+b, 0) / tensions.length).toFixed(1) : null;
  const doneDays = days.filter(ds => FACE_LOG[ds] && Object.values(FACE_LOG[ds]).some(Boolean)).length;
  return { headaches, avgTension, doneDays };
}

function renderFace() {
  const el = document.getElementById('screen-face');
  const ds = today();
  const todayLog = FACE_LOG[ds] || {};
  const streak = getFaceStreak();
  const todayMetric = FACE_METRICS[ds] || {};
  const summary = getFaceWeekSummary();

  let totalEx = 0, doneEx = 0;
  FACE_BLOCKS.forEach(b => b.exercises.forEach(e => { totalEx++; if (todayLog[e.id]) doneEx++; }));

  el.innerHTML = `
    <div class="hero">
      <div class="hero-week" style="color:var(--rose)">RUTINA DIARIA</div>
      <div class="hero-title">🌿 Yoga Facial</div>
      <div class="hero-sub">Definición de mandíbula + relajación del bruxismo</div>
    </div>

    <div class="streak-row">
      <div class="streak-chip ${streak >= 3 ? 'fire' : ''}"><strong>${streak >= 3 ? '🔥' : ''}${streak}</strong><small>Racha</small></div>
      <div class="streak-chip"><strong>${doneEx}/${totalEx}</strong><small>Hoy</small></div>
      <div class="streak-chip"><strong>${summary.doneDays}/7</strong><small>Esta semana</small></div>
    </div>

    <div class="quote-card"><div class="quote-text">${getFaceDailyQuote()}</div></div>

    <div class="sect">Check-in diario</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:600;font-size:13.5px">¿Dolor de cabeza hoy?</span>
        <div style="display:flex;gap:6px">
          <button class="btn ${todayMetric.headache === true ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="logFaceMetric('headache', true)">Sí</button>
          <button class="btn ${todayMetric.headache === false ? 'btn-secondary' : 'btn-ghost'} btn-sm" onclick="logFaceMetric('headache', false)">No</button>
        </div>
      </div>
      <div style="font-weight:600;font-size:13.5px;margin-bottom:8px">Tensión mandibular al despertar</div>
      <div style="display:flex;gap:5px">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button onclick="logFaceMetric('tension',${n})" style="flex:1;aspect-ratio:1;border-radius:8px;border:1.5px solid ${todayMetric.tension === n ? 'var(--rose)' : 'var(--border)'};background:${todayMetric.tension === n ? 'var(--rose-dim)' : 'var(--bg4)'};color:${todayMetric.tension === n ? 'var(--rose)' : 'var(--text2)'};font-size:11px;font-weight:700;cursor:pointer">${n}</button>
        `).join('')}
      </div>
    </div>

    ${summary.headaches > 0 || summary.avgTension ? `
    <div style="margin:0 16px 12px;background:var(--sky-dim);border:1px solid rgba(125,184,232,.3);border-radius:var(--r-md);padding:12px 15px;font-size:12.5px;color:var(--text2)">
      📊 Esta semana: ${summary.headaches} día(s) con dolor de cabeza${summary.avgTension ? ` · tensión promedio ${summary.avgTension}/10` : ''}
    </div>` : ''}

    ${FACE_BLOCKS.map(block => `
      <div class="sect" style="color:${block.color}">${block.title}</div>
      <div class="card-note" style="margin:0 16px 10px;font-size:12px;color:var(--text2);padding:0 4px">${block.subtitle}</div>
      ${block.exercises.map(ex => renderFaceExercise(ex, block.color, todayLog)).join('')}
    `).join('')}

    <div style="height:16px"></div>
  `;
}

function renderFaceExercise(ex, color, todayLog) {
  const done = todayLog[ex.id];
  return `
  <div class="exc ${done ? 'done' : ''}" style="${!done ? `box-shadow:inset 3px 0 0 ${color}44` : ''}">
    <div class="exc-head" onclick="toggleFaceExercise('${ex.id}')" style="cursor:pointer">
      <div class="exc-num" style="${done ? 'background:var(--sage-dim);color:var(--sage)' : ''}">${done ? '✓' : '○'}</div>
      <div class="exc-info">
        <div class="exc-name">${ex.name}</div>
        <div class="exc-meta">
          ${ex.sets !== '—' ? `<span class="pill pill-gray">${ex.sets}${ex.reps ? '×'+ex.reps : ''}</span>` : ''}
          ${ex.hold && ex.hold !== '—' ? `<span class="pill pill-gray">⏱ ${ex.hold}</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.5">${ex.notes}</div>
        ${ex.videoId && FACE_VIDEOS[ex.videoId] ? `
        <a href="https://www.youtube.com/watch?v=${FACE_VIDEOS[ex.videoId]}" target="_blank" rel="noopener" class="photo-btn" style="color:#ff6b5e;border-color:rgba(255,90,69,.3);text-decoration:none;margin-top:8px" onclick="event.stopPropagation()">
          ▶ Ver video del ejercicio
        </a>` : ''}
      </div>
    </div>
  </div>`;
}
