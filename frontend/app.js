    // =========================================================================
    // 1. ESTADO Y DATOS AGRONÓMICOS DE AREQUIPA
    // =========================================================================
    const state = {
      activeView: 'rotations', // 'rotations' | 'pareto'
      selectedRotationIdx: 0,
      zone: 'majes',
      currentCrop: 'Papa',
      priorities: {
        water: 80,
        soil: 65,
        income: 45
      },
      climate: {
        t2m: 19.4,
        prec: 0.40,
        rh: 74.7,
        rad: 20.95,
        wind: 2.14,
        salinity: 2.8
      },
      currentRanked: []
    };

    const ZONE_NAMES = {
      majes: 'Majes - El Pedregal',
      chili: 'Valle de Chili',
      camana: 'Valle de Camaná',
      siguas: 'Santa Rita de Siguas',
      tambo: 'Valle de Tambo'
    };

    const ZONE_MULTIPLIERS = {
      majes: { waterStress: 1.15, soilStress: 1.10 },
      chili: { waterStress: 0.92, soilStress: 0.90 },
      camana: { waterStress: 0.80, soilStress: 1.00 },
      siguas: { waterStress: 1.10, soilStress: 1.05 },
      tambo: { waterStress: 1.00, soilStress: 1.00 }
    };

    // Coordenadas y polígono representativo de cada valle/parcela
    const ZONE_GEO = {
      majes: {
        coords: [-16.350, -72.200],
        polygon: [[-16.364, -72.224], [-16.364, -72.176], [-16.336, -72.170], [-16.336, -72.230]]
      },
      chili: {
        coords: [-16.300, -71.620],
        polygon: [[-16.314, -71.644], [-16.314, -71.596], [-16.286, -71.590], [-16.286, -71.650]]
      },
      camana: {
        coords: [-16.620, -72.710],
        polygon: [[-16.634, -72.734], [-16.634, -72.686], [-16.606, -72.680], [-16.606, -72.740]]
      },
      siguas: {
        coords: [-16.494, -72.094],
        polygon: [[-16.508, -72.118], [-16.508, -72.070], [-16.480, -72.064], [-16.480, -72.124]]
      },
      tambo: {
        coords: [-17.110, -71.770],
        polygon: [[-17.124, -71.794], [-17.124, -71.746], [-17.096, -71.740], [-17.096, -71.800]]
      }
    };

    // =========================================================================
    // 2-BIS. MAPA SATELITAL DE LA PARCELA (Leaflet + Esri World Imagery)
    // =========================================================================
    let parcelMap = null;
    let parcelPolygon = null;
    let lastMapZone = null;
    let parcelCenter = null; // centro actual del polígono (permite reubicarlo con clic)
    let baseTiles = null;    // satellite layer (its attribution follows the language)

    // Paleta Display P3 del semáforo con fallback sRGB
    const P3_OK = window.CSS && CSS.supports('color', 'color(display-p3 1 1 1)');
    const MAP_COLORS = {
      ok:   P3_OK ? 'color(display-p3 0.12 0.82 0.38)' : '#10b981',
      warn: P3_OK ? 'color(display-p3 0.88 0.54 0.10)' : '#f59e0b',
      bad:  P3_OK ? 'color(display-p3 0.90 0.20 0.22)' : '#f43f5e'
    };

    function toggleParcelMap() {
      const section = document.getElementById('parcel-map-section');
      const willShow = section.classList.contains('hidden');
      section.classList.toggle('hidden', !willShow);
      if (willShow && parcelMap) {
        setTimeout(() => parcelMap.invalidateSize(), 80);
      }
    }

    function initParcelMap() {
      const geo = ZONE_GEO[state.zone] || ZONE_GEO.majes;
      parcelCenter = geo.coords;
      parcelMap = L.map('parcel-map').setView(geo.coords, 12);
      baseTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: t('mapAttribution')
      }).addTo(parcelMap);
      // El usuario puede tocar el mapa para ubicar el punto exacto de su parcela
      parcelMap.on('click', (e) => {
        parcelCenter = [e.latlng.lat, e.latlng.lng];
        drawParcelPolygon(parcelStatusColor());
      });
      lastMapZone = state.zone;
      drawParcelPolygon(MAP_COLORS.ok);
    }

    function drawParcelPolygon(colorHex) {
      const geo = ZONE_GEO[state.zone] || ZONE_GEO.majes;
      const center = parcelCenter || geo.coords;
      // Traslada el polígono base de la zona al centro elegido por el usuario
      const pts = geo.polygon.map(([la, ln]) => [
        center[0] + (la - geo.coords[0]),
        center[1] + (ln - geo.coords[1])
      ]);
      if (parcelPolygon) parcelMap.removeLayer(parcelPolygon);
      parcelPolygon = L.polygon(pts, {
        color: colorHex, fillColor: colorHex, fillOpacity: 0.38, weight: 3
      }).addTo(parcelMap);
      document.getElementById('parcel-zone-tag').textContent = zoneName(state.zone);
    }

    function parcelStatusColor() {
      const top = state.currentRanked[0];
      if (!top) return MAP_COLORS.ok;
      if (top.matchPct >= 75) return MAP_COLORS.ok;
      if (top.matchPct >= 55) return MAP_COLORS.warn;
      return MAP_COLORS.bad;
    }

    function updateParcelMap() {
      if (!parcelMap) return;
      if (state.zone !== lastMapZone) {
        lastMapZone = state.zone;
        const geo = ZONE_GEO[state.zone] || ZONE_GEO.majes;
        parcelCenter = geo.coords;
        parcelMap.flyTo(geo.coords, 12, { duration: 0.9 });
      }
      drawParcelPolygon(parcelStatusColor());
    }

    // =========================================================================
    // 2-TER. SISTEMA DE IDIOMA (ES / EN)
    // =========================================================================
    const LANGS = {
      es: {
        appTitle: 'Field Shift | Asesor de Rotación de Cultivos - Arequipa',
        zoneLocation: 'Zona - Ubicación',
        currentCrop: 'Cultivo actual',
        mapTitle: 'MAPA DE LA PARCELA',
        mapSub: 'Cuadros de 5,4 ha del satélite MODIS (NASA). No es el borde exacto de tu parcela.',
        mapOk: '🟢 Regado', mapWarn: '🟡 Mixto', mapBad: '⚪ Desierto',
        mapHint: 'Toca tu parcela para ver qué vio el satélite',
        rotationsTitle: 'ROTACIONES RECOMENDADAS',
        paretoTitle: '¿QUÉ PIERDO SI CUIDO MÁS EL SUELO?', paretoBadge: 'Compromisos',
        paretoDesc: 'Cada punto es una rotación: más a la <strong class="text-slate-200">derecha gana más dinero</strong>, más <strong class="text-slate-200">arriba cuida más el suelo</strong>. La línea une las opciones sin desperdicio: pasar de una a otra es cambiar ingreso por suelo. Toca un punto para ver por qué.',
        axisHigh: 'Alto', axisSoil: '↑ Salud del Suelo', axisLow: 'Bajo', axisIncome: 'Mayor Ingreso →',
        paretoLegendOk: 'Sin desperdicio', paretoLegendBad: 'Hay otra mejor en suelo e ingreso', paretoAxisNote: 'Arriba: suelo · Derecha: ingreso',
        whyTitle: '¿Por qué esta rotación?', copyBtn: 'Copiar', copied: '¡Copiado!',
        railWater: 'AHORRAR AGUA', railSoil: 'SALUD SUELO', railIncome: 'INGRESO',
        tabRotations: 'Rotaciones', tabChart: 'Gráfico',
        blockWater: 'Agua', blockSoil: 'Suelo', blockIncome: 'Ingreso',
        confidence: 'Confianza', confAlta: 'ALTA', confMedia: 'MEDIA', confBaja: 'BAJA',
        seeWhy: 'Ver por qué →',
        soilImpact: 'Impacto en Suelo',
        advTooltip: 'Configuración avanzada (Variables CSV NASA POWER)',
        modalTitle: 'Datos de tu parcela',
        modalDesc: 'Por ahora el modelo usa la salinidad de tu suelo. El clima viene de NASA POWER para Majes y no se ajusta aquí.',
        modalTemp: 'Temp. Media (T2M)', modalPrec: 'Precipitación (PRECTOT)', modalRh: 'Humedad (RH2M)',
        modalRad: 'Radiación (SW_DWN)', modalWind: 'Velocidad Viento (WS2M)', modalSal: 'Salinidad de tu suelo (CE, dS/m), si la mediste',
        cancelBtn: 'Cancelar', applyBtn: 'Aplicar datos',
        waTitle: '🌱 *Field Shift Arequipa - Recomendación de Rotación*',
        waZone: '📍 Zona:', waCrop: 'Cultivo actual:', waSeq: '🔄 Secuencia #',
        waWhy: '💡 Por qué:', waSoil: '🌿 Suelo:', waWater: '💧 Agua:',
        // static texts added later (index.html)
        mapBtnTitle: 'Especificar mi parcela en el mapa', copyTitle: 'Copiar resumen para WhatsApp',
        audFarmer: 'Para el agricultor', audJunta: 'Para la Junta',
        prioHelp: 'Mueve los tres círculos según lo que te importa: ahorrar agua, cuidar el suelo o ganar más.<span class="block text-[11px] text-slate-400 mt-1">Cuenta la <b class="text-slate-300">proporción</b> entre los tres, no el número: si los tres están iguales (todos altos o todos bajos), pesan lo mismo.</span>',
        tabRot: 'Rotaciones', tabPar: '¿Qué pierdo si cuido el suelo?',
        introRot: '¿Qué sembrar después de <b id="intro-crop" class="text-white">tu cultivo</b>? Mueve las tres prioridades del círculo (ahorrar agua, cuidar el suelo, ganar más) y mira qué rotación te conviene.',
        farmWaterDefault: 'Te llegan unos 21.000 m³ por hectárea al año', farmWaterSrc: '(entrega de Pitay repartida en la pampa)',
        capNormal: 'Año normal', capDry: 'Año seco (88 %)', capDry2014: 'Año seco (88 %, como 2014)',
        plannedQ: '¿Qué piensas sembrar? <span class="text-slate-500">Marca los cultivos que de verdad puedes sembrar; si no marcas ninguno, se consideran todos.</span>',
        legendSummary: 'Cómo leer los cuadros y la confianza',
        legendP1: 'Más cuadros llenos = mejor en ese criterio: <span class="text-sky-300">Agua</span> = ahorra más agua, <span class="text-emerald-300">Suelo</span> = cuida más el suelo, <span class="text-orange-300">Ingreso</span> = gana más. <b>Confianza</b> = cuán respaldada está la recomendación por datos y fuentes.',
        legendP2: 'Los cuadros comparan cada rotación con las otras posibles; no son una nota absoluta. Casi todos los cultivos le quitan nitrógeno al suelo: solo la haba y la alfalfa lo reponen, pero la alfalfa gasta mucha agua. Por eso una rotación que gana en agua e ingreso suele sacar pocos cuadros en suelo.',
        zoneNote: 'Los datos del modelo son de Majes. Para esta zona los resultados son solo una referencia.',
        waterTitle: 'AGUA Y TOPE COLECTIVO', waterSub: 'Para la Junta de Usuarios: ¿alcanza el agua con esta mezcla de cultivos?',
        waterModel: 'Modelo GreenOrbit · Majes', waterMix: 'Mezcla de cultivos', waterArea: 'Área regada',
        waterEff: 'Qué parte del agua aprovechan las plantas', waterEt0: 'Cuánta agua piden las plantas',
        optArea1: '15.900 ha (licencia)', optArea2: '17.500 ha (satélite)',
        optEff1: '≈ 50 % (medida con satélite)', optEff2: '75 % (supuesto, sin medir)',
        optEt0Pm: 'Estimación alta (Penman-Monteith)', optEt0Hg: 'Estimación baja (Hargreaves)',
        waterArrives: 'Agua que llega', calculating: 'Calculando…',
        waterBalanceHdr: '<span>💧</span> Balance Hídrico:',
        fitTitle: '¿Cabe en tu agua? <span class="normal-case font-normal text-slate-400">mes a mes, por hectárea</span>',
        fitLegend: 'Barras: agua que pide el cultivo (naranja si pide más de lo que llega). Línea: agua que llega a cada hectárea (entrega de Pitay 2013–2025). Una campaña por año.',
        vulHigh: 'Pierde mucho (−10 % o más)', vulMid: 'Pierde algo (−3 a −10 %)', vulLow: 'Aguanta',
        vulChange: 'Cambió de uso (no se recupera)', vulShort: 'Sin riego si falta agua (barra «Agua que llega»)',
        modalSalHelp: 'Con más sal rinden menos los cultivos sensibles (cebolla, papa, haba) y ganan los tolerantes (quinua, zapallo), según la tabla FAO-29. Si no la mediste, deja 2,8: es un valor de referencia, no de tu parcela.',
        mapAttribution: 'Satélite Esri &mdash; NASA POWER',
        // dynamic texts (app.js / api.js)
        today: 'Hoy', cardTitle: 'Haz clic para ver por qué', optionBadge: 'Opción #{n} ({m}% match)',
        apiOk: 'API conectada', apiOff: 'API sin conexión · cálculo local',
        plannedSuggest: 'Con solo esos cultivos no hay rotación que respete las reglas (misma familia seguida o papa antes de 3 años). Abajo: qué agregar para poder rotar, y tu forma actual para comparar.',
        plannedList: 'Rotaciones armadas solo con tus cultivos. La última es tu forma actual, para comparar.',
        farmWater: 'Te llegan unos {n} m³ por hectárea al año', farmWaterCap: ' ({pct} % del agua normal)',
        fitNo: 'No cabe en tu agua: {crops} pide más de {n} m³/ha', fitShort: 'Cabe en el año; en {n} meses pide más de lo que llega',
        fitOk: 'Cabe en tu agua todos los meses',
        modelDown: 'El servicio del modelo no responde. Inicia el backend:\n        <span class="font-mono-tech">uvicorn app.main:app --port 8765</span> (carpeta <span class="font-mono-tech">backend</span>).',
        capLabelNormal: 'Agua de un año normal', capLabelPct: '{pct} % del agua normal', calcFail: 'No se pudo calcular: {msg}',
        shortage: 'Faltan {m} millones de m³: con esta mezcla alcanza para unas <b>{ok} ha</b>, o sea <b>{short} ha quedarían sin riego</b> si no se cambia nada. En el mapa, en rojo, las zonas que más sufrieron en los años secos: serían las primeras en notarlo.',
        toneOk: 'Alcanza el agua', toneTight: 'Alcanza con poco margen', toneBad: 'No alcanza',
        usePct: 'Usa <b>{pct} %</b> del agua disponible', useAria: 'La demanda usa {pct} por ciento del agua disponible',
        demandLine: 'Las plantas piden {d} millones de m³ y llegan {c} millones de m³ ({sign} {b}). La línea blanca marca el 100 % del agua disponible.',
        surplus: 'sobran', deficit: 'faltan', noData: 's/d', assumptionsTitle: 'Qué es supuesto',
        monthInitials: 'E F M A M J J A S O N D', sownIn: 'siembra en {m}',
        fitAria: '{crop}: {n} meses piden más agua de la que llega',
        fitYearShort: 'Cabe en el año; falta en {n} meses', fitAll: 'Cabe todos los meses', fitNoYear: 'No cabe en el año',
        fitSummaryTail: ' Te llegan unos {n} m³/ha al año.', offlineCalc: 'No se pudo calcular (servicio sin conexión).',
        writing: 'Redactando…', srcAi: 'Texto redactado con IA ({r}). Las cifras son del modelo.', srcModel: 'Texto generado por el modelo ({r}).',
        pixelHint: 'Los puntos verdes son las zonas regadas que ve el satélite. <b class="text-white">Toca tu parcela</b> para ver su verdor, el agua que usa y cómo le fue en los años secos.',
        pixelInfo: '<b class="text-white">Cuadro de {ha} ha: {tipo}.</b> Verdor medio (NDVI) 2013–2024: <b>{ndvi}</b> (desierto ≈ 0,1; cultivo vigoroso ≥ 0,5)',
        pixelEt: ' · Agua que usan las plantas y el suelo (ET): <b>{et} mm al año</b>',
        pixelDry: '<br>En años con menos agua, el verdor de este lugar cambió: {dry}.',
        pixelAdj: '<br><b class="text-emerald-300">Las rotaciones se ajustaron a este punto</b> (mira «Ajustado a tu parcela» en el porqué).',
        pixelSrc: '<br><span class="text-slate-500 text-[10px]">{src}. El cuadro es más grande que muchas parcelas: describe el entorno de la tuya.</span>',
        satOffline: 'No se pudo consultar el satélite (servicio sin conexión).',
        vulChangeTip: 'Bajó para siempre: {c} % de verdor entre 2013-2015 y 2022-2024 (¿ciudad o abandono?)',
        vulTip: 'En años con menos agua este cuadro cambió {c} % de verdor',
        vulSummary: '<b class="text-white">¿Dónde golpea más un año con menos agua?</b> Comparando cada cuadro consigo mismo en 2014, 2016 y 2023: ' +
          '<b class="text-orange-300">{alta} ha pierden mucho</b> verdor y se recuperan después, {media} ha pierden algo y {baja} ha aguantan. ' +
          'En gris, {cambio} ha que bajaron para siempre (ciudad que crece o chacras abandonadas): no se cuentan como sequía. ' +
          'Las más sensibles están sobre todo al <b>{sector}</b> de la pampa. ' +
          'Hectáreas con 15 % o más de caída: 2014 {y14} ha · 2016 {y16} ha · 2023 {y23} ha.' +
          '<br><span class="text-slate-400">Si en 2027 llega menos agua, estas zonas son las primeras a vigilar o priorizar en los turnos.</span>' +
          '<br><span class="text-slate-500 text-[10px]">{src} El verdor también cae por plagas o cambios de cultivo: es una señal, no una prueba.</span>'
      },
      en: {
        appTitle: 'Field Shift | Crop Rotation Advisor - Arequipa',
        zoneLocation: 'Zone - Location',
        currentCrop: 'Current crop',
        mapTitle: 'PARCEL MAP',
        mapSub: '5.4 ha squares from the MODIS satellite (NASA). Not the exact edge of your plot.',
        mapOk: '🟢 Irrigated', mapWarn: '🟡 Mixed', mapBad: '⚪ Desert',
        mapHint: 'Tap your plot to see what the satellite saw',
        rotationsTitle: 'RECOMMENDED ROTATIONS',
        paretoTitle: 'WHAT DO I GIVE UP TO PROTECT THE SOIL?', paretoBadge: 'Trade-offs',
        paretoDesc: 'Each point is a rotation: further <strong class="text-slate-200">right earns more</strong>, higher <strong class="text-slate-200">protects the soil more</strong>. The line joins the options with no waste: moving along it trades income for soil. Tap a point to see why.',
        axisHigh: 'High', axisSoil: '↑ Soil Health', axisLow: 'Low', axisIncome: 'Higher Income →',
        paretoLegendOk: 'No waste', paretoLegendBad: 'Another option is better on soil and income', paretoAxisNote: 'Up: soil · Right: income',
        whyTitle: 'Why this rotation?', copyBtn: 'Copy', copied: 'Copied!',
        railWater: 'WATER SAVING', railSoil: 'SOIL HEALTH', railIncome: 'INCOME',
        tabRotations: 'Rotations', tabChart: 'Chart',
        blockWater: 'Water', blockSoil: 'Soil', blockIncome: 'Income',
        confidence: 'Confidence', confAlta: 'HIGH', confMedia: 'MEDIUM', confBaja: 'LOW',
        seeWhy: 'Why →',
        soilImpact: 'Soil Impact',
        advTooltip: 'Advanced settings (NASA POWER CSV variables)',
        modalTitle: 'Your plot data',
        modalDesc: 'For now the model uses your soil salinity. Climate comes from NASA POWER for Majes and is not adjusted here.',
        modalTemp: 'Avg Temp (T2M)', modalPrec: 'Precipitation (PRECTOT)', modalRh: 'Humidity (RH2M)',
        modalRad: 'Radiation (SW_DWN)', modalWind: 'Wind Speed (WS2M)', modalSal: 'Your soil salinity (EC, dS/m), if measured',
        cancelBtn: 'Cancel', applyBtn: 'Apply data',
        waTitle: '🌱 *Field Shift Arequipa - Rotation Recommendation*',
        waZone: '📍 Zone:', waCrop: 'Current crop:', waSeq: '🔄 Sequence #',
        waWhy: '💡 Why:', waSoil: '🌿 Soil:', waWater: '💧 Water:',
        mapBtnTitle: 'Mark my plot on the map', copyTitle: 'Copy summary for WhatsApp',
        audFarmer: 'For the farmer', audJunta: 'For the Water Board',
        prioHelp: 'Move the three circles to match what matters to you: saving water, protecting the soil or earning more.<span class="block text-[11px] text-slate-400 mt-1">What counts is the <b class="text-slate-300">proportion</b> between the three, not the number: if all three are equal (all high or all low), they weigh the same.</span>',
        tabRot: 'Rotations', tabPar: 'What do I give up to protect the soil?',
        introRot: 'What to sow after <b id="intro-crop" class="text-white">your crop</b>? Move the three priorities on the circle (save water, protect the soil, earn more) and see which rotation suits you.',
        farmWaterDefault: 'You get about 21,000 m³ per hectare a year', farmWaterSrc: '(Pitay delivery spread over the pampa)',
        capNormal: 'Normal year', capDry: 'Dry year (88 %)', capDry2014: 'Dry year (88 %, like 2014)',
        plannedQ: 'What do you plan to sow? <span class="text-slate-500">Mark the crops you can really sow; if you mark none, all are considered.</span>',
        legendSummary: 'How to read the squares and the confidence',
        legendP1: 'More filled squares = better on that criterion: <span class="text-sky-300">Water</span> = saves more water, <span class="text-emerald-300">Soil</span> = protects the soil more, <span class="text-orange-300">Income</span> = earns more. <b>Confidence</b> = how well the recommendation is backed by data and sources.',
        legendP2: 'The squares compare each rotation with the other possible ones; they are not an absolute grade. Almost every crop takes nitrogen from the soil: only fava bean and alfalfa put it back, but alfalfa uses a lot of water. That is why a rotation that wins on water and income usually gets few squares on soil.',
        zoneNote: 'The model data is from Majes. For this zone the results are only a reference.',
        waterTitle: 'WATER AND COLLECTIVE CAP', waterSub: 'For the Water Users Board: is there enough water for this crop mix?',
        waterModel: 'GreenOrbit model · Majes', waterMix: 'Crop mix', waterArea: 'Irrigated area',
        waterEff: 'How much of the water the plants use', waterEt0: 'How much water the plants ask for',
        optArea1: '15,900 ha (license)', optArea2: '17,500 ha (satellite)',
        optEff1: '≈ 50 % (measured by satellite)', optEff2: '75 % (assumption, not measured)',
        optEt0Pm: 'High estimate (Penman-Monteith)', optEt0Hg: 'Low estimate (Hargreaves)',
        waterArrives: 'Water that arrives', calculating: 'Calculating…',
        waterBalanceHdr: '<span>💧</span> Water Balance:',
        fitTitle: 'Does it fit your water? <span class="normal-case font-normal text-slate-400">month by month, per hectare</span>',
        fitLegend: 'Bars: water the crop asks for (orange if it asks for more than arrives). Line: water that reaches each hectare (Pitay delivery 2013–2025). One campaign per year.',
        vulHigh: 'Loses a lot (−10 % or more)', vulMid: 'Loses some (−3 to −10 %)', vulLow: 'Holds up',
        vulChange: 'Changed use (does not recover)', vulShort: 'No irrigation if water runs short («Water that arrives» bar)',
        modalSalHelp: 'With more salt, sensitive crops (onion, potato, fava bean) yield less and tolerant ones (quinoa, squash) gain, according to the FAO-29 table. If you did not measure it, leave 2.8: it is a reference value, not your plot\'s.',
        mapAttribution: 'Esri satellite &mdash; NASA POWER',
        today: 'Today', cardTitle: 'Click to see why', optionBadge: 'Option #{n} ({m}% match)',
        apiOk: 'API connected', apiOff: 'API offline · local calculation',
        plannedSuggest: 'With only those crops no rotation follows the rules (same family in a row, or potato again within 3 years). Below: what to add to be able to rotate, and your current way for comparison.',
        plannedList: 'Rotations built only with your crops. The last one is your current way, for comparison.',
        farmWater: 'You get about {n} m³ per hectare a year', farmWaterCap: ' ({pct} % of the normal water)',
        fitNo: 'Does not fit your water: {crops} needs more than {n} m³/ha', fitShort: 'Fits over the year; in {n} months it needs more than arrives',
        fitOk: 'Fits your water every month',
        modelDown: 'The model service is not answering. Start the backend:\n        <span class="font-mono-tech">uvicorn app.main:app --port 8765</span> (folder <span class="font-mono-tech">backend</span>).',
        capLabelNormal: 'Water of a normal year', capLabelPct: '{pct} % of the normal water', calcFail: 'Could not calculate: {msg}',
        shortage: '{m} million m³ are missing: with this mix there is water for about <b>{ok} ha</b>, so <b>{short} ha would be left without irrigation</b> if nothing changes. On the map, in red, the areas that suffered most in the dry years: they would be the first to notice.',
        toneOk: 'There is enough water', toneTight: 'Enough, with a thin margin', toneBad: 'Not enough',
        usePct: 'Uses <b>{pct} %</b> of the available water', useAria: 'Demand uses {pct} percent of the available water',
        demandLine: 'The plants ask for {d} million m³ and {c} million m³ arrive ({sign} {b}). The white line marks 100 % of the available water.',
        surplus: 'surplus', deficit: 'shortfall', noData: 'n/a', assumptionsTitle: 'What is assumed',
        monthInitials: 'J F M A M J J A S O N D', sownIn: 'sown in {m}',
        fitAria: '{crop}: {n} months ask for more water than arrives',
        fitYearShort: 'Fits over the year; short in {n} months', fitAll: 'Fits every month', fitNoYear: 'Does not fit the year',
        fitSummaryTail: ' You get about {n} m³/ha a year.', offlineCalc: 'Could not calculate (service offline).',
        writing: 'Writing…', srcAi: 'Text written with AI ({r}). The figures come from the model.', srcModel: 'Text generated by the model ({r}).',
        pixelHint: 'The green dots are the irrigated areas the satellite sees. <b class="text-white">Tap your plot</b> to see its greenness, the water it uses and how it did in the dry years.',
        pixelInfo: '<b class="text-white">{ha} ha square: {tipo}.</b> Mean greenness (NDVI) 2013–2024: <b>{ndvi}</b> (desert ≈ 0.1; vigorous crop ≥ 0.5)',
        pixelEt: ' · Water used by plants and soil (ET): <b>{et} mm a year</b>',
        pixelDry: '<br>In years with less water, the greenness of this place changed: {dry}.',
        pixelAdj: '<br><b class="text-emerald-300">The rotations were adjusted to this point</b> (see «Adjusted to your plot» in the why).',
        pixelSrc: '<br><span class="text-slate-500 text-[10px]">{src}. The square is larger than many plots: it describes the surroundings of yours.</span>',
        satOffline: 'Could not query the satellite (service offline).',
        vulChangeTip: 'Dropped for good: {c} % of greenness between 2013-2015 and 2022-2024 (city or abandonment?)',
        vulTip: 'In years with less water this square changed {c} % of greenness',
        vulSummary: '<b class="text-white">Where does a year with less water hit hardest?</b> Comparing each square with itself in 2014, 2016 and 2023: ' +
          '<b class="text-orange-300">{alta} ha lose a lot</b> of greenness and recover afterwards, {media} ha lose some and {baja} ha hold up. ' +
          'In grey, {cambio} ha that dropped for good (growing city or abandoned fields): they are not counted as drought. ' +
          'The most sensitive ones are mostly in the <b>{sector}</b> of the pampa. ' +
          'Hectares with a drop of 15 % or more: 2014 {y14} ha · 2016 {y16} ha · 2023 {y23} ha.' +
          '<br><span class="text-slate-400">If less water arrives in 2027, these areas are the first to watch or prioritise in the irrigation turns.</span>' +
          '<br><span class="text-slate-500 text-[10px]">{src} Greenness also drops because of pests or crop changes: it is a signal, not a proof.</span>'
      }
    };

    // Display names in English; the Spanish names stay the identifiers sent to and received from the API
    const CROP_EN = { Papa: 'Potato', Cebolla: 'Onion', Ajo: 'Garlic', Quinua: 'Quinoa', Zapallo: 'Squash', Haba: 'Fava bean',
                      'Maíz': 'Maize', Alfalfa: 'Alfalfa', Paprika: 'Paprika', Vid: 'Grapevine', Trigo: 'Wheat' };
    const ZONE_EN = { tambo: 'Tambo Valley', chili: 'Chili Valley', camana: 'Camaná Valley' };
    const MONTH_EN = { ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', set: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec' };
    const KIND_EN = { 'regado': 'irrigated', 'mixto (parte regada)': 'mixed (partly irrigated)', 'desierto o sin riego': 'desert or not irrigated', 'sin dato': 'no data' };
    const MIX_EN = { 'Actual (Autodema 2016)': 'Current (Autodema 2016)', 'Menos alfalfa (ilustrativo)': 'Less alfalfa (illustrative)',
                     'Diversificada (ilustrativo)': 'Diversified (illustrative)' };
    const inEn = (map, v) => (lang === 'en' && map[v]) || v;
    const cropName = (c) => inEn(CROP_EN, c);
    const zoneName = (z) => (lang === 'en' && ZONE_EN[z]) || ZONE_NAMES[z] || 'Majes - El Pedregal';
    const monthName = (m) => inEn(MONTH_EN, m);
    const kindName = (k) => inEn(KIND_EN, k);
    const mixName = (m) => inEn(MIX_EN, m);

    let lang = 'es';
    // t('key') or t('key', { n: 3 }): fills {n} placeholders
    function t(key, vars) {
      const s = (LANGS[lang] && LANGS[lang][key]) || LANGS.es[key] || key;
      return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
    }

    function toggleLang() {
      lang = lang === 'es' ? 'en' : 'es';
      document.getElementById('lang-toggle').textContent = lang === 'es' ? 'EN' : 'ES';
      applyLang();
    }

    function applyLang() {
      document.documentElement.lang = lang;
      document.title = t('appTitle');
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.dataset.i18nHtml);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
      });
      // option values stay the Spanish identifiers; only the visible text changes
      document.querySelectorAll('#select-cultivo option').forEach(o => { o.textContent = cropName(o.value); });
      document.querySelectorAll('#select-zona option').forEach(o => { o.textContent = zoneName(o.value); });
      if (parcelMap && baseTiles) {
        parcelMap.attributionControl.removeAttribution(baseTiles.getAttribution());
        baseTiles.options.attribution = t('mapAttribution');
        parcelMap.attributionControl.addAttribution(baseTiles.getAttribution());
      }
      // api.js re-renders what it built (status, water panel, chart, map texts); recalculateAll re-asks the ranking
      if (window.FieldShiftApi && FieldShiftApi.onLang) FieldShiftApi.onLang();
      recalculateAll();
    }

    const CONF_KEY = { ALTA: 'confAlta', MEDIA: 'confMedia', BAJA: 'confBaja' };

    const ROTATIONS_DB = {
      Papa: [
        {
          id: 'papa-1',
          sequence: ['Papa', 'Haba', 'Maíz', 'Alfalfa'],
          water: 5, soil: 5, income: 3,
          paretoX: 58, paretoY: 86, paretoOptimal: true,
          confidence: 'ALTA',
          rationale: 'La inclusión de Haba (leguminosa) inmediatamente después de la Papa repone el nitrógeno extraído sin fertilización sintética excesiva. Cerrar con Alfalfa mejora la infiltración de agua y reduce la salinidad superficial en suelos áridos.',
          soilImpact: '+18% Materia Orgánica proyectada a 4 años; corta ciclo de nematodos de la papa.',
          waterBalance: 'Ahorro de ~2,400 m³/ha frente a rotaciones intensivas de hortalizas.'
        },
        {
          id: 'papa-2',
          sequence: ['Papa', 'Maíz', 'Haba', 'Cebolla'],
          water: 3, soil: 4, income: 4,
          paretoX: 74, paretoY: 69, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'El Maíz aprovecha el nitrógeno residual tras la cosecha de Papa y estructura el perfil radicular antes de introducir Haba. La Cebolla al cierre maximiza el margen comercial aprovechando la mejora biológica previa.',
          soilImpact: '+11% estabilidad de agregados; balance neutro de nitrógeno con aporte de leguminosa en año 3.',
          waterBalance: 'Consumo moderado (+650 m³/ha en campaña final por demanda hídrica de cebolla).'
        },
        {
          id: 'papa-3',
          sequence: ['Papa', 'Haba', 'Cebolla', 'Maíz'],
          water: 4, soil: 4, income: 5,
          paretoX: 88, paretoY: 64, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Fijación biológica temprana con Haba en el segundo año para sostener la rentabilidad de la Cebolla en el tercero, cerrando con Maíz forrajero o grano para capturar nutrientes remanentes.',
          soilImpact: '+9% carbono lábil; requiere monitoreo de conductividad eléctrica antes de cebolla.',
          waterBalance: 'Ahorro de ~1,150 m³/ha respecto al monocultivo continuo de hortalizas.'
        },
        {
          id: 'papa-4',
          sequence: ['Papa', 'Papa', 'Maíz', 'Maíz'],
          water: 2, soil: 1, income: 5,
          paretoX: 78, paretoY: 18, paretoOptimal: false,
          confidence: 'BAJA',
          rationale: 'Secuencia extractiva de alto riesgo agronómico: repetir Papa dos campañas seguidas multiplica inóculos de Globodera (nematodo quiste) y agota el nitrógeno disponible sin descanso ni cobertura.',
          soilImpact: '-22% materia orgánica y compactación subsuperficial; alta probabilidad de caída de rendimiento en año 2.',
          waterBalance: 'Ineficiencia hídrica por baja retención de humedad en suelo degradado.'
        }
      ],
      Maíz: [
        {
          id: 'maiz-1',
          sequence: ['Maíz', 'Haba', 'Papa', 'Alfalfa'],
          water: 4, soil: 5, income: 4,
          paretoX: 64, paretoY: 85, paretoOptimal: true,
          confidence: 'ALTA',
          rationale: 'Después del alto consumo de nitrógeno del Maíz, la Haba fija entre 80 y 110 kg N/ha preparando el terreno para la Papa. La Alfalfa final regenera la porosidad y controla sales.',
          soilImpact: '+17% retención de humedad y fijación simbiótica de nitrógeno validada en valles costeros.',
          waterBalance: 'Ahorro de ~1,950 m³/ha optimizando láminas de riego por goteo.'
        },
        {
          id: 'maiz-2',
          sequence: ['Maíz', 'Cebolla', 'Haba', 'Trigo'],
          water: 4, soil: 4, income: 4,
          paretoX: 78, paretoY: 71, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Alternancia de raíces fasciculadas (Maíz y Trigo) con bulbo (Cebolla) y pivotante (Haba) que evita la formación de pie de arado y diversifica los ingresos anuales.',
          soilImpact: '+12% cobertura de rastrojo con Trigo en año 4; reduce erosión eólica.',
          waterBalance: 'Ahorro de ~1,600 m³/ha gracias al bajo requerimiento hídrico del Trigo.'
        },
        {
          id: 'maiz-3',
          sequence: ['Maíz', 'Haba', 'Cebolla', 'Papa'],
          water: 3, soil: 3, income: 5,
          paretoX: 90, paretoY: 58, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Esquema orientado a flujo de caja con dos cultivos comerciales de alta demanda regional sostenidos por la fijación nitrogenada de Haba en el segundo año.',
          soilImpact: '+6% materia orgánica; exige incorporación de compost antes de la Papa.',
          waterBalance: 'Demanda hídrica media-alta en años 3 y 4.'
        },
        {
          id: 'maiz-4',
          sequence: ['Maíz', 'Maíz', 'Papa', 'Cebolla'],
          water: 2, soil: 2, income: 5,
          paretoX: 81, paretoY: 22, paretoOptimal: false,
          confidence: 'BAJA',
          rationale: 'Alta extracción de macro y micronutrientes sin leguminosas ni descanso. Incrementa la dependencia de urea sintética y eleva la salinización en zonas de riego restringido.',
          soilImpact: '-16% actividad microbiana y pérdida de estructura granular.',
          waterBalance: 'Déficit hídrico severo en campañas de estiaje.'
        }
      ],
      Cebolla: [
        {
          id: 'ceb-1',
          sequence: ['Cebolla', 'Haba', 'Maíz', 'Alfalfa'],
          water: 5, soil: 5, income: 3,
          paretoX: 56, paretoY: 88, paretoOptimal: true,
          confidence: 'ALTA',
          rationale: 'La Cebolla deja raíces superficiales y alta sensibilidad a salinidad; rotar con Haba y cerrar con Alfalfa lava sales del bulbo húmedo y recupera la fertilidad biológica.',
          soilImpact: '+20% infiltración y reducción de conductividad eléctrica superficial.',
          waterBalance: 'Ahorro de ~2,600 m³/ha frente a sucesión continua de hortalizas.'
        },
        {
          id: 'ceb-2',
          sequence: ['Cebolla', 'Papa', 'Haba', 'Maíz'],
          water: 3, soil: 4, income: 5,
          paretoX: 85, paretoY: 66, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Aprovecha la preparación fina de suelo tras Cebolla para establecer Papa, incorporando Haba en el tercer año para restaurar el balance de nitrógeno antes del Maíz.',
          soilImpact: '+10% equilibrio NPK; rompe ciclo de fusarium basal de la cebolla.',
          waterBalance: 'Consumo equilibrado con pico moderado en año 2.'
        },
        {
          id: 'ceb-3',
          sequence: ['Cebolla', 'Cebolla', 'Papa', 'Maíz'],
          water: 1, soil: 1, income: 5,
          paretoX: 76, paretoY: 16, paretoOptimal: false,
          confidence: 'BAJA',
          rationale: 'Repetir Cebolla dispara la incidencia de raíz rosada y trips, reduciendo el calibre comercial y exigiendo riegos frecuentes que agravan la salinidad.',
          soilImpact: '-24% salud biológica del suelo y acumulación de sales solubles.',
          waterBalance: 'Sobreconsumo hídrico (+3,100 m³/ha) por lavados forzados.'
        }
      ],
      Haba: [
        {
          id: 'haba-1',
          sequence: ['Haba', 'Papa', 'Maíz', 'Alfalfa'],
          water: 5, soil: 5, income: 4,
          paretoX: 68, paretoY: 87, paretoOptimal: true,
          confidence: 'ALTA',
          rationale: 'Secuencia modelo INIA: el nitrógeno fijado por la Haba impulsa directamente el rendimiento de la Papa en el año 2, seguido de Maíz y Alfalfa regenerativa.',
          soilImpact: '+19% nitrógeno disponible orgánico y mejora sostenida de carbono del suelo.',
          waterBalance: 'Ahorro de ~2,200 m³/ha con alta eficiencia por kilogramo producido.'
        },
        {
          id: 'haba-2',
          sequence: ['Haba', 'Cebolla', 'Maíz', 'Trigo'],
          water: 4, soil: 4, income: 5,
          paretoX: 86, paretoY: 70, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Capitaliza el aporte nitrogenado inicial de la Haba en un cultivo de alto valor como la Cebolla, estabilizando el perfil con gramíneas (Maíz y Trigo).',
          soilImpact: '+13% cobertura vegetal y menor compactación superficial.',
          waterBalance: 'Ahorro de ~1,750 m³/ha en el ciclo completo de 4 años.'
        },
        {
          id: 'haba-3',
          sequence: ['Haba', 'Haba', 'Papa', 'Papa'],
          water: 2, soil: 2, income: 3,
          paretoX: 54, paretoY: 24, paretoOptimal: false,
          confidence: 'BAJA',
          rationale: 'Repetir bloques de dos años del mismo cultivo favorece enfermedades fúngicas de raíz y reduce la eficiencia de fijación biológica en la segunda campaña de leguminosa.',
          soilImpact: '-12% diversidad microbiana por baja variedad de exudados radiculares.',
          waterBalance: 'Uso subóptimo del agua en años 3 y 4.'
        }
      ],
      Alfalfa: [
        {
          id: 'alf-1',
          sequence: ['Alfalfa', 'Papa', 'Maíz', 'Haba'],
          water: 4, soil: 5, income: 4,
          paretoX: 70, paretoY: 89, paretoOptimal: true,
          confidence: 'ALTA',
          rationale: 'Al roturar Alfalfa se libera una reserva extraordinaria de materia orgánica y nitrógeno que maximiza el rendimiento de Papa y Maíz sin degradar el suelo.',
          soilImpact: '+22% materia orgánica acumulada y descompactación profunda por raíz pivotante.',
          waterBalance: 'Ahorro de ~2,050 m³/ha al sustituir alfalfa permanente por cultivos anuales.'
        },
        {
          id: 'alf-2',
          sequence: ['Alfalfa', 'Cebolla', 'Maíz', 'Haba'],
          water: 4, soil: 4, income: 5,
          paretoX: 88, paretoY: 73, paretoOptimal: true,
          confidence: 'MEDIA',
          rationale: 'Aprovecha la baja salinidad y alta porosidad dejada por la Alfalfa para obtener cebolla de exportación en el segundo año, cerrando con Haba.',
          soilImpact: '+15% estabilidad estructural y excelente drenaje interno.',
          waterBalance: 'Ahorro de ~1,850 m³/ha frente al mantenimiento de alfalfa de corte.'
        },
        {
          id: 'alf-3',
          sequence: ['Alfalfa', 'Alfalfa', 'Alfalfa', 'Alfalfa'],
          water: 1, soil: 3, income: 3,
          paretoX: 48, paretoY: 38, paretoOptimal: false,
          confidence: 'BAJA',
          rationale: 'Mantener Alfalfa continua en zonas áridas como Majes consume hasta 18,000 m³/ha/año y eleva el nivel freático, agravando la salinización en parcelas bajas.',
          soilImpact: 'Buena cobertura, pero alto riesgo de ascenso capilar de sales.',
          waterBalance: 'Consumo hídrico crítico; penalizado bajo escenarios de escasez en Condoroma.'
        }
      ]
    };

    // =========================================================================
    // 2. CAMBIO DE VISTA DESDE LOS BOTONES CURVOS DE LA RANURA EN 'C'
    // =========================================================================
    function switchWorkspaceView(viewName) {
      state.activeView = viewName;

      const rotView = document.getElementById('view-rotations');
      const paretoView = document.getElementById('view-pareto');

      const rotPath = document.getElementById('c-tab-rotations-path');
      const rotLabel = document.getElementById('c-tab-rotations-label');
      const paretoPath = document.getElementById('c-tab-pareto-path');
      const paretoLabel = document.getElementById('c-tab-pareto-label');

      if (viewName === 'rotations') {
        rotView.classList.remove('hidden');
        paretoView.classList.add('hidden');
        paretoView.classList.remove('flex');

        rotPath.style.fill = 'var(--p3-soil)';
        rotPath.setAttribute('stroke', '#ffffff');
        rotLabel.setAttribute('fill', '#052e16');

        paretoPath.style.fill = '#191f2a';
        paretoPath.setAttribute('stroke', '#475569');
        paretoLabel.setAttribute('fill', '#cbd5e1');
      } else {
        rotView.classList.add('hidden');
        paretoView.classList.remove('hidden');
        paretoView.classList.add('flex');

        paretoPath.style.fill = 'var(--p3-llm-accent)';
        paretoPath.setAttribute('stroke', '#ffffff');
        paretoLabel.setAttribute('fill', '#090d16');

        rotPath.style.fill = '#191f2a';
        rotPath.setAttribute('stroke', '#475569');
        rotLabel.setAttribute('fill', '#cbd5e1');

        renderParetoAndLLM();
      }
    }

    function selectRotationForInspection(idx, switchToPareto = false) {
      state.selectedRotationIdx = idx;
      if (switchToPareto) {
        switchWorkspaceView('pareto');
      } else {
        renderParetoAndLLM();
      }
    }

    // =========================================================================
    // 3. GEOMETRÍA Y DRAG DE LOS 3 SLIDERS EN LA RANURA EN FORMA DE 'C'
    // =========================================================================
    // 2. GEOMETRÍA Y DRAG DE LOS 3 SLIDERS EN LA RANURA EN FORMA DE 'C'
    // =========================================================================
    const ARC_CX = 195;
    const ARC_CY = 250;
    const ARC_R = 176;

    const SLIDERS = {
      water: { startDeg: -102, endDeg: -42, trackId: 'track-water', fillId: 'fill-water', handleId: 'handle-water', labelId: 'label-val-water' },
      soil: { startDeg: -24, endDeg: 24, trackId: 'track-soil', fillId: 'fill-soil', handleId: 'handle-soil', labelId: 'label-val-soil' },
      income: { startDeg: 42, endDeg: 102, trackId: 'track-income', fillId: 'fill-income', handleId: 'handle-income', labelId: 'label-val-income' }
    };

    let activeDragKey = null;

    function polarToCartesian(cx, cy, r, angleDeg) {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad)
      };
    }

    function describeArc(cx, cy, r, startAngle, endAngle) {
      const start = polarToCartesian(cx, cy, r, startAngle);
      const end = polarToCartesian(cx, cy, r, endAngle);
      const largeArc = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
      const sweep = endAngle >= startAngle ? '1' : '0';
      return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    }

    function renderHorseshoe() {
      Object.entries(SLIDERS).forEach(([key, cfg]) => {
        const val = state.priorities[key];
        const ratio = val / 100;
        const deg = cfg.startDeg + ratio * (cfg.endDeg - cfg.startDeg);

        document.getElementById(cfg.trackId).setAttribute('d', describeArc(ARC_CX, ARC_CY, ARC_R, cfg.startDeg, cfg.endDeg));
        const safeDeg = Math.abs(deg - cfg.startDeg) < 0.5 ? cfg.startDeg + 0.5 : deg;
        document.getElementById(cfg.fillId).setAttribute('d', describeArc(ARC_CX, ARC_CY, ARC_R, cfg.startDeg, safeDeg));

        const pos = polarToCartesian(ARC_CX, ARC_CY, ARC_R, deg);
        document.getElementById(cfg.handleId).setAttribute('transform', `translate(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
        document.getElementById(cfg.labelId).textContent = `${Math.round(val)}%`;
      });
    }

    function initHorseshoeDrag() {
      const svg = document.getElementById('horseshoe-svg');

      Object.keys(SLIDERS).forEach(key => {
        const handle = document.getElementById(SLIDERS[key].handleId);
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          activeDragKey = key;
          handle.setPointerCapture(e.pointerId);
        });
      });

      svg.addEventListener('pointermove', (e) => {
        if (!activeDragKey) return;
        const rect = svg.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (470 / rect.width);
        const mouseY = (e.clientY - rect.top) * (500 / rect.height);

        const deg = (Math.atan2(mouseY - ARC_CY, mouseX - ARC_CX) * 180) / Math.PI;
        const cfg = SLIDERS[activeDragKey];
        const clamped = Math.max(cfg.startDeg, Math.min(cfg.endDeg, deg));

        state.priorities[activeDragKey] = Math.round(((clamped - cfg.startDeg) / (cfg.endDeg - cfg.startDeg)) * 100);
        renderHorseshoe();
        recalculateAll();
      });

      window.addEventListener('pointerup', () => {
        activeDragKey = null;
      });
    }

    // =========================================================================
    // 3. RECÁLCULO Y RENDERIZADO DE ROTACIONES RECOMENDADAS
    // =========================================================================
    function renderBlocks(filledCount, p3Class) {
      let html = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= filledCount) {
          html += `<span class="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-[4px] ${p3Class}"></span>`;
        } else {
          html += `<span class="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-[4px] bg-slate-800/90 border border-slate-700/80"></span>`;
        }
      }
      return html;
    }

    function getBadgeClass(conf) {
      if (conf === 'ALTA') return 'badge-conf-high';
      if (conf === 'MEDIA') return 'badge-conf-med';
      return 'badge-conf-low';
    }

    function recalculateAll(apiRanked) {
      state.zone = document.getElementById('select-zona').value;
      state.currentCrop = document.getElementById('select-cultivo').value;

      // With the backend connected, never paint the local table first: wait for the model's ranking (api.js).
      if (!Array.isArray(apiRanked) && window.FieldShiftApi && window.FieldShiftApi.isUp()) {
        window.FieldShiftApi.refreshRanking();
        updateParcelMap();
        return;
      }

      const list = ROTATIONS_DB[state.currentCrop] || ROTATIONS_DB.Papa;
      const zoneFactor = ZONE_MULTIPLIERS[state.zone] || ZONE_MULTIPLIERS.majes;
      const heatPenalty = Math.max(0, (state.climate.t2m - 19.4) * 0.15);
      const salinityPenalty = Math.max(0, (state.climate.salinity - 2.8) * 0.25);

      const wWater = state.priorities.water / 100;
      const wSoil = state.priorities.soil / 100;
      const wIncome = state.priorities.income / 100;

      const ranked = list.map(item => {
        const adjWater = Math.min(5, Math.max(1, Math.round(item.water - heatPenalty * (5 - item.water) * 0.35 * zoneFactor.waterStress)));
        const adjSoil = Math.min(5, Math.max(1, Math.round(item.soil - (zoneFactor.soilStress - 1) * 2 - salinityPenalty * (5 - item.soil) * 0.2)));
        const adjIncome = item.income;

        const score = adjWater * wWater + adjSoil * wSoil + adjIncome * wIncome;
        const maxPossible = 5 * (wWater + wSoil + wIncome) || 1;
        const matchPct = Math.min(98, Math.max(42, Math.round((score / maxPossible) * 100)));

        return {
          ...item,
          adjWater,
          adjSoil,
          adjIncome,
          score,
          matchPct
        };
      }).sort((a, b) => b.score - a.score);

      // If the backend already ranked them (see api.js), use that result instead of the local one
      const useApi = Array.isArray(apiRanked) && apiRanked.length > 0;
      const finalRanked = useApi ? apiRanked : ranked;
      state.currentRanked = finalRanked;
      if (state.selectedRotationIdx >= finalRanked.length) {
        state.selectedRotationIdx = 0;
      }

      // Renderizar las 3 principales en la vista de Rotaciones Recomendadas
      // top 3 plus the farmer's current way (id 'actual') so the current practice is always compared
      const topThree = finalRanked.slice(0, 3);
      const currentWay = finalRanked.find(r => r.id === 'actual');
      if (currentWay && !topThree.includes(currentWay)) topThree.push(currentWay);
      const container = document.getElementById('rotations-list');
      container.innerHTML = topThree.map((rot, idx) => `
        <div onclick="selectRotationForInspection(${finalRanked.indexOf(rot)}, false)" title="${t('cardTitle')}" class="bg-[#0d1015] border border-slate-700/75 hover:border-slate-400 rounded-2xl px-4 py-2.5 transition cursor-pointer group">
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="text-sm sm:text-[15px] font-bold text-white tracking-tight">
              <span class="font-mono-tech text-slate-400 mr-1.5">${rot.id === 'actual' ? t('today') : '#' + (idx + 1)}</span>
              ${rot.sequence.map(cropName).join(' <span class="text-slate-500 mx-1">&gt;</span> ')}
            </div>
            <span class="text-[10px] font-semibold text-slate-400 group-hover:text-indigo-300 transition">
              ${t('seeWhy')}
            </span>
          </div>

          ${window.FieldShiftApi && FieldShiftApi.badge ? FieldShiftApi.badge(rot) : ''}
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <!-- Barras segmentadas Display P3 -->
            <div class="flex flex-col gap-1.5 text-xs">
              <div class="flex items-center gap-3">
                <span class="w-14 text-slate-300 font-medium">${t('blockWater')}</span>
                <div class="flex items-center gap-1.5">${renderBlocks(rot.adjWater, 'block-water')}</div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-14 text-slate-300 font-medium">${t('blockSoil')}</span>
                <div class="flex items-center gap-1.5">${renderBlocks(rot.adjSoil, 'block-soil')}</div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-14 text-slate-300 font-medium">${t('blockIncome')}</span>
                <div class="flex items-center gap-1.5">${renderBlocks(rot.adjIncome, 'block-income')}</div>
              </div>
            </div>

            <!-- Insignia de Confianza Display P3 -->
            <div class="px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold tracking-wide shrink-0 ${getBadgeClass(rot.confidence)}">
              ${t('confidence')} ${t(CONF_KEY[rot.confidence] || 'confMedia')}
            </div>
          </div>
        </div>
      `).join('');

      updateParcelMap();

      // Ask the backend for the same ranking; api.js calls back here with the result
      if (!useApi && window.FieldShiftApi) window.FieldShiftApi.refreshRanking();

      // The explanation panel is always visible in the dashboard, so keep it in sync in both views
      renderParetoAndLLM();
    }

    // =========================================================================
    // 4. RENDERIZADO DEL GRÁFICO FRENTE DE COMPROMISOS (PARETO) + CAPA LLM
    // =========================================================================
    function renderParetoAndLLM() {
      const ranked = state.currentRanked;
      if (!ranked || ranked.length === 0) return;

      const layer = document.getElementById('pareto-dynamic-layer');

      // Mapear coordenadas (0-100) al área interna del SVG: X [65..425], Y [180..32]
      // Autoscale to the spread of the shown rotations (scores are relative, so the chart uses the full area)
      const xs = ranked.map(r => r.paretoX), ys = ranked.map(r => r.paretoY);
      const scale = (v, lo, hi) => (hi - lo < 1 ? 0.5 : 0.08 + 0.84 * (v - lo) / (hi - lo));
      const points = ranked.map((rot, idx) => {
        const cx = 65 + scale(rot.paretoX, Math.min(...xs), Math.max(...xs)) * 360;
        const cy = 180 - scale(rot.paretoY, Math.min(...ys), Math.max(...ys)) * 148;
        const r = 10 + rot.adjWater * 1.4; // Tamaño proporcional al ahorro de agua
        return { ...rot, idx, cx, cy, r };
      });

      // Línea punteada conectando los puntos óptimos no dominados (ordenados por X)
      const optimalSorted = points
        .filter(p => p.paretoOptimal)
        .sort((a, b) => a.cx - b.cx);

      let curveHtml = '';
      if (optimalSorted.length > 1) {
        const d = optimalSorted
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
          .join(' ');
        curveHtml = `<path d="${d}" fill="none" style="stroke: var(--p3-soil)" stroke-width="1.8" stroke-dasharray="5 5" opacity="0.7" />`;
      }

      const nodesHtml = points.map(p => {
        const isSelected = p.idx === state.selectedRotationIdx;
        const fillStyle = p.paretoOptimal ? 'fill: var(--p3-soil)' : 'fill: #475569';
        const textFill = p.paretoOptimal ? '#042f1a' : '#e2e8f0';
        const halo = isSelected
          ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r + 5}" fill="none" stroke="#ffffff" stroke-width="2.2" />`
          : '';

        return `
          <g onclick="selectRotationForInspection(${p.idx}, false)" class="cursor-pointer transition-transform hover:opacity-95">
            ${halo}
            <circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" style="${fillStyle}" stroke="#090c10" stroke-width="2" />
            <text x="${p.cx}" y="${p.cy + 3.5}" text-anchor="middle" fill="${textFill}" font-size="10.5" font-weight="800" font-family="JetBrains Mono">
              #${p.idx + 1}
            </text>
          </g>
        `;
      }).join('');

      layer.innerHTML = curveHtml + nodesHtml;

      // Actualizar panel inferior "¿Por qué esta rotación?" (LLM)
      const selected = points[state.selectedRotationIdx] || points[0];
      const zoneLabel = zoneName(state.zone);

      const matchBadge = document.getElementById('llm-match-badge');
      matchBadge.textContent = t('optionBadge', { n: selected.idx + 1, m: selected.matchPct });
      matchBadge.className = `px-2.5 py-1 rounded-lg border text-xs font-bold ${getBadgeClass(selected.confidence)}`;

      document.getElementById('llm-seq-title').textContent = selected.sequence.map(cropName).join(' → ');
      document.getElementById('llm-rationale-text').textContent = selected.rationale;
      document.getElementById('llm-soil-header').innerHTML = `<span>🌱</span> ${t('soilImpact')} (${zoneLabel}):`;
      document.getElementById('llm-soil-detail').textContent = selected.soilImpact;
      document.getElementById('llm-water-detail').textContent = selected.waterBalance;
    }

    function copyWhatsAppSummary() {
      const selected = state.currentRanked[state.selectedRotationIdx] || state.currentRanked[0];
      if (!selected) return;

      const zoneLabel = ZONE_NAMES[state.zone] ? zoneName(state.zone) : 'Arequipa';
      const summary = [
        t('waTitle'),
        `${t('waZone')} ${zoneLabel} | ${t('waCrop')} ${cropName(state.currentCrop)}`,
        `${t('waSeq')}${selected.idx + 1}: *${selected.sequence.map(cropName).join(' → ')}* (${selected.matchPct}% match | ${t('confidence')} ${t(CONF_KEY[selected.confidence] || 'confMedia')})`,
        `${t('waWhy')} ${selected.rationale}`,
        `${t('waSoil')} ${selected.soilImpact}`,
        `${t('waWater')} ${selected.waterBalance}`
      ].join('\n');

      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        const btnLabel = document.getElementById('copy-btn-label');
        btnLabel.textContent = t('copied');
        setTimeout(() => { btnLabel.textContent = t('copyBtn'); }, 1800);
      } catch (err) {
        console.error('Error al copiar:', err);
      }
      document.body.removeChild(textarea);
    }

    // =========================================================================
    // 5-BIS. FONDO ANIMADO: MARQUESINA DE ICONOS (agricultura + UI)
    // =========================================================================
    const MARQUEE_ICONS = [
      'fa-leaf', 'fa-spa', 'fa-apple', 'fa-sun-o', 'fa-cloud', 'fa-cloud-rain',
      'fa-tint', 'fa-thermometer-half', 'fa-thermometer-full', 'fa-bar-chart',
      'fa-line-chart', 'fa-pie-chart', 'fa-area-chart', 'fa-sliders', 'fa-cogs',
      'fa-map-marker', 'fa-map', 'fa-globe', 'fa-crosshairs', 'fa-dashboard',
      'fa-flask', 'fa-database', 'fa-signal', 'fa-bolt'
    ];

    function buildIconMarquee() {
      const host = document.getElementById('icon-marquee');
      if (!host) return;
      const iconSet = MARQUEE_ICONS
        .map(c => `<i class="fa ${c}" aria-hidden="true"></i>`)
        .join('')
        .repeat(3); // set triple para cubrir el ancho durante la animación
      const ROWS = 40;
      for (let r = 0; r < ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'mrow';
        row.innerHTML = `<div>${iconSet}</div><div>${iconSet}</div>`;
        host.appendChild(row);
      }
    }

    // =========================================================================
    // 5. MODAL DE PARÁMETROS CSV
    // =========================================================================
    function toggleAdvancedModal(show) {
      const modal = document.getElementById('advanced-modal');
      modal.classList.toggle('hidden', !show);
      modal.classList.toggle('flex', show);
    }

    function syncModalLabels() {
      document.getElementById('val-t2m').textContent = `${parseFloat(document.getElementById('inp-t2m').value).toFixed(1)} °C`;
      document.getElementById('val-prec').textContent = `${parseFloat(document.getElementById('inp-prec').value).toFixed(2)} mm`;
      document.getElementById('val-rh').textContent = `${parseFloat(document.getElementById('inp-rh').value).toFixed(1)} %`;
      document.getElementById('val-rad').textContent = `${parseFloat(document.getElementById('inp-rad').value).toFixed(2)} MJ`;
      document.getElementById('val-wind').textContent = `${parseFloat(document.getElementById('inp-wind').value).toFixed(2)} m/s`;
      document.getElementById('val-salinity').textContent = `${parseFloat(document.getElementById('inp-salinity').value).toFixed(1)} dS/m`;
    }

    function applyAdvancedAndClose() {
      state.climate.t2m = parseFloat(document.getElementById('inp-t2m').value);
      state.climate.prec = parseFloat(document.getElementById('inp-prec').value);
      state.climate.rh = parseFloat(document.getElementById('inp-rh').value);
      state.climate.rad = parseFloat(document.getElementById('inp-rad').value);
      state.climate.wind = parseFloat(document.getElementById('inp-wind').value);
      state.climate.salinity = parseFloat(document.getElementById('inp-salinity').value);

      document.getElementById('active-climate-tag').textContent = `NASA POWER · ${state.climate.t2m.toFixed(1)}°C`;
      toggleAdvancedModal(false);
      recalculateAll();
    }

    window.addEventListener('DOMContentLoaded', () => {
      buildIconMarquee();
      renderHorseshoe();
      initParcelMap();
      initHorseshoeDrag();
      recalculateAll();
      switchWorkspaceView('rotations');
    });
