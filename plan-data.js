// ═══════════════════════════════════════════════════════
// PLAN "GLOW UP" — ANA SALAS · 12 semanas
// Prioridad: postura → cintura → glúteos → definición
// 5 días de fuerza · sesiones ≤ 90 min · sobrecarga por última carga real
// ═══════════════════════════════════════════════════════

const PLAN_VERSION = '2';
const TOTAL_WEEKS = 12;
const DELOAD_WEEKS = [7];            // + descarga anticipada si la activas (fatiga/dolor)
const TEST_WEEK = 12;               // semana de marcas
const CHECKIN_WEEKS = [1, 5, 9, 12];

function getFase(week) { return week <= 4 ? 1 : week <= 8 ? 2 : 3; }
function isDeload(week) {
  const extra = parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('extraDeloadWeek')) || '0');
  return DELOAD_WEEKS.includes(week) || extra === week;
}
// Esfuerzo: semana 1 de ajuste; desde la 2, básicos a 1–2 reps del fallo y aislamiento a 0–1
function rirFor(week, ex) {
  if (week === 1) return 'RIR 2–3 (semana de ajuste)';
  if (isDeload(week)) return 'RIR 3 (descarga)';
  if (ex && ex.iso) return 'RIR 0–1 (casi al fallo)';
  return 'RIR 1–2';
}

const FASES = {
  1: { name: 'Fase 1 · Base y postura', hipo: { rounds: 3, sec: 10 }, cardio: 15, incline: '8–10%' },
  2: { name: 'Fase 2 · Construcción',  hipo: { rounds: 4, sec: 15 }, cardio: 15, incline: '10–12%' },
  3: { name: 'Fase 3 · Definición',    hipo: { rounds: 5, sec: 20 }, cardio: 15, incline: '10–12%' },
};

// Ajuste por fase del ciclo menstrual
const CYCLE_ADJUSTMENTS = {
  menstruation: { factor: 0.88, label: 'Menstruación', color: '#e57373', tip: 'Reduce 10-12% si hay malestar. Técnica sobre peso.' },
  follicular:   { factor: 1.05, label: 'Fase folicular', color: '#81c784', tip: '¡Semana de subir peso! Tu mejor momento del mes.' },
  ovulation:    { factor: 1.08, label: 'Ovulación', color: '#64b5f6', tip: 'Pico de fuerza. Intenta tus máximos históricos.' },
  luteal_early: { factor: 1.00, label: 'Lútea temprana', color: '#ffb74d', tip: 'Mantén la carga de la semana anterior.' },
  luteal_late:  { factor: 0.90, label: 'Lútea tardía / SPM', color: '#f06292', tip: 'Baja 10%. Más descanso. Es fisiológico, no debilidad.' },
};

