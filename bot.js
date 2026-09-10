// ═══════════════════════════════════════════════════════
// BOT DE ENTRENAMIENTO — Sin API externa
// Lógica conversacional con ajustes reales al plan
// ═══════════════════════════════════════════════════════

const BOT_STATE = {
  open: false,
  messages: JSON.parse(localStorage.getItem('botMessages') || '[]'),
  pendingAction: null,
  customExercises: JSON.parse(localStorage.getItem('customExercises') || '{}'),
  skippedExercises: JSON.parse(localStorage.getItem('skippedExercises') || '{}'),
  customDays: JSON.parse(localStorage.getItem('customDays') || 'null'),
};

// ── Intents y respuestas ─────────────────────────────
const INTENTS = [
  {
    patterns: ['cansada','cansancio','agotada','muy cansada','no puedo','sin energia','sin energía','fatiga'],
    handler: handleTired,
    chips: ['Reducir carga hoy','Reducir esta semana','Cambiar de día','Cancelar'],
  },
  {
    patterns: ['dolor','duele','me duele','lesión','lesion','rodilla','espalda','hombro','molestia'],
    handler: handlePain,
    chips: ['Rodilla','Espalda baja','Hombro','Otro lugar'],
  },
  {
    patterns: ['viaje','viajo','voy a viajar','salgo de viaje','me voy'],
    handler: handleTravel,
    chips: ['Pausar el plan','Continuar igual','Cancelar'],
  },
  {
    patterns: ['mas gluteo','más gluteo','más glúteo','mas glúteo','quiero mas gluteo','enfoque glúteo','enfoque gluteo','priorizar gluteo','priorizar glúteo'],
    handler: handleMoreGlute,
    chips: ['Sí, añadir ejercicios','Ver cambios primero','Cancelar'],
  },
  {
    patterns: ['menos volumen','muy larga','muy largo','acortar','menos ejercicios','menos tiempo','rápido','rapido'],
    handler: handleLessVolume,
    chips: ['Sí, acortar sesión','Solo hoy','Cancelar'],
  },
  {
    patterns: ['cambiar dia','cambiar día','otro día','mover dia','mover día','cambiar horario'],
    handler: handleChangeDay,
    chips: ['Ver mi semana','Cancelar'],
  },
  {
    patterns: ['añadir ejercicio','agregar ejercicio','quiero agregar','nuevo ejercicio'],
    handler: handleAddExercise,
    chips: ['Glúteos','Pierna','Superior','Cancelar'],
  },
  {
    patterns: ['quitar ejercicio','eliminar ejercicio','sacar ejercicio','no quiero hacer'],
    handler: handleRemoveExercise,
    chips: ['Ver ejercicios de hoy','Cancelar'],
  },
  {
    patterns: ['peso','cuanto peso','qué peso','que peso','peso sugerido','mucho peso','poco peso'],
    handler: handleWeight,
    chips: ['Ver pesos de hoy','Ajustar un ejercicio','Cancelar'],
  },
  {
    patterns: ['ciclo','menstruacion','menstruación','periodo','período','regla','flo','fase'],
    handler: handleCycle,
    chips: Object.values(CYCLE_ADJUSTMENTS).map(c => c.label),
  },
  {
    patterns: ['progreso','como voy','cómo voy','avance','resultados','semana','fase'],
    handler: handleProgress,
    chips: ['Ver semana actual','Ver métricas','Cerrar'],
  },
  {
    patterns: ['hola','hi','buenas','buenos días','buenas tardes','buenas noches','hey'],
    handler: handleGreeting,
    chips: null,
  },
  {
    patterns: ['ayuda','help','que puedes hacer','qué puedes hacer','opciones','comandos'],
    handler: handleHelp,
    chips: ['Estoy cansada','Me duele algo','Voy a viajar','Más glúteos','Cambiar días'],
  },
];

function matchIntent(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => t.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))) {
      return intent;
    }
  }
  return null;
}

