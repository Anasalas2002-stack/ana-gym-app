// ═══════════════════════════════════════════════════════
// YOGA FACIAL — Definición de mandíbula + Bruxismo
// ═══════════════════════════════════════════════════════

const FACE_VIDEOS = {
  'jawline-full':      'fLbsAAEsNQQ',  // Jawline Lift & Lower Face Firming - Face Yoga Full Routine
  'jawline-sculpt':    'nnUpOW3yDAQ',  // 10 Minute Jawline Sculpting Face Yoga
  'tmj-doctorjo':      'SbJZXG4fsd4',  // TMJ Exercises & Stretches - Ask Doctor Jo
  'tmj-bobbrad':       'kpBc6wiEkQU',  // Simple TMJ Treatments - Bob & Brad
  'tmj-basics':        'EM18snVgV_c',  // TMJ Exercises #1 - Jaw Pain Help
};

const FACE_BLOCKS = [
  {
    id: 'definicion',
    title: 'Bloque A · Definición facial',
    subtitle: 'Sin ejercicios de resistencia sobre el masetero',
    color: '#e88ab0',
    exercises: [
      {
        id: 'chin-tuck-face',
        name: 'Chin tuck (doble papada intencional)',
        sets: '3', reps: '10', hold: '3 seg',
        videoId: 'tmj-doctorjo',
        notes: 'Lleva el mentón hacia atrás y abajo, como haciendo doble papada a propósito. Trabaja los músculos profundos del cuello, no el masetero.',
      },
      {
        id: 'face-yoga-full',
        name: 'Rutina completa de face yoga — jawline',
        sets: '1 ronda', reps: 'sigue el video', hold: '—',
        videoId: 'jawline-full',
        notes: 'Rutina guiada paso a paso para lift de mandíbula y firmeza del rostro inferior.',
      },
      {
        id: 'face-yoga-sculpt',
        name: 'Jawline sculpting — 10 min',
        sets: '1 ronda', reps: '3-4×/semana', hold: '—',
        videoId: 'jawline-sculpt',
        notes: 'Alterna con la rutina anterior. Técnicas para tonificar y esculpir el contorno de la mandíbula y cuello.',
      },
      {
        id: 'fish-face',
        name: 'Fish face (mejillas succionadas)',
        sets: '3', reps: '10', hold: '—',
        videoId: 'jawline-full',
        notes: 'Succiona las mejillas hacia adentro formando cara de pez, sostén y suelta. Incluido dentro de las rutinas guiadas.',
      },
    ],
  },
  {
    id: 'bruxismo',
    title: 'Bloque B · Bruxismo y relajación',
    subtitle: 'Mañana y noche — más importante que el Bloque A',
    color: '#7db8e8',
    exercises: [
      {
        id: 'lengua-reposo',
        name: 'Postura de lengua en reposo',
        sets: '—', reps: 'Todo el día', hold: 'Hábito constante',
        videoId: null,
        notes: 'Punta de la lengua tocando el paladar detrás de los dientes frontales, dientes superiores e inferiores separados (sin contacto). Repítelo como recordatorio cada 2 horas.',
      },
      {
        id: 'goldfish',
        name: 'Goldfish exercise (apertura parcial)',
        sets: '6', reps: '6 (6 veces al día)', hold: '—',
        videoId: 'tmj-doctorjo',
        notes: 'Lengua en el paladar, abre la boca parcialmente sin desviar la mandíbula. Mejora el deslizamiento de la articulación.',
      },
      {
        id: 'chin-tuck-tmj',
        name: 'Chin tuck para TMJ',
        sets: '1', reps: '10', hold: '3 seg',
        videoId: 'tmj-doctorjo',
        notes: 'Mismo movimiento del Bloque A — corrige la postura que alimenta la tensión mandibular.',
      },
      {
        id: 'respiracion-mandibula',
        name: 'Respiración diafragmática + mandíbula floja',
        sets: '6 rondas', reps: 'Inhala 5s / exhala 10s', hold: '—',
        videoId: 'tmj-bobbrad',
        notes: 'Antes de dormir. Deja caer la mandíbula completamente floja en cada exhalación. Reduce la tensión que causa dolores de cabeza.',
      },
      {
        id: 'depresor-lateral',
        name: 'Estiramiento lateral con depresor (opcional)',
        sets: '1', reps: '10 por lado', hold: '2-3 seg',
        videoId: 'tmj-basics',
        notes: 'Solo si no genera dolor. Detente si sientes chasquido o molestia — el TMJ nunca debe doler durante el ejercicio.',
      },
      {
        id: 'masaje-masetero',
        name: 'Auto-masaje del masetero',
        sets: '1', reps: '2 min', hold: '—',
        videoId: 'tmj-bobbrad',
        notes: 'Con los dedos, masajea en círculos frente a la oreja donde más se siente la tensión.',
      },
    ],
  },
];

const FACE_QUOTES = [
  "🌿 5 minutos hoy, menos dolor de cabeza mañana.",
  "🧘‍♀️ La relajación de la mandíbula es tan entrenamiento como el gimnasio.",
  "✨ Consistencia, no intensidad — así se ve el cambio.",
  "💆‍♀️ Tu mandíbula también necesita día de descanso activo.",
  "🍃 Un hábito pequeño repetido vence a un esfuerzo grande ocasional.",
];
