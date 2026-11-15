/* Connects the advisor to the backend (rotations ranking) and to the water model (/api/model/simulate).
   Backend URL: window.FIELD_SHIFT_API or http://localhost:8765. If the API is down the page keeps working
   with its local ranking and the water panel says so. */
(function () {
  const API_BASE = (window.FIELD_SHIFT_API || (location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765')).replace(/\/$/, '');
  let rankSeq = 0;
  let sitePoint = null;
  const planned = new Set();   // crops the farmer plans to sow; empty = all   // [lat, lon] of the pixel the user tapped; rotations are adjusted to it
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
    paretoX: r.pareto_x, paretoY: r.pareto_y, paretoOptimal: r.pareto_optimal, facts: r.facts,
  });

  /* Rotation ranking from the backend; the local result is already on screen, this replaces it. */
  async function refreshRanking() {
    const seq = ++rankSeq;
    const note = document.getElementById('zone-note');
    if (note) note.classList.toggle('hidden', state.zone === 'majes');
    try {
      const q = new URLSearchParams({ crop: state.currentCrop, water: state.priorities.water, soil: state.priorities.soil,
                                      income: state.priorities.income, salinity: state.climate.salinity, zone: state.zone });
      if (sitePoint) { q.set('lat', sitePoint[0]); q.set('lon', sitePoint[1]); }
      if (planned.size) q.set('crops', [...planned].join(','));
      q.set('cap_pct', fitCap);
      const ranked = await getJson('/api/model/rotations?' + q);   // rotations generated from rules + the water/soil/income model
      if (seq !== rankSeq) return;           // a newer request is in flight
      setStatus(true);
      showPlannedNote(ranked);
      showFarmWater(ranked);
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

  function renderPlanned(crops) {
    const box = $('planned-crops');
    if (!box) return;
    const on = 'bg-emerald-500/20 border-emerald-400 text-white', off = 'bg-p3-surface border-slate-700 text-slate-400 hover:text-slate-200';
    box.innerHTML = crops.map((c) => `<button type="button" data-crop="${c}" aria-pressed="${planned.has(c)}" class="px-2.5 py-1 rounded-lg border text-xs font-semibold ${planned.has(c) ? on : off}">${c}</button>`).join('');
    box.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const c = b.dataset.crop;
      planned.has(c) ? planned.delete(c) : planned.add(c);
      renderPlanned(crops);
      refreshRanking();
    });
  }
  function styleFitButtons() {
    document.querySelectorAll('.fit-cap').forEach((b) => {
      b.className = 'fit-cap px-2 py-0.5 rounded-md border text-[11px] font-semibold ' + (+b.dataset.cap === fitCap ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-p3-surface border-slate-700 text-slate-400');
    });
  }
  function showFarmWater(ranked) {
    const f = ranked[0] && ranked[0].facts && ranked[0].facts.agua_cabe;
    if (f && $('farm-water')) $('farm-water').textContent = `Te llegan unos ${fmt(f.llega_m3_ha_anio)} m³ por hectárea al año` + (f.cap_pct !== 100 ? ` (${f.cap_pct} % del agua normal)` : '');
    styleFitButtons();
  }
  function badge(rot) {
    const f = rot.facts && rot.facts.agua_cabe;
    if (!f) return '';
    const [cls, txt] = !f.cabe_en_el_anio ? ['border-rose-500/60 text-rose-200 bg-rose-500/10', `No cabe en tu agua: ${f.no_caben.join(', ')} pide más de ${fmt(f.llega_m3_ha_anio)} m³/ha`]
      : f.max_meses_con_deficit ? ['border-amber-500/60 text-amber-200 bg-amber-500/10', `Cabe en el año; en ${f.max_meses_con_deficit} meses pide más de lo que llega`]
      : ['border-emerald-500/60 text-emerald-200 bg-emerald-500/10', 'Cabe en tu agua todos los meses'];
    return `<p class="-mt-1 mb-2 inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${cls}">💧 ${txt}</p>`;
  }
  function showPlannedNote(ranked) {
    const note = $('planned-note');
    if (!note) return;
    const mode = ranked[0] && ranked[0].facts ? ranked[0].facts.modo : 'libre';
    const msg = mode === 'sugerencia'
      ? 'Con solo esos cultivos no hay rotación que respete las reglas (misma familia seguida o papa antes de 3 años). Abajo: qué agregar para poder rotar, y tu forma actual para comparar.'
      : (mode === 'lista' ? 'Rotaciones armadas solo con tus cultivos. La última es tu forma actual, para comparar.' : '');
    note.textContent = msg;
    note.classList.toggle('hidden', !msg);
  }

  async function loadRotationCrops() {
    try {
      const { crops } = await getJson('/api/model/rotation-crops');
      const sel = $('select-cultivo');
      if (!sel || !crops.length) return;
      const keep = crops.includes(state.currentCrop) ? state.currentCrop : crops[0];
      sel.innerHTML = crops.map((c) => `<option value="${c}">${c}</option>`).join('');
      sel.value = keep;
      state.currentCrop = keep;
      renderPlanned(crops);
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

  let shortageHa = 0;
  function shortageText(r) {
    const area = +$('water-area').value, perHa = r.demand_hm3 * 1e6 / area;
    shortageHa = r.balance_hm3 < 0 ? (-r.balance_hm3 * 1e6) / perHa : 0;
    highlightShortage();
    if (!shortageHa) return '';
    return `<p class="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 mb-3">Faltan ${fmt(-r.balance_hm3)} millones de m³: con esta mezcla alcanza para unas <b>${fmt(area - shortageHa)} ha</b>, o sea <b>${fmt(shortageHa)} ha quedarían sin riego</b> si no se cambia nada. En el mapa, en rojo, las zonas que más sufrieron en los años secos: serían las primeras en notarlo.</p>`;
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
      ${shortageText(r)}
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
    showVulnerability(a === 'junta');
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
  /* "¿Cabe en tu agua?": month by month, water each campaign asks for vs water that reaches a hectare */
  let fitCap = 100, fitSeq = 0, fitLast = null;
  const MES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  function miniChart(c, supply, top) {
    const W = 240, H = 96, bw = W / 12, y = (v) => H - (v / top) * (H - 8);
    const bars = c.demanda_m3_ha.map((v, i) => `<rect x="${i * bw + 2}" y="${y(v)}" width="${bw - 4}" height="${H - y(v)}" rx="2" fill="${v > supply[i] ? '#f97316' : '#38bdf8'}"/>`).join('');
    const line = supply.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * bw + 2} ${y(v)} L${(i + 1) * bw - 2} ${y(v)}`).join(' ');
    const labels = MES.map((m, i) => `<span style="width:${100 / 12}%" class="inline-block text-center">${m}</span>`).join('');
    return `<div><p class="text-[11px] text-slate-200 font-semibold">${c.cultivo} <span class="font-normal text-slate-400">· siembra en ${c.mes_siembra} · ${fmt(c.total_m3_ha)} m³/ha</span></p>
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto mt-1" role="img" aria-label="${c.cultivo}: ${c.meses_con_deficit.length} meses piden más agua de la que llega">${bars}<path d="${line}" fill="none" stroke="#e2e8f0" stroke-width="2"/></svg>
      <div class="text-[9px] text-slate-500 leading-none">${labels}</div>
      <p class="text-[10px] mt-1 ${c.cabe_en_el_anio ? (c.meses_con_deficit.length ? 'text-amber-300' : 'text-emerald-300') : 'text-rose-300'}">${c.cabe_en_el_anio ? (c.meses_con_deficit.length ? 'Cabe en el año; falta en ' + c.meses_con_deficit.length + ' meses' : 'Cabe todos los meses') : 'No cabe en el año'}</p></div>`;
  }
  async function drawWaterFit(sequence) {
    const box = $('water-fit-charts');
    if (!box) return;
    document.querySelectorAll('.fit-cap').forEach((b) => {
      b.className = 'fit-cap px-2 py-0.5 rounded-md border text-[11px] font-semibold ' + (+b.dataset.cap === fitCap ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-p3-surface border-slate-700 text-slate-400');
    });
    fitLast = sequence;
    const seq = ++fitSeq;
    try {
      const r = await getJson(`/api/model/calendar?sequence=${encodeURIComponent(sequence.join(','))}&cap_pct=${fitCap}`);
      if (seq !== fitSeq) return;
      const top = Math.max(...r.entrega_m3_ha, ...r.campanas.flatMap((c) => c.demanda_m3_ha)) * 1.08;
      box.innerHTML = r.campanas.map((c) => miniChart(c, r.entrega_m3_ha, top)).join('');
      $('water-fit-summary').textContent = r.resumen + ` Te llegan unos ${fmt(r.entrega_anual_m3_ha)} m³/ha al año.`;
    } catch (err) { if (seq === fitSeq) { box.innerHTML = ''; $('water-fit-summary').textContent = 'No se pudo calcular (servicio sin conexión).'; } }
  }
  /* One 'water of the year' for both views: the farmer's buttons and the Junta's slider move the same value */
  let yearTimer = null;
  function setYearWater(pct, fromSlider) {
    fitCap = pct;
    if (!fromSlider && $('water-cap')) { $('water-cap').value = pct; schedule(); }
    styleFitButtons();
    clearTimeout(yearTimer);
    yearTimer = setTimeout(() => { if (fitLast) drawWaterFit(fitLast); refreshRanking(); }, 200);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.fit-cap');
    if (b) setYearWater(+b.dataset.cap);
  });

  window.renderParetoAndLLM = function () {
    originalRender();
    const sel = state.currentRanked[state.selectedRotationIdx] || state.currentRanked[0];
    const box = $('llm-rationale-text');
    if (sel && apiUp) drawWaterFit(sel.sequence.slice(1));
    if (!sel || !box || !apiUp || !(String(sel.id).startsWith('gen-') || sel.id === 'actual')) return;
    let tag = $('llm-source');
    if (!tag) { tag = document.createElement('p'); tag.id = 'llm-source'; tag.className = 'text-[10px] text-slate-500 mt-1.5'; box.after(tag); }
    tag.textContent = 'Redactando…';
    const seq = ++explainSeq;
    const q = new URLSearchParams({ crop: state.currentCrop, rotation_id: sel.id, water: state.priorities.water,
                                    soil: state.priorities.soil, income: state.priorities.income, salinity: state.climate.salinity, zone: state.zone });
    if (sitePoint) { q.set('lat', sitePoint[0]); q.set('lon', sitePoint[1]); }
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
    if (!picked && sitePoint) { sitePoint = null; refreshRanking(); }
    if (!picked) { if (box) box.innerHTML = 'Los puntos verdes son las zonas regadas que ve el satélite. <b class="text-white">Toca tu parcela</b> para ver su verdor, el agua que usa y cómo le fue en los años secos.'; return; }
    const [lat, lon] = parcelCenter || home;
    const seq = ++pointSeq;
    try {
      const r = await getJson(`/api/model/point?lat=${lat}&lon=${lon}&zone=${state.zone}`);
      if (seq !== pointSeq) return;
      if (!r.inside) { if (box) box.textContent = r.message; if (sitePoint) { sitePoint = null; refreshRanking(); } return; }
      const changed = !sitePoint || sitePoint[0] !== lat || sitePoint[1] !== lon;
      sitePoint = [lat, lon];
      if (changed) refreshRanking();
      const color = KIND_COLOR[r.tipo] || '#64748b';
      pixelLayer = L.polygon(r.square, { color, fillColor: color, fillOpacity: 0.35, weight: 2 }).addTo(parcelMap);
      if (parcelCenter && parcelMap.getZoom() < 14) parcelMap.flyTo([lat, lon], 14, { duration: 0.6 });
      const dry = Object.entries(r.anios_secos).map(([y, d]) => `${y}: ${d.cambio_pct > 0 ? '+' : ''}${fmt(d.cambio_pct, 1)} % (${d.por_que})`).join(' · ');
      const showDry = r.tipo === 'regado' || r.tipo.startsWith('mixto');
      if (box) box.innerHTML = `<b class="text-white">Cuadro de ${fmt(r.pixel_ha, 1)} ha: ${r.tipo}.</b> Verdor medio (NDVI) 2013–2024: <b>${r.ndvi_medio_2013_2024 == null ? 's/d' : fmt(r.ndvi_medio_2013_2024, 2)}</b> (desierto ≈ 0,1; cultivo vigoroso ≥ 0,5)` +
        (r.et_mm_anual != null ? ` · Agua que usan las plantas y el suelo (ET): <b>${fmt(r.et_mm_anual)} mm al año</b>` : '') +
        (showDry && dry ? `<br>En años con menos agua, el verdor de este lugar cambió: ${dry}.` : '') +
        `<br><b class="text-emerald-300">Las rotaciones se ajustaron a este punto</b> (mira «Ajustado a tu parcela» en el porqué).` +
        `<br><span class="text-slate-500 text-[10px]">${r.fuente}. El cuadro es más grande que muchas parcelas: describe el entorno de la tuya.</span>`;
    } catch (err) { if (box) box.textContent = 'No se pudo consultar el satélite (servicio sin conexión).'; }
  }
  // replace the old fixed rectangle coloured by the ranking: the map now shows real satellite data
  window.drawParcelPolygon = function () { if (audience !== 'junta') drawPixel(); };

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

  let shortLayer = null;
  async function highlightShortage() {
    if (typeof parcelMap === 'undefined' || !parcelMap) return;
    if (shortLayer) { parcelMap.removeLayer(shortLayer); shortLayer = null; }
    if (audience !== 'junta' || !shortageHa || !vulnData || !vulnData.disponible) return;
    const n = Math.min(vulnData.puntos.length, Math.round(shortageHa / vulnData.pixel_ha));
    const worst = [...vulnData.puntos].sort((a, b) => a[2] - b[2]).slice(0, n);
    shortLayer = L.layerGroup(worst.map(([la, lo]) => L.circleMarker([la, lo], { radius: 3.5, color: '#fecaca', weight: 1, fillColor: '#dc2626', fillOpacity: 0.9 })));
    shortLayer.addTo(parcelMap);
  }

  /* Junta view: where a year with less water hits hardest (greenness lost in 2014, 2016, 2023, per pixel) */
  let vulnLayer = null, vulnData = null;
  const VULN_COLOR = { alta: '#f97316', media: '#facc15', baja: '#38bdf8', cambio: '#94a3b8' };
  async function showVulnerability(on) {
    if (typeof parcelMap === 'undefined' || !parcelMap) return;
    $('map-legend-farmer') && $('map-legend-farmer').classList.toggle('hidden', on);
    $('map-legend-junta') && $('map-legend-junta').classList.toggle('hidden', !on);
    if (vulnLayer) { parcelMap.removeLayer(vulnLayer); vulnLayer = null; }
    if (shortLayer) { parcelMap.removeLayer(shortLayer); shortLayer = null; }
    if (!on) { irrigatedZone = null; showIrrigated(); drawPixel(); return; }
    if (irrigatedLayer) { parcelMap.removeLayer(irrigatedLayer); irrigatedLayer = null; irrigatedZone = null; }
    if (pixelLayer) { parcelMap.removeLayer(pixelLayer); pixelLayer = null; }
    const box = $('pixel-info');
    try {
      if (!vulnData || vulnData.zone !== state.zone) vulnData = { zone: state.zone, ...(await getJson('/api/model/vulnerability?zone=' + state.zone)) };
      if (!vulnData.disponible) { if (box) box.textContent = vulnData.mensaje; return; }
      vulnLayer = L.layerGroup(vulnData.puntos.map(([la, lo, c, lv]) => L.circleMarker([la, lo], { radius: lv === 'alta' ? 4 : 2.5, stroke: false, fillColor: VULN_COLOR[lv], fillOpacity: lv === 'baja' ? 0.35 : (lv === 'cambio' ? 0.7 : 0.85) })
        .bindTooltip(lv === 'cambio' ? `Bajó para siempre: ${fmt(c, 0)} % de verdor entre 2013-2015 y 2022-2024 (¿ciudad o abandono?)` : `En años con menos agua este cuadro cambió ${c > 0 ? '+' : ''}${fmt(c, 1)} % de verdor`)));
      vulnLayer.addTo(parcelMap);
      highlightShortage();
      const ha = vulnData.ha, y = vulnData.ha_con_caida_15_por_anio;
      if (box) box.innerHTML = `<b class="text-white">¿Dónde golpea más un año con menos agua?</b> Comparando cada cuadro consigo mismo en 2014, 2016 y 2023: ` +
        `<b class="text-orange-300">${fmt(ha.alta)} ha pierden mucho</b> verdor y se recuperan después, ${fmt(ha.media)} ha pierden algo y ${fmt(ha.baja)} ha aguantan. ` +
        `En gris, ${fmt(ha.cambio)} ha que bajaron para siempre (ciudad que crece o chacras abandonadas): no se cuentan como sequía. ` +
        `Las más sensibles están sobre todo al <b>${vulnData.sector_mas_sensible}</b> de la pampa. ` +
        `Hectáreas con 15 % o más de caída: 2014 ${fmt(y['2014'])} ha · 2016 ${fmt(y['2016'])} ha · 2023 ${fmt(y['2023'])} ha.` +
        `<br><span class="text-slate-400">Si en 2027 llega menos agua, estas zonas son las primeras a vigilar o priorizar en los turnos.</span>` +
        `<br><span class="text-slate-500 text-[10px]">${vulnData.fuente} El verdor también cae por plagas o cambios de cultivo: es una señal, no una prueba.</span>`;
    } catch (err) { if (box) box.textContent = 'No se pudo consultar el satélite (servicio sin conexión).'; }
  }

  window.FieldShiftApi = { refreshRanking, runWater: schedule, setAudience, isUp: () => apiUp, badge };
  window.addEventListener('DOMContentLoaded', () => {
    if ($('water-cap')) $('water-cap').addEventListener('input', () => setYearWater(+$('water-cap').value, true));
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