// ── Handlers ─────────────────────────────────────────
function handleGreeting() {
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  const week = STATE.currentWeek;
  const greeting = new Date().getHours() < 12 ? '¡Buenos días' : new Date().getHours() < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  return {
    text: `${greeting}, Ana! 💪 Estás en la semana ${week} de tu plan.\n\n${workout ? `Hoy tienes: ${workout.emoji} **${workout.name}**\n${workout.focus}` : 'Hoy es día de descanso — tu cuerpo está creciendo 🌙'}\n\n¿En qué te puedo ayudar?`,
    chips: ['Estoy cansada','Me duele algo','Más glúteos','¿Cómo voy?'],
  };
}

function handleHelp() {
  return {
    text: `Esto es lo que puedo hacer por ti:\n\n💤 **Si estás cansada** — reduzco la carga de hoy o de la semana\n\n🩹 **Si te duele algo** — te sugiero qué evitar y qué sustituir\n\n✈️ **Si viajas** — pauso el plan para que no pierdas semanas\n\n🍑 **Más glúteos** — añado ejercicios extra a tu sesión\n\n📅 **Cambiar días** — reorganizo tu semana\n\n➕ **Añadir ejercicios** — agrego variantes a tu rutina\n\n➖ **Quitar ejercicios** — elimino lo que no quieras hacer\n\n¿Qué necesitas?`,
    chips: ['Estoy cansada','Me duele algo','Voy a viajar','Más glúteos','Cambiar días'],
  };
}

function handleTired() {
  return {
    text: `Entiendo 😴 Escúchate — el descanso es parte del plan.\n\n¿Qué prefieres hacer?`,
    chips: ['Reducir carga hoy 10%','Reducir carga esta semana','Cambiar la sesión de día','Descanso total hoy'],
    action: 'tired_choice',
  };
}

function handleTiredChoice(choice) {
  const week = STATE.currentWeek;
  if (choice.includes('Reducir carga hoy')) {
    // Apply 90% factor to today's weights
    const dow = todayDow();
    const workout = DAY_WORKOUT_MAP[dow];
    if (workout) {
      workout.exercises.forEach(ex => {
        if (ex.progression) {
          const current = getWeight(ex.id, week, ex.progression);
          if (current) setWeight(ex.id, week, Math.round(current * 0.9 * 2) / 2);
        }
      });
    }
    return { text: `Listo ✅ Reduje todos los pesos de hoy un 10%. Recarga esta semana y el próximo entrenamiento volvemos al plan original.\n\n¡Lo más importante es que muevas el cuerpo! 💪`, chips: ['Ver rutina de hoy','Cerrar'] };
  }
  if (choice.includes('esta semana')) {
    return { text: `Entendido 🙏 Para esta semana completa:\n\n• Reduce el peso un 10-15% en todos los ejercicios\n• Añade 30 segundos extra de descanso entre series\n• Prioriza la técnica sobre la carga\n\nLa semana que viene retomamos la progresión normal. ¿Algo más?`, chips: ['Cambiar sesión de hoy','Cerrar'] };
  }
  if (choice.includes('Cambiar')) {
    return handleChangeDay();
  }
  if (choice.includes('Descanso total')) {
    return { text: `Perfecto 🌙 Hoy descansas. No se registra como sesión completada y el plan continúa mañana normalmente.\n\n¡A veces lo más inteligente es no entrenar!`, chips: ['Cerrar'] };
  }
  return handleDefault(choice);
}

function handlePain() {
  return {
    text: `Lo siento 🩹 ¿Dónde sientes la molestia?`,
    chips: ['Rodilla','Espalda baja','Hombro','Cadera','Otro'],
    action: 'pain_location',
  };
}

