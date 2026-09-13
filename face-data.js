// ═══════════════════════════════════════════════════════
// YOGA FACIAL — Rutina por días: papada + bruxismo
// ═══════════════════════════════════════════════════════

const FACE_VIDEOS = {
  'jawline-full':   'fLbsAAEsNQQ',  // Jawline Lift & Lower Face Firming - Face Yoga Full Routine
  'jawline-sculpt': 'nnUpOW3yDAQ',  // 10 Minute Jawline Sculpting Face Yoga
  'neck-fat-doc':   'JwFwel2B2rI',  // Get Rid of Neck Fat and Double Chin Without Surgery - Dr. Jon Saunders
  'tmj-doctorjo':   'SbJZXG4fsd4',  // TMJ Exercises & Stretches - Ask Doctor Jo
  'tmj-bobbrad':    'kpBc6wiEkQU',  // Simple TMJ Treatments - Bob & Brad
  'tmj-basics':     'EM18snVgV_c',  // TMJ Exercises #1
};

// ── BLOQUE DIARIO FIJO — Bruxismo y relajación ──────────
// Se muestra TODOS los días, sin excepción. Es el más importante para tus dolores de cabeza.
const FACE_DAILY_BRUXISMO = {
  title: '🧘‍♀️ Bruxismo y relajación — todos los días',
  subtitle: 'No se salta nunca, ni siquiera en día de descanso de papada',
  color: '#7db8e8',
  exercises: [
    { id: 'lengua-reposo', name: 'Postura de lengua en reposo', sets: '—', reps: 'Todo el día', hold: 'Hábito', videoId: null,
      notes: 'Punta de la lengua en el paladar detrás de los dientes frontales, dientes separados. Recuérdalo cada 2 horas.' },
    { id: 'goldfish', name: 'Goldfish exercise', sets: '6', reps: '6 (6 veces/día)', hold: '—', videoId: 'tmj-doctorjo',
      notes: 'Lengua en el paladar, abre la boca parcialmente sin desviar la mandíbula.' },
    { id: 'respiracion-mandibula', name: 'Respiración + mandíbula floja', sets: '6 rondas', reps: 'Inhala 5s / exhala 10s', hold: '—', videoId: 'tmj-bobbrad',
      notes: 'Antes de dormir. Deja caer la mandíbula floja en cada exhalación.' },
    { id: 'masaje-masetero', name: 'Auto-masaje del masetero', sets: '1', reps: '2 min', hold: '—', videoId: 'tmj-bobbrad',
      notes: 'Círculos con los dedos frente a la oreja, donde más se siente tensión.' },
  ],
};