// ═══════════════════════════════════════════════════════
// BLOQUES REUTILIZABLES (checklists, sin carga)
// ═══════════════════════════════════════════════════════
const WARMUP_LOWER = [
  { id: 'wl-cardio',  name: 'Bici o caminadora suave', dose: '4 min', note: 'Sube la temperatura de rodillas y caderas. Ritmo cómodo.' },
  { id: 'wl-lateral', name: 'Caminata lateral con mini-banda', dose: '2×12 pasos por lado', note: 'Activa el glúteo medio, que evita que la rodilla se meta hacia dentro.' },
];
const WARMUP_UPPER = [
  { id: 'wu-er',      name: 'Rotación externa con banda o polea', dose: '2×15 por lado', note: 'Codo pegado a la costilla. Prepara el manguito rotador, lo que más protege el hombro.' },
  { id: 'wu-pullapart',name: 'Separaciones de banda (pull-apart)', dose: '2×15', note: 'Junta las escápulas hacia atrás y abajo.' },
];
const COOLDOWN_LOWER = [
  { id: 'cl-quad',  name: 'Estiramiento de cuádriceps', dose: '2×30 s por lado', note: 'Rodilla hacia abajo, pelvis neutra (no arquees la espalda).' },
  { id: 'cl-flexor',name: 'Flexor de cadera en media rodilla', dose: '2×30 s por lado', note: 'Aprieta el glúteo de atrás. Clave para la postura en S.' },
  { id: 'cl-ham',   name: 'Isquiotibiales', dose: '2×30 s por lado', note: 'Pierna estirada, espalda larga.' },
  { id: 'cl-glute', name: 'Glúteo en figura 4', dose: '2×30 s por lado', note: 'Acostada. Respira lento.' },
  { id: 'cl-calf',  name: 'Pantorrillas', dose: '1×30 s por lado', note: 'Talón al piso.' },
];
const COOLDOWN_UPPER = [
  { id: 'cu-pec',   name: 'Pecho en marco de puerta', dose: '2×30 s por lado', note: 'Codo a 90°. Abre el pecho: ayuda a los hombros caídos.' },
  { id: 'cu-lat',   name: 'Dorsal en postura del niño', dose: '2×30 s', note: 'Brazos largos al frente, caderas atrás.' },
  { id: 'cu-neck',  name: 'Cuello lateral (trapecio superior)', dose: '2×30 s por lado', note: 'Suave, sin jalar con la mano. Útil si aprietas la mandíbula.' },
  { id: 'cu-thor',  name: 'Extensión torácica sobre banco/rodillo', dose: '1×8 respiraciones', note: 'Manos tras la nuca, codos juntos. Solo la espalda alta se arquea.' },
  { id: 'cu-cross', name: 'Hombro cruzado', dose: '1×30 s por lado', note: 'Hombro abajo, lejos de la oreja.' },
];

// Rutina diaria (se muestra todos los días)
const DAILY_POSTURA = [
  { id: 'dp-chin',  name: 'Retracción de mentón (chin tuck)', dose: '2×10 · pausa 5 s', note: 'Mentón hacia atrás como haciendo “doble papada”. Corrige la cabeza hacia adelante. Mirada al frente.' },
  { id: 'dp-wall',  name: 'Ángeles en la pared', dose: '2×10', note: 'Cabeza, espalda alta y glúteos pegados. Sube y baja brazos sin despegar nada.' },
  { id: 'dp-pec',   name: 'Pecho en marco de puerta', dose: '2×30 s', note: 'Abre el pecho para recuperar los hombros hacia atrás.' },
  { id: 'dp-flexor',name: 'Flexor de cadera en media rodilla', dose: '2×30 s por lado', note: 'Glúteo apretado, costillas abajo. Reduce el arco lumbar (“S”) y el abdomen salido.' },
  { id: 'dp-tilt',  name: 'Báscula pélvica acostada', dose: '2×10 · pausa 5 s', note: 'Aplana la zona lumbar contra el piso exhalando. Enseña a la pelvis a ponerse neutra.' },
];
function hipoDose(week) { const h = FASES[getFase(week)].hipo; return `${h.rounds} rondas · apnea ${h.sec} s`; }
const DAILY_HIPO = [
  { id: 'dh-pie',   name: 'Hipopresivo de pie (postura base)', dose: w => hipoDose(w), note: 'Pies al ancho de caderas, rodillas suaves, tronco ligeramente inclinado, manos en los muslos. 1) Inhala por nariz. 2) Exhala TODO el aire por la boca. 3) Con los pulmones vacíos, simula inspirar: abre las costillas sin que entre aire. 4) El abdomen se mete y sube hacia las costillas. Sostén y luego inspira suave.' },
  { id: 'dh-cuad',  name: 'Hipopresivo en cuadrupedia', dose: w => hipoDose(w), note: 'Misma técnica, apoyada en manos y rodillas, espalda neutra. Facilita sentir la succión del abdomen.' },
  { id: 'dh-vac',   name: 'Vacuum abdominal sentada', dose: w => `${FASES[getFase(w)].hipo.rounds} × ${FASES[getFase(w)].hipo.sec} s`, note: 'Exhala todo, mete el ombligo hacia la columna y sostén. Trabaja el transverso (la “faja natural”) que marca la cintura.' },
];
const HIPO_EXPECT = 'Expectativa real: ayudan al control del core y a la sensación de abdomen “metido”, pero la evidencia es limitada y no tensan la piel. La piel mejora sobre todo con la pérdida de grasa gradual, el músculo debajo y el tiempo.';
const HIPO_SAFETY = 'Mejor en ayunas o 2 h después de comer. Para si te mareas. No los hagas si estás embarazada, con hipertensión no controlada o hernia; ante dudas, consulta a un fisioterapeuta de suelo pélvico.';