function handlePainLocation(location) {
  const suggestions = {
    'Rodilla': {
      avoid: ['Split squat búlgaro', 'Sentadilla', 'Step-up', 'Hack squat'],
      ok: ['Hip thrust', 'RDL', 'Curl femoral tumbado', 'Kickback en cable', 'Abductora'],
      tip: 'Para rodilla: evita flexión profunda. Hip thrust y RDL son seguros porque no cargan la articulación.',
    },
    'Espalda baja': {
      avoid: ['RDL', 'Buenos días', 'Sentadilla con barra', 'Remo con barra'],
      ok: ['Prensa de piernas', 'Curl femoral', 'Abductora', 'Jalón al pecho'],
      tip: 'Para espalda baja: evita bisagra de cadera con carga. Usa máquinas que tengan respaldo.',
    },
    'Hombro': {
      avoid: ['Press de pecho', 'Press de hombro', 'Elevaciones laterales', 'Press militar'],
      ok: ['Jalón al pecho', 'Remo', 'Curl de bíceps', 'Todo el tren inferior'],
      tip: 'Para hombro: nada de empuje por encima de la cabeza. El tirón (jalón, remo) suele estar bien.',
    },
    'Cadera': {
      avoid: ['Hip thrust', 'Sentadilla sumo', 'Split squat'],
      ok: ['Curl femoral', 'Extensión cuádriceps', 'Press de pecho', 'Jalón al pecho'],
      tip: 'Para cadera: evita cargar en posición de flexión de cadera. Descansa si el dolor es agudo.',
    },
  };

  const loc = Object.keys(suggestions).find(k => location.includes(k)) || null;
  if (!loc) {
    return { text: `Si el dolor es agudo o no cede, lo mejor es descansar hoy y consultar un médico antes de seguir. ¿Quieres que pause el plan mientras te recuperas?`, chips: ['Pausar plan','No, continuar','Cerrar'] };
  }

  const s = suggestions[loc];
  // Store skipped exercises
  const todayStr = today();
  s.avoid.forEach(ex => {
    if (!BOT_STATE.skippedExercises[todayStr]) BOT_STATE.skippedExercises[todayStr] = [];
    if (!BOT_STATE.skippedExercises[todayStr].includes(ex)) BOT_STATE.skippedExercises[todayStr].push(ex);
  });
  localStorage.setItem('skippedExercises', JSON.stringify(BOT_STATE.skippedExercises));

  return {
    text: `Para molestia en **${loc}**:\n\n⛔ Evita hoy:\n${s.avoid.map(e=>`• ${e}`).join('\n')}\n\n✅ Puedes hacer sin problema:\n${s.ok.map(e=>`• ${e}`).join('\n')}\n\n💡 ${s.tip}\n\nMarqué los ejercicios a evitar en tu sesión de hoy.`,
    chips: ['Ver rutina de hoy','Pausar plan','Cerrar'],
  };
}

function handleTravel() {
  return {
    text: `✈️ ¡Buen viaje! Recuerda que menos de 1 semana sin entrenar no pierde masa muscular — tu cuerpo te espera exactamente donde lo dejaste.\n\n¿Quieres que pause el plan?`,
    chips: ['Sí, pausar el plan','No, continuar contando semanas','Cancelar'],
    action: 'travel_choice',
  };
}

function handleTravelChoice(choice) {
  if (choice.includes('pausar') || choice.includes('Sí')) {
    startTravel();
    return { text: `Listo ✅ Plan pausado en la semana ${STATE.currentWeek}. Cuando regreses, abre la app y dime "regresé" para reanudar.\n\n¡Disfruta el viaje! 🌍`, chips: ['Cerrar'] };
  }
  return { text: `Perfecto, el plan sigue contando. Si cambias de opinión dime "voy a viajar" cuando quieras pausarlo.`, chips: ['Cerrar'] };
}

function handleMoreGlute() {
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  const extraExercises = [
    { name: 'Kickback en cable extra (serie adicional)', sets: '+1 serie', reps: '15 c/lado' },
    { name: 'Abductora — serie de fatiga', sets: '1 serie extra', reps: '25 reps' },
    { name: 'Puente de glúteo isométrico al final', sets: '3 series', reps: '30 seg' },
  ];

  return {
    text: `🍑 ¡Vamos por más glúteos! Puedo añadir estos ejercicios a tu sesión de hoy:\n\n${extraExercises.map(e=>`• **${e.name}** — ${e.sets} · ${e.reps}`).join('\n')}\n\n¿Los añado?`,
    chips: ['Sí, añadir los 3','Solo el kickback','Solo la abductora','Cancelar'],
    action: 'glute_choice',
  };
}

