// =========================================================================
// SISTEMA DE IDIOMA (ES / EN)
// -------------------------------------------------------------------------
// El inglés es el idioma por defecto. La elección del usuario se guarda en
// localStorage. Las traducciones del contenido agronómico (ROTATIONS_EN, en
// app.js) son una versión inglesa del texto original en español y quedan
// pendientes de revisión por el equipo agronómico antes de publicar.
// =========================================================================

window.I18N_DICT = {
  es: {
    appTitle: 'Field Shift | Asesor de Rotación de Cultivos - Arequipa',
    langToggleTitle: 'Cambiar idioma / Switch language',
    langToggleAria: 'Cambiar idioma a inglés',

    zoneLocation: 'Zona - Ubicación',
    currentCrop: 'Cultivo actual',
    zoneMajes: 'Majes - El Pedregal',
    zoneChili: 'Valle de Chili',
    zoneCamana: 'Valle de Camaná',
    zoneSiguas: 'Santa Rita de Siguas',
    cropPapa: 'Papa',
    cropMaiz: 'Maíz',
    cropCebolla: 'Cebolla',
    cropHaba: 'Haba',
    cropAlfalfa: 'Alfalfa',
    cropTrigo: 'Trigo',

    mapParcelTitle: 'Especificar mi parcela en el mapa',
    ariaParcelMap: 'Mapa de la parcela',
    mapTitle: 'MAPA DE LA PARCELA',
    mapSub: 'Polígono auditado con imágenes satelitales Esri',
    mapOk: '🟢 Viable',
    mapWarn: '🟡 Precaución',
    mapBad: '🔴 No recomendada',
    mapHint: 'Toca el mapa para ubicar tu parcela',
    mapAttribution: 'Satélite Esri — NASA POWER',

    ariaRotations: 'Rotaciones Recomendadas',
    rotationsTitle: 'ROTACIONES RECOMENDADAS',

    ariaPareto: 'Frente de Compromisos',
    paretoTitle: 'FRENTE DE COMPROMISOS',
    paretoBadge: 'Óptimos de Pareto',
    paretoDesc: 'Relación <strong class="text-slate-200">Salud del Suelo vs. Ingreso</strong> (tamaño = ahorro de agua). Haz clic en un punto para inspeccionar.',
    axisHigh: 'Alto',
    axisSoil: '↑ Salud del Suelo',
    axisLow: 'Bajo',
    axisIncome: 'Mayor Ingreso →',
    paretoLegendOk: 'No dominada (Óptima)',
    paretoLegendBad: 'Dominada / Riesgo',
    paretoAxisNote: 'Eje Y: Suelo | Eje X: Ingreso',

    ariaLlm: 'Explicación agronómica LLM',
    whyTitle: '¿Por qué esta rotación?',
    copyBtnTitle: 'Copiar resumen para WhatsApp',
    copyBtn: 'Copiar',
    copied: '¡Copiado!',
    copyError: 'Error al copiar:',
    soilImpact: 'Impacto en Suelo',
    waterBalance: 'Balance Hídrico',

    railWater: 'AHORRAR AGUA',
    railSoil: 'SALUD SUELO',
    railIncome: 'INGRESO',
    tabRotations: 'Rotaciones',
    tabChart: 'Gráfico',

    blockWater: 'Agua',
    blockSoil: 'Suelo',
    blockIncome: 'Ingreso',
    confidence: 'Confianza',
    confAlta: 'ALTA',
    confMedia: 'MEDIA',
    confBaja: 'BAJA',
    seeWhy: 'Ver por qué →',
    cardTooltip: 'Haz clic para ver en el Frente de Compromisos y explicación LLM',
    optionBadge: 'Opción #{n} ({pct}% coincidencia)',
    matchWord: 'coincidencia',

    advTooltip: 'Configuración avanzada (Variables CSV NASA POWER)',
    modalTitle: 'Parámetros Locales (NASA POWER CSV)',
    modalDesc: 'Ajusta los datos climáticos de tu parcela para recalcular el ranking.',
    modalTemp: 'Temp. Media (T2M)',
    modalPrec: 'Precipitación (PRECTOT)',
    modalRh: 'Humedad (RH2M)',
    modalRad: 'Radiación (SW_DWN)',
    modalWind: 'Velocidad Viento (WS2M)',
    modalSal: 'Salinidad Suelo Local (CE dS/m)',
    cancelBtn: 'Cancelar',
    applyBtn: 'Aplicar datos',

    waTitle: '🌱 *Field Shift Arequipa - Recomendación de Rotación*',
    waZone: '📍 Zona:',
    waCrop: 'Cultivo actual:',
    waSeq: '🔄 Secuencia #',
    waWhy: '💡 Por qué:',
    waSoil: '🌿 Suelo:',
    waWater: '💧 Agua:'
  },

  en: {
    appTitle: 'Field Shift | Crop Rotation Advisor - Arequipa',
    langToggleTitle: 'Cambiar idioma / Switch language',
    langToggleAria: 'Switch language to Spanish',

    zoneLocation: 'Zone - Location',
    currentCrop: 'Current crop',
    zoneMajes: 'Majes - El Pedregal',
    zoneChili: 'Chili Valley',
    zoneCamana: 'Camaná Valley',
    zoneSiguas: 'Santa Rita de Siguas',
    cropPapa: 'Potato',
    cropMaiz: 'Corn',
    cropCebolla: 'Onion',
    cropHaba: 'Fava bean',
    cropAlfalfa: 'Alfalfa',
    cropTrigo: 'Wheat',

    mapParcelTitle: 'Set my parcel on the map',
    ariaParcelMap: 'Parcel map',
    mapTitle: 'PARCEL MAP',
    mapSub: 'Polygon audited with Esri satellite imagery',
    mapOk: '🟢 Viable',
    mapWarn: '🟡 Caution',
    mapBad: '🔴 Not recommended',
    mapHint: 'Tap the map to place your parcel',
    mapAttribution: 'Esri satellite — NASA POWER',

    ariaRotations: 'Recommended rotations',
    rotationsTitle: 'RECOMMENDED ROTATIONS',

    ariaPareto: 'Trade-off front',
    paretoTitle: 'TRADE-OFF FRONT',
    paretoBadge: 'Pareto Optima',
    paretoDesc: 'Trade-off between <strong class="text-slate-200">Soil Health vs. Income</strong> (size = water savings). Click a point to inspect.',
    axisHigh: 'High',
    axisSoil: '↑ Soil Health',
    axisLow: 'Low',
    axisIncome: 'Higher Income →',
    paretoLegendOk: 'Non-dominated (Optimal)',
    paretoLegendBad: 'Dominated / Risk',
    paretoAxisNote: 'Y axis: Soil | X axis: Income',

    ariaLlm: 'LLM agronomic explanation',
    whyTitle: 'Why this rotation?',
    copyBtnTitle: 'Copy summary for WhatsApp',
    copyBtn: 'Copy',
    copied: 'Copied!',
    copyError: 'Copy failed:',
    soilImpact: 'Soil Impact',
    waterBalance: 'Water Balance',

    railWater: 'WATER SAVING',
    railSoil: 'SOIL HEALTH',
    railIncome: 'INCOME',
    tabRotations: 'Rotations',
    tabChart: 'Chart',

    blockWater: 'Water',
    blockSoil: 'Soil',
    blockIncome: 'Income',
    confidence: 'Confidence',
    confAlta: 'HIGH',
    confMedia: 'MEDIUM',
    confBaja: 'LOW',
    seeWhy: 'Why →',
    cardTooltip: 'Click to see it on the Trade-off Front and the LLM explanation',
    optionBadge: 'Option #{n} ({pct}% match)',
    matchWord: 'match',

    advTooltip: 'Advanced settings (NASA POWER CSV variables)',
    modalTitle: 'Local Parameters (NASA POWER CSV)',
    modalDesc: "Adjust your parcel's climate data to recalculate the ranking.",
    modalTemp: 'Avg Temp (T2M)',
    modalPrec: 'Precipitation (PRECTOT)',
    modalRh: 'Humidity (RH2M)',
    modalRad: 'Radiation (SW_DWN)',
    modalWind: 'Wind Speed (WS2M)',
    modalSal: 'Local Soil Salinity (CE dS/m)',
    cancelBtn: 'Cancel',
    applyBtn: 'Apply data',

    waTitle: '🌱 *Field Shift Arequipa - Rotation Recommendation*',
    waZone: '📍 Zone:',
    waCrop: 'Current crop:',
    waSeq: '🔄 Sequence #',
    waWhy: '💡 Why:',
    waSoil: '🌿 Soil:',
    waWater: '💧 Water:'
  }
};