// Cardio post-sesión (caminadora con inclinación, sin HIIT)
function cardioFor(week) {
  const f = FASES[getFase(week)];
  const mins = isDeload(week) ? Math.max(10, f.cardio - 5) : f.cardio;
  return { type: 'Caminadora inclinada', duration: mins, desc: `Inclinación ${f.incline} · 5–5.5 km/h · sin sujetarte de las barras. Ritmo en el que puedas hablar entrecortado.` };
}

const DOSE_URL = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);

// ═══════════════════════════════════════════════════════
// RUTINAS — ejercicios principales (con registro de series)
// repMin/repMax: doble progresión · inc: salto de carga en kg
// ═══════════════════════════════════════════════════════
const WORKOUTS = {
  1: {
    key: 'lowerA', name: 'Glúteos + Isquios', emoji: '🍑', color: '#c62828', lightColor: '#ffebee',
    duration: '~60 min', cardio: null, warmup: WARMUP_LOWER, cooldown: COOLDOWN_LOWER,
    focus: 'Hip thrust · RDL · Prensa · Pantorrilla',
    tip: 'Primer ejercicio: haz 2 series de aproximación (50% y 75% del peso) antes de las efectivas.',
    exercises: [
      { id: 'hip-thrust', name: 'Hip thrust con barra', equipment: 'Banco + barra/discos o máquina', q: 'hip thrust técnica glúteo',
        sets: 4, reps: '8–10', repMin: 8, repMax: 10, inc: 5, tempo: '2-1-1', rest: '2 min', isGlute: true,
        notes: 'Costillas abajo, mentón al pecho, pausa 1 s apretando arriba. Prioridad #1 del plan.' },
      { id: 'rdl', name: 'Peso muerto rumano', equipment: 'Barra o mancuernas', q: 'peso muerto rumano técnica glúteo',
        sets: 3, reps: '8–10', repMin: 8, repMax: 10, inc: 2.5, tempo: '3-0-1', rest: '2 min', isGlute: true,
        notes: 'Cadera atrás, espalda neutra, barra pegada a las piernas. Baja hasta sentir el isquio.' },
      { id: 'prensa-pies-altos', ss: 'A1', name: 'Prensa 45° pies altos y abiertos', equipment: 'Prensa de piernas', q: 'prensa pies altos glúteo técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 5, tempo: '3-0-1', rest: '15 seg', isGlute: true,
        notes: 'Rango sin que la pelvis se despegue. Rodillas alineadas con los pies.',
        alt: 'Si molesta la rodilla: reduce el rango y baja la carga.' },
      { id: 'n2-pantorrilla-sentada', ss: 'A2', iso: true, name: 'Elevación de pantorrillas sentada', equipment: 'Máquina de sóleo sentada', q: 'elevación de pantorrillas sentado técnica',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 5, tempo: '1-2-3', rest: '90 seg', isGlute: false,
        notes: 'Pausa 2 s abajo en estiramiento. Trabaja el sóleo; el jueves trabajas el gemelo de pie.' },
      { id: 'curl-femoral', ss: 'B1', iso: true, name: 'Curl femoral tumbado', equipment: 'Máquina', q: 'curl femoral tumbado técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 2.5, tempo: '2-0-3', rest: '15 seg', isGlute: false,
        notes: '3 s bajando. Cadera pegada al banco.' },
      { id: 'abductora', ss: 'B2', iso: true, name: 'Abductora sentada inclinada hacia adelante', equipment: 'Máquina abductora', q: 'abductora máquina glúteo medio',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '75 seg', isGlute: true,
        notes: 'Inclina el torso hacia adelante para cargar glúteo medio (la curva lateral de la cadera).' },
      { id: 'n2-deadbug', ss: 'C1', name: 'Dead bug', equipment: 'Colchoneta', q: 'dead bug ejercicio core', bw: true, unit: 'reps',
        sets: 3, reps: '8–10 por lado', repMin: 8, repMax: 10, inc: 0, tempo: 'lento', rest: '15 seg', isCore: true,
        notes: 'Lumbar pegada al suelo, exhala al estirar. Activa el transverso.' },
      { id: 'n2-plancha', ss: 'C2', name: 'Plancha', equipment: 'Colchoneta', q: 'plancha abdominal técnica', bw: true, unit: 'seg',
        sets: 3, reps: '30–45 seg', repMin: 30, repMax: 45, inc: 0, tempo: '—', rest: '60 seg', isCore: true,
        notes: 'Glúteo y abdomen apretados, sin hundir la lumbar. Registra los segundos.' },
    ],
  },
  2: {
    key: 'upperA', name: 'Espalda + Postura', emoji: '🧍‍♀️', color: '#1565c0', lightColor: '#e3f2fd',
    duration: '~55 min + 15 de cardio', cardio: true, warmup: WARMUP_UPPER, cooldown: COOLDOWN_UPPER,
    focus: 'Jalones · Remos · Hombro posterior',
    tip: 'Piensa en llevar los codos hacia la cadera y las escápulas abajo y atrás. Esta sesión corrige hombros caídos.',
    exercises: [
      { id: 'jalon', name: 'Jalón al pecho agarre neutro', equipment: 'Polea alta', q: 'jalón al pecho agarre neutro técnica',
        sets: 4, reps: '8–12', repMin: 8, repMax: 12, inc: 2.5, tempo: '2-1-2', rest: '2 min', isGlute: false,
        notes: 'Pecho arriba, escápulas abajo. Sin balanceo.' },
      { id: 'n2-remo-pecho', ss: 'A1', name: 'Remo con pecho apoyado', equipment: 'Máquina o T-bar', q: 'remo con pecho apoyado técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 2.5, tempo: '2-1-2', rest: '15 seg', isGlute: false,
        notes: 'Pausa 1 s apretando la espalda alta.' },
      { id: 'n2-press-inclinado', ss: 'A2', name: 'Press inclinado con mancuernas', equipment: 'Banco inclinado 30°', q: 'press inclinado mancuernas técnica',
        sets: 3, reps: '8–12', repMin: 8, repMax: 12, inc: 2, tempo: '2-0-1', rest: '90 seg', isGlute: false,
        notes: 'Escápulas retraídas contra el banco. Codos ~45° del torso.',
        alt: 'Si molesta el hombro: usa agarre neutro o la máquina.' },
      { id: 'face-pull', ss: 'B1', iso: true, name: 'Face pull', equipment: 'Polea con cuerda', q: 'face pull técnica hombro posterior',
        sets: 3, reps: '15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '15 seg', isGlute: false,
        notes: 'Jala hacia la frente abriendo codos. Pausa 1 s. El mejor ejercicio para la postura de hombros.' },
      { id: 'n2-pajaros', ss: 'B2', iso: true, name: 'Pájaros en máquina (deltoide posterior)', equipment: 'Pec deck inverso', q: 'pec deck inverso deltoide posterior',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '60 seg', isGlute: false,
        notes: 'Brazos casi rectos; el movimiento sale de los hombros, no de los trapecios.' },
      { id: 'n2-pallof', ss: 'C1', name: 'Pallof press', equipment: 'Polea', q: 'pallof press técnica core', unit: 'reps',
        sets: 3, reps: '10 por lado', repMin: 10, repMax: 12, inc: 2.5, tempo: '2-2-2', rest: '15 seg', isCore: true,
        notes: 'Anti-rotación: marca la cintura. No dejes que el cable te gire.' },
      { id: 'n2-lateral-plank', ss: 'C2', name: 'Plancha lateral', equipment: 'Colchoneta', q: 'plancha lateral técnica', bw: true, unit: 'seg',
        sets: 3, reps: '20–30 seg por lado', repMin: 20, repMax: 30, inc: 0, tempo: '—', rest: '60 seg', isCore: true,
        notes: 'Oblicuos + glúteo medio. Caderas arriba y alineadas.' },
    ],
  },
  4: {
    key: 'lowerB', name: 'Cuádriceps + Glúteos', emoji: '🦵', color: '#6a1b9a', lightColor: '#f3e5f5',
    duration: '~65 min', cardio: null, warmup: WARMUP_LOWER, cooldown: COOLDOWN_LOWER,
    focus: 'Sentadilla · Zancada · Glúteo · Pantorrilla',
    tip: 'Si tus rodillas molestan, mantén el rango cómodo y la técnica lenta. Estar en control importa más que el peso.',
    exercises: [
      { id: 'sentadilla-smith', name: 'Sentadilla en Smith', equipment: 'Máquina Smith', q: 'sentadilla Smith técnica pies adelante',
        sets: 4, reps: '8–10', repMin: 8, repMax: 10, inc: 5, tempo: '3-0-1', rest: '2 min', isGlute: true,
        notes: 'Pies un poco adelante de la barra, talones pesados. Baja hasta paralelo.',
        alt: 'Si molesta la rodilla: sentadilla goblet al cajón.' },
      { id: 'split-squat', name: 'Zancada búlgara', equipment: 'Mancuernas + banco', q: 'sentadilla búlgara glúteo técnica',
        sets: 3, reps: '8–10 por lado', repMin: 8, repMax: 10, inc: 2, tempo: '3-0-1', rest: '90 seg', isGlute: true,
        notes: 'Torso ligeramente inclinado para más glúteo. Peso por todo el pie delantero.',
        alt: 'Si molesta la rodilla: zancada hacia atrás (reverse lunge).' },
      { id: 'extension-cuad', ss: 'A1', iso: true, name: 'Extensión de cuádriceps', equipment: 'Máquina', q: 'extensión de cuádriceps técnica rodilla',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-3', rest: '15 seg', isGlute: false,
        notes: 'Sube controlado y baja lento. Usa un rango sin dolor.',
        alt: 'Si hay dolor en rodilla, sáltalo hoy.' },
      { id: 'curl-femoral-sentado', ss: 'A2', iso: true, name: 'Curl femoral sentado', equipment: 'Máquina', q: 'curl femoral sentado técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 2.5, tempo: '2-0-3', rest: '75 seg', isGlute: false,
        notes: '3 s bajando.' },
      { id: 'n2-patada', ss: 'B1', iso: true, name: 'Patada de glúteo en polea', equipment: 'Polea baja + tobillera', q: 'patada de glúteo polea técnica',
        sets: 3, reps: '12–15 por lado', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '15 seg', isGlute: true,
        notes: 'No arquees la espalda; mueve solo la cadera. Pausa 1 s arriba.' },
      { id: 'n2-abduccion-polea', ss: 'B2', iso: true, name: 'Abducción de pie en polea', equipment: 'Polea baja + tobillera', q: 'abducción de cadera en polea de pie glúteo medio',
        sets: 2, reps: '15 por lado', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '60 seg', isGlute: true,
        notes: 'Torso ligeramente inclinado, pierna hacia afuera y un poco atrás. Glúteo medio: la curva lateral de la cadera.' },
      { id: 'pantorrillas', iso: true, name: 'Elevación de pantorrillas', equipment: 'Máquina de pie', q: 'elevación de pantorrillas técnica',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 5, tempo: '1-1-3', rest: '45 seg', isGlute: false,
        notes: 'Rango completo. 3 s bajando.' },
      { id: 'n2-crunch-inverso', name: 'Crunch inverso', equipment: 'Banco/colchoneta', q: 'crunch inverso técnica abdomen', bw: true, unit: 'reps',
        sets: 3, reps: '10–15', repMin: 10, repMax: 15, inc: 0, tempo: 'lento', rest: '45 seg', isCore: true,
        notes: 'Sube la pelvis enrollando, sin balanceo. Abdomen inferior.' },
    ],
  },
  5: {
    key: 'upperB', name: 'Hombros + Cintura', emoji: '✨', color: '#00838f', lightColor: '#e0f7fa',
    duration: '~60 min + 15 de cardio', cardio: true, warmup: WARMUP_UPPER, cooldown: COOLDOWN_UPPER,
    focus: 'Hombros · Espalda · Brazos',
    tip: 'Hombros redondos y espalda ancha hacen que la cintura se vea más pequeña.',
    exercises: [
      { id: 'press-hombro', name: 'Press de hombro con mancuernas', equipment: 'Banco con respaldo', q: 'press de hombros con mancuernas técnica',
        sets: 3, reps: '8–10', repMin: 8, repMax: 10, inc: 2, tempo: '2-0-1', rest: '2 min', isGlute: false,
        notes: 'Costillas abajo, no arquees la espalda. Codos ligeramente adelante.',
        alt: 'Si molesta el hombro: press neutro o landmine.' },
      { id: 'remo-mancuerna', ss: 'A1', name: 'Remo con mancuerna a una mano', equipment: 'Mancuerna + banco', q: 'remo con mancuerna una mano técnica',
        sets: 3, reps: '10–12 por lado', repMin: 10, repMax: 12, inc: 2, tempo: '2-1-2', rest: '15 seg', isGlute: false,
        notes: 'Espalda plana. Lleva el codo a la cadera.' },
      { id: 'elev-laterales', ss: 'A2', iso: true, name: 'Elevaciones laterales', equipment: 'Mancuernas o polea', q: 'elevaciones laterales técnica hombro',
        sets: 4, reps: '12–15', repMin: 12, repMax: 15, inc: 1, tempo: '2-0-2', rest: '75 seg', isGlute: false,
        notes: 'Codo ligeramente flexionado, sube hasta la altura del hombro. Hombro ancho = cintura marcada.' },
      { id: 'n2-remo-polea', name: 'Remo en polea baja agarre neutro', equipment: 'Polea baja', q: 'remo polea baja técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 2.5, tempo: '2-1-2', rest: '75 seg', isGlute: false,
        notes: 'Pecho abierto, sin balancear el torso.' },
      { id: 'pushdown', ss: 'B1', iso: true, name: 'Extensión de tríceps en polea', equipment: 'Polea alta', q: 'extensión de tríceps polea técnica',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-0-2', rest: '15 seg', isGlute: false,
        notes: 'Codos pegados al cuerpo.' },
      { id: 'curl-biceps', ss: 'B2', iso: true, name: 'Curl de bíceps con mancuernas', equipment: 'Mancuernas', q: 'curl de bíceps mancuernas técnica',
        sets: 3, reps: '10–12', repMin: 10, repMax: 12, inc: 1, tempo: '2-0-2', rest: '60 seg', isGlute: false,
        notes: 'Sin balanceo.' },
      { id: 'n2-crunch-polea', ss: 'C1', name: 'Crunch en polea (de rodillas)', equipment: 'Polea alta + cuerda', q: 'crunch en polea de rodillas técnica',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '15 seg', isCore: true,
        notes: 'Enrolla la columna, no tires con los brazos.' },
      { id: 'n2-woodchop', ss: 'C2', name: 'Leñador en polea (woodchop)', equipment: 'Polea', q: 'woodchop polea oblicuos técnica', unit: 'reps',
        sets: 3, reps: '12 por lado', repMin: 10, repMax: 15, inc: 2.5, tempo: '2-0-2', rest: '60 seg', isCore: true,
        notes: 'Gira desde el torso, caderas estables. Cintura.' },
    ],
  },
  6: {
    key: 'glutePump', name: 'Glúteos Extra (bonus)', emoji: '🔥', color: '#ad1457', lightColor: '#fce4ec', optional: true,
    duration: '~45 min + 15 de cardio', cardio: true, warmup: WARMUP_LOWER, cooldown: COOLDOWN_LOWER,
    focus: 'Extra de volumen de glúteo',
    tip: 'Sesión extra: si un sábado no puedes, no pasa nada. Lo esencial (postura, cintura, glúteo pesado) ya lo hiciste de lunes a viernes.',
    exercises: [
      { id: 'n2-hip-thrust-1p', name: 'Hip thrust a una pierna', equipment: 'Banco + mancuerna sobre la cadera', q: 'hip thrust a una pierna técnica',
        sets: 3, reps: '10–12 por lado', repMin: 10, repMax: 12, inc: 2, tempo: '2-1-1', rest: '75 seg', isGlute: true,
        notes: 'Empieza sin peso; cuando hagas 12 por lado limpias, pon una mancuerna sobre la cadera. Pausa 1 s arriba.' },
      { id: 'n2-hiperextension', ss: 'A1', name: 'Hiperextensión 45° enfocada en glúteo', equipment: 'Banco romano', q: 'hiperextensión 45 glúteo técnica',
        sets: 3, reps: '12–15', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '15 seg', isGlute: true,
        notes: 'Redondea ligeramente la espalda alta y empuja con el glúteo. Peso opcional contra el pecho.' },
      { id: 'abductora-sab', ss: 'A2', iso: true, name: 'Abductora sentada (volumen)', equipment: 'Máquina abductora', q: 'abductora máquina glúteo medio',
        sets: 3, reps: '15–20', repMin: 15, repMax: 20, inc: 2.5, tempo: '2-1-2', rest: '75 seg', isGlute: true,
        notes: 'Llega cerca del fallo en la última serie.' },
      { id: 'n2-extension-cadera', iso: true, name: 'Extensión de cadera en máquina', equipment: 'Máquina de patada de glúteo', q: 'máquina patada de glúteo técnica',
        sets: 3, reps: '12–15 por lado', repMin: 12, repMax: 15, inc: 2.5, tempo: '2-1-2', rest: '60 seg', isGlute: true,
        notes: 'Pausa 1 s arriba. No hiperextiendas la lumbar.' },
      { id: 'n2-birddog', name: 'Bird-dog con pausa', equipment: 'Colchoneta', q: 'bird dog ejercicio técnica', bw: true, unit: 'reps',
        sets: 3, reps: '8–10 por lado', repMin: 8, repMax: 10, inc: 0, tempo: 'pausa 3 s', rest: '45 seg', isCore: true,
        notes: 'Pelvis quieta, como si llevaras una taza en la espalda.' },
    ],
  },
  0: null,
  3: null,
};