function handleGluteChoice(choice) {
  if (choice.includes('Cancelar')) return { text: 'Entendido, el plan sigue igual.', chips: ['Cerrar'] };

  const added = [];
  if (choice.includes('3') || choice.includes('kickback')) added.push('Kickback extra — 1 serie adicional · 15 c/lado');
  if (choice.includes('3') || choice.includes('abductora')) added.push('Abductora serie de fatiga — 25 reps');
  if (choice.includes('3')) added.push('Puente isométrico final — 3×30 seg');

  // Store custom exercises for today
  const todayStr = today();
  BOT_STATE.customExercises[todayStr] = added;
  localStorage.setItem('customExercises', JSON.stringify(BOT_STATE.customExercises));

  return {
    text: `✅ Añadido al final de tu sesión de hoy:\n\n${added.map(e=>`🍑 ${e}`).join('\n')}\n\nApareceré como nota en tu rutina. ¡A darlo todo!`,
    chips: ['Ver rutina de hoy','Cerrar'],
  };
}

function handleLessVolume() {
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  if (!workout) return { text: 'Hoy es día de descanso, ya estás tranquila 😄', chips: ['Cerrar'] };

  const total = workout.exercises.filter(e => !e.isWarmup).length;
  const keep = Math.ceil(total * 0.6);

  return {
    text: `Entendido ⚡ Tu sesión de hoy tiene ${total} ejercicios. Puedo dejarla en los ${keep} más importantes (los prioritarios de glúteo primero) y saltas los demás.\n\n¿Confirmas?`,
    chips: ['Sí, acortar sesión','Solo hoy','Esta semana completa','Cancelar'],
    action: 'volume_choice',
  };
}

function handleVolumeChoice(choice) {
  if (choice.includes('Cancelar')) return { text: 'Perfecto, el plan sigue completo.', chips: ['Cerrar'] };
  return {
    text: `✅ Listo. Haz los primeros ejercicios de la sesión (los de glúteo primero) y puedes parar cuando sientas que ya diste lo mejor.\n\nRecuerda: un entrenamiento corto es infinitamente mejor que ninguno. 💪`,
    chips: ['Ver rutina de hoy','Cerrar'],
  };
}

function handleChangeDay() {
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const currentSchedule = 'Lun: Pierna Pull · Mar: Upper Push · Jue: Upper Pull · Vie: Pierna Push · Sáb: Pierna Completa';
  return {
    text: `📅 Tu distribución actual es:\n${currentSchedule}\n\n¿Qué quieres cambiar?`,
    chips: ['Mover el entrenamiento de hoy','Intercambiar dos días','Quitar un día de entrenamiento','Agregar un día','Cancelar'],
    action: 'day_choice',
  };
}

function handleDayChoice(choice) {
  if (choice.includes('hoy')) {
    return { text: `Para mover el entrenamiento de hoy: simplemente no lo hagas hoy y hazlo mañana. El plan es flexible — si completas las 5 sesiones en la semana, no importa el orden exacto.\n\n¿Quieres que marque hoy como descanso?`, chips: ['Sí, hoy descansó','Cancelar'] };
  }
  if (choice.includes('Intercambiar')) {
    return { text: `El intercambio más común y compatible es:\n\n• Lunes ↔ Martes (pierna/push)\n• Jueves ↔ Viernes (pull/pierna)\n\nLo importante: nunca dos días de pierna seguidos, y siempre un día de descanso entre sesiones pesadas.\n\n¿Cuál quieres intercambiar?`, chips: ['Lunes y Martes','Jueves y Viernes','Otro','Cancelar'] };
  }
  return { text: `Entendido. Recuerda que la constancia importa más que el orden exacto. El plan fue diseñado para los días que elegiste pero es flexible. ¿Algo más?`, chips: ['Cerrar'] };
}