window.LANG_STORAGE_KEY = 'fieldshift.lang';

let currentLang = 'en';

window.getLang = function () {
  return currentLang;
};

window.t = function (key, vars) {
  const dict = window.I18N_DICT[currentLang] || window.I18N_DICT.en;
  let str = dict[key];
  if (str === undefined) str = window.I18N_DICT.en[key];
  if (str === undefined) str = key;
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (match, name) =>
      vars[name] !== undefined ? vars[name] : match
    );
  }
  return str;
};

window.getInitialLang = function () {
  try {
    const param = new URLSearchParams(window.location.search).get('lang');
    if (param === 'es' || param === 'en') return param;
  } catch (err) {
    // URLSearchParams no disponible; se continúa con localStorage
  }
  try {
    const saved = localStorage.getItem(window.LANG_STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch (err) {
    // localStorage puede estar bloqueado; se usa el idioma por defecto
  }
  return 'en';
};

window.setLang = function (next) {
  currentLang = next === 'es' ? 'es' : 'en';
  try {
    localStorage.setItem(window.LANG_STORAGE_KEY, currentLang);
  } catch (err) {
    // sin persistencia: el idioma solo dura la sesión
  }
  window.applyLang();
};

window.toggleLang = function () {
  window.setLang(currentLang === 'es' ? 'en' : 'es');
};

window.applyLang = function () {
  const lang = currentLang;
  document.documentElement.lang = lang;
  document.title = window.t('appTitle');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = window.t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = window.t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = window.t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', window.t(el.dataset.i18nAria));
  });

  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = lang === 'es' ? 'EN' : 'ES';
    btn.title = window.t('langToggleTitle');
    btn.setAttribute('aria-label', window.t('langToggleAria'));
  }

  if (typeof window.recalculateAll === 'function') {
    window.recalculateAll();
  }
};
