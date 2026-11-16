/* GreenOrbit front end, part 2: everything that talks to the backend.
   Backend URL: window.FIELD_SHIFT_API or the page's own origin (http://localhost:8765 when opened from a file).
   The free host sleeps, so the first call can take about a minute: the page says so, times out cleanly and
   offers a retry button. Errors shown to people are plain language, never raw server text. */
(function () {
  const API_BASE = (window.FIELD_SHIFT_API || (location.protocol.startsWith('http') ? location.origin : 'http://localhost:8765')).replace(/\/$/, '');
  const MONTH_KEYS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  let rankSeq = 0;
  let sitePoint = null;        // [lat, lon] of the MODIS pixel the user tapped; rotations are adjusted to it
  const planned = new Set();   // crops the farmer plans to sow; empty = all
  let apiUp = false;           // last call worked
  let everUp = false;          // the service answered at least once (it is awake)
  let statusKnown = false;

  /* ---------- water scenario: one switch (shown in three places) + the board's slider ---------- */
  let dry = false;             // dry-year scenario on
  let dryPct = 84;             // % of normal water in the dry scenario; refreshed from the calendar response
  let fitCap = 100;            // % of normal water used for ranking and simulation
  let fitLast = null, fitSeq = 0;

  /* ---------- requests with timeout, typed errors and a wake-up banner ---------- */
  class ApiError extends Error {
    constructor(kind, status, retryAfter) { super(kind); this.kind = kind; this.status = status || 0; this.retryAfter = retryAfter || 0; }
  }
  let wakeTimer = null;
  let bannerState = { kind: 'none', err: null };

  function friendly(err) {
    if (!err || !err.kind) return t('errServer');
    if (err.kind === 'timeout') return t('errTimeout');
    if (err.kind === 'network') return t('errNetwork');
    if (err.kind === 'rate') return t('errRate');
    if (err.status === 422) return t('errRange');
    return t('errServer');
  }

  function showBanner(kind, err) {
    bannerState = { kind, err: err || null };
    const b = $('api-banner');
    if (kind === 'none') { b.classList.add('hidden'); b.innerHTML = ''; return; }
    b.classList.remove('hidden');
    if (kind === 'wake') {
      b.className = 'banner banner-wake';
      b.innerHTML = `<div class="flex items-center gap-3"><span class="spinner" aria-hidden="true"></span><div><b>${t('wakeTitle')}</b><br><span class="sub">${t('wakeBody')}</span></div></div>`;
    } else {
      b.className = 'banner banner-err';
      b.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><div><b>${t('errTitle')}</b><br><span class="sub">${friendly(err)}</span></div>
        <button type="button" id="retry-btn" class="btn btn-sm">${t('retryBtn')}</button></div>`;
      $('retry-btn').addEventListener('click', retry);
    }
  }

  async function getJson(path, options, timeoutMs) {
    const ctrl = new AbortController();
    const ms = timeoutMs || (everUp ? 30000 : 80000);   // a sleeping host needs about a minute the first time
    const timer = setTimeout(() => ctrl.abort(), ms);
    if (!everUp && !wakeTimer) {
      wakeTimer = setTimeout(() => { if (!everUp && bannerState.kind !== 'error') showBanner('wake'); }, 3500);
    }
    try {
      const res = await fetch(API_BASE + path, { ...(options || {}), signal: ctrl.signal });
      if (!res.ok) throw new ApiError(res.status === 429 ? 'rate' : 'http', res.status, +res.headers.get('Retry-After') || 0);
      const data = await res.json();
      everUp = true;
      clearTimeout(wakeTimer); wakeTimer = null;
      if (bannerState.kind === 'wake') showBanner('none');
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(e && e.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  function setStatus(ok, waiting) {
    const el = $('api-status');
    if (!el) return;
    if (!waiting) { apiUp = ok; statusKnown = true; }
    el.textContent = waiting ? t('apiWait') : (ok ? t('apiOk') : t('apiOff'));
    el.className = 'text-xs ' + (waiting ? 'text-slate-400' : ok ? 'text-emerald-300' : 'text-amber-300');
  }

  /* Start-up: wake the host first, then ask for everything. Also what the retry button runs. */
  async function boot() {
    setStatus(false, true);
    showBanner('none');
    try {
      await getJson('/health', {}, 80000);
    } catch (err) {
      setStatus(false);
      showBanner('error', err);
      setRankingError();
      return;
    }
    clearTimeout(wakeTimer); wakeTimer = null;
    showBanner('none');
    await Promise.allSettled([loadRotationCrops(), loadMixes()]);
    if (state.picked) refreshRanking();
    else setStatus(true);
  }
  function retry() { boot(); }

  const toLocal = (r) => ({
    id: r.id, sequence: r.sequence, confidence: r.confidence, rationale: r.rationale,
    soilImpact: r.soil_impact, waterBalance: r.water_balance,
    adjWater: r.adj_water, adjSoil: r.adj_soil, adjIncome: r.adj_income,
    score: r.score, matchPct: r.match_pct,
    paretoX: r.pareto_x, paretoY: r.pareto_y, paretoOptimal: r.pareto_optimal, facts: r.facts,
  });

  /* Rotation ranking from the backend. The answer stays dimmed on screen until the new one arrives. */
  async function refreshRanking() {
    if (!state.picked) return;
    const seq = ++rankSeq;
    const note = $('zone-note');
    if (note) note.classList.toggle('hidden', state.zone === 'majes');
    try {
      const q = new URLSearchParams({ crop: state.currentCrop, water: state.priorities.water, soil: state.priorities.soil,
                                      income: state.priorities.income, salinity: state.climate.salinity, zone: state.zone });
      if (sitePoint) { q.set('lat', sitePoint[0]); q.set('lon', sitePoint[1]); }
      if (planned.size) q.set('crops', [...planned].join(','));
      if (dry) q.set('scenario', 'dry'); else q.set('cap_pct', fitCap);   // the same supply the calendar uses
      q.set('lang', lang);
      const ranked = await getJson('/api/model/rotations?' + q);
      if (seq !== rankSeq) return;           // a newer request is in flight
      setStatus(true);
      if (bannerState.kind === 'error') showBanner('none');
      showPlannedNote(ranked);
      showFarmWater(ranked);
      recalculateAll(ranked.map(toLocal));
    } catch (err) {
      if (seq !== rankSeq) return;
      setStatus(false);
      showBanner('error', err);
      setRankingError();
    }
  }

  /* ---------- helpers for the recommendation ---------- */
  let plannedCrops = null;
  function renderPlanned(crops) {
    const box = $('planned-crops');
    if (!box) return;
    plannedCrops = crops;
    box.innerHTML = crops.map((c) => `<button type="button" class="chip" data-crop="${c}" aria-pressed="${planned.has(c)}"><span class="mini" style="--g:${cropColor(c)}">${cropGlyph(c)}</span>${cropName(c)}</button>`).join('');
    box.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const c = b.dataset.crop;
      planned.has(c) ? planned.delete(c) : planned.add(c);
      renderPlanned(crops);
      recalculateAll();
    });
  }

  function showFarmWater(ranked) {
    const f = ranked[0] && ranked[0].facts && ranked[0].facts.agua_cabe;
    if (f && $('farm-water')) {
      $('farm-water').removeAttribute('data-i18n');   // real value from now on, not the placeholder
      $('farm-water').textContent = t('farmWater', { n: fmt(f.llega_m3_ha_anio) }) + (dry && f.scenario === 'dry' ? t('farmWaterCap', { pct: fmt(dryPct, 0) }) : f.cap_pct !== 100 ? t('farmWaterCap', { pct: fmt(f.cap_pct, 0) }) : '');
    }
  }

  /* Compact verdict chip (kept for compatibility with the old card markup) */
  function badge(rot) {
    const v = verdictOf(rot);
    if (!v) return '';
    return `<span class="pill tone-${v.tone}">${v.text}</span>`;
  }

  /* Water per campaign with its range, and whether it is measured or an estimate */
  function waterFigure(rot) {
    const f = rot.facts;
    const wr = f && f.water_range_m3_ha_campaign;
    if (!wr) return '';
    const central = wr.central != null ? wr.central : wr.low;
    const span = wr.central_is_low && wr.low !== wr.high;   // central equals the low end: say "X to Y", not "about X (between X and Y)"
    const range = wr.low !== wr.high && !span ? t('waterFigRange', { l: fmt(wr.low), h: fmt(wr.high) }) : '';
    const basis = f.water_basis || {};
    const measured = Object.keys(basis).filter((k) => basis[k] === 'measured');
    const note = measured.length ? t('waterNoteMeasured', { crops: measured.map(cropName).join(', ') }) : t('waterNoteEst');
    const head = span ? t('waterSpan', { l: '<b class="font-mono-tech">' + fmt(wr.low) + '</b>', h: '<b class="font-mono-tech">' + fmt(wr.high) + '</b>' })
      : t('waterFig', { c: '<b class="font-mono-tech">' + fmt(central) + '</b>' });
    return `<p>${head}${range}</p><p class="sub">${note}</p>`;
  }

  function showPlannedNote(ranked) {
    const note = $('planned-note');
    if (!note) return;
    const mode = ranked[0] && ranked[0].facts ? ranked[0].facts.modo : 'libre';
    const msg = mode === 'sugerencia' ? t('plannedSuggest') : (mode === 'lista' ? t('plannedList') : '');
    note.textContent = msg;
    note.classList.toggle('hidden', !msg);
    if (msg) $('planned-fold').open = true;
  }

  async function loadRotationCrops() {
    try {
      const { crops } = await getJson('/api/model/rotation-crops');
      if (!crops.length) return;
      state.crops = crops;
      if (!crops.includes(state.currentCrop)) { state.currentCrop = crops[0]; state.picked = false; }
      buildTiles(crops);
      renderPlanned(crops);
    } catch (err) { /* keeps the static crop list; the ranking call reports the failure */ }
  }

  /* ---------- board: water and collective cap ---------- */
  let mixes = {};
  let boardMix = null;
  const boardOpts = { area: 15900, eff: 0.5, et0: 'hargreaves' };
  let waterTimer = null;

  function renderMixCards() {
    const box = $('mix-cards');
    if (!box) return;
    box.innerHTML = Object.keys(mixes).map((name) => {
      const entries = Object.entries(mixes[name]).sort((a, b) => b[1] - a[1]);
      const comp = entries.map(([c, v]) => `<i style="flex-grow:${v};--g:${cropColor(c)}"></i>`).join('');
      const names = entries.slice(0, 3).map(([c]) => cropName(c)).join(', ');
      return `<button type="button" class="mixcard" data-mix="${name}" aria-pressed="${name === boardMix}">
        <span class="nm"><span>${mixName(name)}</span><span class="tick">${CHECK_ICON}</span></span>
        <span class="comp" aria-hidden="true">${comp}</span><span class="comp-names">${names}…</span></button>`;
    }).join('');
  }

  async function loadMixes() {
    try {
      mixes = await getJson('/api/model/mixes');
      if (!boardMix || !mixes[boardMix]) boardMix = Object.keys(mixes)[0];
      renderMixCards();
      if (state.audience === 'junta') runWater();
    } catch (err) { /* the banner already tells the user; the panel shows the error on the next calculation */ }
  }

  function capLabel(pct) {
    const el = $('water-cap-label');
    el.removeAttribute('data-i18n');
    el.textContent = pct === 100 ? t('capLabelNormal') : t('capLabelPct', { pct });
  }

  async function runWater() {
    if (!boardMix || !mixes[boardMix]) return;
    capLabel(fitCap);
    const body = { mix: mixes[boardMix], cap_pct: fitCap, area_ha: boardOpts.area, efficiency: boardOpts.eff, et0_method: boardOpts.et0, lang };
    try {
      const r = await getJson('/api/model/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      setStatus(true);
      renderWater(r);
    } catch (err) {
      setStatus(false);
      const box = $('water-result');
      box.dataset.state = 'error';
      $('board-tone').className = 'tone-big tone-bad';
      $('board-tone').textContent = friendly(err);
    }
  }

  let shortageHa = 0;
  function shortageState(r) {
    const area = boardOpts.area, perHa = r.demand_hm3 * 1e6 / area;
    shortageHa = r.balance_hm3 < 0 ? (-r.balance_hm3 * 1e6) / perHa : 0;
    highlightShortage();
    if (!shortageHa) return '';
    return t('shortage', { m: fmt(-r.balance_hm3), ok: fmt(area - shortageHa), short: fmt(shortageHa) });
  }

  function renderWater(r) {
    const use = r.use_pct;
    const hi = r.demand_range_hm3 && r.demand_range_hm3.high != null ? r.demand_range_hm3.high : r.demand_hm3;
    const useHigh = r.cap_hm3 ? 100 * hi / r.cap_hm3 : use;
    const tone = use <= 90 ? ['ok', t('toneOk')] : use <= 100 ? ['tight', t('toneTight')] : ['bad', t('toneBad')];
    const maxW = Math.max(130, useHigh * 1.05);
    const box = $('water-result');
    box.dataset.state = 'ready';
    // the tank: same visual language as the calendar (water level, what the crops ask for, what sticks out)
    const tank = $('tank');
    tank.style.setProperty('--w', (10000 / maxW).toFixed(2));
    tank.style.setProperty('--n', (100 * use / maxW).toFixed(2));
    tank.style.setProperty('--h', (100 * useHigh / maxW).toFixed(2));
    tank.setAttribute('aria-label', t('tankAria', { tone: tone[1] }));
    const bt = $('board-tone');
    bt.className = 'tone-big tone-' + tone[0];
    bt.textContent = tone[1];
    $('board-use').innerHTML = t('usePct', { pct: fmt(use) });
    $('board-high').textContent = useHigh > 100 && use <= 100 ? t('useHighBad') : hi > r.demand_hm3 ? t('useHigh', { pct: fmt(useHigh) }) : '';

    const shortText = shortageState(r);
    const bs = $('board-short');
    bs.textContent = shortText ? t('boardShortLine') : '';
    bs.classList.toggle('hidden', !shortText);

    // crop mix as a ribbon plus glyphs
    const items = r.per_crop.slice().sort((a, b) => b.share_pct - a.share_pct);
    $('board-mix').innerHTML = `<div class="comp comp-lg" role="img" aria-label="${items.map((c) => cropName(c.crop)).join(', ')}">${items.map((c) => `<i style="flex-grow:${c.share_pct};--g:${cropColor(c.crop)}"></i>`).join('')}</div>
      <div class="crop-legend" style="margin-top:10px">${items.filter((c) => c.share_pct >= 3).map((c) => `<span><span class="mini" style="--g:${cropColor(c.crop)}">${cropGlyph(c.crop)}</span>${cropName(c.crop)}</span>`).join('')}</div>`;

    const crops = items.map((c) => `<li class="flex justify-between gap-3"><span>${cropName(c.crop)} <span class="text-slate-400">${fmt(c.share_pct, 1)} %</span></span>
        <span class="font-mono-tech">${c.water_m3_ha == null ? t('noData') : fmt(c.water_m3_ha) + ' m³/ha'}</span></li>`).join('');
    const caveats = Array.isArray(r.caveats) && r.caveats.length ? `<h4>${t('caveatsTitle')}</h4><ul class="list-disc pl-5 flex flex-col gap-1 sub">${r.caveats.map((a) => `<li>${a}</li>`).join('')}</ul>` : '';
    $('board-nums-body').innerHTML = `
      <p>${t('demandLine', { d: fmt(r.demand_hm3), h: fmt(hi), c: fmt(r.cap_hm3), sign: r.balance_hm3 >= 0 ? t('surplus') : t('deficit'), b: fmt(Math.abs(r.balance_hm3)) })}</p>
      ${shortText ? `<p>${shortText}</p>` : ''}
      <h4>${t('perCropTitle')}</h4><ul class="flex flex-col gap-1">${crops}</ul>
      <p class="sub">${t('simEstimate')}</p>
      <h4>${t('assumptionsTitle')}</h4><ul class="list-disc pl-5 flex flex-col gap-1 sub">${r.assumptions.map((a) => `<li>${a}</li>`).join('')}</ul>
      ${caveats}`;
  }

  function schedule() { clearTimeout(waterTimer); waterTimer = setTimeout(runWater, 150); }

  /* ---------- audience: farmer (rotations) or users' board (water and cap) ---------- */
  function hide(id, yes) { const el = $(id); if (el) el.classList.toggle('hidden', yes); }
  function setAudience(a) {
    applyAudienceShell(a);
    const junta = a === 'junta';
    hide('map-legend-farmer', junta);
    hide('map-legend-junta', !junta);
    showVulnerability(junta);
    if (junta) { if (Object.keys(mixes).length) runWater(); }
    else switchWorkspaceView(state.activeView);
  }
  function styleViewTabs() { /* the view tabs style themselves from aria-pressed */ }
  function syncIntroCrop() { if (typeof syncCropChip === 'function') syncCropChip(); }

  /* ---------- dry year: one switch (top bar, calendar, board), shared by ranking, calendar and board simulation ---------- */
  function syncDryUi() {
    document.querySelectorAll('[data-dry-switch]').forEach((sw) => {
      sw.setAttribute('aria-checked', String(dry));
      sw.style.setProperty('--lvl', String(Math.max(0.1, Math.min(1, fitCap / 100))));
    });
    document.documentElement.dataset.dry = String(dry);
    const stage = $('cal-stage');
    if (stage) stage.dataset.dry = String(dry);
    const badgeEl = $('dry-badge');
    const show = dry || fitCap !== 100;
    badgeEl.classList.toggle('hidden', !show);
    if (show) badgeEl.textContent = dry ? t('dryBadge', { pct: fmt(dryPct) }) : t('capBadge', { pct: fmt(fitCap) });
    $('water-cap').value = fitCap;
    capLabel(fitCap);
  }
  let yearTimer = null;
  function afterWaterChange() {
    schedule();                                   // board simulation
    clearTimeout(yearTimer);                      // ranking (its answer also redraws the calendar)
    yearTimer = setTimeout(refreshRanking, 200);
  }
  function setDry(on) {
    dry = on;
    fitCap = on ? dryPct : 100;
    syncDryUi();
    previewScenario(on);                          // the water level moves at once, from numbers the API already sent
    afterWaterChange();
  }

  /* ---------- "Is there enough water?": a month-by-month calendar, water level against what the plants ask for ---------- */
  const niceTop = (v) => { const step = v > 6000 ? 2000 : v > 2500 ? 1000 : 500; return Math.ceil(v / step) * step; };
  const cal = { data: null, idx: 0, normalSupply: null };

  function ensureCols() {
    const box = $('cal-cols');
    if (box.children.length === 12) return;
    box.innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="mcol" style="--i:${i}"><div class="mcol-bar"><span class="mc-range"></span><span class="mc-water"></span><span class="mc-need"></span><span class="mc-gap"></span></div><span class="mc-lab"></span><span class="mc-flag">${WARN_ICON}</span></div>`).join('');
  }

  const campDemand = (c) => {
    const low = (c.demand_range_m3_ha && c.demand_range_m3_ha.low) || c.demanda_m3_ha;
    const high = (c.demand_range_m3_ha && c.demand_range_m3_ha.high) || low;
    return { low, high };
  };
  function calTop(r) {
    const supplies = [...r.entrega_m3_ha, ...(r.entrega_seca_m3_ha || []), ...(cal.normalSupply || [])];
    const demands = r.campanas.flatMap((c) => campDemand(c).high);
    return niceTop(Math.max(...supplies, ...demands) * 1.05);
  }
  const campTone = (c) => (!c.cabe_en_el_anio ? 'no' : (c.meses_con_deficit || []).length ? 'short' : 'ok');
  const TONE_COLOR = { ok: 'var(--c-ok)', short: 'var(--c-soil)', no: 'var(--c-deficit)' };

  /* Paint the 12 columns. `previewSupply` is used for the instant dry-year preview before the new answer arrives. */
  function paintCal(previewSupply) {
    const r = cal.data;
    if (!r) return;
    ensureCols();
    const c = r.campanas[cal.idx] || r.campanas[0];
    const supply = previewSupply || r.entrega_m3_ha;
    const { low, high } = campDemand(c);
    const top = calTop(r);
    const pct = (v) => Math.min(100, (100 * v) / top).toFixed(2);
    const short = previewSupply
      ? new Set(low.map((v, i) => (v > supply[i] + 0.5 ? i : -1)).filter((i) => i >= 0))
      : new Set((c.meses_con_deficit || []).map((d) => MONTH_KEYS.indexOf(d.mes)));
    const initials = t('monthInitials').split(' ');
    $('cal-cols').querySelectorAll('.mcol').forEach((col, i) => {
      col.style.setProperty('--w', pct(supply[i]));
      col.style.setProperty('--n', pct(low[i]));
      col.style.setProperty('--h', pct(high[i]));
      col.classList.toggle('is-short', short.has(i));
      col.querySelector('.mc-lab').textContent = initials[i];
    });
    const n = short.size;
    $('cal-cols').setAttribute('aria-label', n ? t('fitAria', { crop: cropName(c.cultivo), n }) : t('fitAriaOk', { crop: cropName(c.cultivo) }));
  }

  /* Plain-language text under the chart for the selected campaign, and the numbers table behind the disclosure */
  function paintCalText() {
    const r = cal.data;
    if (!r) return;
    const c = r.campanas[cal.idx] || r.campanas[0];
    const nShort = (c.meses_con_deficit || []).length, nDry = (c.meses_con_deficit_seco || []).length;
    const verdict = c.cabe_en_el_anio ? (nShort ? t('fitYearShort', { n: nShort }) : t('fitAll')) : t('fitNoYear');
    const dryLine = !dry && nDry > nShort ? ' ' + t('fitChartDry', { n: nDry }) : '';
    $('cal-line').textContent = `${cropName(c.cultivo)}: ${verdict}.${dryLine}`;

    const { low } = campDemand(c);
    const shortBy = {};
    (c.meses_con_deficit || []).forEach((d) => { shortBy[d.mes] = d.falta_m3_ha; });
    const initials = MONTH_KEYS;
    $('cal-table').innerHTML = `<thead><tr><th>${t('tblMonth')}</th><th>${t('tblSupply')}</th><th>${t('tblNeed')}</th><th>${t('tblShort')}</th></tr></thead><tbody>` +
      r.entrega_m3_ha.map((v, i) => {
        const f = shortBy[initials[i]];
        return `<tr><td>${monthName(initials[i])}</td><td>${fmt(v)}</td><td>${fmt(low[i])}</td><td class="${f ? 's' : ''}">${f ? fmt(f) : '—'}</td></tr>`;
      }).join('') + '</tbody>';
    const totals = c.total_range_m3_ha || { low: c.total_m3_ha, high: c.total_m3_ha };
    const sownKey = c.siembra && c.siembra.basis === 'fallback' ? 'sownAssumed' : 'sownIn';
    $('cal-total').textContent = `${cropName(c.cultivo)}: ${t(sownKey, { m: monthName(c.mes_siembra) })}. ` +
      (totals.low !== totals.high ? t('chartTotal', { c: fmt(totals.low), l: fmt(totals.low), h: fmt(totals.high) }) : t('chartTotalOne', { c: fmt(totals.low) }));
  }

  function renderCalChips() {
    const r = cal.data;
    const box = $('cal-chips');
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = r.campanas.map((c, i) => {
      const sownKey = c.siembra && c.siembra.basis === 'fallback' ? 'sownAssumed' : 'sownIn';
      return `<button type="button" class="chip" data-i="${i}" aria-pressed="${i === cal.idx}"><span class="mini" style="--g:${cropColor(c.cultivo)}">${cropGlyph(c.cultivo)}</span><span>${cropName(c.cultivo)} <span class="fine">${t(sownKey, { m: monthName(c.mes_siembra) })}</span></span><span class="dot" style="--tone-c:${TONE_COLOR[campTone(c)]}"></span></button>`;
    }).join('');
  }

  function selectCampaign(i) {
    if (!cal.data) return;
    cal.idx = clamp(i, 0, cal.data.campanas.length - 1);
    renderCalChips(); paintCal(); paintCalText();
    $('cal').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* The dry switch moves the water before the new answer arrives: the API already sent the dry supply with the normal one */
  function previewScenario(on) {
    if (!cal.data) return;
    const sup = on ? cal.data.entrega_seca_m3_ha : cal.normalSupply;
    if (sup && sup.length === 12) paintCal(sup);
  }

  function fitVerdictHtml(r) {
    const cs = r.campanas;
    const notFit = cs.filter((c) => !c.cabe_en_el_anio);
    const maxShort = Math.max(0, ...cs.map((c) => (c.meses_con_deficit || []).length));
    const maxDry = Math.max(0, ...cs.map((c) => (c.meses_con_deficit_seco || []).length));
    let tone, text;
    if (notFit.length) { tone = 'no'; text = t('fitVerdictNo', { crops: [...new Set(notFit.map((c) => cropName(c.cultivo)))].join(', ') }); }
    else if (maxShort) { tone = 'short'; text = t('fitVerdictShort', { n: maxShort }); }
    else if (cs.some((c) => c.fits_in_year_high === false)) { tone = 'short'; text = t('fitVerdictLow'); }
    else { tone = 'ok'; text = t('fitVerdictOk'); }
    const dryTag = dry ? ' ' + t('fitDryTag') : '';
    const outlook = !dry && maxDry > maxShort ? t('fitDryOutlook', { n: maxDry }) : '';
    return `<span class="pill tone-${tone}">${text}${dryTag}</span>${outlook ? `<span class="cal-line">${outlook.trim()}</span>` : ''}`;
  }

  const methodName = (m) => (m === 'pm' ? t('methodPm') : t('methodHg'));

  /* "What this does not know": the backend's caveats, collapsed under the calendar; opens and closes on the reader's choice */
  function renderCaveats(list) {
    const box = $('fit-caveats');
    const has = Array.isArray(list) && list.length > 0;
    box.classList.toggle('hidden', !has);
    if (!has) return;
    const wasOpen = box.open;
    box.innerHTML = `<summary>${t('caveatsTitle')}</summary><div class="nums-body"><ul class="list-disc pl-5 flex flex-col gap-1 sub"></ul></div>`;
    const ul = box.querySelector('ul');
    list.forEach((c) => { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); });
    box.open = wasOpen;
  }

  function onCalendar(r) {
    cal.data = r;
    if (r.scenario === 'normal' || !r.scenario) cal.normalSupply = r.entrega_m3_ha;
    if (cal.idx >= r.campanas.length) cal.idx = 0;
    // keep the dry percentage honest: it comes from the model, not from a constant
    if (dry && r.supply_basis === 'dry_profile' && r.cap_pct) dryPct = Math.round(r.cap_pct);
    else if (!dry && r.scenario === 'normal' && fitCap === 100 && r.entrega_seca_anual_m3_ha && r.entrega_anual_m3_ha) dryPct = Math.round(100 * r.entrega_seca_anual_m3_ha / r.entrega_anual_m3_ha);
    if (dry && fitCap !== dryPct) { fitCap = dryPct; }
    syncDryUi();
    renderCalChips();
    paintCal(); paintCalText();
    state.tones = r.campanas.map(campTone);
    applyTones();
    $('fit-verdict').innerHTML = fitVerdictHtml(r);
    $('water-fit-summary').textContent = r.resumen + t('fitSummaryTail', { n: fmt(r.entrega_anual_m3_ha) });
    const rule = $('dry-rule-note');
    rule.classList.toggle('hidden', !dry);
    if (dry) rule.textContent = (lang === 'en' && r.dry_rule) ? r.dry_rule : t('dryRule', { pct: fmt(dryPct) });
    const m = r.et0_range_methods;
    $('fit-method-note').textContent = m ? t('methodNote', { low: methodName(m.low), high: methodName(m.high) }) : '';
    renderCaveats(r.caveats);
  }

  async function drawWaterFit(sequence) {
    if (!$('cal-cols') || state.audience === 'junta') return;
    fitLast = sequence;
    const seq = ++fitSeq;
    const q = new URLSearchParams({ sequence: sequence.join(','), lang });
    if (dry) q.set('scenario', 'dry'); else if (fitCap !== 100) q.set('cap_pct', fitCap);
    try {
      const r = await getJson('/api/model/calendar?' + q);
      if (seq !== fitSeq) return;
      onCalendar(r);
    } catch (err) {
      if (seq === fitSeq) {
        cal.data = null;
        $('fit-verdict').innerHTML = '';
        $('cal-line').textContent = '';
        $('water-fit-summary').textContent = t('offlineCalc') + ' ' + friendly(err);
      }
    }
  }

  /* ---------- "Why this rotation?": plain-language text from the backend (LLM if configured, template otherwise) ---------- */
  let explainSeq = 0, explainTimer = null, explainKeyNow = '';
  const explainCache = new Map();
  function explainKey(sel) {
    const q = new URLSearchParams({ crop: state.currentCrop, rotation_id: sel.id, water: state.priorities.water,
                                    soil: state.priorities.soil, income: state.priorities.income, salinity: state.climate.salinity,
                                    zone: state.zone, lang });
    if (dry) q.set('scenario', 'dry'); else q.set('cap_pct', fitCap);
    if (sitePoint) { q.set('lat', sitePoint[0]); q.set('lon', sitePoint[1]); }
    if (planned.size) q.set('crops', [...planned].join(','));
    return q.toString();
  }
  function applyExplain(r) {
    $('llm-rationale-text').textContent = r.text;
    $('llm-source').textContent = r.source === 'gemini' ? t('srcAi', { r: r.reason }) : t('srcModel', { r: r.reason });
  }
  function reapplyExplain() {
    const sel = selectedRotation();
    if (!sel || !(String(sel.id).startsWith('gen-') || sel.id === 'actual')) return;
    const cached = explainCache.get(explainKey(sel));
    if (cached) applyExplain(cached); else $('llm-source').textContent = '';
  }
  function fetchExplain(sel) {
    clearTimeout(explainTimer);
    const seq = ++explainSeq;
    const tag = $('llm-source');
    if (!sel || !(String(sel.id).startsWith('gen-') || sel.id === 'actual')) { tag.textContent = ''; return; }
    const key = explainKey(sel);
    explainKeyNow = key;
    if (explainCache.has(key)) { applyExplain(explainCache.get(key)); return; }
    tag.textContent = t('writing');
    // small delay so a burst of changes (sliders) makes one request, which also keeps us under the rate limit
    explainTimer = setTimeout(() => {
      getJson('/api/model/explain?' + key).then((r) => {
        explainCache.set(key, r);
        if (seq === explainSeq) applyExplain(r);
      }).catch((err) => {
        if (seq !== explainSeq) return;
        // 429 or any failure: keep the model's own text that is already on screen
        tag.textContent = err.kind === 'rate' ? t('explainRate', { n: err.retryAfter || 10 }) : '';
      });
    }, 350);
  }

  function onSelection(sel) {
    if (!sel) return;
    drawWaterFit(sel.sequence.slice(1));
    fetchExplain(sel);
  }

  /* ---------- parcel map: the MODIS pixel that contains the point the user taps, and what NASA saw there ---------- */
  let pixelLayer = null, irrigatedLayer = null, pointSeq = 0;
  const tok = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
  const kindColor = (k) => ({
    'regado': tok('--map-irrigated', '#4fbf7a'), 'mixto (parte regada)': tok('--map-mixed', '#d9a74a'),
    'desierto o sin riego': tok('--map-desert', '#9a9484'), 'sin dato': tok('--map-nodata', '#6d7a74'),
  }[k] || tok('--map-nodata', '#6d7a74'));

  let irrigatedZone = null;
  async function showIrrigated() {
    if (!parcelMap || irrigatedZone === state.zone) return;
    if (irrigatedLayer) { parcelMap.removeLayer(irrigatedLayer); irrigatedLayer = null; }
    irrigatedZone = state.zone;
    try {
      const pts = await getJson('/api/model/irrigated?zone=' + state.zone);
      const color = tok('--map-irrigated', '#4fbf7a');
      irrigatedLayer = L.layerGroup(pts.map(([la, lo]) => L.circleMarker([la, lo], { radius: 3, stroke: false, fillColor: color, fillOpacity: 0.6, interactive: false })));
      irrigatedLayer.addTo(parcelMap);
    } catch (err) { /* overlay is optional */ }
  }

  async function drawPixel() {
    if (!parcelMap) return;
    const box = $('pixel-info');
    if (pixelLayer) { parcelMap.removeLayer(pixelLayer); pixelLayer = null; }
    $('parcel-zone-tag').textContent = zoneName(state.zone);
    showIrrigated();
    const home = (ZONE_GEO[state.zone] || ZONE_GEO.majes).coords;
    const picked = parcelCenter && (parcelCenter[0] !== home[0] || parcelCenter[1] !== home[1]);
    if (!picked && sitePoint) { sitePoint = null; refreshRanking(); }
    if (!picked) { if (box) box.innerHTML = `<p class="pixel-hint">${t('pixelHint')}</p>`; return; }
    const [lat, lon] = parcelCenter || home;
    const seq = ++pointSeq;
    try {
      const r = await getJson(`/api/model/point?lat=${lat}&lon=${lon}&zone=${state.zone}&lang=${lang}`);
      if (seq !== pointSeq) return;
      if (!r.inside) { if (box) box.textContent = r.message; if (sitePoint) { sitePoint = null; refreshRanking(); } return; }
      const changed = !sitePoint || sitePoint[0] !== lat || sitePoint[1] !== lon;
      sitePoint = [lat, lon];
      if (changed) refreshRanking();
      const color = kindColor(r.tipo);
      pixelLayer = L.polygon(r.square, { color, fillColor: color, fillOpacity: 0.35, weight: 2 }).addTo(parcelMap);
      if (parcelCenter && parcelMap.getZoom() < 14) parcelMap.flyTo([lat, lon], 14, { duration: reducedMotion() ? 0 : 0.6 });
      const dryYears = Object.entries(r.anios_secos).map(([y, d]) => `${y}: ${d.cambio_pct > 0 ? '+' : ''}${fmt(d.cambio_pct, 1)} % (${d.por_que})`).join(' · ');
      const showDry = r.tipo === 'regado' || r.tipo.startsWith('mixto');
      if (box) box.innerHTML = `<p class="pixel-head"><span class="swatch" style="background:${color};margin-right:8px"></span>${t('pixelHead', { tipo: kindName(r.tipo) })}</p>
        <p class="adj-note">${t('pixelAdj')}</p>
        <details class="nums"><summary>${t('seeNumbers')}</summary><div class="nums-body">
          <p>${t('pixelInfo', { ha: fmt(r.pixel_ha, 1), ndvi: r.ndvi_medio_2013_2024 == null ? t('noData') : fmt(r.ndvi_medio_2013_2024, 2) })}</p>
          ${r.et_mm_anual != null ? `<p>${t('pixelEt', { et: fmt(r.et_mm_anual) })}</p>` : ''}
          ${showDry && dryYears ? `<p>${t('pixelDry', { dry: dryYears })}</p>` : ''}
          <p class="sub">${t('pixelSrc', { src: r.fuente })}</p></div></details>`;
    } catch (err) { if (box) box.textContent = t('satOffline'); }
  }
  function drawMap() { if (state.audience !== 'junta') drawPixel(); }

  let shortLayer = null;
  async function highlightShortage() {
    if (!parcelMap) return;
    if (shortLayer) { parcelMap.removeLayer(shortLayer); shortLayer = null; }
    if (state.audience !== 'junta' || !shortageHa || !vulnData || !vulnData.disponible) return;
    const n = Math.min(vulnData.puntos.length, Math.round(shortageHa / vulnData.pixel_ha));
    const worst = [...vulnData.puntos].sort((a, b) => a[2] - b[2]).slice(0, n);
    shortLayer = L.layerGroup(worst.map(([la, lo]) => L.circleMarker([la, lo], { radius: 4.5, color: '#fecaca', weight: 1, fillColor: tok('--map-short', '#c0392b'), fillOpacity: 0.95 })));
    shortLayer.addTo(parcelMap);
  }

  /* Board view: where a year with less water hits hardest (greenness lost in 2014, 2016, 2023, per pixel) */
  let vulnLayer = null, vulnData = null;
  async function showVulnerability(on) {
    if (!parcelMap) return;
    if (vulnLayer) { parcelMap.removeLayer(vulnLayer); vulnLayer = null; }
    if (shortLayer) { parcelMap.removeLayer(shortLayer); shortLayer = null; }
    if (!on) { irrigatedZone = null; showIrrigated(); drawPixel(); return; }
    if (irrigatedLayer) { parcelMap.removeLayer(irrigatedLayer); irrigatedLayer = null; irrigatedZone = null; }
    if (pixelLayer) { parcelMap.removeLayer(pixelLayer); pixelLayer = null; }
    const box = $('pixel-info');
    const color = { alta: tok('--map-vul-high', '#e2724b'), media: tok('--map-vul-mid', '#e6c25a'), baja: tok('--map-vul-low', '#4cc2b6'), cambio: tok('--map-desert', '#9a9484') };
    try {
      if (!vulnData || vulnData.zone !== state.zone || vulnData.lang !== lang) vulnData = { zone: state.zone, lang, ...(await getJson(`/api/model/vulnerability?zone=${state.zone}&lang=${lang}`)) };
      if (state.audience !== 'junta') return;     // the user switched back while the data was loading
      if (!vulnData.disponible) { if (box) box.textContent = vulnData.mensaje; return; }
      vulnLayer = L.layerGroup(vulnData.puntos.map(([la, lo, c, lv]) => L.circleMarker([la, lo], { radius: lv === 'alta' ? 5 : 3.5, stroke: false, fillColor: color[lv], fillOpacity: lv === 'baja' ? 0.6 : (lv === 'cambio' ? 0.75 : 0.9) })
        .bindTooltip(lv === 'cambio' ? t('vulChangeTip', { c: fmt(c, 0) }) : t('vulTip', { c: (c > 0 ? '+' : '') + fmt(c, 1) }))));
      vulnLayer.addTo(parcelMap);
      highlightShortage();
      const ha = vulnData.ha, y = vulnData.ha_con_caida_15_por_anio;
      if (box) box.innerHTML = `<p class="pixel-head">${t('vulHead', { alta: fmt(ha.alta) })}</p>
        <p class="pixel-hint" style="margin-top:6px">${t('vulAdvice')}</p>
        <details class="nums"><summary>${t('seeNumbers')}</summary><div class="nums-body">
          <p>${t('vulSummary', { alta: fmt(ha.alta), media: fmt(ha.media), baja: fmt(ha.baja), cambio: fmt(ha.cambio), sector: vulnData.sector_mas_sensible, y14: fmt(y['2014']), y16: fmt(y['2016']), y23: fmt(y['2023']) })}</p>
          <p class="sub">${t('vulSrc', { src: vulnData.fuente })}</p></div></details>`;
    } catch (err) { if (box) box.textContent = t('satOffline'); }
  }

  /* Language switch (app.js applyLang): re-render what was built here; app.js then re-asks the ranking. */
  function onLang() {
    if (plannedCrops) renderPlanned(plannedCrops);
    if (statusKnown) setStatus(apiUp);
    if (bannerState.kind !== 'none') showBanner(bannerState.kind, bannerState.err);
    if (Object.keys(mixes).length) { renderMixCards(); }
    syncDryUi();
    if (cal.data) { renderCalChips(); paintCal(); paintCalText(); }
    if (Object.keys(mixes).length && state.audience === 'junta') runWater();
    if (fitLast) drawWaterFit(fitLast);
    if (parcelMap) { if (state.audience === 'junta') showVulnerability(true); else drawPixel(); }
  }

  window.FieldShiftApi = { refreshRanking, runWater: schedule, setAudience, isUp: () => apiUp, badge, waterFigure, onLang, onSelection, drawMap, styleViewTabs, syncIntroCrop, retry, selectCampaign, reapplyExplain };

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-dry-switch]').forEach((sw) => sw.addEventListener('click', () => setDry(!dry)));
    // the board's slider: any manual value leaves the "dry year" switch
    $('water-cap').addEventListener('input', () => { fitCap = +$('water-cap').value; dry = false; syncDryUi(); afterWaterChange(); });
    $('cal-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b || !cal.data) return;
      cal.idx = +b.dataset.i;
      renderCalChips(); paintCal(); paintCalText();
    });
    $('mix-cards').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mix]');
      if (!b) return;
      boardMix = b.dataset.mix;
      document.querySelectorAll('#mix-cards .mixcard').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      schedule();
    });
    document.querySelectorAll('.seg2').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const key = g.dataset.key;
      boardOpts[key] = key === 'et0' ? b.dataset.v : +b.dataset.v;
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      schedule();
    }));
    setAudience('farmer');
    syncDryUi();
    setTimeout(() => { if (parcelMap) { parcelMap.invalidateSize(); drawPixel(); } }, 400);
    boot();
  });
})();