function handleAddExercise() {
  return {
    text: `➕ ¿A qué grupo muscular quieres añadir?`,
    chips: ['Más glúteos 🍑','Más pierna','Más espalda','Más pecho','Más bíceps'],
    action: 'add_exercise_group',
  };
}

function handleAddExerciseGroup(group) {
  const options = {
    'glúteos': ['Hip thrust unilateral — 3×10 c/lado','Cable pull-through — 3×15','Sentadilla sumo pausa — 3×10'],
    'pierna': ['Prensa unilateral — 3×10 c/lado','Extensión cuádriceps unilateral — 3×12','Sentadilla con pausa — 3×8'],
    'espalda': ['Remo en cable sentado — 3×12','Face pull — 3×15','Pullover con mancuerna — 3×12'],
    'pecho': ['Apertura en cable — 3×12','Press inclinado mancuernas — 3×10','Fondos en paralelas — 3×8'],
    'bíceps': ['Curl concentrado — 3×12 c/lado','Curl 21s — 3 series','Curl en cable — 3×15'],
  };

  const key = Object.keys(options).find(k => group.toLowerCase().includes(k)) || 'glúteos';
  const list = options[key];

  return {
    text: `Opciones para añadir a tu sesión:\n\n${list.map((e,i)=>`${i+1}. ${e}`).join('\n')}\n\n¿Cuál añado?`,
    chips: [...list.map((_,i)=>`Añadir opción ${i+1}`), 'Cancelar'],
    action: 'add_exercise_confirm',
    data: list,
  };
}

function handleRemoveExercise() {
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  if (!workout) return { text: 'Hoy es día de descanso, no hay ejercicios que quitar.', chips: ['Cerrar'] };

  const exList = workout.exercises.filter(e => !e.isWarmup).map(e => e.name);
  return {
    text: `Ejercicios de hoy:\n\n${exList.map((e,i)=>`${i+1}. ${e}`).join('\n')}\n\n¿Cuál quieres quitar?`,
    chips: exList.slice(0,4).concat(['Cancelar']),
    action: 'remove_exercise_confirm',
  };
}

function handleRemoveExerciseConfirm(name) {
  if (name === 'Cancelar') return { text: 'Entendido, el plan sigue completo.', chips: ['Cerrar'] };
  const todayStr = today();
  if (!BOT_STATE.skippedExercises[todayStr]) BOT_STATE.skippedExercises[todayStr] = [];
  BOT_STATE.skippedExercises[todayStr].push(name);
  localStorage.setItem('skippedExercises', JSON.stringify(BOT_STATE.skippedExercises));
  return { text: `✅ **${name}** quitado de la sesión de hoy. No aparecerá en tu rutina.\n\nSi cambias de opinión, dime "volver a añadir ${name}".`, chips: ['Ver rutina de hoy','Cerrar'] };
}

function handleWeight() {
  const week = STATE.currentWeek;
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  if (!workout) return { text: 'Hoy es descanso. Los pesos los ves en los días de entrenamiento.', chips: ['Cerrar'] };

  const weights = workout.exercises
    .filter(e => e.progression)
    .map(e => {
      const w = getSuggestedWeight(e.progression, week);
      return `• ${e.name}: **${w} kg**`;
    }).join('\n');

  return {
    text: `Pesos sugeridos para hoy (semana ${week}):\n\n${weights}\n\n¿Quieres ajustar alguno?`,
    chips: ['Reducir todos 10%','Aumentar todos 5%','Ver en la rutina','Cerrar'],
    action: 'weight_adj',
  };
}

