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

    // Claves de traducción para zonas y cultivos (los valores del <select>
    // siguen siendo los identificadores del dominio: 'majes', 'Papa', etc.)
    const ZONE_KEYS = {
      majes: 'zoneMajes',
      chili: 'zoneChili',
      camana: 'zoneCamana',
      siguas: 'zoneSiguas'
    };

    const CROP_KEYS = {
      Papa: 'cropPapa',
      Maíz: 'cropMaiz',
      Cebolla: 'cropCebolla',
      Haba: 'cropHaba',
      Alfalfa: 'cropAlfalfa',
      Trigo: 'cropTrigo'
    };

    function zoneLabel(zone) {
      return t(ZONE_KEYS[zone] || 'zoneMajes');
    }

    function cropLabel(name) {
      return CROP_KEYS[name] ? t(CROP_KEYS[name]) : name;
    }

    function sequenceLabel(sequence) {
      return sequence.map(cropLabel).join(' → ');
    }

    // Devuelve el texto agronómico en el idioma activo. Las versiones en
    // inglés viven en ROTATIONS_EN y están pendientes de revisión agronómica.
    function rotationText(rotation, field) {
      if (getLang() === 'en' && ROTATIONS_EN[rotation.id] && ROTATIONS_EN[rotation.id][field]) {
        return ROTATIONS_EN[rotation.id][field];
      }
      return rotation[field];
    }

    const ZONE_MULTIPLIERS = {
      majes: { waterStress: 1.15, soilStress: 1.10 },
      chili: { waterStress: 0.92, soilStress: 0.90 },
      camana: { waterStress: 0.80, soilStress: 1.00 },
      siguas: { waterStress: 1.10, soilStress: 1.05 }
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
      }
    };

    // =========================================================================
    // 2-BIS. MAPA SATELITAL DE LA PARCELA (Leaflet + Esri World Imagery)
    // =========================================================================
    let parcelMap = null;
    let parcelPolygon = null;
    let parcelTile = null;
    let parcelAttribution = '';
    let lastMapZone = null;
    let parcelCenter = null; // centro actual del polígono (permite reubicarlo con clic)

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
      parcelAttribution = t('mapAttribution');
      parcelTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: parcelAttribution
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
      document.getElementById('parcel-zone-tag').textContent = zoneLabel(state.zone);
    }

    // La atribución de Leaflet se crea una sola vez; al cambiar de idioma hay
    // que retirar el texto anterior y añadir el nuevo.
    function refreshMapAttribution() {
      if (!parcelMap || !parcelTile) return;
      const next = t('mapAttribution');
      if (next === parcelAttribution) return;
      if (parcelAttribution) {
        parcelMap.attributionControl.removeAttribution(parcelAttribution);
      }
      parcelAttribution = next;
      parcelTile.options.attribution = next;
      parcelMap.attributionControl.addAttribution(next);
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
      refreshMapAttribution();
    }

    // =========================================================================
    // 2-TER. SISTEMA DE IDIOMA (ES / EN) -> definido en i18n.js
    // =========================================================================
    // t(), getLang(), setLang(), toggleLang() y applyLang() viven en i18n.js

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
    // 1-BIS. TEXTOS AGRONÓMICOS EN INGLÉS
    // Traducción de ROTATIONS_DB. Pendiente de revisión por el equipo
    // agronómico antes de publicar (ver informe de entrega).
    // =========================================================================
    const ROTATIONS_EN = {
      'papa-1': {
        rationale: 'Including fava bean (a legume) immediately after potato replenishes the nitrogen removed by the crop without relying on excessive synthetic fertiliser. Closing the cycle with alfalfa improves water infiltration and reduces surface salinity in arid soils.',
        soilImpact: '+18% projected organic matter over 4 years; breaks the potato nematode cycle.',
        waterBalance: 'Savings of ~2,400 m³/ha compared with intensive vegetable rotations.'
      },
      'papa-2': {
        rationale: 'Corn uses the residual nitrogen left after the potato harvest and structures the root profile before fava bean is introduced. Onion at the end maximises the commercial margin by capitalising on the previous biological improvement.',
        soilImpact: '+11% aggregate stability; neutral nitrogen balance thanks to the legume in year 3.',
        waterBalance: 'Moderate consumption (+650 m³/ha in the final season due to onion water demand).'
      },
      'papa-3': {
        rationale: 'Early biological fixation with fava bean in year two supports onion profitability in year three, closing with forage or grain corn to capture remaining nutrients.',
        soilImpact: '+9% labile carbon; electrical conductivity must be monitored before onion.',
        waterBalance: 'Savings of ~1,150 m³/ha compared with continuous vegetable monoculture.'
      },
      'papa-4': {
        rationale: 'A highly extractive sequence with high agronomic risk: repeating potato for two consecutive seasons multiplies Globodera (cyst nematode) inoculum and depletes available nitrogen with no fallow or cover.',
        soilImpact: '-22% organic matter and subsurface compaction; high likelihood of yield loss in year 2.',
        waterBalance: 'Water inefficiency due to low moisture retention in degraded soil.'
      },
      'maiz-1': {
        rationale: 'After the high nitrogen demand of corn, fava bean fixes between 80 and 110 kg N/ha, preparing the ground for potato. Alfalfa at the end restores porosity and controls salts.',
        soilImpact: '+17% moisture retention and symbiotic nitrogen fixation validated in coastal valleys.',
        waterBalance: 'Savings of ~1,950 m³/ha by optimising drip irrigation depths.'
      },
      'maiz-2': {
        rationale: 'Alternating fibrous roots (corn and wheat) with a bulb crop (onion) and a taproot (fava bean) prevents plough-pan formation and diversifies annual income.',
        soilImpact: '+12% stubble cover with wheat in year 4; reduces wind erosion.',
        waterBalance: 'Savings of ~1,600 m³/ha thanks to the low water requirement of wheat.'
      },
      'maiz-3': {
        rationale: 'A cash-flow-oriented scheme with two commercial crops in high regional demand, supported by the nitrogen fixation of fava bean in year two.',
        soilImpact: '+6% organic matter; requires compost incorporation before potato.',
        waterBalance: 'Medium-high water demand in years 3 and 4.'
      },
      'maiz-4': {
        rationale: 'High extraction of macro- and micronutrients with no legumes and no fallow. It increases dependence on synthetic urea and raises salinisation in areas with restricted irrigation.',
        soilImpact: '-16% microbial activity and loss of granular structure.',
        waterBalance: 'Severe water deficit during the dry season.'
      },
      'ceb-1': {
        rationale: 'Onion leaves shallow roots and high salinity sensitivity; rotating with fava bean and closing with alfalfa leaches salts from the wet bulb and restores biological fertility.',
        soilImpact: '+20% infiltration and reduced surface electrical conductivity.',
        waterBalance: 'Savings of ~2,600 m³/ha compared with continuous vegetable succession.'
      },
      'ceb-2': {
        rationale: 'Takes advantage of the fine seedbed left after onion to establish potato, adding fava bean in year three to restore the nitrogen balance before corn.',
        soilImpact: '+10% NPK balance; breaks the onion basal fusarium cycle.',
        waterBalance: 'Balanced consumption with a moderate peak in year 2.'
      },
      'ceb-3': {
        rationale: 'Repeating onion sharply increases pink root and thrips incidence, reducing commercial bulb size and requiring frequent irrigation that worsens salinity.',
        soilImpact: '-24% soil biological health and accumulation of soluble salts.',
        waterBalance: 'Water overuse (+3,100 m³/ha) due to forced leaching.'
      },
      'haba-1': {
        rationale: 'INIA model sequence: nitrogen fixed by fava bean directly boosts potato yield in year 2, followed by corn and regenerative alfalfa.',
        soilImpact: '+19% available organic nitrogen and sustained soil carbon improvement.',
        waterBalance: 'Savings of ~2,200 m³/ha with high efficiency per kilogram produced.'
      },
      'haba-2': {
        rationale: 'Capitalises on the initial nitrogen supply from fava bean in a high-value crop such as onion, stabilising the profile with grasses (corn and wheat).',
        soilImpact: '+13% plant cover and less surface compaction.',
        waterBalance: 'Savings of ~1,750 m³/ha over the full 4-year cycle.'
      },
      'haba-3': {
        rationale: 'Repeating two-year blocks of the same crop favours fungal root diseases and reduces biological fixation efficiency in the second legume season.',
        soilImpact: '-12% microbial diversity due to low variety of root exudates.',
        waterBalance: 'Suboptimal water use in years 3 and 4.'
      },
      'alf-1': {
        rationale: 'Ploughing in alfalfa releases an extraordinary reserve of organic matter and nitrogen that maximises potato and corn yields without degrading the soil.',
        soilImpact: '+22% accumulated organic matter and deep loosening by the taproot.',
        waterBalance: 'Savings of ~2,050 m³/ha by replacing permanent alfalfa with annual crops.'
      },
      'alf-2': {
        rationale: 'Uses the low salinity and high porosity left by alfalfa to produce export onion in year two, closing with fava bean.',
        soilImpact: '+15% structural stability and excellent internal drainage.',
        waterBalance: 'Savings of ~1,850 m³/ha compared with maintaining cut alfalfa.'
      },
      'alf-3': {
        rationale: 'Keeping continuous alfalfa in arid areas such as Majes consumes up to 18,000 m³/ha/year and raises the water table, worsening salinisation in low-lying parcels.',
        soilImpact: 'Good cover, but high risk of capillary rise of salts.',
        waterBalance: 'Critical water consumption; penalised under scarcity scenarios at Condoroma.'
      }
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

    function recalculateAll() {
      state.zone = document.getElementById('select-zona').value;
      state.currentCrop = document.getElementById('select-cultivo').value;

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

      state.currentRanked = ranked;
      if (state.selectedRotationIdx >= ranked.length) {
        state.selectedRotationIdx = 0;
      }

      // Renderizar las 3 principales en la vista de Rotaciones Recomendadas
      const topThree = ranked.slice(0, 3);
      const container = document.getElementById('rotations-list');
      container.innerHTML = topThree.map((rot, idx) => `
        <div onclick="selectRotationForInspection(${idx}, true)" title="${t('cardTooltip')}" class="bg-[#0d1015] border border-slate-700/75 hover:border-slate-400 rounded-2xl px-4 py-3.5 transition cursor-pointer group">
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="text-sm sm:text-[15px] font-bold text-white tracking-tight">
              <span class="font-mono-tech text-slate-400 mr-1.5">#${idx + 1}</span>
              ${rot.sequence.map(cropLabel).join(' <span class="text-slate-500 mx-1">&gt;</span> ')}
            </div>
            <span class="text-[10px] font-semibold text-slate-400 group-hover:text-indigo-300 transition">
              ${t('seeWhy')}
            </span>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
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

      if (state.activeView === 'pareto') {
        renderParetoAndLLM();
      }
    }

    // =========================================================================
    // 4. RENDERIZADO DEL GRÁFICO FRENTE DE COMPROMISOS (PARETO) + CAPA LLM
    // =========================================================================
    function renderParetoAndLLM() {
      const ranked = state.currentRanked;
      if (!ranked || ranked.length === 0) return;

      const layer = document.getElementById('pareto-dynamic-layer');

      // Mapear coordenadas (0-100) al área interna del SVG: X [65..425], Y [180..32]
      const points = ranked.map((rot, idx) => {
        const cx = 65 + (rot.paretoX / 100) * 360;
        const cy = 180 - (rot.paretoY / 100) * 148;
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
      const zoneName = zoneLabel(state.zone);

      const matchBadge = document.getElementById('llm-match-badge');
      matchBadge.textContent = t('optionBadge', { n: selected.idx + 1, pct: selected.matchPct });
      matchBadge.className = `px-2.5 py-1 rounded-lg border text-xs font-bold ${getBadgeClass(selected.confidence)}`;

      document.getElementById('llm-seq-title').textContent = sequenceLabel(selected.sequence);
      document.getElementById('llm-rationale-text').textContent = rotationText(selected, 'rationale');
      document.getElementById('llm-soil-header').innerHTML = `<span>🌱</span> ${t('soilImpact')} (${zoneName}):`;
      document.getElementById('llm-soil-detail').textContent = rotationText(selected, 'soilImpact');
      document.getElementById('llm-water-detail').textContent = rotationText(selected, 'waterBalance');
    }

    function copyWhatsAppSummary() {
      const selected = state.currentRanked[state.selectedRotationIdx] || state.currentRanked[0];
      if (!selected) return;

      const zoneName = zoneLabel(state.zone);
      const summary = [
        t('waTitle'),
        `${t('waZone')} ${zoneName} | ${t('waCrop')} ${cropLabel(state.currentCrop)}`,
        `${t('waSeq')}${state.selectedRotationIdx + 1}: *${sequenceLabel(selected.sequence)}* (${selected.matchPct}% ${t('matchWord')} | ${t('confidence')} ${t(CONF_KEY[selected.confidence] || 'confMedia')})`,
        `${t('waWhy')} ${rotationText(selected, 'rationale')}`,
        `${t('waSoil')} ${rotationText(selected, 'soilImpact')}`,
        `${t('waWater')} ${rotationText(selected, 'waterBalance')}`
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
        console.error(t('copyError'), err);
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
      setLang(getInitialLang());
      switchWorkspaceView('rotations');
    });