// ── RUTINA POR DÍAS — Papada y definición (cuello/platisma) ──
// La intensidad se concentra en el platisma y el cuello — el músculo que
// realmente sostiene la papada — nunca en el masetero (masticación),
// para no empeorar el bruxismo.
const FACE_WEEK_MAP = {
  1: { // LUNES
    title: '💪 Neck Curls & Platisma — Base',
    subtitle: 'Semana 1-2 de intensidad · construye la base',
    color: '#e88ab0',
    exercises: [
      { id: 'neck-curl-lun', name: 'Neck curl-up (acostada)', sets: '3', reps: '15', hold: '2 seg arriba', videoId: 'neck-fat-doc',
        notes: 'Acostada, rodillas dobladas. Sube solo la barbilla hacia el techo (como un crunch pero con el cuello), sin despegar los hombros del piso. Trabaja platisma directamente.' },
      { id: 'chin-tuck-res-lun', name: 'Chin tuck resistido con mano', sets: '4', reps: '12', hold: '5 seg', videoId: 'jawline-full',
        notes: 'Mano bajo la barbilla haciendo resistencia leve mientras empujas la barbilla hacia abajo y atrás. No aprietes los dientes.' },
      { id: 'platysma-stretch-lun', name: 'Platysma stretch', sets: '3', reps: '15', hold: '10 seg', videoId: 'jawline-full',
        notes: 'Cabeza hacia atrás, labios cerrados sin apretar dientes, labio inferior estirado hacia arriba como puchero exagerado.' },
    ],
  },
  2: { // MARTES
    title: '🦒 Jaw Jut & Postura',
    subtitle: 'Semana 1-2 de intensidad',
    color: '#e88ab0',
    exercises: [
      { id: 'jaw-jut-mar', name: 'Jaw jut (mandíbula al frente)', sets: '3', reps: '12', hold: '5 seg', videoId: 'neck-fat-doc',
        notes: 'Empuja la mandíbula inferior hacia adelante sin abrir la boca ni apretar dientes. Sostén y regresa.' },
      { id: 'chin-lift-mar', name: 'Chin lift con resistencia', sets: '3', reps: '10', hold: '3 seg', videoId: 'jawline-sculpt',
        notes: 'Cabeza inclinada hacia atrás, cierra la boca lentamente presionando el labio inferior sobre el superior.' },
      { id: 'giraffe-mar', name: 'Giraffe neck stretch (lateral)', sets: '3', reps: '10 c/lado', hold: '15 seg', videoId: 'jawline-sculpt',
        notes: 'Inclina la cabeza al lado y ligeramente atrás, sintiendo el estiramiento del cuello contrario.' },
    ],
  },
  3: { // MIÉRCOLES — descanso de definición
    title: '🌙 Descanso de definición',
    subtitle: 'El cuello también necesita recuperarse — hoy solo bruxismo',
    color: '#5f5a68',
    exercises: [],
    isRest: true,
  },
  4: { // JUEVES — progresión del lunes
    title: '💪 Neck Curls & Platisma — Progresión',
    subtitle: 'Más reps y hold que el lunes',
    color: '#e88ab0',
    exercises: [
      { id: 'neck-curl-jue', name: 'Neck curl-up (acostada)', sets: '4', reps: '18', hold: '3 seg arriba', videoId: 'neck-fat-doc',
        notes: 'Mismo movimiento del lunes — sube la intensidad. Si sientes tensión en el cuello (no en la mandíbula), es correcto.' },
      { id: 'chin-tuck-res-jue', name: 'Chin tuck resistido con mano', sets: '4', reps: '15', hold: '6 seg', videoId: 'jawline-full',
        notes: 'Aumenta el hold un segundo respecto al lunes.' },
      { id: 'platysma-stretch-jue', name: 'Platysma stretch', sets: '4', reps: '18', hold: '12 seg', videoId: 'jawline-full',
        notes: 'Sostén 2 segundos más que el lunes.' },
    ],
  },
  5: { // VIERNES — progresión del martes
    title: '🦒 Jaw Jut & Postura — Progresión',
    subtitle: 'Más reps y hold que el martes',
    color: '#e88ab0',
    exercises: [
      { id: 'jaw-jut-vie', name: 'Jaw jut (mandíbula al frente)', sets: '4', reps: '15', hold: '6 seg', videoId: 'neck-fat-doc',
        notes: 'Progresión del martes.' },
      { id: 'chin-lift-vie', name: 'Chin lift con resistencia', sets: '4', reps: '12', hold: '4 seg', videoId: 'jawline-sculpt',
        notes: 'Progresión del martes.' },
      { id: 'giraffe-vie', name: 'Giraffe neck stretch (lateral)', sets: '3', reps: '12 c/lado', hold: '15 seg', videoId: 'jawline-sculpt',
        notes: 'Mantén el mismo hold, sube las repeticiones.' },
    ],
  },
  6: { // SÁBADO — rutina guiada completa + masaje
    title: '🎥 Rutina guiada completa + masaje',
    subtitle: 'Cierre de semana — sigue el video completo',
    color: '#e88ab0',
    exercises: [
      { id: 'guiada-sab', name: 'Face yoga — rutina completa jawline', sets: '1 ronda', reps: 'sigue el video', hold: '—', videoId: 'jawline-full',
        notes: 'Sigue el video paso a paso, incluye varias técnicas combinadas de la semana.' },
      { id: 'masaje-profundo-sab', name: 'Auto-masaje profundo de drenaje', sets: '1', reps: '5 min', hold: '—', videoId: 'neck-fat-doc',
        notes: 'Con los nudillos, masajea del centro de la barbilla hacia las orejas siguiendo la línea de la mandíbula.' },
    ],
  },
  0: { // DOMINGO — descanso total
    title: '🌙 Descanso total de definición',
    subtitle: 'Solo bruxismo — deja que el cuello recupere antes de la nueva semana',
    color: '#5f5a68',
    exercises: [],
    isRest: true,
  },
};

const FACE_QUOTES = [
  "🌿 5 minutos hoy, menos dolor de cabeza mañana.",
  "🧘‍♀️ La relajación de la mandíbula es tan entrenamiento como el gimnasio.",
  "✨ Consistencia, no intensidad — así se ve el cambio real.",
  "💪 El cuello también se entrena — dale la misma seriedad que a tus glúteos.",
  "🍃 Un hábito pequeño repetido vence a un esfuerzo grande ocasional.",
];