function handleWeightAdj(choice) {
  const week = STATE.currentWeek;
  const dow = todayDow();
  const workout = DAY_WORKOUT_MAP[dow];
  if (!workout) return { text: 'No hay sesión hoy.', chips: ['Cerrar'] };

  const factor = choice.includes('Reducir') ? 0.9 : choice.includes('Aumentar') ? 1.05 : 1;
  if (factor !== 1) {
    workout.exercises.forEach(ex => {
      if (ex.progression) {
        const current = getSuggestedWeight(ex.progression, week);
        if (current) setWeight(ex.id, week, Math.round(current * factor * 2) / 2);
      }
    });
    return { text: `✅ Pesos ajustados ${factor < 1 ? '-10%' : '+5%'} para hoy. Puedes verlos en tu rutina.`, chips: ['Ver rutina','Cerrar'] };
  }
  return { text: 'Puedes editar el peso de cada ejercicio directamente en la rutina tocando el campo de peso.', chips: ['Ver rutina','Cerrar'] };
}

function handleCycle() {
  return {
    text: `🌙 ¿En qué fase de tu ciclo estás? Ajustaré automáticamente los pesos sugeridos.\n\nRecuerda que puedes verlo también en Perfil → Fase del ciclo.`,
    chips: Object.entries(CYCLE_ADJUSTMENTS).map(([k,v]) => v.label),
    action: 'cycle_select',
  };
}

function handleCycleSelect(label) {
  const entry = Object.entries(CYCLE_ADJUSTMENTS).find(([k,v]) => v.label === label);
  if (entry) {
    setCyclePhase(entry[0]);
    const adj = entry[1];
    return {
      text: `✅ Fase actualizada: **${adj.label}**\n\nAjuste de peso: ${adj.factor >= 1 ? '+' : ''}${Math.round((adj.factor-1)*100)}%\n\n💡 ${adj.tip}`,
      chips: ['Ver rutina de hoy','Cerrar'],
    };
  }
  return handleDefault(label);
}

function handleProgress() {
  const week = STATE.currentWeek;
  const totalSessions = Object.values(STATE.completedDays).filter(Boolean).length;
  const adj = getCycleAdj();
  return {
    text: `📊 Tu progreso actual:\n\n• Semana **${week} de 26** (${Math.round(week/26*100)}%)\n• Fase: **${getFaseName(week)}**\n• Sesiones completadas: **${totalSessions}**\n• Ciclo actual: **${adj.label}** (${Math.round(adj.factor*100)}%)\n\n${week <= 8 ? '¡Estás construyendo la base! Cada sesión cuenta.' : week <= 17 ? '¡Ya estás en hipertrofia real! El cuerpo está cambiando.' : '¡Fase avanzada! Estás entre las que más llegan. Orgullo.'} 💪`,
    chips: ['Ver métricas','Cerrar'],
  };
}

function handleDefault(text) {
  const responses = [
    `Entiendo. ¿Te puedo ayudar con algo específico de tu entrenamiento?\n\nDime: "estoy cansada", "me duele algo", "más glúteos", "voy a viajar" o "¿cómo voy?"`,
    `No tengo una respuesta específica para eso, pero puedo ayudarte a ajustar tu plan. ¿Qué necesitas?`,
    `Cuéntame más — ¿es sobre la sesión de hoy, sobre el plan en general, o sobre algún ejercicio específico?`,
  ];
  return {
    text: responses[Math.floor(Math.random() * responses.length)],
    chips: ['Estoy cansada','Me duele algo','Más glúteos','¿Cómo voy?','Ayuda'],
  };
}

// ── Router de pending actions ─────────────────────────
function routePendingAction(action, text) {
  if (action === 'tired_choice') return handleTiredChoice(text);
  if (action === 'pain_location') return handlePainLocation(text);
  if (action === 'travel_choice') return handleTravelChoice(text);
  if (action === 'glute_choice') return handleGluteChoice(text);
  if (action === 'volume_choice') return handleVolumeChoice(text);
  if (action === 'day_choice') return handleDayChoice(text);
  if (action === 'add_exercise_group') return handleAddExerciseGroup(text);
  if (action === 'remove_exercise_confirm') return handleRemoveExerciseConfirm(text);
  if (action === 'weight_adj') return handleWeightAdj(text);
  if (action === 'cycle_select') return handleCycleSelect(text);
  return null;
}

