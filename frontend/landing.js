/* GreenOrbit landing: scroll story + live demonstrations against the real API (relative URLs, /api/model/...).
   Sections: i18n, API client, helpers, hero, problem demos, route map and scroll state, route demos, boot. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedMq.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* =====================================================================
     i18n. Spanish lives in the HTML; English lives here. Dynamic text uses t().
     ===================================================================== */
  let lang = 'es';
  try { const s = localStorage.getItem('greenorbit-lang'); if (s === 'es' || s === 'en') lang = s; } catch (e) { /* storage blocked: choice is not remembered */ }

  const EN = {
    title: 'GreenOrbit: what to plant so the canal water lasts',
    metaDesc: 'GreenOrbit proposes crop rotations for the Majes plateau (Arequipa) using NASA data. Follow how it was built and try the real model, limits in plain view.',
    skip: 'Skip to content', navProblem: 'The problem', navRoute: 'The route', navHonest: 'What we do not know', navWho: 'Who it is for', openShort: 'Open the app',
    wakeTitle: 'The server is waking up.', wakeBody: 'Free hosting can take about a minute on the first visit. The demos appear on their own once it answers.',
    heroKicker: 'Field Shift challenge, NASA Space Apps Challenge 2026',
    heroH1a: 'The water comes down one canal.', heroH1b: 'What you plant decides if it lasts.',
    heroLead: 'The Majes plateau in Arequipa is a desert that only produces with canal water. GreenOrbit proposes what to plant over the next three campaigns so that water lasts, also in a dry year.',
    ctaOpen: 'Open GreenOrbit', ctaRoute: 'Follow the route', ctaBack: 'Back to the route',
    stSupply: 'hm³ of water delivered per year', stDemand: 'hm³ asked for by the current crop mix, depending on the ET0 method', stDry: 'hm³ would arrive in the model’s dry case',
    stSrc: 'Figures computed just now by the model, using the 2016 Autodema crop mix.',
    pTitle: 'The water has a cap. And almost half the land asks for the same plant.',
    pLead: 'Three facts, with figures the model computes right now.',
    pB1: 'Water that arrives against water that is asked for',
    pB1p: 'Today’s crop mix asks for an amount that depends on how evapotranspiration is estimated. Both are shown: the low and the high one.',
    liveData: 'Live data', scnNormal: 'Normal year', scnDry: 'Dry year',
    pB2: 'Almost half the area is alfalfa',
    pB2p: 'It is fodder for dairy cattle and its area is tied to milk sales, not to available water. Each square below is 1 % of the area.',
    pB3: 'Years with less water have already happened',
    pB3p: 'Satellite and official deliveries show three years with lower deliveries. The model’s dry case is harsher than any of them: it takes the lowest delivery seen in each month.',
    rTitle: 'The route: how it was built, stop by stop',
    rLead: 'Eight stops, from the question to who uses it. At several of them you can touch the real work.',
    rm1: 'The question', rm2: 'The data', rm3: 'The checks', rm4: 'The water model', rm5: 'The rotation engine', rm6: 'The interface', rm7: 'What we do not know', rm8: 'Who it is for',
    s1tag: 'Stop 1', s1t: 'What to plant so the water lasts?',
    s1p1: 'We started from a single question, asked from the Majes plateau: with the water that comes down the canal, what is best to plant over the next three campaigns?',
    s1p2: 'We are not looking for the most profitable crop. We look for the combination that fits the water, looks after the soil and earns income.',
    slotC1: 'Campaign 1', slotC2: 'Campaign 2', slotC3: 'Campaign 3',
    mustWater: 'Water', mustWaterP: 'has to fit, month by month', mustSoil: 'Soil', mustSoilP: 'is not worn out in three campaigns', mustInc: 'Income', mustIncP: 'with real Majes prices',
    s2tag: 'Stop 2', s2t: 'Satellite data and office data, over the same plateau.',
    s2p: 'The satellite measures greenness and the water plants use. Official series say how much water comes in and what is sown.',
    src1: 'Greenness (NDVI), 250 m cells, 2013 to 2025.', src2: 'Evapotranspiration (ET), 500 m: the water plants and soil use.', src3: 'Daily climate to compute water demand (ET0).',
    src4: 'Water use of the plateau, to cross-check MODIS.', src5: 'Water delivered at Pitay, 2013 to 2025.', src6: 'Yield, farm-gate price and monthly sowing.',
    t3dTitle: 'The plateau in 3D, with real relief and real paths', t3dDry: 'See a dry year', t3dNormal: 'See a normal year',
    t3dAria: '3D relief of Majes: the plateau, the Colca canyon and the volcanoes, with the canal in turquoise', t3dPlaces: 'Places',
    t3dPampa: 'The plateau', t3dCanal: 'The canal', t3dCanyon: 'Colca Canyon', t3dVolc: 'Volcanoes',
    t3dNote: 'The canal is the OpenStreetMap line where it is mapped. The tunnelled stretch towards the plateau is not drawn. Green dots are the irrigated MODIS cells.',
    mapRandom: 'Try a random cell', mapHint: 'Tap the map. Dots are irrigated 5.4 ha cells.',
    s3tag: 'Stop 3', s3t: 'Before modelling, we checked the data matched NASA’s.', s3p: 'Each step was checked against an independent reference. These are the results of those tests.',
    lg1t: 'Greenness extracted vs NASA AppEEARS', lg1p: '715 comparisons, difference 0. Same rows and columns at all 36 points checked.',
    lg2t: 'Evapotranspiration vs AppEEARS', lg2p: '156 cases, correlation 0.999.', lg3u: 'mm/day',
    lg3t: 'Penman-Monteith vs FAO-56', lg3p: 'The calculation was checked against example 18 of the FAO-56 manual and gives 3.88 mm per day.',
    lg4u: 'readings', lg4t: 'Midagri read in two ways', lg4p: 'Yield, price and sowing were read two ways and the figures agree.',
    s4tag: 'Stop 4', s4t: 'How much water each crop asks for, month by month.',
    s4p1: 'We follow the FAO-56 method: water = crop coefficient (Kc) × reference evapotranspiration (ET0).',
    s4p2: 'We compute ET0 with two standard methods, Hargreaves and Penman-Monteith. We do not pick one: we show the range between the low and the high.',
    s4p3: 'Water figures are orders of magnitude. They have not been validated against field measurements.', dryYear: 'Dry year',
    s5tag: 'Stop 5', s5t: 'We tried every combination and kept the ones that hold up.',
    s5p1: 'The engine builds every possible combination of three campaigns. Agronomic rotation rules discard the ones that break a sensible rotation.',
    s5p2: 'The survivors are scored on water, soil and income, and always compared with what is done today.', rotQ: 'Pick the crop you have today',
    s6tag: 'Stop 6', s6t: 'Two views, one model.',
    s6p1: 'The farmer marks what they plan to sow and moves three priorities: water, soil and income. The Water Users Board sees whether the water is enough for a crop mix.',
    s6p2: 'Each result says why it wins, what it gives up and what data is missing. The interface is in Spanish and English.',
    frameP: 'The real interface runs right in this page.', frameBtn: 'Load the interface here', frameAlt: 'or open it full screen',
    s7tag: 'Stop 7', s7t: 'What did not work, and what we do not know.',
    s7p: 'The challenge scores how uncertainty is handled, so we put it in plain view. GreenOrbit supports the decision; it does not replace it.',
    h1t: 'A predictive model did not beat the usual yield',
    h1p: 'We tried predicting each crop’s yield with CatBoost, validating by leaving one year out each time. It erred more than using the crop’s usual yield, so we dropped it.',
    duelA: 'CatBoost', duelB: 'Usual yield', duelNote: 'Validation error: lower is better.',
    h2t: 'Water is a range, not a number', h2p: 'With the current mix, water demand falls between two standard estimates. Where it falls inside the range depends on the method.',
    h3t: 'What we do not know',
    u1t: 'Production costs', u1p: 'Only alfalfa has official data. The income we show is gross.',
    u2t: 'Salinity measured per plot', u2p: 'We use a reference value of 2.8 dS/m.',
    u3t: 'Water each plot receives', u3p: 'We use the average per hectare.',
    u4t: 'What happens inside a satellite cell', u4p: 'Detail below 5.4 ha is not visible.',
    u5t: 'Which zones will suffer first', u5p: 'The map shows where greenness dropped in dry years. That signal is weak: it does not identify sensitive zones with certainty.',
    cavSum: 'Warnings the model returns, verbatim',
    s8tag: 'Stop 8', s8t: 'First the Water Users Board. Then each farmer.',
    w1t: 'The Water Users Board', w1p: 'It must file a crop and irrigation plan and faces reduced deliveries. It needs to know whether the water is enough for the crop mix of its area.',
    w2t: 'The farmer', w2p: 'Asks something more concrete: “how much can I irrigate if my allocation is cut?”. The app shows which rotations fit the water that reaches them.',
    boardQ: 'Is there enough water for this crop mix?',
    cTitle: 'Try GreenOrbit with your own crop.', cLead: 'Pick what you have today and see which rotations fit Majes water, in a normal year and in a dry one.',
    footData: 'Data: NASA MODIS, NASA POWER, USGS SSEBop, Autodema, Midagri. Map imagery: Esri.',
    heroMapAria: 'Map of the irrigated cells of the Majes plateau, seen by satellite', scnAria: 'Water scenario', routeAria: 'Route map', slotsAria: 'Three campaigns',
    mapAria: 'Satellite map of Majes. Tap a point to see what NASA measured there.', duelAria: 'CatBoost error 0.230 against 0.221 for the usual yield',
    hudAria: 'Position on the route', hudPrev: 'Previous stop', hudNext: 'Next stop',
  };

  const DYN = {
    es: {
      loading: 'Cargando datos reales…', retry: 'Reintentar',
      errTimeout: 'El servidor tardó demasiado en responder.', errNetwork: 'No hay conexión con el servidor.', errRate: 'Demasiadas consultas seguidas. Espera unos segundos.', errServer: 'El servidor no pudo responder esta consulta.', errMap: 'El mapa no pudo cargarse.',
      heroCap: '{n} cuadros regados vistos por NASA MODIS. Cada punto es un cuadro de 5.4 ha, coloreado por su verdor medio 2013 a 2024.',
      heroCapLoad: 'Cargando los cuadros regados…', heroFail: 'No se pudieron cargar las cifras en vivo. {err}',
      hudStart: 'Inicio', hudProblem: 'El problema', hudRoute: 'La ruta', hudClose: 'Cierre', stopOf: '{n} de 8',
      haveLbl: 'Llega', haveVal: '{n} hm³', needLbl: 'Se pide', needVal: '{l} a {h} hm³', supplyAt: 'Llega: {n} hm³',
      barAria: 'Llegan {c} hm³. La mezcla pide entre {l} y {h} hm³.',
      vOk: 'Alcanza, con margen', vNarrow: 'Alcanza, pero con poco margen', vTight: 'Alcanza con el estimado bajo; con el alto, no', vBad: 'No alcanza, ni con el estimado bajo',
      lgLow: 'Se pide, estimado bajo', lgRange: 'Hasta el estimado alto', lgOver: 'Pide más de lo que llega', lgSupply: 'Agua que llega',
      share: '{p} % de la superficie', waterHa: '{n} m³/ha', noDetail: 'Sin detalle en la mezcla', wafNote: 'Agua estimada por hectárea y por ciclo de cultivo (alfalfa: el año completo). Mezcla: {mix}.',
      dryStress: 'Caso seco del modelo', dryStressP: 'Llega el {pct} % del agua de un año normal. Toma la entrega más baja vista en cada mes, 2013 a 2025: es un caso de estrés, más duro que cualquier año registrado.',
      kindIrr: 'Regado', kindMixed: 'Mixto (parte regada)', kindDesert: 'Desierto o sin riego', kindNone: 'Sin dato',
      pxNdvi: 'verdor medio 2013 a 2024', pxEt: 'mm al año de agua usada', pxCap: 'Verdor de este cuadro por año. Los aros marcan los años con menos agua ({years}).', pxDry: '{y}: {c} % ({why})',
      pxWarn: 'Un cuadro de {ha} ha no es una parcela, y el cambio en años secos es una señal débil.', pxSrc: 'Fuente: MODIS MOD13Q1 y MOD16A3GF (NASA).', pxHint: 'Toca un punto verde del mapa para ver qué midió NASA ahí.', pxOut: 'Ese punto está fuera de la zona con datos.',
      calSeq: 'Ejemplo: {seq}, las tres campañas que el motor propone tras {crop}.', calLeg1: 'Agua que pide (estimado bajo)', calLeg2: 'Rango hasta el estimado alto', calLeg3: 'Mes con déficit', calLeg4: 'Agua que llega', calLeg5: 'Llega en año normal',
      calTotal: 'Pide {l} a {h} m³/ha en la campaña', calTotalOne: 'Pide {l} m³/ha en la campaña', calSown: 'siembra en {m}',
      calOk: 'Cabe mes a mes', calShort: 'Falta agua en {n} meses', calNo: 'No cabe en el año',
      calDelta: 'Meses con déficit entre las tres campañas: {a} en un año normal, {b} en uno seco.', calMethods: 'Estimado bajo: {low}. Estimado alto: {high}.',
      hargreaves: 'Hargreaves-Samani', pm: 'Penman-Monteith',
      rotNow: 'Forma actual: repetir {crop}', rotN: 'Opción {n}', rotBest: 'Primera opción', now: 'hoy',
      mWater: 'Agua', mSoil: 'Suelo', mIncome: 'Ingreso',
      fitOk: 'Cabe mes a mes', fitShort: 'Faltan meses de agua: hasta {n}', fitNo: 'No cabe en el año ({crops})',
      rotWater: '{l} a {h} m³/ha por campaña, estimado', rotWaterOne: '{l} m³/ha por campaña, estimado', rotNote: 'Se muestran las 3 primeras y la forma actual. Las prioridades usadas son las del producto por defecto.',
      scnNormalShort: 'Año normal', scnDryShort: 'Año seco', demandWord: 'hm³', boardNote: 'Cada mezcla se calcula ahora, con la API del modelo. El estimado bajo y el alto vienen de los dos métodos de ET0.',
      mixCur: 'Actual (Autodema 2016)', mixLess: 'Menos alfalfa (ilustrativo)', mixDiv: 'Diversificada (ilustrativo)', alfalfaShare: 'Alfalfa: {p} % de la superficie',
      frameTitle: 'Interfaz de GreenOrbit', rangeLow: 'Bajo (Hargreaves-Samani)', rangeHigh: 'Alto (Penman-Monteith)',
      dryOn: 'Año seco activado', dryOff: 'Año normal',
    },
    en: {
      loading: 'Loading real data…', retry: 'Retry',
      errTimeout: 'The server took too long to answer.', errNetwork: 'No connection to the server.', errRate: 'Too many requests in a row. Wait a few seconds.', errServer: 'The server could not answer this request.', errMap: 'The map could not load.',
      heroCap: '{n} irrigated cells seen by NASA MODIS. Each dot is a 5.4 ha cell, coloured by its mean greenness 2013 to 2024.',
      heroCapLoad: 'Loading irrigated cells…', heroFail: 'The live figures could not load. {err}',
      hudStart: 'Start', hudProblem: 'The problem', hudRoute: 'The route', hudClose: 'Closing', stopOf: '{n} of 8',
      haveLbl: 'Arrives', haveVal: '{n} hm³', needLbl: 'Asked for', needVal: '{l} to {h} hm³', supplyAt: 'Arrives: {n} hm³',
      barAria: '{c} hm³ arrive. The mix asks for between {l} and {h} hm³.',
      vOk: 'Enough, with room to spare', vNarrow: 'Enough, but with little room', vTight: 'Enough at the low estimate; not at the high one', vBad: 'Not enough, even at the low estimate',
      lgLow: 'Asked for, low estimate', lgRange: 'Up to the high estimate', lgOver: 'Asks for more than arrives', lgSupply: 'Water that arrives',
      share: '{p} % of the area', waterHa: '{n} m³/ha', noDetail: 'No detail in the mix', wafNote: 'Estimated water per hectare and per crop cycle (alfalfa: the whole year). Mix: {mix}.',
      dryStress: 'The model’s dry case', dryStressP: '{pct} % of a normal year’s water arrives. It takes the lowest delivery seen in each month, 2013 to 2025: a stress case, harsher than any recorded year.',
      kindIrr: 'Irrigated', kindMixed: 'Mixed (partly irrigated)', kindDesert: 'Desert or not irrigated', kindNone: 'No data',
      pxNdvi: 'mean greenness 2013 to 2024', pxEt: 'mm per year of water used', pxCap: 'Greenness of this cell by year. Rings mark the years with less water ({years}).', pxDry: '{y}: {c} % ({why})',
      pxWarn: 'A {ha} ha cell is not a plot, and the change in dry years is a weak signal.', pxSrc: 'Source: MODIS MOD13Q1 and MOD16A3GF (NASA).', pxHint: 'Tap a green dot on the map to see what NASA measured there.', pxOut: 'That point is outside the zone with data.',
      calSeq: 'Example: {seq}, the three campaigns the engine proposes after {crop}.', calLeg1: 'Water asked for (low estimate)', calLeg2: 'Range up to the high estimate', calLeg3: 'Month in deficit', calLeg4: 'Water that arrives', calLeg5: 'Arrives in a normal year',
      calTotal: 'Asks for {l} to {h} m³/ha in the campaign', calTotalOne: 'Asks for {l} m³/ha in the campaign', calSown: 'sown in {m}',
      calOk: 'Fits month by month', calShort: 'Short of water in {n} months', calNo: 'Does not fit in the year',
      calDelta: 'Months in deficit across the three campaigns: {a} in a normal year, {b} in a dry one.', calMethods: 'Low estimate: {low}. High estimate: {high}.',
      hargreaves: 'Hargreaves-Samani', pm: 'Penman-Monteith',
      rotNow: 'Current practice: repeat {crop}', rotN: 'Option {n}', rotBest: 'First option', now: 'today',
      mWater: 'Water', mSoil: 'Soil', mIncome: 'Income',
      fitOk: 'Fits month by month', fitShort: 'Short of water for up to {n} months', fitNo: 'Does not fit in the year ({crops})',
      rotWater: '{l} to {h} m³/ha per campaign, estimate', rotWaterOne: '{l} m³/ha per campaign, estimate', rotNote: 'The first 3 and the current practice are shown. Priorities are the product defaults.',
      scnNormalShort: 'Normal year', scnDryShort: 'Dry year', demandWord: 'hm³', boardNote: 'Each mix is computed now, through the model API. The low and high estimates come from the two ET0 methods.',
      mixCur: 'Current (Autodema 2016)', mixLess: 'Less alfalfa (illustrative)', mixDiv: 'Diversified (illustrative)', alfalfaShare: 'Alfalfa: {p} % of the area',
      frameTitle: 'GreenOrbit interface', rangeLow: 'Low (Hargreaves-Samani)', rangeHigh: 'High (Penman-Monteith)',
      dryOn: 'Dry year on', dryOff: 'Normal year',
    },
  };
  const t = (k, v) => {
    let s = (DYN[lang] && DYN[lang][k]) || DYN.es[k] || k;
    if (v) s = s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m));
    return s;
  };
  const fmt = (n, d = 0) => Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

  const esHtml = new WeakMap();
  const esAttr = new Map();
  const rerender = [];   // functions that redraw dynamic content after a language change

  function applyStatic() {
    $$('[data-t]').forEach((el) => {
      if (!esHtml.has(el)) esHtml.set(el, el.innerHTML);
      const k = el.dataset.t;
      el.innerHTML = lang === 'en' && EN[k] !== undefined ? EN[k] : esHtml.get(el);
    });
    $$('[data-tl]').forEach((el) => {
      const [attr, k] = el.dataset.tl.split(':');
      const key = k + '|' + attr;
      if (!esAttr.has(el)) esAttr.set(el, {});
      const store = esAttr.get(el);
      if (store[key] === undefined) store[key] = el.getAttribute(attr);
      el.setAttribute(attr, lang === 'en' && EN[k] !== undefined ? EN[k] : store[key]);
    });
    if (!applyStatic.es) applyStatic.es = { title: document.title, desc: $('meta[name="description"]').content };
    document.title = lang === 'en' ? EN.title : applyStatic.es.title;
    $('meta[name="description"]').content = lang === 'en' ? EN.metaDesc : applyStatic.es.desc;
    document.documentElement.lang = lang;
    $$('.langsw button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem('greenorbit-lang', l); } catch (e) { /* not remembered */ }
    applyStatic();
    rerender.forEach((fn) => { try { fn(); } catch (e) { /* keep the page alive */ } });
    updateHud();
  }

  const CROP_EN = { papa: 'Potato', cebolla: 'Onion', ajo: 'Garlic', quinua: 'Quinoa', zapallo: 'Squash', haba: 'Fava bean', maiz: 'Maize', alfalfa: 'Alfalfa', paprika: 'Paprika', vid: 'Grape', tomate: 'Tomato' };
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cropName = (c) => (lang === 'en' ? CROP_EN[norm(c)] || c : c);
  const CROP_COLOR = { papa: '#d6a24a', cebolla: '#c987b4', ajo: '#b8a584', quinua: '#d98c5f', zapallo: '#f0a63c', haba: '#5fae8a', maiz: '#e6c25a', alfalfa: '#8cc46a', paprika: '#e2724b', vid: '#9b7bd0' };
  const cropColor = (c) => CROP_COLOR[norm(c)] || '#98a8a0';
  const MONTHS = { es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  const MONTH_KEYS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const monthName = (key) => { const i = MONTH_KEYS.indexOf(key); return i < 0 ? key : MONTHS[lang][i]; };
  const MONTH_INITIALS = { es: 'E F M A M J J A S O N D', en: 'J F M A M J J A S O N D' };
  const MIX_NAMES = { 'Actual (Autodema 2016)': 'mixCur', 'Menos alfalfa (ilustrativo)': 'mixLess', 'Diversificada (ilustrativo)': 'mixDiv' };
  const mixName = (k) => (MIX_NAMES[k] ? t(MIX_NAMES[k]) : k);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* =====================================================================
     API client: relative URLs, long first timeout (cold start), typed errors, wake banner
     ===================================================================== */
  class ApiError extends Error { constructor(kind, status) { super(kind); this.kind = kind; this.status = status || 0; } }
  let everUp = false, wakeTimer = null, inflightFirst = 0;
  const wakeEl = $('#wake');

  function friendly(e) {
    if (!e || !e.kind) return t('errServer');
    return { timeout: t('errTimeout'), network: t('errNetwork'), rate: t('errRate') }[e.kind] || t('errServer');
  }
  async function api(path, opts) {
    const ctrl = new AbortController();
    const ms = everUp ? 30000 : 90000;
    const timer = setTimeout(() => ctrl.abort(), ms);
    if (!everUp) {
      inflightFirst++;
      if (!wakeTimer) wakeTimer = setTimeout(() => { if (!everUp) wakeEl.hidden = false; }, 3500);
    }
    try {
      const res = await fetch(path, { ...(opts || {}), signal: ctrl.signal });
      if (!res.ok) throw new ApiError(res.status === 429 ? 'rate' : 'http', res.status);
      const data = await res.json();
      everUp = true; wakeEl.hidden = true; clearTimeout(wakeTimer); wakeTimer = null;
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(e && e.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
      if (!everUp) { inflightFirst--; if (inflightFirst <= 0) { wakeEl.hidden = true; clearTimeout(wakeTimer); wakeTimer = null; } }
    }
  }
  const memo = new Map();
  function cached(key, fn) {
    if (!memo.has(key)) memo.set(key, fn().catch((e) => { memo.delete(key); throw e; }));
    return memo.get(key);
  }
  let awakeP = null;
  const awake = () => (awakeP = awakeP || api('/health').catch((e) => { awakeP = null; throw e; }));

  const getMixes = () => cached('mixes', async () => { await awake(); return api('/api/model/mixes'); });
  const getCrops = () => cached('crops', async () => { await awake(); return (await api('/api/model/rotation-crops')).crops; });
  const getIrrigated = () => cached('irr', async () => { await awake(); return api('/api/model/irrigated?zone=majes'); });
  const getRotations = (crop) => cached('rot:' + crop + ':' + lang, async () => { await awake(); return api('/api/model/rotations?' + new URLSearchParams({ crop, lang })); });
  const getCalendar = (seq, scn) => cached('cal:' + seq.join(',') + ':' + scn + ':' + lang, async () => { await awake(); return api('/api/model/calendar?' + new URLSearchParams({ sequence: seq.join(','), scenario: scn, lang })); });
  const getVulnerability = () => cached('vul:' + lang, async () => { await awake(); return api('/api/model/vulnerability?' + new URLSearchParams({ zone: 'majes', lang })); });
  const getPoint = (la, lo) => cached('pt:' + la + ',' + lo + ':' + lang, async () => { await awake(); return api('/api/model/point?' + new URLSearchParams({ lat: la, lon: lo, zone: 'majes', lang })); });
  const getDryPct = () => cached('dry', async () => {
    const r = await getCalendar(['Papa'], 'normal');
    return 100 * r.entrega_seca_anual_m3_ha / r.entrega_anual_m3_ha;
  });
  const getSim = (mixKey, cap) => cached('sim:' + mixKey + ':' + cap.toFixed(2) + ':' + lang, async () => {
    const mixes = await getMixes();
    await awake();
    return api('/api/model/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mix: mixes[mixKey], cap_pct: cap, area_ha: 15900, et0_method: 'hargreaves', lang }) });
  });
  const currentMixKey = async () => { const m = await getMixes(); return Object.keys(m).find((k) => k.startsWith('Actual')) || Object.keys(m)[0]; };

  /* A demo container: loading / ready / error with retry, loaded when it nears the viewport */
  function makeDemo(el, load, margin) {
    const state = $('.demo__state', el);
    let started = false;
    const run = async () => {
      el.dataset.state = 'loading';
      state.innerHTML = `<span>${esc(t('loading'))}</span>`;
      try { await load(); el.dataset.state = 'ready'; state.innerHTML = ''; }
      catch (e) {
        el.dataset.state = 'error';
        state.innerHTML = `<span>${esc(friendly(e))}</span><button type="button" class="btn btn--small btn--ghost">${esc(t('retry'))}</button>`;
        $('button', state).addEventListener('click', run);
      }
    };
    const start = () => { if (!started) { started = true; run(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: margin || '600px 0px' });
      io.observe(el);
    } else start();
    return { run, start };
  }
  function onceVisible(el, fn, threshold) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: threshold || 0.25 });
    io.observe(el);
  }

  /* =====================================================================
     HERO: stats from the model + the irrigated pixels drawn on a canvas
     ===================================================================== */
  const ramp = (v) => {   // NDVI 0.3 .. 0.66 -> dry ochre to bright leaf
    const x = clamp((v - 0.3) / 0.36, 0, 1);
    const a = [190, 150, 70], b = [96, 178, 92], c = [200, 245, 140];
    const m = x < 0.5 ? mix(a, b, x / 0.5) : mix(b, c, (x - 0.5) / 0.5);
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  };
  const mix = (p, q, k) => [Math.round(p[0] + (q[0] - p[0]) * k), Math.round(p[1] + (q[1] - p[1]) * k), Math.round(p[2] + (q[2] - p[2]) * k)];

  let heroPoints = null, heroProgress = 1;
  function drawHero() {
    const cv = $('#hero-canvas');
    if (!heroPoints || !cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
    heroPoints.forEach(([la, lo]) => { minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo); });
    const kx = Math.cos(((minLa + maxLa) / 2) * Math.PI / 180);
    const spanX = (maxLo - minLo) * kx, spanY = maxLa - minLa;
    const pad = Math.min(w, h) * 0.06;
    const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
    const ox = (w - spanX * scale) / 2, oy = (h - spanY * scale) / 2;
    const cell = Math.max(2, 0.0021 * scale * 0.88);
    const P = heroProgress;
    heroPoints.forEach(([la, lo, nd]) => {
      const x = ox + (lo - minLo) * kx * scale, y = oy + (maxLa - la) * scale;
      const key = 0.5 * ((lo - minLo) / (maxLo - minLo)) + 0.5 * ((maxLa - la) / (maxLa - minLa));
      const a = clamp((P * 1.45 - key) * 5, 0, 1);
      if (a <= 0) return;
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = ramp(nd);
      ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
    });
    ctx.globalAlpha = 1;
  }
  function revealHero() {
    if (reduced()) { heroProgress = 1; drawHero(); return; }
    const t0 = performance.now(), dur = 2600;
    heroProgress = 0;
    const tick = (now) => {
      heroProgress = clamp((now - t0) / dur, 0, 1);
      heroProgress = 1 - Math.pow(1 - heroProgress, 3);
      drawHero();
      if ((now - t0) < dur) requestAnimationFrame(tick); else { heroProgress = 1; drawHero(); }
    };
    requestAnimationFrame(tick);
  }
  function countTo(el, value, d) {
    if (reduced()) { el.textContent = fmt(value, d); return; }
    const t0 = performance.now(), dur = 1100;
    const tick = (now) => {
      const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(value * e, d);
      if (k < 1) requestAnimationFrame(tick); else el.textContent = fmt(value, d);
    };
    requestAnimationFrame(tick);
  }

  let heroNums = null;
  function renderHeroStats() {
    if (!heroNums) return;
    $('#st-demand').textContent = fmt(heroNums.low) + ' – ' + fmt(heroNums.high);
    $('#hero-cap').textContent = heroPoints ? t('heroCap', { n: fmt(heroPoints.length) }) : t('heroCapLoad');
  }
  async function loadHero() {
    const cap = $('#hero-cap'), src = $('.hero__src');
    cap.textContent = t('heroCapLoad');
    try {
      await awake();
      const key = await currentMixKey();
      const dryPct = await getDryPct();
      const [normal, dry, pts] = await Promise.all([getSim(key, 100), getSim(key, dryPct), getIrrigated()]);
      heroNums = { low: normal.demand_range_hm3.low, high: normal.demand_range_hm3.high };
      $('#st-supply').textContent = ''; $('#st-dry').textContent = '';
      countTo($('#st-supply'), normal.cap_hm3, 0);
      countTo($('#st-dry'), dry.cap_hm3, 0);
      heroPoints = pts;
      renderHeroStats();
      revealHero();
      src.textContent = (lang === 'en' ? EN.stSrc : esHtml.get(src) || src.textContent);
    } catch (e) {
      src.innerHTML = '';
      const span = document.createElement('span');
      span.textContent = t('heroFail', { err: friendly(e) }) + ' ';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn--small btn--ghost'; b.textContent = t('retry');
      b.addEventListener('click', () => { src.textContent = lang === 'en' ? EN.stSrc : esHtml.get(src); loadHero(); });
      src.append(span, b);
      cap.textContent = '';
    }
  }
  rerender.push(renderHeroStats);

  /* =====================================================================
     Water bar: demand range against delivered water (one persistent DOM, so changes animate)
     ===================================================================== */
  function verdictOf(r) {
    const low = r.demand_range_hm3.low, high = r.demand_range_hm3.high, cap = r.cap_hm3;
    if (low > cap) return ['bad', 'vBad'];
    if (high > cap) return ['tight', 'vTight'];
    if (high > 0.9 * cap) return ['tight', 'vNarrow'];
    return ['ok', 'vOk'];
  }
  function makeWBar(host) {
    host.innerHTML = `<div class="wbar" role="img"><div class="wbar__track"><i class="wbar__low"></i><i class="wbar__range"></i><i class="wbar__over"></i></div><div class="wbar__supply"><span></span></div></div>
      <div class="wnums"></div><span class="verdict" hidden></span>`;
    const q = (s) => $(s, host);
    return (r) => {
      const low = r.demand_range_hm3.low, high = r.demand_range_hm3.high, cap = r.cap_hm3;
      const max = Math.max(cap, high) * 1.12;
      const pc = (v) => (100 * v / max).toFixed(2);
      const set = (sel, l, w) => { const el = q(sel); el.style.setProperty('--l', l); if (w !== undefined) el.style.setProperty('--w', w); };
      set('.wbar__low', 0, pc(low));
      set('.wbar__range', pc(low), pc(Math.max(0, high - low)));
      set('.wbar__over', pc(Math.min(cap, high)), pc(Math.max(0, high - cap)));
      const sup = q('.wbar__supply'); set('.wbar__supply', pc(cap));
      sup.classList.toggle('is-edge', cap / max < 0.28);
      $('span', sup).textContent = t('supplyAt', { n: fmt(cap) });
      q('.wbar').setAttribute('aria-label', t('barAria', { c: fmt(cap), l: fmt(low), h: fmt(high) }));
      const [tone, key] = verdictOf(r);
      const v = q('.verdict'); v.hidden = false; v.className = 'verdict verdict--' + tone; v.textContent = t(key);
    };
  }
  // simpler, explicit number line for the demos (avoids string surgery above)
  function numsHtml(r) {
    const low = r.demand_range_hm3.low, high = r.demand_range_hm3.high;
    return `<div><span>${esc(t('needLbl'))}</span> <b>${fmt(low)} – ${fmt(high)}</b><span>hm³</span></div><div><span>${esc(t('haveLbl'))}</span> <b>${fmt(r.cap_hm3)}</b><span>hm³</span></div>`;
  }
  function wbarUpdate(host, r, update) { update(r); $('.wnums', host).innerHTML = numsHtml(r); }

  /* ---------- problem demo 1: normal year / dry year ---------- */
  (() => {
    const el = $('#demo-supply'), body = $('.demo__body', el);
    let scn = 'normal', update = null, last = null;
    const legend = () => `<div class="legend"><span><i style="background:var(--water)"></i>${esc(t('lgLow'))}</span><span><i style="background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--water) 55%,transparent) 0 3px,color-mix(in srgb,var(--water) 18%,transparent) 3px 6px)"></i>${esc(t('lgRange'))}</span><span><i style="background:repeating-linear-gradient(135deg,var(--deficit) 0 3px,color-mix(in srgb,var(--deficit) 45%,transparent) 3px 6px)"></i>${esc(t('lgOver'))}</span><span><i style="background:var(--fg);width:3px;border-radius:0"></i>${esc(t('lgSupply'))}</span></div>`;
    const load = async () => {
      const key = await currentMixKey(); const dryPct = await getDryPct();
      last = await getSim(key, scn === 'dry' ? dryPct : 100);
      if (!update) { body.innerHTML = '<div class="wb"></div>' + legend(); update = makeWBar($('.wb', body)); }
      wbarUpdate($('.wb', body), last, update);
      $('.legend', body).outerHTML = legend();
    };
    const d = makeDemo(el, load, '900px 0px');
    $$('.seg button', el).forEach((b) => b.addEventListener('click', async () => {
      scn = b.dataset.scn;
      $$('.seg button', el).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      if (el.dataset.state === 'ready') { try { await load(); } catch (e) { d.run(); } }
    }));
    rerender.push(() => { if (el.dataset.state === 'ready') load().catch(() => {}); });
  })();

  /* ---------- problem demo 2: the alfalfa waffle ---------- */
  (() => {
    const el = $('#demo-waffle'), body = $('.demo__body', el);
    let mixes = null, key = null, sim = null;
    const render = () => {
      const mix = mixes[key];
      const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);
      const water = {}; sim.per_crop.forEach((c) => { water[c.crop] = c.water_m3_ha; });
      let cells = [], used = 0;
      entries.forEach(([crop, share]) => { const n = Math.round(share); for (let i = 0; i < n && used < 100; i++, used++) cells.push(cropColor(crop)); });
      const total = entries.reduce((s, e) => s + e[1], 0);
      const rest = Math.max(0, 100 - total);
      const html = cells.map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join('') + Array.from({ length: Math.max(0, 100 - cells.length) }, (_, j) => `<i class="is-empty" style="--i:${cells.length + j}"></i>`).join('');
      const list = entries.map(([crop, share], i) => `<li class="${i === 0 ? 'is-top' : ''}"><i style="--c:${cropColor(crop)}"></i><span>${esc(cropName(crop))} <span class="w-per">${fmt(share, share < 1 ? 2 : 1)} %</span></span><span class="w-per">${water[crop] ? esc(t('waterHa', { n: fmt(water[crop]) })) : ''}</span></li>`).join('')
        + (rest > 0.5 ? `<li><i style="--c:transparent;border:1.5px dashed currentColor"></i><span>${esc(t('noDetail'))} <span class="w-per">${fmt(rest, 1)} %</span></span><span></span></li>` : '');
      const was = $('.waffle', body) && $('.waffle', body).classList.contains('is-on');
      body.innerHTML = `<div class="wafflebox"><div class="waffle ${was ? 'is-on' : ''}" role="img" aria-label="${esc(t('alfalfaShare', { p: fmt(mix.Alfalfa, 1) }))}">${html}</div><ul class="wlist">${list}</ul></div><p class="wnote">${esc(t('wafNote', { mix: mixName(key) }))}</p>`;
    };
    const load = async () => {
      mixes = await getMixes(); key = await currentMixKey(); sim = await getSim(key, 100);
      render();
      onceVisible(el, () => { const w = $('.waffle', body); if (w) w.classList.add('is-on'); }, 0.35);
    };
    makeDemo(el, load, '900px 0px');
    rerender.push(() => { if (mixes && sim) render(); });
  })();

  /* ---------- problem demo 3: the dry years ---------- */
  (() => {
    const ul = $('#dryyears');
    let vul = null, pct = null;
    const render = () => {
      if (!vul) return;
      const items = Object.entries(vul.anios_secos);
      const nums = items.map(([, s]) => parseFloat((String(s).match(/(\d+(?:[.,]\d+)?)\s*%/) || [0, 0])[1]));
      const maxN = Math.max(...nums, 1);
      ul.innerHTML = items.map(([y, s], i) => `<li><span class="y">${esc(y)}</span><span class="d">${esc(s)}</span><span class="drop" style="--w:${(100 * nums[i] / maxN).toFixed(0)}"></span></li>`).join('')
        + (pct != null ? `<li class="stress"><span class="y">${esc(t('dryStress'))}</span><span class="d">${esc(t('dryStressP', { pct: fmt(pct) }))}</span></li>` : '');
    };
    const load = async () => { [vul, pct] = await Promise.all([getVulnerability(), getDryPct()]); render(); };
    onceVisible(ul, () => { load().catch(() => { ul.innerHTML = `<li class="stress"><span class="d">${esc(t('errServer'))}</span></li>`; }); }, 0.01);
    rerender.push(() => { if (vul) getVulnerability().then((v) => { vul = v; render(); }).catch(() => {}); });
  })();

  /* =====================================================================
     ROUTE: map object, rail, active stop, HUD, progress
     ===================================================================== */
  const stopEls = $$('.stop');
  const rm = { path: $('#rm-dry'), wet: $('#rm-wet'), pulse: $('#rm-pulse'), items: $$('#routemap-list li'), pts: [], len: 0, vertical: false };
  const RM_D = 'M 30 120 C 170 10, 250 230, 400 120 S 640 10, 800 120 S 1040 230, 1170 120';

  function layoutRouteMap() {
    rm.vertical = window.matchMedia('(max-width: 959px)').matches;
    rm.path.setAttribute('d', RM_D); rm.wet.setAttribute('d', RM_D); rm.pulse.setAttribute('d', RM_D);
    if (rm.vertical) { rm.items.forEach((li) => { li.style.left = li.style.top = ''; }); return; }
    rm.len = rm.wet.getTotalLength();
    rm.wet.style.strokeDasharray = rm.len;
    const map = $('#routemap');
    map.style.setProperty('--len', rm.len + 'px'); map.style.setProperty('--seg', rm.len * 0.1 + 'px');
    rm.pulse.style.strokeDasharray = (rm.len * 0.1) + ' ' + rm.len;
    rm.items.forEach((li, i) => {
      const p = rm.wet.getPointAtLength(rm.len * (0.02 + 0.96 * i / (rm.items.length - 1)));
      rm.pts[i] = rm.len * (0.02 + 0.96 * i / (rm.items.length - 1));
      li.style.left = (100 * p.x / 1200) + '%';
      li.style.top = (100 * p.y / 240) + '%';
    });
    setMapActive(activeStop, true);
  }
  function setMapActive(n, instant) {
    rm.items.forEach((li, i) => { li.classList.toggle('is-active', i + 1 === n); li.classList.toggle('is-done', i + 1 < n); });
    if (!rm.vertical && rm.len) {
      const upTo = n > 0 ? rm.pts[n - 1] : 0;
      rm.wet.style.opacity = n > 0 ? '1' : '0';
      if (instant) { const tr = rm.wet.style.transition; rm.wet.style.transition = 'none'; rm.wet.style.strokeDashoffset = rm.len - upTo; void rm.wet.getBoundingClientRect(); rm.wet.style.transition = tr; }
      else rm.wet.style.strokeDashoffset = rm.len - upTo;
    }
  }

  const waypoints = () => [
    { el: $('#inicio'), label: () => t('hudStart') }, { el: $('#problema'), label: () => t('hudProblem') }, { el: $('#route'), label: () => t('hudRoute') },
    ...stopEls.map((el, i) => ({ el, stop: i + 1, label: () => `<b>${t('stopOf', { n: i + 1 })}</b>${esc($('.l', rm.items[i]).textContent)}` })),
    { el: $('#cierre'), label: () => t('hudClose') },
  ];
  let wps = null, activeWp = 0, activeStop = 0;
  const hud = $('#hud');
  function updateHud() {
    if (!wps) wps = waypoints();
    const w = wps[activeWp];
    $('#hud-txt').innerHTML = w.label();
    $$('#hud-dots i').forEach((d, i) => { d.classList.toggle('is-active', i + 1 === activeStop); d.classList.toggle('is-done', i + 1 < activeStop); });
    $('#hud-prev').disabled = activeWp === 0; $('#hud-next').disabled = activeWp === wps.length - 1;
  }
  function goWp(i) {
    wps = wps || waypoints();
    const w = wps[clamp(i, 0, wps.length - 1)];
    w.el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: w.stop ? 'start' : 'start' });
  }
  $('#hud-prev').addEventListener('click', () => goWp(activeWp - 1));
  $('#hud-next').addEventListener('click', () => goWp(activeWp + 1));

  const rails = $$('.rail'), topEl = $('#top');
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = window.innerHeight, y = window.scrollY, doc = document.documentElement.scrollHeight - vh;
      $('#progress-fill').style.setProperty('--p', doc > 0 ? (y / doc).toFixed(4) : 0);
      topEl.classList.toggle('is-solid', y > 40);
      hud.hidden = y < vh * 0.55;
      const line = vh * 0.55;
      // rail fill
      rails.forEach((rail) => { const rr = rail.getBoundingClientRect(); $('i', rail).style.setProperty('--fill', rr.height ? clamp((line - rr.top) / rr.height, 0, 1).toFixed(4) : 0); });
      // active stop and waypoint
      let st = 0;
      stopEls.forEach((s, i) => { const r = s.getBoundingClientRect(); s.classList.toggle('is-passed', r.top < line); if (r.top < line) st = i + 1; });
      stopEls.forEach((s, i) => s.classList.toggle('is-active', i + 1 === st));
      if (st !== activeStop) { activeStop = st; setMapActive(st, false); }
      if (!wps) wps = waypoints();
      let wi = 0;
      wps.forEach((w, i) => { if (w.el.getBoundingClientRect().top < line) wi = i; });
      if (wi !== activeWp) { activeWp = wi; }
      updateHud();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { layoutRouteMap(); drawHero(); onScroll(); });

  /* =====================================================================
     STOP 2: Leaflet map of irrigated pixels, tap for what NASA saw
     ===================================================================== */
  (() => {
    const el = $('#demo-map'), info = $('#pixel-info');
    let map = null, layer = null, poly = null, pts = null, lastPoint = null;
    const kindKey = { 'regado': ['kindIrr', true], 'mixto (parte regada)': ['kindMixed', true], 'desierto o sin riego': ['kindDesert', false], 'sin dato': ['kindNone', false] };
    const kindColor = { 'regado': '#8cc46a', 'mixto (parte regada)': '#d9a74a', 'desierto o sin riego': '#9a9484', 'sin dato': '#6d7a74' };

    function spark(r) {
      const ys = Object.keys(r.ndvi_por_anio), vs = ys.map((y) => r.ndvi_por_anio[y]);
      const mn = Math.min(...vs), mx = Math.max(...vs), W = 600, H = 90, px = (i) => 10 + (i / (ys.length - 1)) * (W - 20), py = (v) => 16 + (1 - (v - mn) / ((mx - mn) || 1)) * (H - 34);
      const line = vs.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
      const dryYears = Object.keys(r.anios_secos);
      const dots = ys.map((y, i) => {
        const isDry = dryYears.includes(y);
        return `<circle cx="${px(i).toFixed(1)}" cy="${py(vs[i]).toFixed(1)}" r="${isDry ? 5.5 : 2.6}" fill="${isDry ? 'none' : 'var(--leaf)'}" stroke="${isDry ? 'var(--deficit)' : 'none'}" stroke-width="2.2"/>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('pxCap', { years: dryYears.join(', ') }))}"><line x1="10" x2="${W - 10}" y1="${H - 8}" y2="${H - 8}" stroke="var(--line)"/><path d="${line}" fill="none" stroke="var(--leaf)" stroke-width="2" vector-effect="non-scaling-stroke"/>${dots}<text x="10" y="${H - 0}" font-size="9" fill="var(--mute)">${ys[0]}</text><text x="${W - 10}" y="${H - 0}" font-size="9" text-anchor="end" fill="var(--mute)">${ys[ys.length - 1]}</text></svg>`;
    }
    function renderPixel() {
      const r = lastPoint;
      if (!r) { info.innerHTML = `<p class="pixel__warn">${esc(t('pxHint'))}</p>`; return; }
      if (!r.inside) { info.innerHTML = `<p class="pixel__warn">${esc(r.message || t('pxOut'))}</p>`; return; }
      const [kk, irr] = kindKey[r.tipo] || ['kindNone', false];
      const dry = Object.entries(r.anios_secos).map(([y, d]) => esc(t('pxDry', { y, c: (d.cambio_pct > 0 ? '+' : '') + fmt(d.cambio_pct, 1), why: d.por_que }))).join('<br>');
      info.innerHTML = `<div class="pixel__top"><span class="pixel__kind ${irr ? '' : 'is-other'}">${esc(t(kk))}</span>
        <span class="pixel__kv"><b>${r.ndvi_medio_2013_2024 == null ? '—' : fmt(r.ndvi_medio_2013_2024, 2)}</b><span>${esc(t('pxNdvi'))}</span></span>
        ${r.et_mm_anual != null ? `<span class="pixel__kv"><b>${fmt(r.et_mm_anual)}</b><span>${esc(t('pxEt'))}</span></span>` : ''}</div>
        <div class="spark">${spark(r)}<p class="spark__cap">${esc(t('pxCap', { years: Object.keys(r.anios_secos).join(', ') }))}</p><p class="spark__cap">${dry}</p></div>
        <p class="pixel__warn">${esc(t('pxWarn', { ha: fmt(r.pixel_ha, 1) }))} ${esc(t('pxSrc'))}</p>`;
    }
    async function pick(la, lo, fly) {
      try {
        const r = await getPoint(la, lo);
        lastPoint = r; renderPixel();
        if (poly) { map.removeLayer(poly); poly = null; }
        if (r.inside) {
          const c = kindColor[r.tipo] || '#fff';
          poly = L.polygon(r.square, { color: '#ffffff', weight: 2, fillColor: c, fillOpacity: 0.4 }).addTo(map);
          if (fly) { if (reduced()) map.setView([la, lo], Math.max(map.getZoom(), 13), { animate: false }); else map.flyTo([la, lo], Math.max(map.getZoom(), 13), { duration: 0.7 }); }
        }
      } catch (e) { info.innerHTML = `<p class="pixel__warn">${esc(friendly(e))}</p>`; }
    }
    const radiusFor = (z) => clamp(0.9 * Math.pow(2, z - 10.5), 1.6, 26);
    const load = async () => {
      if (!window.L) throw new ApiError('map');
      pts = await getIrrigated();
      if (!map) {
        const touch = L.Browser.mobile || window.matchMedia('(pointer: coarse)').matches;
        map = L.map('map-el', { preferCanvas: true, dragging: !touch, scrollWheelZoom: false, zoomSnap: 0.5 });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 16 }).addTo(map);
        const las = pts.map((p) => p[0]), los = pts.map((p) => p[1]);
        map.fitBounds([[Math.min(...las), Math.min(...los)], [Math.max(...las), Math.max(...los)]], { padding: [10, 10] });
        const renderer = L.canvas({ padding: 0.4 });
        layer = L.layerGroup(pts.map(([la, lo, nd]) => L.circleMarker([la, lo], { renderer, radius: radiusFor(map.getZoom()), stroke: false, fillColor: ramp(nd), fillOpacity: 0.78, interactive: false }))).addTo(map);
        map.on('zoomend', () => { const r = radiusFor(map.getZoom()); layer.eachLayer((m) => m.setRadius(r)); });
        map.on('click', (e) => { $('#map-hint').hidden = true; pick(e.latlng.lat, e.latlng.lng, true); });
        map.on('focus', () => map.scrollWheelZoom.enable()); map.on('blur', () => map.scrollWheelZoom.disable());
        setTimeout(() => map.invalidateSize(), 300);
        // start with a real cell so the panel is never empty
        const cla = (Math.min(...las) + Math.max(...las)) / 2, clo = (Math.min(...los) + Math.max(...los)) / 2;
        const near = pts.reduce((b, p) => (Math.hypot(p[0] - cla, p[1] - clo) < Math.hypot(b[0] - cla, b[1] - clo) ? p : b), pts[0]);
        pick(near[0], near[1], false);
      }
    };
    makeDemo(el, load, '700px 0px');
    $('#map-random').addEventListener('click', () => { if (!pts || !map) return; const p = pts[Math.floor(Math.random() * pts.length)]; $('#map-hint').hidden = true; pick(p[0], p[1], true); });
    rerender.push(() => { renderPixel(); if (lastPoint && lastPoint.inside) getPoint(lastPoint.square[0][0], lastPoint.square[0][1]).catch(() => {}); });
  })();

  /* =====================================================================
     STOP 3: ledger counters. STOP 7: duel bars.
     ===================================================================== */
  (() => {
    const ledger = $('#ledger');
    onceVisible(ledger, () => {
      if (reduced()) return;
      $$('b[data-count]', ledger).forEach((b) => {
        const end = parseFloat(b.dataset.count), d = parseInt(b.dataset.dec || '0', 10);
        const t0 = performance.now(), dur = 1300;
        const tick = (now) => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); b.textContent = fmt(end * e, d); if (k < 1) requestAnimationFrame(tick); else b.textContent = fmt(end, d); };
        b.textContent = fmt(0, d); requestAnimationFrame(tick);
      });
    }, 0.4);
    onceVisible($('.duel'), () => $('.duel').classList.add('is-in'), 0.4);
  })();

  /* =====================================================================
     STOP 4: water calendar, dry-year switch
     ===================================================================== */
  (() => {
    const el = $('#demo-calendar'), body = $('.demo__body', el), sw = $('#dry-switch');
    let dry = false, seq = null, base = null, data = { normal: null, dry: null }, firstDraw = true, prevShort = new Set();
    const niceTop = (v) => { const step = v > 6000 ? 2000 : v > 2500 ? 1000 : 500; return Math.ceil(v / step) * step; };
    const H = 118, W = 360;

    function chart(c, supply, ghost, top, animate) {
      const low = c.demand_range_m3_ha.low, high = c.demand_range_m3_ha.high;
      const short = new Set((c.meses_con_deficit || []).map((d) => MONTH_KEYS.indexOf(d.mes)));
      const bw = W / 12, y = (v) => H - (v / top) * (H - 4);
      const grid = [0, top / 2, top].map((v) => `<line class="grid" x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
      const band = high.map((h, i) => (h > low[i] ? `<rect class="band" x="${i * bw + 3}" y="${y(h)}" width="${bw - 6}" height="${Math.max(0, y(low[i]) - y(h))}"/>` : '')).join('');
      const bars = low.map((v, i) => (v > 0 ? `<rect class="bar ${short.has(i) ? 'is-short' : ''}" x="${i * bw + 3}" y="${y(v)}" width="${bw - 6}" height="${H - y(v)}" rx="1.5"/>` : '')).join('');
      const path = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * bw + 1} ${y(v)} L${(i + 1) * bw - 1} ${y(v)}`).join(' ');
      const ticks = [0, top / 2, top].map((v) => `<span style="bottom:${(v / top) * (H - 4) / H * 100}%">${fmt(v)}</span>`).join('');
      const months = MONTH_INITIALS[lang].split(' ').map((m, i) => `<span>${m}${short.has(i) ? '<br><span class="bad">!</span>' : ''}</span>`).join('');
      const nShort = short.size;
      const [tone, vt] = !c.cabe_en_el_anio ? ['bad', t('calNo')] : nShort ? ['tight', t('calShort', { n: nShort })] : ['ok', t('calOk')];
      const tot = c.total_range_m3_ha;
      const total = tot.low !== tot.high ? t('calTotal', { l: fmt(tot.low), h: fmt(tot.high) }) : t('calTotalOne', { l: fmt(tot.low) });
      return `<figure class="chart"><figcaption><b>${esc(cropName(c.cultivo))}</b><span>${esc(t('calSown', { m: monthName(c.mes_siembra) }))}. ${esc(total)}</span></figcaption>
        <div class="chart__plot"><div class="chart__y">${ticks}</div><div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(cropName(c.cultivo))}: ${esc(vt)}">${grid}${band}${bars}${ghost ? `<path class="ghost" d="${path(ghost)}"/>` : ''}<path class="supply ${animate ? 'is-draw' : ''}" d="${path(supply)}"/></svg>
        <div class="chart__m">${months}</div></div></div><p class="chart__verdict ${tone}">${esc(vt)}</p></figure>`;
    }
    function render(animate) {
      if (!data.normal || !data.dry) return;
      const cur = dry ? data.dry : data.normal;
      const all = [...data.normal.entrega_m3_ha, ...data.dry.entrega_m3_ha, ...cur.campanas.flatMap((c) => c.demand_range_m3_ha.high)];
      const top = niceTop(Math.max(...all) * 1.05);
      const count = (d) => d.campanas.reduce((s, c) => s + (c.meses_con_deficit || []).length, 0);
      const m = cur.et0_range_methods;
      body.innerHTML = `<p class="cal__note" style="margin:0 0 .9rem">${esc(t('calSeq', { seq: seq.map(cropName).join(' → '), crop: cropName(base) }))}</p>
        <div class="charts">${cur.campanas.map((c) => chart(c, cur.entrega_m3_ha, dry ? data.normal.entrega_m3_ha : null, top, animate)).join('')}</div>
        <div class="legend"><span><i style="background:var(--water)"></i>${esc(t('calLeg1'))}</span><span><i style="background:color-mix(in srgb,var(--water) 24%,transparent);border:1px dashed var(--water)"></i>${esc(t('calLeg2'))}</span><span><i style="background:var(--deficit)"></i>${esc(t('calLeg3'))}</span><span><i style="background:var(--fg);height:3px"></i>${esc(t('calLeg4'))}</span>${dry ? `<span><i style="border-top:2px dashed var(--fg);height:0;opacity:.5"></i>${esc(t('calLeg5'))}</span>` : ''}</div>
        <div class="cal__sum">${esc(cur.resumen)}<span class="delta">${esc(t('calDelta', { a: count(data.normal), b: count(data.dry) }))}</span></div>
        ${m ? `<p class="cal__note">${esc(t('calMethods', { low: t(m.low === 'pm' ? 'pm' : 'hargreaves'), high: t(m.high === 'pm' ? 'pm' : 'hargreaves') }))}</p>` : ''}`;
    }
    const load = async () => {
      const crops = await getCrops();
      base = crops.includes('Alfalfa') ? 'Alfalfa' : crops[0];
      const rots = await getRotations(base);
      seq = rots[0].sequence.slice(1);
      const [n, d] = await Promise.all([getCalendar(seq, 'normal'), getCalendar(seq, 'dry')]);
      data = { normal: n, dry: d };
      render(false);
    };
    makeDemo(el, load, '700px 0px');
    sw.addEventListener('click', () => {
      dry = !dry; sw.setAttribute('aria-checked', String(dry));
      render(true);
    });
    rerender.push(() => { if (el.dataset.state === 'ready') { Promise.all([getCalendar(seq, 'normal'), getCalendar(seq, 'dry')]).then(([n, d]) => { data = { normal: n, dry: d }; render(false); }).catch(() => {}); } });
  })();

  /* =====================================================================
     STOP 5: rotation engine, crop picker
     ===================================================================== */
  (() => {
    const el = $('#demo-rot'), body = $('.demo__body', el), chips = $('#rot-chips');
    let crop = 'Alfalfa', list = null, crops = null;
    const pips = (n, color) => `<span class="pips" style="--mc:${color}" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
    const tile = (c) => `<span class="tile"><i style="--c:${cropColor(c)}"></i>${esc(cropName(c))}</span>`;
    function fit(r) {
      const f = r.facts && r.facts.agua_cabe; if (!f) return '';
      const [tone, txt] = !f.cabe_en_el_anio ? ['bad', t('fitNo', { crops: (f.no_caben || []).map(cropName).join(', ') })] : f.max_meses_con_deficit ? ['tight', t('fitShort', { n: f.max_meses_con_deficit })] : ['ok', t('fitOk')];
      const wr = r.facts.water_range_m3_ha_campaign;
      const w = wr ? (wr.low !== wr.high ? t('rotWater', { l: fmt(wr.low), h: fmt(wr.high) }) : t('rotWaterOne', { l: fmt(wr.low) })) : '';
      return `<p class="rot__water"><span class="tag ${tone}">${esc(txt)}</span>${esc(w)}</p>`;
    }
    function card(r, kind, n) {
      const head = kind === 'now' ? t('rotNow', { crop: cropName(crop) }) : n === 1 ? t('rotBest') : t('rotN', { n });
      return `<li class="rot ${kind === 'top' ? 'rot--top' : ''} ${kind === 'now' ? 'rot--now' : ''}"><div class="rot__head"><b>${esc(head)}</b></div>
        <div class="seq"><span class="seq__base">${esc(cropName(crop))} (${esc(t('now'))})</span>${r.sequence.slice(1).map((c) => `<span class="seq__sep" aria-hidden="true">›</span>${tile(c)}`).join('')}</div>
        <div class="meters"><span class="meter">${esc(t('mWater'))} ${pips(r.adj_water, 'var(--water)')}</span><span class="meter">${esc(t('mSoil'))} ${pips(r.adj_soil, 'var(--ochre)')}</span><span class="meter">${esc(t('mIncome'))} ${pips(r.adj_income, 'var(--leaf)')}</span></div>
        ${fit(r)}${kind === 'top' ? `<p class="rot__why">${esc(r.rationale)}</p>` : ''}</li>`;
    }
    function render() {
      if (!list) return;
      const gens = list.filter((r) => r.id !== 'actual').slice(0, 3), now = list.find((r) => r.id === 'actual');
      body.innerHTML = `<ol class="rots">${gens.map((r, i) => card(r, i === 0 ? 'top' : 'other', i + 1)).join('')}${now ? card(now, 'now', 0) : ''}</ol><p class="rots__note">${esc(t('rotNote'))}</p>`;
    }
    function drawChips() {
      chips.innerHTML = crops.map((c) => `<button type="button" class="chip" role="radio" aria-checked="${c === crop}" data-crop="${esc(c)}"><i style="--c:${cropColor(c)}"></i>${esc(cropName(c))}</button>`).join('');
    }
    async function choose(c) {
      crop = c; drawChips(); body.setAttribute('aria-busy', 'true');
      try { list = await getRotations(c); render(); } catch (e) { body.innerHTML = `<p class="rots__note">${esc(friendly(e))}</p>`; }
      body.removeAttribute('aria-busy');
    }
    const load = async () => { crops = await getCrops(); if (!crops.includes(crop)) crop = crops[0]; drawChips(); list = await getRotations(crop); render(); };
    makeDemo(el, load, '700px 0px');
    chips.addEventListener('click', (e) => { const b = e.target.closest('button[data-crop]'); if (b) choose(b.dataset.crop); });
    chips.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const bs = $$('button', chips), i = bs.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      const nb = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length]; nb.focus(); nb.click();
    });
    rerender.push(() => { if (crops) { drawChips(); getRotations(crop).then((l) => { list = l; render(); }).catch(() => {}); } });
  })();

  /* =====================================================================
     STOP 6: the real interface, loaded on request
     ===================================================================== */
  $('#frame-load').addEventListener('click', () => {
    const body = $('#frame-body');
    const f = document.createElement('iframe');
    f.src = '/app/'; f.title = t('frameTitle'); f.loading = 'lazy';
    body.innerHTML = ''; body.appendChild(f);
  });

  /* =====================================================================
     STOP 7: the range demo and the model's own caveats. STOP 8: the board question
     ===================================================================== */
  (() => {
    const el = $('#demo-range'), body = $('.demo__body', el);
    let r = null, update = null;
    const render = () => {
      if (!r) return;
      if (!update) { body.innerHTML = '<div class="wb"></div><div class="legend"></div>'; update = makeWBar($('.wb', body)); }
      wbarUpdate($('.wb', body), r, update);
      $('.legend', body).innerHTML = `<span><i style="background:var(--water)"></i>${esc(t('rangeLow'))}: ${fmt(r.demand_range_hm3.low)} hm³</span><span><i style="background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--water) 55%,transparent) 0 3px,color-mix(in srgb,var(--water) 18%,transparent) 3px 6px)"></i>${esc(t('rangeHigh'))}: ${fmt(r.demand_range_hm3.high)} hm³</span>`;
      const det = $('#caveats'), ul = $('#caveats-list');
      if (r.caveats && r.caveats.length) { ul.innerHTML = r.caveats.map((c) => `<li>${esc(c)}</li>`).join(''); det.hidden = false; }
    };
    const load = async () => { const key = await currentMixKey(); r = await getSim(key, 100); update = null; render(); };
    makeDemo(el, load, '900px 0px');
    rerender.push(() => { if (r) currentMixKey().then((k) => getSim(k, 100)).then((x) => { r = x; render(); }).catch(() => {}); });
  })();

  (() => {
    const el = $('#demo-board'), body = $('.demo__body', el), seg = $('#board-seg');
    let key = null, keys = null, bars = null, dryPct = null;
    const build = () => {
      body.innerHTML = `<p class="wnote" style="margin:0 0 .6rem" id="board-alf"></p>
        <div class="brow"><p class="brow__t" id="b-n"></p><div id="b-nbar"></div></div>
        <div class="brow"><p class="brow__t" id="b-d"></p><div id="b-dbar"></div></div>
        <p class="board__src" id="b-src"></p>`;
      bars = { n: makeWBar($('#b-nbar')), d: makeWBar($('#b-dbar')) };
    };
    async function refresh() {
      const [n, d, mixes] = await Promise.all([getSim(key, 100), getSim(key, dryPct), getMixes()]);
      $('#b-n').textContent = t('scnNormalShort'); $('#b-d').textContent = t('scnDryShort') + ' (' + fmt(dryPct) + ' %)';
      wbarUpdate($('#b-nbar'), n, bars.n); wbarUpdate($('#b-dbar'), d, bars.d);
      $('#board-alf').textContent = mixes[key].Alfalfa != null ? t('alfalfaShare', { p: fmt(mixes[key].Alfalfa, 1) }) : '';
      $('#b-src').textContent = t('boardNote');
    }
    function drawSeg() { seg.innerHTML = keys.map((k) => `<button type="button" role="radio" aria-checked="${k === key}" data-k="${esc(k)}">${esc(mixName(k))}</button>`).join(''); }
    const load = async () => {
      const mixes = await getMixes(); keys = Object.keys(mixes); key = await currentMixKey(); dryPct = await getDryPct();
      drawSeg(); build(); await refresh();
    };
    makeDemo(el, load, '900px 0px');
    seg.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-k]'); if (!b) return;
      key = b.dataset.k; drawSeg();
      try { await refresh(); } catch (err) { $('#b-src').textContent = friendly(err); }
    });
    rerender.push(() => { if (keys && bars) { drawSeg(); refresh().catch(() => {}); } });
  })();

  /* =====================================================================
     Boot
     ===================================================================== */
  applyStatic();
  $$('.langsw button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  layoutRouteMap();
  onScroll();
  /* =====================================================================
     3D terrain (progressive enhancement): the 2D canvas / Leaflet map stay as the fallback
     ===================================================================== */
  let terrainMod = null;
  const loadTerrain = () => terrainMod || (terrainMod = import('./terrain3d.js').then((m) => m.default).catch((e) => { terrainMod = null; throw e; }));
  async function mountHero3D() {
    const box = $('#hero-map');
    if (!box) return;
    try {
      const GO = await loadTerrain();
      if (!GO.isSupported()) return;
      const h = await GO.mount(box, { mode: 'hero', lang, interactive: false, showPixels: false, assetsBase: './terrain-assets/' });
      box.classList.add('has3d');
      rerender.push(() => h.setLang(lang));
      getIrrigated().then((p) => h.setPixels(p)).catch(() => { /* the scene works without the dots */ });
      if (!reduced()) {
        let raf = 0;
        const hero = $('#inicio');
        const upd = () => {
          raf = 0;
          const r = hero.getBoundingClientRect();
          const p = clamp(-r.top / Math.max(r.height, 1), 0, 1);
          if (p > 0) h.setProgress(0.16 * p);
        };
        window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
      }
    } catch (e) { /* keep the 2D canvas */ }
  }
  async function mountExplore3D() {
    const demo = $('#terrain-demo'), stage = $('#terrain-stage');
    if (!demo || !stage) return;
    try {
      const GO = await loadTerrain();
      if (!GO.isSupported()) return;
      demo.hidden = false;
      const h = await GO.mount(stage, { mode: 'explore', lang, interactive: true, showPixels: false, assetsBase: './terrain-assets/' });
      rerender.push(() => h.setLang(lang));
      getIrrigated().then((p) => h.setPixels(p)).catch(() => {});
      $$('[data-fly]', demo).forEach((b) => b.addEventListener('click', () => h.flyTo(b.dataset.fly, 2.6)));
      const dry = $('#t3d-dry');
      dry.addEventListener('click', () => {
        const on = dry.getAttribute('aria-pressed') !== 'true';
        dry.setAttribute('aria-pressed', String(on));
        h.setDry(on);
      });
    } catch (e) { demo.hidden = true; }
  }
  mountHero3D();
  onceVisible($('#demo-map') || document.body, mountExplore3D, 0.01);

  loadHero();
  if (!reduced()) onceVisible($('#routemap'), () => $('#routemap').classList.add('is-flowing'), 0.5);
  window.addEventListener('load', () => { layoutRouteMap(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawHero(); onScroll(); });
})();