// 0=domingo … 6=sábado · 4 días esenciales (Lun, Mar, Jue, Vie) + sábado extra (opcional: lo menos importante va ahí)
const DAY_WORKOUT_MAP = {
  0: null,
  1: WORKOUTS[1],
  2: WORKOUTS[2],
  3: null,
  4: WORKOUTS[4],
  5: WORKOUTS[5],
  6: WORKOUTS[6],
};

// Mensajes motivacionales
const MOTIVATIONAL_MESSAGES = [
  "✨ Tu postura se construye hoy: hombros atrás, cabeza alta.",
  "🔥 El glow up no es magia: es repetirte cada día. ¡Vamos!",
  "🍑 Cada hip thrust bien hecho es una inversión en ti.",
  "⚡ Un entrenamiento más. Una versión mejor de ti.",
  "🎯 Disciplina es elegirte a ti misma todos los días.",
  "💎 Progreso, no perfección. Hoy sumas una serie más fuerte.",
  "🌟 Tu futura versión te agradecerá que entrenes hoy.",
  "🧘‍♀️ Respira, mete el abdomen, endereza la espalda. Eso ya es entrenar.",
  "🏆 Más fuerte que la semana pasada: ese es el único rival.",
  "💫 La cintura se marca con constancia, no con castigo.",
];
