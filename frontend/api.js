/* Connects the advisor to the backend (rotations ranking) and to the water model (/api/model/simulate).
   Backend URL: window.FIELD_SHIFT_API or http://localhost:8765. If the API is down the page keeps working
   with its local ranking and the water panel says so. */
(function () {
  const API_BASE = (window.FIELD_SHIFT_API || (location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765')).replace(/\/$/, '');
  let rankSeq = 0;
  let apiUp = false;   // true after the first successful call; while true, app.js does not paint its local table

  function setStatus(ok) {
    const el = document.getElementById('api-status');
    if (!el) return;
    apiUp = ok;
    el.textContent = ok ? 'API conectada' : 'API sin conexión · cálculo local';
    el.className = 'text-[11px] font-mono-tech ' + (ok ? 'text-emerald-400' : 'text-amber-400');
  }

  async function getJson(path, options) {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    return res.json();
  }

  const toLocal = (r) => ({
    id: r.id, sequence: r.sequence, confidence: r.confidence, rationale: r.rationale,
    soilImpact: r.soil_impact, waterBalance: r.water_balance,
    adjWater: r.adj_water, adjSoil: r.adj_soil, adjIncome: r.adj_income,
    score: r.score, matchPct: r.match_pct,
    paretoX: r.pareto_x, paretoY: r.pareto_y, paretoOptimal: r.pareto_optimal,
  });

  /* Rotation ranking from the backend; the local result is already on screen, this replaces it. */
  async function refreshRanking() {
    const seq = ++rankSeq;
    const note = document.getElementById('zone-note');
    if (note) note.classList.toggle('hidden', state.zone === 'majes');
    try {
      const q = new URLSearchParams({ crop: state.currentCrop, water: state.priorities.water, soil: state.priorities.soil,
                                      income: state.priorities.income, salinity: state.climate.salinity });
      const ranked = await getJson('/api/model/rotations?' + q);   // rotations generated from rules + the water/soil/income model
      if (seq !== rankSeq) return;           // a newer request is in flight
      setStatus(true);
      recalculateAll(ranked.map(toLocal));
    } catch (err) {
      if (seq === rankSeq) { setStatus(false); recalculateAll(); }   // API down: fall back to the local table
    }
  }

  /* ---------- water and collective cap panel ---------- */
  const $ = (id) => document.getElementById(id);
  let mixes = {};
  let waterTimer = null;

  const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

  async function loadRotationCrops() {
    try {
      const { crops } = await getJson('/api/model/rotation-crops');
      const sel = $('select-cultivo');
      if (!sel || !crops.length) return;
      const keep = crops.includes(state.currentCrop) ? state.currentCrop : crops[0];
      sel.innerHTML = crops.map((c) => `<option value="${c}">${c}</option>`).join('');
      sel.value = keep;
      state.currentCrop = keep;
      syncIntroCrop();
      refreshRanking();
    } catch (err) { /* keeps the static crop list */ }
  }

  async function loadMixes() {
    try {
      mixes = await getJson('/api/model/mixes');
      $('water-mix').innerHTML = Object.keys(mixes).map((k) => `<option value="${k}">${k}</option>`).join('');
      setStatus(true);
      runWater();
    } catch (err) {
      setStatus(false);
      $('water-result').innerHTML = `<p class="text-amber-300 text-sm">El servicio del modelo no responde. Inicia el backend:
        <span class="font-mono-tech">uvicorn app.main:app --port 8765</span> (carpeta <span class="font-mono-tech">backend</span>).</p>`;
    }
  }

  async function runWater() {
    const name = $('water-mix').value;
    if (!mixes[name]) return;
    const pct = +$('water-cap').value;
    $('water-cap-label').textContent = pct === 100 ? 'Agua de un año normal' : `${pct} % del agua normal`;
    const body = { mix: mixes[name], cap_pct: pct, area_ha: +$('water-area').value,
                   efficiency: +$('water-eff').value, et0_method: $('water-et0').value };
    try {
      const r = await getJson('/api/model/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      setStatus(true);
      renderWater(r);
    } catch (err) {
      setStatus(false);
      $('water-result').innerHTML = `<p class="text-amber-300 text-sm">No se pudo calcular: ${String(err.message).slice(0, 160)}</p>`;
    }
  }

  function renderWater(r) {
    const use = r.use_pct;
    const tone = use <= 90 ? ['emerald', 'Alcanza el agua'] : use <= 100 ? ['amber', 'Alcanza con poco margen'] : ['rose', 'No alcanza'];
    const maxW = Math.max(130, use * 1.05);
    const crops = r.per_crop.map((c) => `<li class="flex justify-between gap-3"><span>${c.crop} <span class="text-slate-500">${fmt(c.share_pct, 1)} %</span></span>
        <span class="font-mono-tech text-slate-300">${c.water_m3_ha == null ? 's/d' : fmt(c.water_m3_ha) + ' m³/ha'}</span></li>`).join('');
    $('water-result').innerHTML = `
      <div class="flex items-center justify-between gap-3 mb-2">
        <span class="px-3 py-1 rounded-lg border text-xs font-bold border-${tone[0]}-500/60 text-${tone[0]}-300 bg-${tone[0]}-500/10">${tone[1]}</span>
        <span class="text-sm text-slate-200">Usa <b>${fmt(use)} %</b> del agua disponible</span>
      </div>
      <div class="relative h-3 rounded-full bg-slate-800 overflow-hidden mb-1" role="img" aria-label="La demanda usa ${fmt(use)} por ciento del agua disponible">
        <div class="absolute inset-y-0 left-0 rounded-full bg-${tone[0]}-500/80" style="width:${Math.min(100, 100 * use / maxW)}%"></div>
        <div class="absolute inset-y-0 w-0.5 bg-white/80" style="left:${100 * 100 / maxW}%"></div>
      </div>
      <p class="text-[11px] text-slate-400 mb-3">Las plantas piden ${fmt(r.demand_hm3)} millones de m³ y llegan ${fmt(r.cap_hm3)} millones de m³ (${r.balance_hm3 >= 0 ? 'sobran' : 'faltan'} ${fmt(Math.abs(r.balance_hm3))}). La línea blanca marca el 100 % del agua disponible.</p>
      <ul class="text-xs text-slate-300 flex flex-col gap-1 mb-3">${crops}</ul>
      <details class="text-[11px] text-slate-400"><summary class="cursor-pointer text-slate-300">Qué es supuesto</summary>
        <ul class="list-disc pl-4 mt-1 flex flex-col gap-1">${r.assumptions.map((a) => `<li>${a}</li>`).join('')}</ul></details>`;
  }

  function schedule() { clearTimeout(waterTimer); waterTimer = setTimeout(runWater, 150); }

  /* Audience tabs: farmer (rotations) or Junta de Usuarios (water and cap) */
  let audience = 'farmer';
  const originalSwitch = window.switchWorkspaceView;
  function setAudience(a) {
    audience = a;
    const on = 'bg-indigo-500/20 border-indigo-400 text-white', off = 'bg-p3-surface border-slate-700 text-slate-400 hover:text-slate-200';
    $('aud-farmer').className = 'flex-1 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide whitespace-nowrap transition ' + (a === 'farmer' ? on : off);
    $('aud-junta').className = 'flex-1 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide whitespace-nowrap transition ' + (a === 'junta' ? on : off);
    $('aud-farmer').setAttribute('aria-selected', a === 'farmer');
    $('aud-junta').setAttribute('aria-selected', a === 'junta');
    ['view-tabs', 'llm-panel'].forEach((id) => $(id) && $(id).classList.toggle('hidden', a === 'junta'));
    if (a === 'junta') {
      $('view-rotations').classList.add('hidden');
      $('view-pareto').classList.add('hidden'); $('view-pareto').classList.remove('flex');
      $('view-water').classList.remove('hidden');
    } else {
      $('view-water').classList.add('hidden');
      originalSwitch(state.activeView);
    }
  }
  // Clicking the circle's own tabs (Rotaciones / Gráfico) means the user wants the farmer view
  function styleViewTabs(view) {
    const on = 'bg-indigo-500/20 border-indigo-400 text-white', off = 'bg-p3-surface border-slate-700 text-slate-400 hover:text-slate-200';
    if ($('tab-rot')) $('tab-rot').className = 'px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ' + (view === 'rotations' ? on : off);
    if ($('tab-par')) $('tab-par').className = 'px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ' + (view === 'pareto' ? on : off);
  }
  window.switchWorkspaceView = function (view) {
    if (audience === 'junta') { audience = 'farmer'; setAudience('farmer'); }
    const out = originalSwitch(view);
    styleViewTabs(view);
    return out;
  };
  function syncIntroCrop() { const el = $('intro-crop'); if (el && typeof state !== 'undefined') el.textContent = state.currentCrop; }

  /* "¿Por qué esta rotación?": ask the backend for a plain-language version (LLM if configured, template otherwise) */
  let explainSeq = 0;
  const originalRender = window.renderParetoAndLLM;
  window.renderParetoAndLLM = function () {
    originalRender();
    const sel = state.currentRanked[state.selectedRotationIdx] || state.currentRanked[0];
    const box = $('llm-rationale-text');
    if (!sel || !box || !apiUp || !String(sel.id).startsWith('gen-')) return;
    let tag = $('llm-source');
    if (!tag) { tag = document.createElement('p'); tag.id = 'llm-source'; tag.className = 'text-[10px] text-slate-500 mt-1.5'; box.after(tag); }
    tag.textContent = 'Redactando…';
    const seq = ++explainSeq;
    const q = new URLSearchParams({ crop: state.currentCrop, rotation_id: sel.id, water: state.priorities.water,
                                    soil: state.priorities.soil, income: state.priorities.income, salinity: state.climate.salinity });
    getJson('/api/model/explain?' + q).then((r) => {
      if (seq !== explainSeq) return;
      box.textContent = r.text;
      tag.textContent = r.source === 'gemini' ? `Texto redactado con IA (${r.reason}). Las cifras son del modelo.` : `Texto generado por el modelo (${r.reason}).`;
    }).catch(() => { if (seq === explainSeq) tag.textContent = ''; });
  };

  /* ---------- parcel map: the MODIS pixel that contains the point the user taps, and what NASA saw there ---------- */
  let pixelLayer = null, irrigatedLayer = null, pointSeq = 0;
  const KIND_COLOR = { 'regado': '#22c55e', 'mixto (parte regada)': '#eab308', 'desierto o sin riego': '#94a3b8', 'sin dato': '#64748b' };

  let irrigatedZone = null;
  async function showIrrigated() {
    if (!parcelMap || irrigatedZone === state.zone) return;
    if (irrigatedLayer) { parcelMap.removeLayer(irrigatedLayer); irrigatedLayer = null; }
    irrigatedZone = state.zone;
    try {
      const pts = await getJson('/api/model/irrigated?zone=' + state.zone);
      irrigatedLayer = L.layerGroup(pts.map(([la, lo]) => L.circleMarker([la, lo], { radius: 2, stroke: false, fillColor: '#22c55e', fillOpacity: 0.35, interactive: false })));
      irrigatedLayer.addTo(parcelMap);
    } catch (err) { /* overlay is optional */ }
  }

  async function drawPixel() {
    if (!parcelMap) return;
    const box = $('pixel-info');
    if (pixelLayer) { parcelMap.removeLayer(pixelLayer); pixelLayer = null; }
    if (parcelPolygon) { parcelMap.removeLayer(parcelPolygon); parcelPolygon = null; }
    $('parcel-zone-tag').textContent = ZONE_NAMES[state.zone] || 'Majes - El Pedregal';
    showIrrigated();
    const home = (ZONE_GEO[state.zone] || ZONE_GEO.majes).coords;
    const picked = parcelCenter && (parcelCenter[0] !== home[0] || parcelCenter[1] !== home[1]);
    if (!picked) { if (box) box.innerHTML = 'Los puntos verdes son las zonas regadas que ve el satélite. <b class="text-white">Toca tu parcela</b> para ver su verdor, el agua que usa y cómo le fue en los años secos.'; return; }
    const [lat, lon] = parcelCenter || home;
    const seq = ++pointSeq;
    try {
      const r = await getJson(`/api/model/point?lat=${lat}&lon=${lon}&zone=${state.zone}`);
      if (seq !== pointSeq) return;
      if (!r.inside) { if (box) box.textContent = r.message; return; }
      const color = KIND_COLOR[r.tipo] || '#64748b';
      pixelLayer = L.polygon(r.square, { color, fillColor: color, fillOpacity: 0.35, weight: 2 }).addTo(parcelMap);
      if (parcelCenter && parcelMap.getZoom() < 14) parcelMap.flyTo([lat, lon], 14, { duration: 0.6 });
      const dry = Object.entries(r.anios_secos).map(([y, d]) => `${y}: ${d.cambio_pct > 0 ? '+' : ''}${fmt(d.cambio_pct, 1)} % (${d.por_que})`).join(' · ');
      const showDry = r.tipo === 'regado' || r.tipo.startsWith('mixto');
      if (box) box.innerHTML = `<b class="text-white">Cuadro de ${fmt(r.pixel_ha, 1)} ha: ${r.tipo}.</b> Verdor medio (NDVI) 2013–2024: <b>${r.ndvi_medio_2013_2024 == null ? 's/d' : fmt(r.ndvi_medio_2013_2024, 2)}</b> (desierto ≈ 0,1; cultivo vigoroso ≥ 0,5)` +
        (r.et_mm_anual != null ? ` · Agua que usan las plantas y el suelo (ET): <b>${fmt(r.et_mm_anual)} mm al año</b>` : '') +
        (showDry && dry ? `<br>En años con menos agua, el verdor de este lugar cambió: ${dry}.` : '') +
        `<br><span class="text-slate-500 text-[10px]">${r.fuente}. El cuadro es más grande que muchas parcelas: describe el entorno de la tuya.</span>`;
    } catch (err) { if (box) box.textContent = 'No se pudo consultar el satélite (servicio sin conexión).'; }
  }
  // replace the old fixed rectangle coloured by the ranking: the map now shows real satellite data
  window.drawParcelPolygon = function () { drawPixel(); };

  /* Map button: hiding the map gives its width to the other two columns */
  const THREE = 'lg:grid-cols-[minmax(280px,25%)_minmax(0,1fr)_minmax(340px,28%)]', TWO = 'lg:grid-cols-[minmax(280px,25%)_minmax(0,1fr)]';
  function syncMapColumn() {
    const hidden = $('parcel-map-section').classList.contains('hidden');
    $('map-col').classList.toggle('hidden', hidden);
    $('dash-grid').classList.toggle(THREE, !hidden);
    $('dash-grid').classList.toggle(TWO, hidden);
    if (!hidden && typeof parcelMap !== 'undefined' && parcelMap) setTimeout(() => parcelMap.invalidateSize(), 120);
  }
  const originalToggle = window.toggleParcelMap;
  window.toggleParcelMap = function () { originalToggle(); syncMapColumn(); };

  window.FieldShiftApi = { refreshRanking, runWater: schedule, setAudience, isUp: () => apiUp };
  window.addEventListener('DOMContentLoaded', () => {
    ['water-mix', 'water-cap', 'water-area', 'water-eff', 'water-et0'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener(id === 'water-cap' ? 'input' : 'change', schedule);
    });
    setAudience('farmer');
    styleViewTabs('rotations');
    setTimeout(() => { if (typeof parcelMap !== 'undefined' && parcelMap) { parcelMap.invalidateSize(); drawPixel(); } }, 400);
    loadRotationCrops();
    loadMixes();
    refreshRanking();
    ['select-cultivo'].forEach((id) => $(id) && $(id).addEventListener('change', syncIntroCrop));
    syncIntroCrop();
  });
})();
