    // =========================================================================
    // GreenOrbit front end, part 1: state, language, crop tiles, priorities, the recommendation, alternatives, trade-off chart.
    // The model's numbers come only from the API (api.js). Nothing here invents a result:
    // while the API has not answered the page shows skeletons, never sample figures.
    // =========================================================================
    const $ = (id) => document.getElementById(id);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const state = {
      activeView: 'rotations', // 'rotations' | 'pareto'
      audience: 'farmer',      // 'farmer' | 'junta'
      selectedRotationIdx: 0,
      zone: 'majes',
      currentCrop: 'Papa',
      picked: false,           // the farmer has chosen the current crop (reveals steps 2 and 3)
      crops: [],               // crops the model can rotate (from the API; a static list until it answers)
      priorities: { water: 80, soil: 65, income: 45 },
      climate: { salinity: 2.8 },
      currentRanked: [],
      tones: [],               // water verdict per campaign of the selected rotation (set by api.js from the calendar)
      load: 'loading'          // 'loading' | 'ready' | 'error'
    };

    const DEFAULT_CROPS = ['Papa', 'Cebolla', 'Ajo', 'Quinua', 'Zapallo', 'Haba', 'Maíz', 'Alfalfa', 'Paprika'];
    const ZONE_NAMES = { majes: 'Majes - El Pedregal', tambo: 'Valle de Tambo' };

    // Representative point of each valley (used to place the plot when the user taps the map)
    const ZONE_GEO = {
      majes: { coords: [-16.350, -72.200] },
      tambo: { coords: [-17.110, -71.770] }
    };

    // =========================================================================
    // LANGUAGE (ES / EN). The choice is remembered in localStorage (it can be blocked, so always try/catch).
    // =========================================================================
    let lang = 'es';
    try { const saved = localStorage.getItem('greenorbit-lang'); if (saved === 'en' || saved === 'es') lang = saved; } catch (e) { /* storage blocked */ }

    const LANGS = {
      es: {
        appTitle: 'GreenOrbit | Asesor de rotación de cultivos - Arequipa',
        skipLink: 'Saltar al contenido',
        audFarmer: 'Soy agricultor', audJunta: 'Junta de Usuarios', audFarmerShort: 'Agricultor', audBoardShort: 'Junta', audAria: 'Para quién es la vista',
        heroTitle: 'Un desierto que solo da de comer con agua de canal.',
        heroSub: 'Lo que siembres decide si esa agua alcanza todo el año.',
        pickTitle: 'Empieza aquí: ¿qué cultivas hoy?', pickSub: 'Toca tu cultivo. Con eso armamos las rotaciones que siguen.',
        zoneAria: 'Zona', zoneLocation: 'Zona',
        dryLabel: 'Año seco', dryBig: 'Probar un año seco', dryHint: 'Simula la menor entrega de agua vista en cada mes',
        dryBadge: 'Año seco · {pct} % del agua normal', capBadge: 'Agua al {pct} % de lo normal',
        dryRule: 'Año seco = la entrega más baja vista en cada mes en Pitay (2013–2025), cerca del {pct} % de lo normal. Los datos no traen años completos, así que los meses vienen de años distintos: es un caso de estrés, más duro que cualquier año real.',
        prioTitle: '¿Qué te importa más?', prioLead: 'Arrastra las tres perillas. El resultado cambia mientras las mueves.',
        prioWater: 'Ahorrar agua', prioSoil: 'Cuidar el suelo', prioIncome: 'Ganar más',
        lvl0: 'Poco', lvl1: 'Algo', lvl2: 'Mucho', lvl3: 'Lo máximo',
        prioCaptionTop: 'Lo que más pesa: {a}', prioCaptionTwo: 'Lo que más pesa: {a} y {b}', prioCaptionEven: 'Los tres pesan parecido',
        prioNote: 'Cuenta la proporción entre los tres, no el número: si los tres están iguales, pesan lo mismo.',
        sliderHelp: 'Con el teclado: flechas para cambiar un valor, Re Pág y Av Pág de 10 en 10.',
        prioValText: '{v} de 100',
        plannedSummary: 'Solo algunos cultivos (opcional)',
        plannedQ: 'Marca los cultivos que de verdad puedes sembrar; si no marcas ninguno, se consideran todos.',
        plotBtn: 'Afinar con la sal de mi suelo',
        answerTitle: 'Tu mejor jugada', changeCrop: 'cambiar',
        recAria: 'Rotación recomendada', recTitle1: 'La rotación que más te conviene', recTitleN: 'Rotación elegida: opción {n}', recTitleToday: 'Tu forma actual de rotar',
        pathNow: 'Hoy', pathCamp: 'Campaña {n}', pathAria: 'Ir a la campaña {n}: {crop}',
        confidence: 'Confianza', confAlta: 'alta', confMedia: 'media', confBaja: 'baja',
        verdictOk: 'Cabe en tu agua todos los meses.', verdictShort: 'Cabe en el año, pero faltaría agua en {n} meses.', verdictNo: 'No cabe en tu agua: {crops} pide más de la que llega en el año.',
        meterAria: '{name}: {v} de 5',
        blockWater: 'Agua', blockSoil: 'Suelo', blockIncome: 'Ingreso',
        seeNumbers: 'Ver los números', whyTitle: '¿Por qué esta rotación?',
        copyBtn: 'Copiar', copied: '¡Copiado!', copyTitle: 'Copiar resumen para WhatsApp',
        soilImpact: 'Impacto en el suelo', waterBalanceHdr: 'Balance de agua',
        optionBadge: 'Opción #{n} · encaja {m} % con tus prioridades',
        legendP1: 'Los cuadros comparan cada rotación con las otras posibles: <span class="text-sky-300">Agua</span> = ahorra más agua, <span class="text-amber-300">Suelo</span> = cuida más el suelo, <span class="text-emerald-300">Ingreso</span> = gana más. <b>Confianza</b> = cuán respaldada está la recomendación por datos y fuentes.',
        legendP2: 'No son una nota absoluta. Casi todos los cultivos le quitan nitrógeno al suelo: solo la haba y la alfalfa lo reponen, pero la alfalfa gasta mucha agua. Por eso una rotación que gana en agua e ingreso suele sacar pocos cuadros en suelo.',
        altTitle: 'Otras formas de rotar', altSub: 'Toca una para ver su calendario de agua.',
        tabRotations: 'Tarjetas', tabPar: '¿Qué pierdo si cuido el suelo?', viewTabsAria: 'Vista de resultados',
        altFitOk: 'Cabe en tu agua', altFitShort: 'Falta agua algunos meses', altFitNo: 'No cabe en tu agua',
        altSelected: 'Elegida', today: 'Hoy', altOption: 'Opción {n}',
        toMap: 'Ajustar a mi parcela en el mapa',
        calTitle: '¿Alcanza el agua, mes a mes?', calSub: 'Por hectárea. El agua azul es la que llega; la barra dorada, lo que piden las plantas.',
        calChipsAria: 'Campaña',
        calLegWater: 'Agua que llega', calLegNeed: 'Lo que piden las plantas', calLegNeedBoard: 'Lo que piden los cultivos', calLegShort: 'Falta agua', calLegRange: 'Si piden más (estimación alta)',
        supplyLabel: 'Agua que llega',
        farmWaterDefault: 'Calculando el agua que te llega…',
        farmWater: 'Te llegan unos {n} m³ por hectárea al año', farmWaterCap: ' ({pct} % del agua normal)',
        fitVerdictOk: 'Cabe en tu agua todos los meses',
        fitVerdictShort: 'Cabe en el año, pero falta agua en hasta {n} meses',
        fitVerdictNo: 'No cabe en tu agua: {crops} pide más de la que llega en el año',
        fitVerdictLow: 'Cabe solo con la estimación baja de lo que piden las plantas; con la estimación alta no cabe',
        fitDryOutlook: ' En un año seco faltaría agua en hasta {n} meses.',
        fitDryTag: '(año seco)',
        fitYearShort: 'Cabe en el año; falta agua en {n} meses', fitAll: 'Cabe todos los meses', fitNoYear: 'No cabe en el año',
        fitChartDry: 'En año seco: falta agua en {n} meses',
        sownIn: 'siembra en {m}', sownAssumed: 'siembra en {m} (mes supuesto)',
        fitAria: '{crop}: {n} meses piden más agua de la que llega', fitAriaOk: '{crop}: el agua alcanza todos los meses',
        chartTotal: 'Total de la campaña: {c} m³/ha (entre {l} y {h})', chartTotalOne: 'Total de la campaña: {c} m³/ha',
        fitSummaryTail: ' Te llegan unos {n} m³/ha al año.',
        methodNote: 'Estimación central: {low}. Estimación alta: {high}. Es lo que se calcula que piden las plantas, no una medición.',
        methodHg: 'Hargreaves (estimación baja)', methodPm: 'Penman-Monteith',
        yAxisTitle: 'Las cifras son m³ por hectárea, por mes.',
        tblMonth: 'Mes', tblSupply: 'Llega', tblNeed: 'Piden', tblShort: 'Falta',
        offlineCalc: 'No se pudo calcular el calendario de agua.',
        caveatsTitle: 'Lo que esto no sabe',
        fitNo: 'No cabe en tu agua: {crops} pide más de {n} m³/ha', fitShort: 'Cabe en el año; en {n} meses pide más de lo que llega', fitOk: 'Cabe en tu agua todos los meses',
        waterFig: 'Agua: unos {c} m³/ha por campaña', waterFigRange: ' (entre {l} y {h})', waterSpan: 'Agua: de {l} a {h} m³/ha por campaña',
        waterNoteMeasured: 'Medido con datos reales: {crops}. Lo demás es una estimación (FAO-56).',
        waterNoteEst: 'Es una estimación (FAO-56), no una medición.',
        mapTitleFarmer: '¿Es esta tu tierra? Tócala en el mapa.',
        mapSubFarmer: 'Cuadros de 5.4 ha del satélite MODIS (NASA). No es el borde exacto de tu parcela. Las rotaciones se ajustan al punto que toques.',
        mapTitleBoard: '¿Dónde golpea más un año con menos agua?',
        mapSubBoard: 'Cada punto es un cuadro de 5.4 ha del satélite MODIS (NASA), comparado consigo mismo en los años secos.',
        mapInvite: 'Toca aquí', mapDragHint: 'Usa dos dedos para mover el mapa', mapAria: 'Mapa satelital de la zona',
        mapOk: 'Regado', mapWarn: 'Mixto', mapBad: 'Desierto o sin riego', mapAttribution: 'Satélite Esri &mdash; NASA POWER',
        pixelHint: 'Los puntos verdes son las zonas regadas que ve el satélite. <b class="text-white">Toca tu parcela</b> para ver su verdor, el agua que usa y cómo le fue en los años secos.',
        pixelHead: 'Aquí el satélite ve: <b>{tipo}</b>.',
        pixelInfo: 'Cuadro de {ha} ha. Verdor medio (NDVI) 2013–2024: <b class="n">{ndvi}</b> (desierto ≈ 0.1; cultivo vigoroso ≥ 0.5)',
        pixelEt: 'Agua que usan las plantas y el suelo (ET): <b class="n">{et} mm al año</b>',
        pixelDry: 'En años con menos agua, el verdor de este lugar cambió: {dry}.',
        pixelAdj: 'Las rotaciones se ajustaron a este punto (mira «Ajustado a tu parcela» en el porqué).',
        pixelSrc: '{src}. El cuadro es más grande que muchas parcelas: describe el entorno de la tuya.',
        satOffline: 'No se pudo consultar el satélite en este momento.',
        vulHigh: 'Pierde mucho (−10 % o más)', vulMid: 'Pierde algo (−3 a −10 %)', vulLow: 'Aguanta',
        vulChange: 'Cambió de uso (no se recupera)', vulShort: 'Sin riego si falta agua (barra «Agua que llega»)',
        vulChangeTip: 'Bajó para siempre: {c} % de verdor entre 2013-2015 y 2022-2024 (¿ciudad o abandono?)',
        vulTip: 'En años con menos agua este cuadro cambió {c} % de verdor',
        vulHead: '<b>{alta} ha</b> pierden mucho verdor cuando el agua escasea y se recuperan después.',
        vulSummary: 'Comparando cada cuadro consigo mismo en 2014, 2016 y 2023: ' +
          '<b class="n">{alta} ha</b> pierden mucho verdor y se recuperan después, {media} ha pierden algo y {baja} ha aguantan. ' +
          'En gris, {cambio} ha que bajaron para siempre (ciudad que crece o chacras abandonadas): no se cuentan como sequía. ' +
          'Las más sensibles están sobre todo al <b>{sector}</b> de la pampa. ' +
          'Hectáreas con 15 % o más de caída: 2014 {y14} ha · 2016 {y16} ha · 2023 {y23} ha.',
        vulAdvice: 'Si en 2027 llega menos agua, estas zonas son las primeras a vigilar o priorizar en los turnos.',
        vulSrc: '{src} El verdor también cae por plagas o cambios de cultivo: es una señal, no una prueba.',
        boardFor: 'Para la Junta de Usuarios', boardTitle: '¿Alcanza el agua con esta mezcla de cultivos?',
        boardMixQ: 'Elige la mezcla de cultivos', boardWaterQ: '¿Cuánta agua llega?', boardAssump: 'Ajustar supuestos', boardAnswer: 'La respuesta',
        boardShortLine: 'Algunas chacras se quedarían sin riego. El mapa de abajo muestra cuáles lo notarían primero.',
        tankAria: 'Tanque: el agua que llega frente a lo que piden los cultivos. {tone}.',
        waterArea: 'Área regada', waterEff: 'Qué parte del agua aprovechan las plantas', waterEt0: 'Cuánta agua piden las plantas',
        optArea1: '15,900 ha (licencia)', optArea2: '17,500 ha (satélite)',
        optEff1: '≈ 50 % (medida con satélite)', optEff2: '75 % (supuesto, sin medir)',
        optEt0Pm: 'Estimación alta (Penman-Monteith)', optEt0Hg: 'Estimación baja (Hargreaves)',
        waterArrives: 'Agua que llega', capSliderAria: 'Agua disponible en porcentaje de lo normal',
        capLabelNormal: 'Agua de un año normal', capLabelPct: '{pct} % del agua normal',
        toneOk: 'Alcanza el agua', toneTight: 'Alcanza, con poco margen', toneBad: 'No alcanza',
        usePct: 'Usa <b>{pct} %</b> del agua disponible', useAria: 'La demanda usa {pct} por ciento del agua disponible',
        useHigh: 'Con la estimación alta usaría {pct} %.', useHighBad: 'Con la estimación alta, el agua no alcanzaría.',
        demandLine: 'Las plantas piden unos {d} millones de m³ (hasta {h} con la estimación alta) y llegan {c} millones de m³ ({sign} {b}). El borde del agua marca el 100 % de lo disponible.',
        shortage: 'Faltan {m} millones de m³: con esta mezcla alcanza para unas <b>{ok} ha</b>, o sea <b>{short} ha quedarían sin riego</b> si no se cambia nada. En el mapa, en rojo, las zonas que más sufrieron en los años secos: serían las primeras en notarlo.',
        simEstimate: 'Son cifras estimadas: el agua que piden las plantas se calcula, no se mide.',
        surplus: 'sobran', deficit: 'faltan', noData: 's/d', assumptionsTitle: 'Qué es supuesto', perCropTitle: 'Por cultivo',
        modalTitle: 'Datos de tu parcela',
        modalDesc: 'Por ahora el modelo usa la salinidad de tu suelo. El clima viene de NASA POWER para Majes y no se ajusta aquí.',
        modalSal: 'Salinidad de tu suelo (CE, dS/m), si la mediste',
        modalSalHelp: 'Con más sal rinden menos los cultivos sensibles (cebolla, papa, haba) y ganan los tolerantes (quinua, zapallo), según la tabla FAO-29. Si no la mediste, deja 2.8: es un valor de referencia, no de tu parcela.',
        cancelBtn: 'Cancelar', applyBtn: 'Aplicar datos', closeAria: 'Cerrar',
        waTitle: '🌱 *GreenOrbit Arequipa - Recomendación de rotación*',
        waZone: '📍 Zona:', waCrop: 'Cultivo actual:', waSeq: '🔄 Secuencia #',
        waWhy: '💡 Por qué:', waSoil: '🌿 Suelo:', waWater: '💧 Agua:', waMatch: '{m} % de ajuste a tus prioridades',
        zoneNote: 'Los datos del modelo son de Majes. Para esta zona los resultados son solo una referencia.',
        plannedSuggest: 'Con solo esos cultivos no hay rotación que respete las reglas (misma familia seguida o papa antes de 3 años). Abajo: qué agregar para poder rotar, y tu forma actual para comparar.',
        plannedList: 'Rotaciones armadas solo con tus cultivos. La última es tu forma actual, para comparar.',
        loadingRot: 'Calculando rotaciones…', rotUnavailable: 'Todavía no hay resultados del modelo.',
        paretoTitle: '¿Qué pierdo si cuido más el suelo?', paretoSvgAria: 'Gráfico: ingreso contra salud del suelo de cada rotación',
        paretoDesc: 'Cada punto es una rotación: más a la <strong class="text-slate-100">derecha gana más dinero</strong>, más <strong class="text-slate-100">arriba cuida más el suelo</strong>. La línea une las opciones sin desperdicio: pasar de una a otra es cambiar ingreso por suelo. Toca un punto para ver por qué.',
        paretoLegendOk: 'Sin desperdicio', paretoLegendBad: 'Hay otra mejor en suelo e ingreso', paretoLegendSize: 'Tamaño: cuánta agua ahorra (más grande, más ahorra)',
        paretoAxisX: 'Ingreso →  (0 a 100, relativo)', paretoAxisY: 'Salud del suelo →  (0 a 100)',
        paretoOpt: 'Opción {n}: ingreso {x}, suelo {y}',
        paretoSame: 'La opción #{n} es la mejor en suelo y en ingreso a la vez: aquí no hay que elegir.',
        paretoTake: 'Pasar de la #{a} (la que más cuida el suelo, {ys} puntos) a la #{b} (la que más gana, {xs} puntos de ingreso) suma {dx} puntos de ingreso y resta {dy} de suelo.',
        paretoTakeNote: ' Son puntos relativos entre estas opciones, no soles ni toneladas.',
        todayShort: 'Hoy',
        apiOk: 'Modelo conectado', apiOff: 'Modelo sin conexión', apiWait: 'Conectando…',
        wakeTitle: 'Despertando el modelo…', wakeBody: 'El servicio gratuito se duerme cuando nadie lo usa. La primera consulta puede tardar hasta un minuto.',
        errTitle: 'No pudimos conectar con el modelo', retryBtn: 'Reintentar',
        errTimeout: 'Tardó demasiado en responder. Prueba otra vez en unos segundos.',
        errNetwork: 'No hay conexión con el servicio. Revisa tu internet y prueba otra vez.',
        errServer: 'El servicio tuvo un problema. Prueba otra vez en unos segundos.',
        errRange: 'Alguno de los datos está fuera del rango permitido.',
        errRate: 'Hay demasiadas consultas seguidas. Espera unos segundos.',
        explainRate: 'Hay muchas consultas seguidas: mostramos el texto del modelo. Puedes volver a intentar en {n} s.',
        writing: 'Redactando…', srcAi: 'Texto redactado con IA ({r}). Las cifras son del modelo.', srcModel: 'Texto generado por el modelo ({r}).',
        monthInitials: 'E F M A M J J A S O N D'
      },
      en: {
        appTitle: 'GreenOrbit | Crop Rotation Advisor - Arequipa',
        skipLink: 'Skip to content',
        audFarmer: 'I am a farmer', audJunta: 'Water Users Board', audFarmerShort: 'Farmer', audBoardShort: 'Board', audAria: 'Who the view is for',
        heroTitle: 'A desert that only feeds people with canal water.',
        heroSub: 'What you plant decides whether that water lasts the whole year.',
        pickTitle: 'Start here: what do you grow today?', pickSub: 'Tap your crop. We build the rotations that come next from it.',
        zoneAria: 'Zone', zoneLocation: 'Zone',
        dryLabel: 'Dry year', dryBig: 'Try a dry year', dryHint: 'Simulates the lowest water delivery seen in each month',
        dryBadge: 'Dry year · {pct} % of normal water', capBadge: 'Water at {pct} % of normal',
        dryRule: 'Dry year = the lowest delivery seen in each month at Pitay (2013–2025), about {pct} % of normal. The data has no complete years, so the months come from different years: it is a stress case, harsher than any real year.',
        prioTitle: 'What matters most to you?', prioLead: 'Drag the three knobs. The answer changes as you move them.',
        prioWater: 'Save water', prioSoil: 'Protect the soil', prioIncome: 'Earn more',
        lvl0: 'A little', lvl1: 'Some', lvl2: 'A lot', lvl3: 'Maximum',
        prioCaptionTop: 'Weighs most: {a}', prioCaptionTwo: 'Weighs most: {a} and {b}', prioCaptionEven: 'All three weigh about the same',
        prioNote: 'What counts is the proportion between the three, not the number: if all three are equal, they weigh the same.',
        sliderHelp: 'With the keyboard: arrow keys change a value, Page Up and Page Down in steps of 10.',
        prioValText: '{v} out of 100',
        plannedSummary: 'Only some crops (optional)',
        plannedQ: 'Mark the crops you can really sow; if you mark none, all are considered.',
        plotBtn: 'Tune it to my soil salinity',
        answerTitle: 'Your best move', changeCrop: 'change',
        recAria: 'Recommended rotation', recTitle1: 'The rotation that suits you best', recTitleN: 'Chosen rotation: option {n}', recTitleToday: 'Your current way of rotating',
        pathNow: 'Now', pathCamp: 'Campaign {n}', pathAria: 'Go to campaign {n}: {crop}',
        confidence: 'Confidence', confAlta: 'high', confMedia: 'medium', confBaja: 'low',
        verdictOk: 'Fits your water every month.', verdictShort: 'Fits over the year, but water would be short in {n} months.', verdictNo: 'Does not fit your water: {crops} needs more than arrives over the year.',
        meterAria: '{name}: {v} out of 5',
        blockWater: 'Water', blockSoil: 'Soil', blockIncome: 'Income',
        seeNumbers: 'See the numbers', whyTitle: 'Why this rotation?',
        copyBtn: 'Copy', copied: 'Copied!', copyTitle: 'Copy summary for WhatsApp',
        soilImpact: 'Soil impact', waterBalanceHdr: 'Water balance',
        optionBadge: 'Option #{n} · {m} % match to your priorities',
        legendP1: 'The squares compare each rotation with the other possible ones: <span class="text-sky-300">Water</span> = saves more water, <span class="text-amber-300">Soil</span> = protects the soil more, <span class="text-emerald-300">Income</span> = earns more. <b>Confidence</b> = how well the recommendation is backed by data and sources.',
        legendP2: 'They are not an absolute grade. Almost every crop takes nitrogen from the soil: only fava bean and alfalfa put it back, but alfalfa uses a lot of water. That is why a rotation that wins on water and income usually gets few squares on soil.',
        altTitle: 'Other ways to rotate', altSub: 'Tap one to see its water calendar.',
        tabRotations: 'Cards', tabPar: 'What do I give up to protect the soil?', viewTabsAria: 'Results view',
        altFitOk: 'Fits your water', altFitShort: 'Water is short some months', altFitNo: 'Does not fit your water',
        altSelected: 'Chosen', today: 'Now', altOption: 'Option {n}',
        toMap: 'Adjust it to my plot on the map',
        calTitle: 'Is there enough water, month by month?', calSub: 'Per hectare. Blue is the water that arrives; the gold bar is what the plants ask for.',
        calChipsAria: 'Campaign',
        calLegWater: 'Water that arrives', calLegNeed: 'What the plants ask for', calLegNeedBoard: 'What the crops ask for', calLegShort: 'Water is short', calLegRange: 'If they ask for more (high estimate)',
        supplyLabel: 'Water that arrives',
        farmWaterDefault: 'Working out the water you receive…',
        farmWater: 'You get about {n} m³ per hectare a year', farmWaterCap: ' ({pct} % of the normal water)',
        fitVerdictOk: 'Fits your water every month',
        fitVerdictShort: 'Fits over the year, but water is short in up to {n} months',
        fitVerdictNo: 'Does not fit your water: {crops} needs more than arrives over the year',
        fitVerdictLow: 'Fits only with the low estimate of what the plants ask for; with the high estimate it does not',
        fitDryOutlook: ' In a dry year water would be short in up to {n} months.',
        fitDryTag: '(dry year)',
        fitYearShort: 'Fits over the year; short in {n} months', fitAll: 'Fits every month', fitNoYear: 'Does not fit the year',
        fitChartDry: 'In a dry year: short in {n} months',
        sownIn: 'sown in {m}', sownAssumed: 'sown in {m} (assumed month)',
        fitAria: '{crop}: {n} months ask for more water than arrives', fitAriaOk: '{crop}: the water is enough every month',
        chartTotal: 'Campaign total: {c} m³/ha (between {l} and {h})', chartTotalOne: 'Campaign total: {c} m³/ha',
        fitSummaryTail: ' You get about {n} m³/ha a year.',
        methodNote: 'Central estimate: {low}. High estimate: {high}. This is what the plants are calculated to ask for, not a measurement.',
        methodHg: 'Hargreaves (low estimate)', methodPm: 'Penman-Monteith',
        yAxisTitle: 'Figures are m³ per hectare, per month.',
        tblMonth: 'Month', tblSupply: 'Arrives', tblNeed: 'Asked', tblShort: 'Short',
        offlineCalc: 'Could not calculate the water calendar.',
        caveatsTitle: 'What this does not know',
        fitNo: 'Does not fit your water: {crops} needs more than {n} m³/ha', fitShort: 'Fits over the year; in {n} months it needs more than arrives', fitOk: 'Fits your water every month',
        waterFig: 'Water: about {c} m³/ha per campaign', waterFigRange: ' (between {l} and {h})', waterSpan: 'Water: {l} to {h} m³/ha per campaign',
        waterNoteMeasured: 'Measured with real data: {crops}. The rest is an estimate (FAO-56).',
        waterNoteEst: 'This is an estimate (FAO-56), not a measurement.',
        mapTitleFarmer: 'Is this your land? Tap it on the map.',
        mapSubFarmer: '5.4 ha squares from the MODIS satellite (NASA). Not the exact edge of your plot. The rotations adjust to the point you tap.',
        mapTitleBoard: 'Where does a year with less water hit hardest?',
        mapSubBoard: 'Each dot is a 5.4 ha square from the MODIS satellite (NASA), compared with itself in the dry years.',
        mapInvite: 'Tap here', mapDragHint: 'Use two fingers to move the map', mapAria: 'Satellite map of the area',
        mapOk: 'Irrigated', mapWarn: 'Mixed', mapBad: 'Desert or not irrigated', mapAttribution: 'Esri satellite &mdash; NASA POWER',
        pixelHint: 'The green dots are the irrigated areas the satellite sees. <b class="text-white">Tap your plot</b> to see its greenness, the water it uses and how it did in the dry years.',
        pixelHead: 'Here the satellite sees: <b>{tipo}</b>.',
        pixelInfo: '{ha} ha square. Mean greenness (NDVI) 2013–2024: <b class="n">{ndvi}</b> (desert ≈ 0.1; vigorous crop ≥ 0.5)',
        pixelEt: 'Water used by plants and soil (ET): <b class="n">{et} mm a year</b>',
        pixelDry: 'In years with less water, the greenness of this place changed: {dry}.',
        pixelAdj: 'The rotations were adjusted to this point (see «Adjusted to your plot» in the why).',
        pixelSrc: '{src}. The square is larger than many plots: it describes the surroundings of yours.',
        satOffline: 'Could not query the satellite right now.',
        vulHigh: 'Loses a lot (−10 % or more)', vulMid: 'Loses some (−3 to −10 %)', vulLow: 'Holds up',
        vulChange: 'Changed use (does not recover)', vulShort: 'No irrigation if water runs short («Water that arrives» bar)',
        vulChangeTip: 'Dropped for good: {c} % of greenness between 2013-2015 and 2022-2024 (city or abandonment?)',
        vulTip: 'In years with less water this square changed {c} % of greenness',
        vulHead: '<b>{alta} ha</b> lose a lot of greenness when water runs short, then recover.',
        vulSummary: 'Comparing each square with itself in 2014, 2016 and 2023: ' +
          '<b class="n">{alta} ha</b> lose a lot of greenness and recover afterwards, {media} ha lose some and {baja} ha hold up. ' +
          'In grey, {cambio} ha that dropped for good (growing city or abandoned fields): they are not counted as drought. ' +
          'The most sensitive ones are mostly in the <b>{sector}</b> of the pampa. ' +
          'Hectares with a drop of 15 % or more: 2014 {y14} ha · 2016 {y16} ha · 2023 {y23} ha.',
        vulAdvice: 'If less water arrives in 2027, these areas are the first to watch or prioritise in the irrigation turns.',
        vulSrc: '{src} Greenness also drops because of pests or crop changes: it is a signal, not a proof.',
        boardFor: 'For the Water Users Board', boardTitle: 'Is there enough water for this crop mix?',
        boardMixQ: 'Choose the crop mix', boardWaterQ: 'How much water arrives?', boardAssump: 'Adjust assumptions', boardAnswer: 'The answer',
        boardShortLine: 'Some fields would be left without irrigation. The map below shows which ones would notice first.',
        tankAria: 'Tank: the water that arrives against what the crops ask for. {tone}.',
        waterArea: 'Irrigated area', waterEff: 'How much of the water the plants use', waterEt0: 'How much water the plants ask for',
        optArea1: '15,900 ha (license)', optArea2: '17,500 ha (satellite)',
        optEff1: '≈ 50 % (measured by satellite)', optEff2: '75 % (assumption, not measured)',
        optEt0Pm: 'High estimate (Penman-Monteith)', optEt0Hg: 'Low estimate (Hargreaves)',
        waterArrives: 'Water that arrives', capSliderAria: 'Available water as a percentage of normal',
        capLabelNormal: 'Water of a normal year', capLabelPct: '{pct} % of the normal water',
        toneOk: 'There is enough water', toneTight: 'Enough, with a thin margin', toneBad: 'Not enough',
        usePct: 'Uses <b>{pct} %</b> of the available water', useAria: 'Demand uses {pct} percent of the available water',
        useHigh: 'With the high estimate it would use {pct} %.', useHighBad: 'With the high estimate, the water would not be enough.',
        demandLine: 'The plants ask for about {d} million m³ (up to {h} with the high estimate) and {c} million m³ arrive ({sign} {b}). The water edge marks 100 % of what is available.',
        shortage: '{m} million m³ are missing: with this mix there is water for about <b>{ok} ha</b>, so <b>{short} ha would be left without irrigation</b> if nothing changes. On the map, in red, the areas that suffered most in the dry years: they would be the first to notice.',
        simEstimate: 'These figures are estimates: the water the plants ask for is calculated, not measured.',
        surplus: 'surplus', deficit: 'shortfall', noData: 'n/a', assumptionsTitle: 'What is assumed', perCropTitle: 'By crop',
        modalTitle: 'Your plot data',
        modalDesc: 'For now the model uses your soil salinity. Climate comes from NASA POWER for Majes and is not adjusted here.',
        modalSal: 'Your soil salinity (EC, dS/m), if measured',
        modalSalHelp: 'With more salt, sensitive crops (onion, potato, fava bean) yield less and tolerant ones (quinoa, squash) gain, according to the FAO-29 table. If you did not measure it, leave 2.8: it is a reference value, not your plot\'s.',
        cancelBtn: 'Cancel', applyBtn: 'Apply data', closeAria: 'Close',
        waTitle: '🌱 *GreenOrbit Arequipa - Rotation Recommendation*',
        waZone: '📍 Zone:', waCrop: 'Current crop:', waSeq: '🔄 Sequence #',
        waWhy: '💡 Why:', waSoil: '🌿 Soil:', waWater: '💧 Water:', waMatch: '{m} % match to your priorities',
        zoneNote: 'The model data is from Majes. For this zone the results are only a reference.',
        plannedSuggest: 'With only those crops no rotation follows the rules (same family in a row, or potato again within 3 years). Below: what to add to be able to rotate, and your current way for comparison.',
        plannedList: 'Rotations built only with your crops. The last one is your current way, for comparison.',
        loadingRot: 'Calculating rotations…', rotUnavailable: 'There are no model results yet.',
        paretoTitle: 'What do I give up to protect the soil?', paretoSvgAria: 'Chart: income against soil health for each rotation',
        paretoDesc: 'Each point is a rotation: further <strong class="text-slate-100">right earns more</strong>, higher <strong class="text-slate-100">protects the soil more</strong>. The line joins the options with no waste: moving along it trades income for soil. Tap a point to see why.',
        paretoLegendOk: 'No waste', paretoLegendBad: 'Another option is better on soil and income', paretoLegendSize: 'Size: how much water it saves (bigger, saves more)',
        paretoAxisX: 'Income →  (0 to 100, relative)', paretoAxisY: 'Soil health →  (0 to 100)',
        paretoOpt: 'Option {n}: income {x}, soil {y}',
        paretoSame: 'Option #{n} is the best on soil and on income at once: there is nothing to trade off here.',
        paretoTake: 'Going from #{a} (best for the soil, {ys} points) to #{b} (earns the most, {xs} income points) adds {dx} income points and loses {dy} soil points.',
        paretoTakeNote: ' These are relative points among these options, not soles or tonnes.',
        todayShort: 'Now',
        apiOk: 'Model connected', apiOff: 'Model offline', apiWait: 'Connecting…',
        wakeTitle: 'Waking up the model…', wakeBody: 'The free service sleeps when nobody is using it. The first request can take up to a minute.',
        errTitle: 'We could not reach the model', retryBtn: 'Try again',
        errTimeout: 'It took too long to answer. Try again in a few seconds.',
        errNetwork: 'There is no connection to the service. Check your internet and try again.',
        errServer: 'The service had a problem. Try again in a few seconds.',
        errRange: 'One of the values is outside the allowed range.',
        errRate: 'There are too many requests in a row. Wait a few seconds.',
        explainRate: 'There are many requests in a row: we show the model\'s own text. You can try again in {n} s.',
        writing: 'Writing…', srcAi: 'Text written with AI ({r}). The figures come from the model.', srcModel: 'Text generated by the model ({r}).',
        monthInitials: 'J F M A M J J A S O N D'
      }
    };

    // Display names in English; the Spanish names stay the identifiers sent to and received from the API
    const CROP_EN = { Papa: 'Potato', Cebolla: 'Onion', Ajo: 'Garlic', Quinua: 'Quinoa', Zapallo: 'Squash', Haba: 'Fava bean',
                      'Maíz': 'Maize', Alfalfa: 'Alfalfa', Paprika: 'Paprika', Vid: 'Grapevine', Trigo: 'Wheat' };
    const ZONE_EN = { tambo: 'Tambo Valley' };
    const ZONE_CHIP = { es: { majes: 'Majes', tambo: 'Valle de Tambo' }, en: { majes: 'Majes', tambo: 'Tambo Valley' } };
    const MONTH_EN = { ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', set: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec' };
    const MONTH_ES = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', set: 'setiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };
    const KIND_EN = { 'regado': 'irrigated', 'mixto (parte regada)': 'mixed (partly irrigated)', 'desierto o sin riego': 'desert or not irrigated', 'sin dato': 'no data' };
    const MIX_EN = { 'Actual (Autodema 2016)': 'Current (Autodema 2016)', 'Menos alfalfa (ilustrativo)': 'Less alfalfa (illustrative)',
                     'Diversificada (ilustrativo)': 'Diversified (illustrative)' };
    const inEn = (map, v) => (lang === 'en' && map[v]) || v;
    const cropName = (c) => inEn(CROP_EN, c);
    const zoneName = (z) => (lang === 'en' && ZONE_EN[z]) || ZONE_NAMES[z] || 'Majes - El Pedregal';
    const monthName = (m) => (lang === 'en' ? MONTH_EN[m] : MONTH_ES[m]) || m;
    const kindName = (k) => inEn(KIND_EN, k);
    const mixName = (m) => inEn(MIX_EN, m);

    // Spanish (Peru) and English both use a comma for thousands and a point for decimals, as the backend text does
    const fmt = (n, d = 0) => Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

    // t('key') or t('key', { n: 3 }): fills {n} placeholders
    function t(key, vars) {
      const s = (LANGS[lang] && LANGS[lang][key]) || LANGS.es[key] || key;
      return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
    }

    function translateStatic() {
      document.documentElement.lang = lang;
      document.title = t('appTitle');
      $('lang-toggle').textContent = lang === 'es' ? 'EN' : 'ES';
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
      document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
      document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
      document.querySelectorAll('#zone-chips button').forEach((b) => { b.textContent = ZONE_CHIP[lang][b.dataset.zone]; });
      buildTiles(state.crops.length ? state.crops : DEFAULT_CROPS);
      syncCropChip();
      renderPriorities();
      syncMapCopy();
      if (parcelMap && baseTiles) {
        parcelMap.attributionControl.removeAttribution(baseTiles.getAttribution());
        baseTiles.options.attribution = t('mapAttribution');
        parcelMap.attributionControl.addAttribution(baseTiles.getAttribution());
      }
    }

    function toggleLang() {
      lang = lang === 'es' ? 'en' : 'es';
      try { localStorage.setItem('greenorbit-lang', lang); } catch (e) { /* storage blocked: the choice just is not remembered */ }
      applyLang();
    }

    function applyLang() {
      translateStatic();
      renderCards(); renderPareto(); renderRec();        // from state, instantly
      if (window.FieldShiftApi && FieldShiftApi.onLang) FieldShiftApi.onLang();
      recalculateAll();                                  // the ranking text comes in the new language
    }

    const CONF_KEY = { ALTA: 'confAlta', MEDIA: 'confMedia', BAJA: 'confBaja' };

    // =========================================================================
    // CROP GLYPHS: simple inline SVG, one per crop (no emoji, no icon font)
    // =========================================================================
    const CROP_COL = { Papa: '#c9a06a', Cebolla: '#c9738f', Ajo: '#e8dfc8', Quinua: '#e0a75a', Zapallo: '#e08a3c', Haba: '#8cc46a',
                       'Maíz': '#e6c25a', Alfalfa: '#4fbf7a', Paprika: '#dc6a45', Vid: '#9b6fb0', Trigo: '#d9b86a' };
    const GLYPHS = {
      Papa: '<path d="M8 27c-1-8 6-14 16-14 10 0 17 6 16 14-1 8-9 11-17 10C14 37 9 33 8 27z" fill="#c9a06a"/><path d="M14 21c3-3 7-4 11-4" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="19" cy="28" r="1.7" fill="#7a5a2c"/><circle cx="29" cy="25" r="1.7" fill="#7a5a2c"/><circle cx="27" cy="32" r="1.7" fill="#7a5a2c"/><circle cx="14" cy="30" r="1.4" fill="#7a5a2c"/>',
      Cebolla: '<path d="M24 11c1 2 1 4 0 6 7 2 13 8 13 15 0 6-6 10-13 10S11 38 11 32c0-7 6-13 13-15-1-2-1-4 0-6z" fill="#c9738f"/><path d="M24 17c-4 4-5 13-1 22M24 17c4 4 5 13 1 22" stroke="#fff" stroke-opacity=".42" stroke-width="1.6" fill="none"/><path d="M24 11c0-3 2-5 5-6" stroke="#8cc46a" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M21 41h6" stroke="#8b4a63" stroke-width="2" stroke-linecap="round"/>',
      Ajo: '<path d="M24 8c1 4 1 6 0 8 8 3 13 9 13 16 0 5-5 8-13 8s-13-3-13-8c0-7 5-13 13-16-1-2-1-4 0-8z" fill="#efe6d2"/><path d="M24 16c-6 5-7 15-2 24M24 16c6 5 7 15 2 24M24 16v24" stroke="#b9a98a" stroke-width="1.6" fill="none"/><path d="M20 42h8" stroke="#b9a98a" stroke-width="2" stroke-linecap="round"/>',
      Quinua: '<path d="M24 43V22" stroke="#6e9c52" stroke-width="2.6" stroke-linecap="round"/><g fill="#e0a75a"><circle cx="24" cy="8" r="3.2"/><circle cx="20" cy="13" r="3.2"/><circle cx="28" cy="13" r="3.2"/><circle cx="17" cy="19" r="3.2" fill="#d96f5a"/><circle cx="24" cy="18" r="3.2" fill="#d96f5a"/><circle cx="31" cy="19" r="3.2" fill="#d96f5a"/><circle cx="21" cy="24" r="3.2"/><circle cx="27" cy="24" r="3.2"/></g><path d="M24 40c-5-1-8-4-9-8 5 0 8 3 9 8zM24 37c5-1 8-4 9-8-5 0-8 3-9 8z" fill="#6e9c52"/>',
      Zapallo: '<ellipse cx="24" cy="29" rx="16" ry="12.5" fill="#e08a3c"/><path d="M24 17c-5 3-6 20 0 24M24 17c5 3 6 20 0 24M24 17c-10 2-13 18-4 23M24 17c10 2 13 18 4 23" stroke="#a95a1c" stroke-opacity=".6" stroke-width="1.5" fill="none"/><path d="M24 17c0-4 2-7 6-8" stroke="#6e9c52" stroke-width="3.2" stroke-linecap="round" fill="none"/>',
      Haba: '<path d="M9 36C7 20 20 7 39 8c1 18-8 33-26 31z" fill="#8cc46a"/><path d="M12 37C20 29 30 19 38 9" stroke="#5a8d3c" stroke-width="1.6" fill="none"/><circle cx="20" cy="28" r="4" fill="#d6edb0"/><circle cx="27" cy="21" r="4" fill="#d6edb0"/><circle cx="33" cy="14" r="3.2" fill="#d6edb0"/>',
      'Maíz': '<path d="M24 5c8 4 11 14 10 24-1 7-5 11-10 11s-9-4-10-11C13 19 16 9 24 5z" fill="#e6c25a"/><path d="M19 13h10M17 19h14M16 25h16M17 31h14M24 7v32" stroke="#b9902a" stroke-width="1.3" fill="none"/><path d="M24 42c-9 0-14-6-15-14 4 3 8 7 15 7zM24 42c9 0 14-6 15-14-4 3-8 7-15 7z" fill="#6e9c52"/>',
      Alfalfa: '<path d="M24 29v14" stroke="#2f8f58" stroke-width="2.8" stroke-linecap="round"/><circle cx="24" cy="14" r="8" fill="#4fbf7a"/><circle cx="15" cy="26" r="8" fill="#4fbf7a"/><circle cx="33" cy="26" r="8" fill="#4fbf7a"/><circle cx="24" cy="23" r="4.2" fill="#2f8f58"/><path d="M19 12c3-3 7-3 10 0M10 25c2-3 6-4 9-2M29 23c3-2 7-1 9 2" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
      Paprika: '<path d="M15 17c-5 3-7 12-3 21 2 5 8 6 11 2 2-3 1-6 4-9 3-4 1-10-4-13-3-2-6-2-8-1z" fill="#dc6a45"/><path d="M15 17c1-3 4-5 7-5 2 0 3-2 3-6" stroke="#6e9c52" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M16 21c-2 4-2 9 0 13" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" fill="none"/>',
      Vid: '<g fill="#9b6fb0"><circle cx="18" cy="22" r="5"/><circle cx="28" cy="22" r="5"/><circle cx="23" cy="29" r="5"/><circle cx="14" cy="30" r="4.6"/><circle cx="32" cy="30" r="4.6"/><circle cx="23" cy="37" r="4.4"/></g><path d="M24 17c0-4 1-7 5-9" stroke="#6e9c52" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M26 11c4-3 9-2 11 2-4 2-8 2-11-2z" fill="#6e9c52"/>',
      Trigo: '<path d="M24 44V14" stroke="#b39a50" stroke-width="2.4" stroke-linecap="round"/><g fill="#d9b86a"><ellipse cx="19" cy="14" rx="3.4" ry="6" transform="rotate(-25 19 14)"/><ellipse cx="29" cy="14" rx="3.4" ry="6" transform="rotate(25 29 14)"/><ellipse cx="18" cy="23" rx="3.4" ry="6" transform="rotate(-25 18 23)"/><ellipse cx="30" cy="23" rx="3.4" ry="6" transform="rotate(25 30 23)"/><ellipse cx="18" cy="32" rx="3.4" ry="6" transform="rotate(-25 18 32)"/><ellipse cx="30" cy="32" rx="3.4" ry="6" transform="rotate(25 30 32)"/><ellipse cx="24" cy="9" rx="3" ry="6"/></g>'
    };
    const GLYPH_FALLBACK = '<path d="M24 42V24" stroke="#6e9c52" stroke-width="3" stroke-linecap="round"/><path d="M24 26c-8 0-12-5-12-12 8 0 12 5 12 12zM24 30c7 0 11-4 11-10-7 0-11 4-11 10z" fill="#4fbf7a"/>';
    const cropGlyph = (c) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${GLYPHS[c] || GLYPH_FALLBACK}</svg>`;
    const cropColor = (c) => CROP_COL[c] || '#82958d';
    const CHECK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const ICON = {
      water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/></svg>',
      soil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c3-4 6-6 9-8"/></svg>',
      income: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.4-2.5 1.8-2.5.8-2.5 1.8 1 1.6 2.5 1.6 2.5-.6 2.5-1.6"/></svg>'
    };
    const WARN_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l10 18H2L12 3z"/></svg>';

    // =========================================================================
    // STEP 1: CROP TILES and ZONE
    // =========================================================================
    function buildTiles(crops) {
      const box = $('crop-tiles');
      if (!box) return;
      box.innerHTML = crops.map((c) => `<button type="button" class="tile" data-crop="${c}" aria-pressed="${state.picked && c === state.currentCrop}">
          <span class="tick">${CHECK_ICON}</span>
          <span class="glyph-disc" style="--g:${cropColor(c)}">${cropGlyph(c)}</span>
          <span>${cropName(c)}</span></button>`).join('');
    }

    function syncCropChip() {
      const g = $('crop-chip-glyph'), n = $('crop-chip-name');
      if (!g || !n) return;
      g.style.setProperty('--g', cropColor(state.currentCrop));
      g.innerHTML = cropGlyph(state.currentCrop);
      n.textContent = cropName(state.currentCrop);
    }

    function pickCrop(c) {
      state.currentCrop = c;
      state.picked = true;
      document.querySelectorAll('#crop-tiles .tile').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.crop === c)));
      syncCropChip();
      revealBench();
      state.selectedRotationIdx = 0;
      recalculateAll();
    }

    function setZone(z) {
      if (state.zone === z) return;
      state.zone = z;
      document.querySelectorAll('#zone-chips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === z)));
      if (state.picked) recalculateAll(); else updateParcelMap();
    }

    // Steps 2 and 3 unfold once the farmer has said what they grow
    function revealBench() {
      const bench = $('bench');
      const first = bench.hidden;
      bench.hidden = false;
      document.body.dataset.stage = 'explore';
      syncMapBand();
      if (first) {
        if (!reducedMotion()) { bench.classList.add('is-revealing'); setTimeout(() => bench.classList.remove('is-revealing'), 900); }
        introSliders();
      }
      requestAnimationFrame(() => bench.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }));
    }

    // The map is the last block: shown once the crop is chosen (farmer) or always (board)
    function syncMapBand() {
      const show = state.audience === 'junta' || state.picked;
      $('map-band').hidden = !show;
      if (show) {
        if (!parcelMap) initParcelMap();
        setTimeout(() => { if (parcelMap) parcelMap.invalidateSize(); }, 150);
        if (window.FieldShiftApi) FieldShiftApi.drawMap();
      }
    }
    function syncMapCopy() {
      const junta = state.audience === 'junta';
      const h = $('map-h'), s = $('map-sub');
      if (h) h.textContent = t(junta ? 'mapTitleBoard' : 'mapTitleFarmer');
      if (s) s.textContent = t(junta ? 'mapSubBoard' : 'mapSubFarmer');
    }

    // Audience shell: which view is on screen (api.js adds the data work on top)
    function applyAudienceShell(a) {
      state.audience = a;
      const junta = a === 'junta';
      document.body.dataset.aud = a;
      $('aud-farmer').setAttribute('aria-pressed', String(!junta));
      $('aud-junta').setAttribute('aria-pressed', String(junta));
      $('view-farmer').hidden = junta;
      $('view-board').hidden = !junta;
      syncMapCopy();
      syncMapBand();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    // =========================================================================
    // STEP 2: PRIORITIES (three native range inputs: keyboard and touch work out of the box)
    // =========================================================================
    const PRIO = {
      water: { id: 'prio-water', word: 'word-water', nameKey: 'prioWater', cls: 'r-water' },
      soil: { id: 'prio-soil', word: 'word-soil', nameKey: 'prioSoil', cls: 'r-soil' },
      income: { id: 'prio-income', word: 'word-income', nameKey: 'prioIncome', cls: 'r-income' }
    };
    let prioTimer = null;
    let introRunning = false;

    const levelWord = (v) => t('lvl' + (v < 25 ? 0 : v < 60 ? 1 : v < 85 ? 2 : 3));

    function renderPriorities(shown) {
      const vals = shown || state.priorities;
      Object.entries(PRIO).forEach(([key, cfg]) => {
        const input = $(cfg.id);
        if (!input) return;
        const v = vals[key];
        if (+input.value !== v) input.value = v;
        input.parentElement.style.setProperty('--p', v);
        input.setAttribute('aria-valuetext', t('prioValText', { v }) + ', ' + levelWord(v));
        $(cfg.word).textContent = levelWord(v);
      });
      const rb = $('prio-ribbon');
      if (rb) {
        if (!rb.children.length) {
          rb.innerHTML = Object.entries(PRIO).map(([key, cfg]) => `<span class="${cfg.cls}" data-k="${key}">${ICON[key]}</span>`).join('');
        }
        rb.querySelectorAll('span').forEach((s) => { s.style.flexGrow = Math.max(vals[s.dataset.k], 6); });
      }
      const cap = $('prio-caption');
      if (cap) {
        const arr = Object.entries(vals).sort((a, b) => b[1] - a[1]);
        const spread = arr[0][1] - arr[2][1];
        if (spread <= 12) cap.textContent = t('prioCaptionEven');
        else if (arr[0][1] - arr[1][1] <= 10) cap.textContent = t('prioCaptionTwo', { a: t(PRIO[arr[0][0]].nameKey).toLowerCase(), b: t(PRIO[arr[1][0]].nameKey).toLowerCase() });
        else cap.textContent = t('prioCaptionTop', { a: t(PRIO[arr[0][0]].nameKey).toLowerCase() });
      }
    }

    function setPriority(key, v) {
      const nv = clamp(Math.round(v), 0, 100);
      if (state.priorities[key] === nv) return;
      state.priorities[key] = nv;
      renderPriorities();
    }

    // The model is asked ~250 ms after the last move, so a drag re-ranks live without flooding the service
    function schedulePriorityRefresh() {
      clearTimeout(prioTimer);
      prioTimer = setTimeout(recalculateAll, 250);
    }

    // First reveal: the knobs slide in from zero, which shows they can be dragged
    function introSliders() {
      if (reducedMotion()) return;
      introRunning = true;
      const target = { ...state.priorities }, t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        const shown = {};
        Object.keys(target).forEach((key) => { shown[key] = Math.round(target[key] * e); });
        renderPriorities(shown);
        if (k < 1) requestAnimationFrame(step); else { introRunning = false; renderPriorities(); }
      };
      requestAnimationFrame(step);
    }

    function initPriorities() {
      Object.entries(PRIO).forEach(([key, cfg]) => {
        const input = $(cfg.id);
        input.addEventListener('input', () => {
          $('prio-panel').classList.remove('untouched');
          setPriority(key, +input.value);
          schedulePriorityRefresh();
        });
      });
    }

    // =========================================================================
    // RECALCULATION
    // =========================================================================
    function setStale(on) {
      ['rec', 'rotations-list'].forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle('stale', on);
        if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
      });
    }

    // Ask the model; the answer stays on screen (dimmed) while the new ranking is on its way
    function recalculateAll(apiRanked) {
      if (Array.isArray(apiRanked)) { setRanked(apiRanked); return; }
      if (!state.picked) return;
      if (state.currentRanked.length) {
        setStale(true);
      } else {
        state.load = 'loading';
        renderCards(); renderRec();
      }
      if (window.FieldShiftApi) FieldShiftApi.refreshRanking();
      updateParcelMap();
    }

    function setRanked(list) {
      state.currentRanked = list;
      state.load = 'ready';
      if (state.selectedRotationIdx >= list.length) state.selectedRotationIdx = 0;
      setStale(false);
      renderCards(); renderPareto(); renderRec();
      if (window.FieldShiftApi) FieldShiftApi.onSelection(selectedRotation());
    }

    function setRankingError() {
      setStale(false);
      if (!state.currentRanked.length) { state.load = 'error'; renderCards(); renderRec(); }
    }

    function selectedRotation() {
      return state.currentRanked[state.selectedRotationIdx] || state.currentRanked[0] || null;
    }

    // =========================================================================
    // THE RECOMMENDATION: one path, one verdict, three fills
    // =========================================================================
    function verdictOf(rot) {
      const f = rot && rot.facts && rot.facts.agua_cabe;
      if (!f) return null;
      if (!f.cabe_en_el_anio) return { tone: 'no', level: 0.15, text: t('verdictNo', { crops: (f.no_caben || []).map(cropName).join(', ') }), detail: t('fitNo', { crops: (f.no_caben || []).map(cropName).join(', '), n: fmt(f.llega_m3_ha_anio) }) };
      if (f.max_meses_con_deficit) return { tone: 'short', level: Math.max(0.35, 1 - f.max_meses_con_deficit / 12), text: t('verdictShort', { n: f.max_meses_con_deficit }), detail: t('fitShort', { n: f.max_meses_con_deficit }) };
      return { tone: 'ok', level: 1, text: t('verdictOk'), detail: t('fitOk') };
    }

    function dropIcon(level) {
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><g clip-path="url(#clip-drop)"><rect class="drop-level" x="0" y="0" width="24" height="24" style="--lvl:${level}; fill: var(--tone-c)"/></g><path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z" fill="none" stroke="var(--tone-c)" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    }

    function pips(n) {
      let h = '';
      for (let i = 1; i <= 5; i++) h += `<i class="${i <= n ? 'on' : ''}"></i>`;
      return `<span class="pips">${h}</span>`;
    }

    function confDots(conf) {
      const n = conf === 'ALTA' ? 3 : conf === 'MEDIA' ? 2 : 1;
      const cls = conf === 'ALTA' ? 'conf-high' : conf === 'MEDIA' ? 'conf-med' : 'conf-low';
      return `<span class="${cls}" style="display:inline-flex;gap:4px">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
    }

    function applyTones() {
      document.querySelectorAll('#rec-path .node').forEach((li) => {
        const i = +li.dataset.node;
        const tone = i > 0 ? state.tones[i - 1] : '';
        if (tone) li.dataset.tone = tone; else li.removeAttribute('data-tone');
      });
    }

    function renderRec() {
      const sel = selectedRotation();
      const rec = $('rec');
      if (!rec) return;
      const path = $('rec-path');
      if (!sel) {
        rec.classList.add('is-loading');
        $('rec-h').textContent = state.load === 'error' ? t('rotUnavailable') : t('loadingRot');
        $('rec-conf').innerHTML = '';
        path.innerHTML = state.load === 'error' ? '' : [0, 1, 2, 3].map(() => '<li class="node-skel"><span class="skeleton" style="width:64px;height:64px;border-radius:50%"></span><span class="skeleton" style="width:56px;height:12px"></span></li>').join('');
        $('rec-verdict').innerHTML = ''; $('rec-meters').innerHTML = '';
        $('rec-nums').innerHTML = '';
        $('llm-seq-title').textContent = '';
        const dash = state.load === 'error' ? '—' : '';
        $('llm-rationale-text').innerHTML = state.load === 'error' ? '—' : '<span class="skeleton block h-3 w-full mb-1.5"></span><span class="skeleton block h-3 w-5/6"></span>';
        $('llm-soil-detail').textContent = dash; $('llm-water-detail').textContent = dash; $('llm-match-badge').textContent = '';
        return;
      }
      rec.classList.remove('is-loading');
      const idx = state.currentRanked.indexOf(sel);
      $('rec-h').textContent = sel.id === 'actual' ? t('recTitleToday') : idx === 0 ? t('recTitle1') : t('recTitleN', { n: idx + 1 });
      $('rec-conf').innerHTML = `${confDots(sel.confidence)}<span>${t('confidence')} ${t(CONF_KEY[sel.confidence] || 'confMedia')}</span>`;

      path.innerHTML = sel.sequence.map((c, i) => {
        const disc = `<span class="node-disc" style="--g:${cropColor(c)}">${cropGlyph(c)}</span><span class="node-name">${cropName(c)}</span><span class="node-tag">${i === 0 ? t('pathNow') : t('pathCamp', { n: i })}</span>`;
        const inner = i === 0 ? `<div class="node-btn" style="cursor:default">${disc}</div>`
          : `<button type="button" class="node-btn" data-camp="${i - 1}" aria-label="${t('pathAria', { n: i, crop: cropName(c) })}">${disc}</button>`;
        return `${i ? '<li class="link" aria-hidden="true"></li>' : ''}<li class="node${i === 0 ? ' node-now' : ''}" data-node="${i}" style="--i:${i}">${inner}</li>`;
      }).join('');
      applyTones();

      const v = verdictOf(sel);
      $('rec-verdict').innerHTML = v ? `<div class="verdict tone-${v.tone}">${dropIcon(v.level)}<p class="verdict-text">${v.text}</p></div>` : '';
      $('rec-meters').innerHTML = [['water', sel.adjWater, 'blockWater'], ['soil', sel.adjSoil, 'blockSoil'], ['income', sel.adjIncome, 'blockIncome']].map(([k, n, nameKey]) =>
        `<div class="meter m-${k}" role="img" aria-label="${t('meterAria', { name: t(nameKey), v: n })}">${ICON[k]}${pips(n)}<span>${t(nameKey)}</span></div>`).join('');

      const api = window.FieldShiftApi;
      $('rec-nums').innerHTML = `<p><b class="n">${t('optionBadge', { n: idx + 1, m: sel.matchPct })}</b></p>` +
        (v ? `<p>${v.detail}</p>` : '') + (api && api.waterFigure ? `<div>${api.waterFigure(sel)}</div>` : '');

      $('llm-seq-title').textContent = sel.sequence.map(cropName).join(' → ');
      $('llm-rationale-text').textContent = sel.rationale;
      const soilTitle = $('llm-soil-title');
      soilTitle.removeAttribute('data-i18n');
      soilTitle.textContent = `${t('soilImpact')} (${zoneName(state.zone)})`;
      $('llm-soil-detail').textContent = sel.soilImpact;
      $('llm-water-detail').textContent = sel.waterBalance;
      $('llm-match-badge').textContent = '';
      if (window.FieldShiftApi && FieldShiftApi.reapplyExplain) FieldShiftApi.reapplyExplain();
    }

    function copyWhatsAppSummary() {
      const sel = selectedRotation();
      if (!sel) return;
      const idx = state.currentRanked.indexOf(sel);
      const summary = [
        t('waTitle'),
        `${t('waZone')} ${zoneName(state.zone)} | ${t('waCrop')} ${cropName(state.currentCrop)}`,
        `${t('waSeq')}${idx + 1}: *${sel.sequence.map(cropName).join(' → ')}* (${t('waMatch', { m: sel.matchPct })} | ${t('confidence')} ${t(CONF_KEY[sel.confidence] || 'confMedia')})`,
        `${t('waWhy')} ${sel.rationale}`,
        `${t('waSoil')} ${sel.soilImpact}`,
        `${t('waWater')} ${sel.waterBalance}`
      ].join('\n');

      const done = () => {
        const label = $('copy-btn-label');
        label.textContent = t('copied');
        setTimeout(() => { label.textContent = t('copyBtn'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(done).catch(() => legacyCopy(summary, done));
      } else {
        legacyCopy(summary, done);
      }
    }

    function legacyCopy(text, done) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { console.error('Copy failed:', err); }
      document.body.removeChild(ta);
    }

    // =========================================================================
    // ALTERNATIVES: compact cards, compared by fills; re-ranking glides to the new order
    // =========================================================================
    function altFit(rot) {
      const f = rot.facts && rot.facts.agua_cabe;
      if (!f) return { tone: 'ok', label: '', months: '' };
      let months = '', tone, label;
      if (!f.cabe_en_el_anio) { tone = 'no'; label = t('altFitNo'); months = `<span class="months all-no">${'<i></i>'.repeat(12)}</span>`; }
      else {
        const n = Math.min(12, f.max_meses_con_deficit || 0);
        tone = n ? 'short' : 'ok'; label = n ? t('altFitShort') : t('altFitOk');
        months = `<span class="months">${Array.from({ length: 12 }, (_, i) => `<i class="${i >= 12 - n ? 's' : ''}"></i>`).join('')}</span>`;
      }
      return { tone, label, months };
    }

    function renderCards() {
      const box = $('rotations-list');
      if (!box) return;
      if (!state.currentRanked.length) {
        box.innerHTML = state.load === 'error' ? `<p class="lead">${t('rotUnavailable')}</p>`
          : `<p class="sr-only" role="status">${t('loadingRot')}</p>` + [1, 2].map(() => '<div class="alt" style="pointer-events:none"><span class="skeleton block h-4 w-3/4"></span><span class="skeleton block h-8 w-full"></span><span class="skeleton block h-3 w-1/2"></span></div>').join('');
        return;
      }
      const ranked = state.currentRanked;
      // top 3 plus the farmer's current way (id 'actual') so the current practice is always compared
      const top = ranked.slice(0, 3);
      const current = ranked.find((r) => r.id === 'actual');
      if (current && !top.includes(current)) top.push(current);

      const before = new Map();
      box.querySelectorAll('[data-key]').forEach((el) => before.set(el.dataset.key, el.getBoundingClientRect()));

      box.innerHTML = top.map((rot) => {
        const idx = ranked.indexOf(rot);
        const sel = idx === state.selectedRotationIdx;
        const fit = altFit(rot);
        const path = rot.sequence.map((c, i) => `${i ? '<span class="sep"></span>' : ''}<span class="mini${i === 0 ? ' now' : ''}" style="--g:${cropColor(c)}">${cropGlyph(c)}</span>`).join('');
        return `
        <button type="button" data-idx="${idx}" data-key="${rot.id}:${rot.sequence.join('>')}" aria-pressed="${sel}" class="alt tone-${fit.tone}">
          <span class="alt-top"><span>${rot.id === 'actual' ? t('today') : t('altOption', { n: idx + 1 })}</span>
            <span class="alt-sel">${CHECK_ICON}${t('altSelected')}</span><span style="display:inline-flex;gap:4px" class="${rot.confidence === 'ALTA' ? 'conf-high' : rot.confidence === 'MEDIA' ? 'conf-med' : 'conf-low'} conf" title="${t('confidence')} ${t(CONF_KEY[rot.confidence] || 'confMedia')}">${confDots(rot.confidence)}</span></span>
          <span class="alt-path">${path}</span>
          <span class="alt-names">${rot.sequence.map(cropName).join(' › ')}</span>
          <span class="fitbar">${fit.months}<span class="fit-label">${fit.label}</span></span>
          <span class="alt-meters">
            <span class="mi m-water">${ICON.water}${pips(rot.adjWater)}</span>
            <span class="mi m-soil">${ICON.soil}${pips(rot.adjSoil)}</span>
            <span class="mi m-income">${ICON.income}${pips(rot.adjIncome)}</span>
          </span>
        </button>`;
      }).join('');

      if (!reducedMotion() && box.animate) {
        box.querySelectorAll('[data-key]').forEach((el) => {
          const p = before.get(el.dataset.key), r = el.getBoundingClientRect();
          if (p) {
            const dx = p.left - r.left, dy = p.top - r.top;
            if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
          } else if (before.size) {
            el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'ease-out' });
          }
        });
      }
    }

    function selectRotationForInspection(idx) {
      state.selectedRotationIdx = idx;
      state.tones = [];
      renderCards(); renderPareto(); renderRec();
      if (window.FieldShiftApi) FieldShiftApi.onSelection(selectedRotation());
      // bring the recommendation into view so the click visibly leads somewhere
      $('rec').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    // =========================================================================
    // VIEW SWITCH (cards / trade-off chart; the board view is set in api.js)
    // =========================================================================
    function switchWorkspaceView(viewName) {
      state.activeView = viewName;
      const rot = viewName === 'rotations';
      $('view-rotations').hidden = !rot;
      $('view-pareto').hidden = rot;
      $('tab-rot').setAttribute('aria-pressed', String(rot));
      $('tab-par').setAttribute('aria-pressed', String(!rot));
      if (!rot) renderPareto();
    }

    // =========================================================================
    // TRADE-OFF CHART (Pareto): fixed 0-100 axes so small differences stay small
    // =========================================================================
    function renderPareto() {
      const svg = $('pareto-svg');
      const ranked = state.currentRanked;
      if (!ranked.length) { svg.innerHTML = ''; $('pareto-takeaway').textContent = ''; return; }
      const W = 400, H = 280, L = 56, R = 14, T = 14, B = 62;
      const px = (v) => L + (clamp(v, 0, 100) / 100) * (W - L - R);
      const py = (v) => H - B - (clamp(v, 0, 100) / 100) * (H - T - B);
      const points = ranked.map((rot, idx) => ({ ...rot, idx, cx: px(rot.paretoX), cy: py(rot.paretoY), r: 7 + rot.adjWater * 1.5 }));

      let axes = `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#5d6f68" stroke-width="1.5" /><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#5d6f68" stroke-width="1.5" />`;
      [0, 50, 100].forEach((v) => {
        axes += `<line x1="${L}" y1="${py(v)}" x2="${W - R}" y2="${py(v)}" stroke="#26332f" stroke-width="1" ${v ? 'stroke-dasharray="4 4"' : ''} />`
          + `<text x="${L - 8}" y="${py(v) + 4}" text-anchor="end" fill="#b6c4bd" font-size="12" font-family="JetBrains Mono">${v}</text>`
          + `<line x1="${px(v)}" y1="${T}" x2="${px(v)}" y2="${H - B}" stroke="#26332f" stroke-width="1" ${v ? 'stroke-dasharray="4 4"' : ''} />`
          + `<text x="${px(v)}" y="${H - B + 18}" text-anchor="middle" fill="#b6c4bd" font-size="12" font-family="JetBrains Mono">${v}</text>`;
      });
      axes += `<text x="${(L + W - R) / 2}" y="${H - 10}" text-anchor="middle" fill="#e6ece8" font-size="12.5" font-weight="600">${t('paretoAxisX')}</text>`
        + `<text transform="rotate(-90 13 ${(T + H - B) / 2})" x="13" y="${(T + H - B) / 2}" text-anchor="middle" fill="#e6ece8" font-size="12.5" font-weight="600">${t('paretoAxisY')}</text>`;

      const optimal = points.filter((p) => p.paretoOptimal).sort((a, b) => a.cx - b.cx);
      let curve = '';
      if (optimal.length > 1) {
        const d = optimal.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');
        curve = `<path d="${d}" fill="none" style="stroke: var(--c-soil)" stroke-width="1.8" stroke-dasharray="5 5" opacity="0.8" />`;
      }

      const node = (p) => {
        const isSel = p.idx === state.selectedRotationIdx;
        const label = p.id === 'actual' ? t('todayShort') : '#' + (p.idx + 1);
        return `<g data-idx="${p.idx}" role="button" tabindex="0" aria-pressed="${isSel}" aria-label="${t('paretoOpt', { n: p.id === 'actual' ? t('todayShort') : p.idx + 1, x: Math.round(p.paretoX), y: Math.round(p.paretoY) })}" class="cursor-pointer svg-focus">
          ${isSel ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r + 5}" fill="none" stroke="#ffffff" stroke-width="2.2" />` : ''}
          <circle class="pt" cx="${p.cx}" cy="${p.cy}" r="${p.r}" style="fill: ${p.paretoOptimal ? 'var(--c-soil)' : '#5d6f68'}" fill-opacity="0.92" stroke="#0b1311" stroke-width="2" />
          <text x="${p.cx}" y="${p.cy + 4}" text-anchor="middle" fill="${p.paretoOptimal ? '#2a1d05' : '#f3f6f4'}" font-size="12" font-weight="800" font-family="JetBrains Mono" pointer-events="none">${label}</text>
        </g>`;
      };
      svg.innerHTML = axes + curve + points.filter((p) => p.idx !== state.selectedRotationIdx).map(node).join('') + points.filter((p) => p.idx === state.selectedRotationIdx).map(node).join('');

      // One-sentence takeaway, computed from the options on screen
      const bestSoil = points.reduce((a, b) => (b.paretoY > a.paretoY ? b : a));
      const bestIncome = points.reduce((a, b) => (b.paretoX > a.paretoX ? b : a));
      const take = $('pareto-takeaway');
      if (bestSoil.idx === bestIncome.idx) {
        take.textContent = t('paretoSame', { n: bestSoil.idx + 1 });
      } else {
        take.textContent = t('paretoTake', {
          a: bestSoil.idx + 1, b: bestIncome.idx + 1, ys: Math.round(bestSoil.paretoY), xs: Math.round(bestIncome.paretoX),
          dx: Math.max(0, Math.round(bestIncome.paretoX - bestSoil.paretoX)), dy: Math.max(0, Math.round(bestSoil.paretoY - bestIncome.paretoY))
        }) + t('paretoTakeNote');
      }
    }

    // =========================================================================
    // MAP SHELL (Leaflet + Esri World Imagery). Layers on top are in api.js.
    // =========================================================================
    let parcelMap = null;
    let lastMapZone = null;
    let parcelCenter = null; // [lat, lon] the user tapped (or the zone centre)
    let baseTiles = null;    // satellite layer (its attribution follows the language)
    let parcelPolygon = null; // kept for api.js, which clears it

    function initParcelMap() {
      if (parcelMap || !window.L) return;
      const geo = ZONE_GEO[state.zone] || ZONE_GEO.majes;
      parcelCenter = geo.coords;
      // One finger must keep scrolling the page on a phone: dragging the map is a two-finger gesture there
      const touch = (window.L && L.Browser.mobile) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      parcelMap = L.map('parcel-map', { preferCanvas: true, dragging: !touch }).setView(geo.coords, 12);
      baseTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: t('mapAttribution')
      }).addTo(parcelMap);
      if (touch) {
        const hint = $('map-touch-hint');
        hint.classList.remove('hidden');
        setTimeout(() => hint.classList.add('hidden'), 6000);
      }
      // The user taps the map to place the exact point of the plot
      parcelMap.on('click', (e) => {
        parcelCenter = [e.latlng.lat, e.latlng.lng];
        $('map-invite').classList.add('gone');
        if (window.FieldShiftApi) FieldShiftApi.drawMap();
      });
      lastMapZone = state.zone;
    }

    function updateParcelMap() {
      if (!parcelMap) return;
      if (state.zone !== lastMapZone) {
        lastMapZone = state.zone;
        const geo = ZONE_GEO[state.zone] || ZONE_GEO.majes;
        parcelCenter = geo.coords;
        $('map-invite').classList.remove('gone');
        parcelMap.flyTo(geo.coords, 12, { duration: reducedMotion() ? 0 : 0.9 });
      }
      if (window.FieldShiftApi) FieldShiftApi.drawMap();
    }

    // =========================================================================
    // DIALOG: plot data (soil salinity)
    // =========================================================================
    let lastFocus = null;
    function toggleAdvancedModal(show) {
      const modal = $('advanced-modal');
      modal.classList.toggle('open', show);
      if (show) {
        lastFocus = document.activeElement;
        $('inp-salinity').value = state.climate.salinity;
        syncModalLabels();
        $('modal-close').focus();
      } else if (lastFocus && lastFocus.focus) {
        lastFocus.focus();
        lastFocus = null;
      }
    }

    document.addEventListener('keydown', (e) => {
      const modal = $('advanced-modal');
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); toggleAdvancedModal(false); return; }
      if (e.key === 'Tab') {   // keep focus inside the dialog
        const items = [...modal.querySelectorAll('button, input, [href], select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    $('advanced-modal').addEventListener('mousedown', (e) => { if (e.target === $('advanced-modal')) toggleAdvancedModal(false); });

    function syncModalLabels() {
      $('val-salinity').textContent = `${parseFloat($('inp-salinity').value).toFixed(1)} dS/m`;
    }

    function applyAdvancedAndClose() {
      state.climate.salinity = parseFloat($('inp-salinity').value);
      toggleAdvancedModal(false);
      recalculateAll();
    }

    window.addEventListener('DOMContentLoaded', () => {
      $('crop-tiles').addEventListener('click', (e) => { const b = e.target.closest('[data-crop]'); if (b) pickCrop(b.dataset.crop); });
      $('zone-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-zone]'); if (b) setZone(b.dataset.zone); });
      $('rec-path').addEventListener('click', (e) => { const b = e.target.closest('[data-camp]'); if (b && window.FieldShiftApi) FieldShiftApi.selectCampaign(+b.dataset.camp); });
      $('rotations-list').addEventListener('click', (e) => {
        const card = e.target.closest('[data-idx]');
        if (card) selectRotationForInspection(+card.dataset.idx);
      });
      const pareto = $('pareto-svg');
      pareto.addEventListener('click', (e) => { const g = e.target.closest('[data-idx]'); if (g) selectRotationForInspection(+g.dataset.idx); });
      pareto.addEventListener('keydown', (e) => {
        const g = e.target.closest('[data-idx]');
        if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectRotationForInspection(+g.dataset.idx); }
      });
      initPriorities();
      translateStatic();
      switchWorkspaceView('rotations');
      renderCards(); renderRec();   // skeletons until the model answers
      // api.js starts talking to the model on its own DOMContentLoaded handler
    });

    // =========================================================================
    // 3D HERO (optional enhancement). The illustrated SVG scene is the fallback and stays in the DOM:
    // it is replaced only after terrain3d.js has loaded AND mounted. Nothing here touches the model or its wording.
    // =========================================================================
    const terrainHero = (() => {
      let handle = null;
      const safe = (fn) => { try { if (handle) fn(handle); } catch (e) { console.warn('3D hero:', e); } };

      function wanted() {
        if (reducedMotion()) return false;
        if (window.matchMedia && window.matchMedia('(max-width: 560px)').matches) return false;
        const c = navigator.connection;
        return !(c && c.saveData);
      }

      async function start() {
        const box = $('scene3d'), hero = $('hero');
        if (!box || !hero) return;
        try {
          const mod = await import('./terrain3d.js');
          const T = window.GreenOrbitTerrain || (mod && mod.default);
          if (!T || typeof T.isSupported !== 'function' || !T.isSupported()) return;
          const h = await T.mount(box, { mode: 'hero', lang, interactive: false, showPixels: true, assetsBase: './terrain-assets/' });
          if (!h) return;
          handle = h;
          // bring the scene up to date with what the page already shows
          safe((x) => x.setDry(document.documentElement.dataset.dry === 'true'));
          safe((x) => x.setLang(lang));
          if (state.audience === 'junta') safe((x) => x.flyTo('canal', 0.1));
          hero.dataset['3d'] = 'on';   // fades the SVG out and the scrim in
          safe((x) => x.resize());
        } catch (e) {
          console.warn('3D hero unavailable, keeping the illustrated scene.', e);
        }
      }

      function init() {
        // crop picked: look at the pampa
        $('crop-tiles').addEventListener('click', (e) => { if (e.target.closest('[data-crop]')) safe((x) => x.flyTo('pampa')); });
        // dry switch (any of the three), language and audience are read from the attributes the app already sets
        const watch = (el, attr, fn) => new MutationObserver(fn).observe(el, { attributes: true, attributeFilter: [attr] });
        watch(document.documentElement, 'data-dry', () => safe((x) => x.setDry(document.documentElement.dataset.dry === 'true')));
        watch(document.documentElement, 'lang', () => safe((x) => x.setLang(lang)));
        watch(document.body, 'data-aud', () => {
          if (state.audience === 'junta') safe((x) => x.flyTo('canal'));
          else safe((x) => { x.resize(); x.flyTo('orbit'); });   // the hero was hidden while the board was open
        });
        if (!wanted()) return;
        // after first paint and once the first API calls are under way, when the browser is idle
        const go = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 3000 }) : setTimeout(start, 1200));
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(go, 800)));
      }
      return { init };
    })();
    window.addEventListener('DOMContentLoaded', terrainHero.init);