// ── Process message ───────────────────────────────────
function processMessage(text) {
  // Check special commands
  if (text.toLowerCase().includes('regres') && STATE.travelMode) {
    endTravel();
    return { text: `🏠 ¡Bienvenida de vuelta! El plan retoma en la semana ${STATE.currentWeek}. ¿Cómo te sientes después del viaje?`, chips: ['Bien, a entrenar','Cansada','Cerrar'] };
  }

  // Pending action
  if (BOT_STATE.pendingAction) {
    const action = BOT_STATE.pendingAction;
    BOT_STATE.pendingAction = null;
    const result = routePendingAction(action, text);
    if (result) {
      if (result.action) BOT_STATE.pendingAction = result.action;
      return result;
    }
  }

  // Navigate to today
  if (text.includes('Ver rutina') || text.includes('rutina de hoy')) {
    closeBot();
    showTab('today', document.querySelectorAll('.tab')[0]);
    return null;
  }
  if (text.includes('Ver métricas')) {
    closeBot();
    showTab('progress', document.querySelectorAll('.tab')[2]);
    return null;
  }
  if (text === 'Cerrar') { closeBot(); return null; }

  // Match intent
  const intent = matchIntent(text);
  if (intent) {
    const result = intent.handler();
    if (result && result.action) BOT_STATE.pendingAction = result.action;
    return result;
  }

  return handleDefault(text);
}

// ── UI ────────────────────────────────────────────────
function openBot() {
  BOT_STATE.open = true;
  document.getElementById('bot-overlay').style.display = 'flex';
  if (BOT_STATE.messages.length === 0) {
    addBotMessage(handleGreeting());
  }
  renderBotMessages();
  document.getElementById('bot-input').focus();
}

function closeBot() {
  BOT_STATE.open = false;
  document.getElementById('bot-overlay').style.display = 'none';
}

function addUserMessage(text) {
  BOT_STATE.messages.push({ role: 'user', text, time: Date.now() });
}

function addBotMessage(response) {
  if (!response) return;
  BOT_STATE.messages.push({ role: 'bot', text: response.text, chips: response.chips, time: Date.now() });
}

function renderBotMessages() {
  const container = document.getElementById('bot-messages');
  const chipsContainer = document.getElementById('bot-chips');
  if (!container) return;

  container.innerHTML = BOT_STATE.messages.map(m => {
    if (m.role === 'user') {
      return `<div class="bot-msg user">${m.text}</div>`;
    }
    // Format bot message: **bold** → <strong>
    const formatted = m.text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return `<div class="bot-msg bot">${formatted}</div>`;
  }).join('');

  // Show chips from last bot message
  const lastBot = [...BOT_STATE.messages].reverse().find(m => m.role === 'bot');
  if (lastBot && lastBot.chips) {
    chipsContainer.innerHTML = lastBot.chips.map(chip =>
      `<button class="bot-chip" onclick="sendChip('${chip.replace(/'/g,"\\'")}')">${chip}</button>`
    ).join('');
    chipsContainer.style.display = 'flex';
  } else {
    chipsContainer.innerHTML = '';
    chipsContainer.style.display = 'none';
  }

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function sendBotMsg() {
  const input = document.getElementById('bot-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendChip(text);
}

function sendChip(text) {
  addUserMessage(text);
  renderBotMessages();

  // Thinking indicator
  const container = document.getElementById('bot-messages');
  const thinking = document.createElement('div');
  thinking.className = 'bot-msg bot thinking';
  thinking.id = 'thinking';
  thinking.textContent = '...';
  container.appendChild(thinking);
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    const t = document.getElementById('thinking');
    if (t) t.remove();
    const response = processMessage(text);
    if (response) {
      addBotMessage(response);
      if (response.action) BOT_STATE.pendingAction = response.action;
    }
    renderBotMessages();
    // Re-render today if changes were made
    if (STATE.currentTab === 'today') renderToday();
  }, 400 + Math.random() * 300);
}
