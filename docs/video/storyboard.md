# GreenOrbit: guion visual del video de presentación

Documento de producción. Cubre el video para NASA Space Apps Challenge 2026 (reto "Field Shift: Adapting Farms with NASA Data"): un corte de 30 segundos para la entrega y un corte de unos 2 minutos para la presentación y la página de aterrizaje. Ambos salen de las mismas tomas.

Estado de este documento: no se generó ningún material. No se llamó a ninguna herramienta de generación de Higgsfield ni se gastó ningún crédito. Los prompts de la sección 4 están listos para pegar; la decisión de generar es del equipo.

---

## 1. Hallazgos de la investigación

### 1.1 Video de referencia

URL: https://www.youtube.com/watch?v=QvbLhHqKULc

Lo que se pudo confirmar (consulta oEmbed de YouTube):
- Título: "Space App Challenge 2025 - Queñaris".
- Canal: Oscar Medina.

Lo que no se pudo obtener:
- Duración, descripción, transcripción, subtítulos y cualquier detalle de imagen o sonido. La página devolvió solo la estructura de YouTube sin contenido.
- No se pudo confirmar que este video sea el ganador local del año pasado. Es lo que afirma el equipo; el título solo indica la edición 2025 y un nombre que parece el del equipo o proyecto (inferencia, sin confirmar).

Consecuencia: este guion no describe ni imita ningún plano de ese video porque nadie lo vio en esta investigación. "Superar la vara" se plantea por lo que sí se controla: claridad en 30 segundos, identidad visual propia, producto real en pantalla y evidencia verificable. Recomendación de 5 minutos: que alguien del equipo vea el video y anote tres cosas (cómo abre, qué muestra del producto, cómo cierra) para ajustar el gancho de los primeros 3 segundos si hace falta.

### 1.2 Requisitos del demo, Space Apps 2026

Fuentes: Project Submission Guide https://www.spaceappschallenge.org/resources/project-submission-guide/ y Judging & Awards Guide https://www.spaceappschallenge.org/resources/judging-awards-guide/

Lo que se encontró (resumen de dos búsquedas web sobre esas páginas oficiales):
- El demo es obligatorio. Puede ser un video de máximo 30 segundos o una presentación de máximo 7 diapositivas, incluidas portada e introducción. La guía de jueces lo vincula con la elegibilidad para la evaluación global.
- Un video puede narrarse en otro idioma, pero debe llevar subtítulos en inglés. Las presentaciones deben estar en inglés.
- No se sube a la web de Space Apps: se aloja fuera (YouTube, Google Drive u otro) con un enlace público que no pida contraseña, permiso ni registro.
- Ventana de entrega: sábado 14 de noviembre a las 9:00 hasta el domingo 15 de noviembre a las 23:59, hora local.

Confianza: media-alta, no total. La lectura directa de spaceappschallenge.org falló en este entorno por un error de certificado TLS, así que no se leyó el texto de la página sino el resumen de un buscador sobre ella. Una de las búsquedas indicó además que el snapshot de la guía en el buscador podía ser de octubre de 2025. Los números (30 s, 7 diapositivas, subtítulos en inglés) coinciden con lo que halló la investigación previa del proyecto. Acción de 1 minuto antes de subir: abrir la guía en el navegador y confirmar esos tres puntos. Tampoco se verificó si el evento local de Arequipa exige otro formato.

Decisión de este documento: el corte de 30 segundos es el entregable. El corte de 2 minutos es para la presentación presencial y la página de aterrizaje; no cumple el límite de entrega.

### 1.3 Higgsfield (solo lectura)

Consulta hecha con `models_explore` y `balance`, sin generar nada. Lectura parcial del catálogo (primeros 40 modelos de video y 30 de imagen); el catálogo es de hoy y puede cambiar.

Saldo de la cuenta: 645,38 créditos, plan Plus. Las generaciones ilimitadas ("unlim") figuran como no disponibles ahora mismo. El costo en créditos por generación no se puede consultar sin generar, por lo que no se da cifra en créditos.

Modelos de video relevantes (todos aceptan 16:9):

| id | Duración | Imagen inicial / final | Resolución | Notas |
|---|---|---|---|---|
| `cinematic_studio_3_0` (Cinema Studio Video 3.0) | 4 a 15 s | start_image y end_image | 480p a 4k, por defecto 720p | También 21:9. `generate_audio` desactivado por defecto. Género "auto". |
| `kling3_0` (Kling v3.0) | 3 a 15 s | start_image y end_image | modo std, pro o 4k | `sound` on/off: poner off. Recomendado por el buscador de modelos para "cinemático". |
| `seedance_2_0` (Seedance 2.0) | 4 a 15 s | start_image y end_image | 480p a 4k, modo std o fast | Acepta ilimitadas cuando la cuenta las tiene (ahora no). |
| `seedance_2_5` | 4 a 30 s | start_image y end_image (modo omni_reference) | 480p a 4k | Tiene borrador de 480p. |

Modelos de imagen relevantes: `nano_banana_2_1` (1k a 4k, 16:9, hasta 14 referencias, semilla fija), `cinematic_studio_2_5` (1k a 4k, 16:9 y 21:9), `soul_location` (entornos, 16:9).

Ningún modelo de video leído expone un campo de prompt negativo. Las exclusiones van al final del prompt, en positivo y negativo ("no text, no logos...").

### 1.4 Qué no se pudo verificar

- Contenido del video de referencia (sección 1.1).
- Texto directo de la guía oficial (1.2).
- Costo por generación en Higgsfield (1.3).
- El rediseño guiado de la aplicación y `/app/landing.html`: en el repositorio `frontend/` solo hay `index.html`, `app.js`, `api.js` y `styles.css`. La versión desplegada hoy en https://greenorbit-six.vercel.app/app/ sigue el flujo anterior (perfil agricultor/Junta, prioridades con círculos, pestañas Rotaciones/Gráfico, casilla "Año seco"). Los planos de pantalla de la sección 6 describen el flujo nuevo y llevan un plan B con el flujo actual.
- Las cifras de la sección 5 provienen de pruebas locales con el código del árbol de trabajo (sin confirmar en commit). Deben re-exportarse de la API justo antes de construir cada animación.

---

## 2. Concepto creativo

**Idea única: "El hilo de agua".** Una sola línea turquesa recorre todo el video. Es el canal en el desierto, es la línea que un satélite vería desde la órbita, es la curva de agua que llega mes a mes, es el recorrido de la rotación de tres campañas. La pregunta que atraviesa el video es una: ¿alcanza?

Arco emocional (cabe en 30 s y se expande en 2 min):
1. **Asombro y contraste (gancho):** un canal fino y brillante en un desierto absoluto; el borde nítido entre lo verde y la arena.
2. **Tensión:** el agua que baja. El hilo se adelgaza; el calendario se pone naranja.
3. **Claridad:** desde la órbita, con datos de la NASA, 729 rotaciones se ordenan hasta quedar tres.
4. **Calma con respaldo:** una recomendación que cabe en el agua, probada también en el escenario seco, y una promesa honesta: apoya la decisión, no la reemplaza.

Recurso visual de firma: la **transición "hilo"**. Una línea turquesa de 4 px cruza el cuadro en 0,4 s y revela el plano siguiente detrás. Se usa entre planos clave; en el corte de 30 s, 4 veces como máximo.

Lema: **"Que el agua alcance."** (inglés: "Make the water last.")

Por qué este concepto: convierte un tema técnico (balance hídrico) en un objeto visual simple y repetible, une material generado con IA, gráficos y pantalla sin que parezcan piezas ajenas, y evita depender de mostrar personas.

---

## 3. Los dos cortes

Convenciones:
- Tipos de plano: **HF** (metraje de Higgsfield), **MG** (motion graphic), **PA** (grabación de pantalla), **TC** (tarjeta de título).
- Los códigos H1 a H8 remiten a la sección 4; MG1 a MG8 a la sección 5; T1 a T7 a la sección 6.
- Cada línea de voz en off lleva su subtítulo en inglés (línea "EN"). Los subtítulos en inglés van grabados en la imagen, en la franja inferior; los textos en español van arriba o al centro.
- Insignia permanente en los planos HF: "Imágenes ilustrativas generadas con IA" / EN: "AI-generated illustrative footage", abajo a la izquierda, 60 % de opacidad.
- Cifras de cada plano de pantalla: son las que muestra la aplicación en el momento de grabar; no se escenifican.

### 3.1 Corte de 30 segundos (entrega)

Duración total de exportación: 29,0 s. Nunca exportar 30,0 s o más; verificar la duración del archivo final. Voz: unas 63 palabras, ritmo tranquilo.

| # | Tiempo | Dur. | Tipo | Qué se ve y cómo se mueve | Texto en pantalla (ES / EN) | Voz en off (ES) y subtítulo EN | Sonido |
|---|---|---|---|---|---|---|---|
| 1 | 0:00 a 0:03,0 | 3,0 | HF (H3) | Sale de negro. Travelling bajo a lo largo de un canal de concreto con agua clara que se aleja hasta el horizonte, desierto a ambos lados. El canal es el hilo: una línea turquesa de gradación suave. Leve empuje hacia adelante. | "UN DESIERTO. UN CANAL." / EN: "One desert. One canal." | ES: "Majes es desierto. Lo verde llega por un canal." EN: "Majes is desert. Everything green arrives by canal." | Viento seco muy bajo; agua corriendo que sube de nivel; sin música todavía. |
| 2 | 0:03,0 a 0:05,5 | 2,5 | HF (H4) + MG2 | Transición hilo. Elevación de dron sobre el borde entre alfalfa verde y arena. El contador sube de 0 a 334 en 1,6 s en tipografía mono. | "334 millones de m³ al año" y fuente pequeña "Autodema, Pitay" / EN: "334 million m³ a year" | ES: "Son 334 millones de metros cúbicos al año." EN: "334 million cubic metres a year." | Entra un pulso grave suave; clic seco por cada tramo del contador. |
| 3 | 0:05,5 a 0:08,0 | 2,5 | HF (H8) + MG4 (mini) | Mismo canal, ahora con poco agua y bordes agrietados (H8). Un medidor en la esquina baja de 100 % a 84 % y el hilo turquesa se adelgaza hasta casi un trazo. Leve empuje. | "Escenario de año seco: ~84 % del agua normal" / EN: "Dry-year scenario: ~84 % of normal water" | ES: "Y en un año seco, llega menos." EN: "And in a dry year, less arrives." | Cae la música a un zumbido; golpe grave sutil en el 84 %. |
| 4 | 0:08,0 a 0:11,5 | 3,5 | HF (H1) + MG8 | Transición hilo. Retroceso desde la pampa (círculos de riego) hasta la curvatura de la Tierra. Etiquetas finas apuntan a la pampa. | "Datos de la NASA: MODIS · POWER" / EN: "NASA data: MODIS · POWER" | ES: "GreenOrbit lee la pampa con datos de la NASA." EN: "GreenOrbit reads the pampa with NASA data." | Whoosh limpio de ascenso; la música sube. |
| 5 | 0:11,5 a 0:14,5 | 3,0 | MG (MG5) | Cuadrícula de 729 puntos (27 por 27) sobre fondo canvas. Los puntos que rompen reglas se apagan; quedan pocos; tres brillan en turquesa. | "729 → válidas → 3" / EN: "729 → valid → 3" | ES: "Probamos las 729 rotaciones posibles." EN: "We test all 729 possible rotations." | Clics rápidos de la poda; acorde al quedar tres. |
| 6 | 0:14,5 a 0:19,5 | 5,0 | PA (T1+T2+T3 acelerado) | Montaje de pantalla acelerado: se toca el cultivo actual y los planeados, se arrastran las tres prioridades, aparece la recomendación como camino de tres campañas con su veredicto. Zoom suave a la tarjeta final. | "La que cabe en tu agua" / EN: "The one that fits your water" | ES: "y te mostramos la que cabe en tu agua." EN: "...and show the one that fits your water." | Clics suaves; el pulso se estabiliza. |
| 7 | 0:19,5 a 0:23,5 | 4,0 | PA (T4+T5) | Calendario de doce meses; se activa el interruptor de año seco y los meses con falta pasan a naranja. Zoom a los meses de déficit. | "Mes a mes, también en año seco" / EN: "Month by month, dry year too" | ES: "Mes a mes, también en un año seco." EN: "Month by month, dry year included." | Golpe grave en el cambio de interruptor; tensión. |
| 8 | 0:23,5 a 0:26,5 | 3,0 | PA (T6+T7) | Toque en una parcela del mapa; corte a la vista de la Junta con la pregunta "¿alcanza el agua?" y su respuesta. | "Agricultor · Junta de Usuarios" / EN: "Farmer · Water Users Board" | ES: "Para el agricultor y para la Junta de Usuarios." EN: "For the farmer and the Water Users Board." | Resolución de acordes; entra calidez. |
| 9 | 0:26,5 a 0:29,0 | 2,5 | TC sobre HF (final de H4 o H5) | Fondo: último segundo del plano H4 en cámara lenta. El hilo turquesa dibuja la palabra. Aparece el lema. Línea pequeña: "Apoya la decisión; no la reemplaza." | "GreenOrbit · Que el agua alcance." y URL / EN: "Make the water last." | ES: "GreenOrbit. Que el agua alcance." EN: "GreenOrbit. Make the water last." | Último acorde sostenido; cola de agua. |

Subtítulos en inglés de este corte: apéndice A (SRT).

### 3.2 Corte de unos 2 minutos (presentación y página de aterrizaje)

Duración 2:00 exactos. Voz: unas 230 palabras. Cinco actos; los planos HF y de pantalla son los mismos del corte de 30 s con mayor duración.

| # | Tiempo | Dur. | Tipo | Qué se ve y cómo se mueve | Texto en pantalla (ES / EN) | Voz en off (ES) y subtítulo EN | Sonido |
|---|---|---|---|---|---|---|---|
| 1 | 0:00 a 0:04 | 4,0 | HF (H2) | Acto 1, "El hilo". Vuelo lento hacia adelante por un cañón andino profundo, neblina baja; un hilo de agua en el fondo. | "Arequipa, Perú" / EN: "Arequipa, Peru" | ES: "En el sur del Perú, un canal cruza el desierto." EN: "In southern Peru, a canal crosses the desert." | Viento de altura; drone grave. |
| 2 | 0:04 a 0:09 | 5,0 | HF (H3) | Travelling bajo por el canal hacia el horizonte. | "Pampa de Majes" / EN: "Majes pampa" | ES: "Cada gota que riega la pampa de Majes llega por él." EN: "Every drop that irrigates the Majes pampa arrives through it." | Agua corriendo; entra una nota sostenida. |
| 3 | 0:09 a 0:13 | 4,0 | HF (H4) | Elevación de dron sobre el borde nítido entre alfalfa y arena. | "Sin el canal, solo arena." / EN: "Without the canal, only sand." | ES: "Sin canal, aquí solo hay arena." EN: "Without the canal, there is only sand." | Pulso grave suave. |
| 4 | 0:13 a 0:15,5 | 2,5 | HF (H5) + MG2 | Riego por pivote al atardecer; contador 0 a 334. | "334 millones de m³ al año (Autodema, Pitay)" / EN: "334 million m³ a year" | ES: "Son unos 334 millones de metros cúbicos al año." EN: "About 334 million cubic metres a year." | Chorros de agua; clic del contador. |
| 5 | 0:15,5 a 0:18 | 2,5 | HF (H6) | Plano detalle del agua entrando en surcos secos; el suelo se oscurece. | (sin texto) | (continúa la frase anterior) | Agua sobre tierra. |
| 6 | 0:18 a 0:23 | 5,0 | MG (MG3) | Mapa de cuadros regados (datos reales de `/irrigated`); los cuadros de alfalfa se encienden en verde hasta 48,2 %. | "La alfalfa ocupa el 48,2 % del área y sostiene la venta de leche. (Autodema 2016)" / EN: "Alfalfa covers 48.2 % of the area and is tied to milk sales." | ES: "Casi la mitad es alfalfa, ligada a la venta de leche." EN: "Nearly half is alfalfa, tied to milk sales." | Pulso sostenido; notas suben. |
| 7 | 0:23 a 0:28 | 5,0 | HF (H8) | Acto 2, "La pregunta". Mismo canal con poco agua, bordes agrietados. | "Escenario de año seco" / EN: "Dry-year scenario" | ES: "Pero hay años en que llega menos agua." EN: "But some years, less water arrives." | Música baja; viento seco. |
| 8 | 0:28 a 0:34 | 6,0 | MG (MG4) | Gráfico de doce meses: agua que llega (línea turquesa) frente a lo que piden los cultivos (área ocre); al cambiar a seco, la línea baja y el hueco se rellena en naranja. | "Agua que llega frente a lo que piden los cultivos" / EN: "Water delivered vs. water demanded" | ES: "La Junta de Usuarios debe presentar un plan de cultivos y riego con menos agua." EN: "The Water Users Board must file a crop and irrigation plan with less water." | Golpe grave en el cambio; textura tensa. |
| 9 | 0:34 a 0:38 | 4,0 | HF (H7) | Manos que giran la rueda de una compuerta del canal; empuje lento. | "¿Qué sembrar para que el agua alcance?" / EN: "What to plant so the water is enough?" | ES: "¿Qué sembrar para que el agua alcance?" EN: "What to plant so the water lasts?" | Pausa; casi silencio, solo agua. |
| 10 | 0:38 a 0:43 | 5,0 | HF (H1) + MG8 + TC | Acto 3, "Verlo desde el espacio". Retroceso hasta la órbita; el título GreenOrbit se dibuja con el hilo. | "GreenOrbit" / EN: "GreenOrbit" | ES: "GreenOrbit responde con datos de la NASA." EN: "GreenOrbit answers with NASA data." | Ascenso; entra la música plena. |
| 11 | 0:43 a 0:52 | 9,0 | MG (MG7) | Pila de fuentes con chips: MODIS NDVI, MODIS ET, NASA POWER, USGS SSEBop, Autodema 2013–2025, Midagri. Luego comparación: dos columnas de puntos coinciden hasta 715 comparaciones, diferencia 0. | "715 comparaciones con NASA AppEEARS, diferencia 0" / EN: "715 comparisons with NASA AppEEARS, difference 0" | ES: "Verdor y consumo de agua por satélite, clima de NASA POWER, entregas reales de Autodema. Nuestra extracción coincide con AppEEARS: 715 comparaciones, diferencia cero." EN: "Greenness and water use from satellites, NASA POWER climate, real Autodema deliveries. Our extraction matches AppEEARS: 715 comparisons, zero difference." | Teclas suaves; contador de coincidencias. |
| 12 | 0:52 a 0:58 | 6,0 | PA (T1) | Acto 4, "Cómo decide". Se elige el cultivo actual y los que se piensa sembrar. Zoom a las fichas. | "1. Elige qué sembrarás" / EN: "1. Choose what you will plant" | ES: "El agricultor elige qué piensa sembrar." EN: "The farmer chooses what to plant." | Clics suaves. |
| 13 | 0:58 a 1:04 | 6,0 | PA (T2) | Se arrastran las tres prioridades; el resultado se reordena. | "2. Mueve tus prioridades: agua, suelo, ingreso" / EN: "2. Move your priorities: water, soil, income" | ES: "Mueve tres prioridades: ahorrar agua, cuidar el suelo, ganar más." EN: "Move three priorities: save water, protect soil, earn more." | Tono ascendente al arrastrar. |
| 14 | 1:04 a 1:11 | 7,0 | MG (MG5) | 729 puntos; se descartan los que rompen reglas agronómicas; los válidos se ordenan por agua, suelo e ingreso; tres quedan brillando. | "729 rotaciones → válidas → las 3 mejores" / EN: "729 rotations → valid → top 3" | ES: "Probamos las 729 rotaciones posibles. Las reglas agronómicas descartan las inválidas y quedan las mejores." EN: "We test all 729 possible rotations. Agronomic rules discard the invalid ones and the best remain." | Clics de poda, acorde final. |
| 15 | 1:11 a 1:20 | 9,0 | PA (T3) + MG6 | Aparece la recomendación: camino de tres campañas sobre el hilo, veredicto en lenguaje llano, qué cede y qué datos faltan. Zoom suave. | "3. Una recomendación clara" / EN: "3. One clear recommendation" | ES: "Una recomendación: tres campañas, por qué gana y qué cede." EN: "One recommendation: three campaigns, why it wins and what it gives up." | Música estable, cálida. |
| 16 | 1:20 a 1:27 | 7,0 | PA (T4) | Calendario de doce meses en año normal: la demanda cabe en el agua que llega. | "4. ¿Cabe mes a mes?" / EN: "4. Does it fit month by month?" | ES: "Y mes a mes, si cabe en el agua que llega." EN: "And month by month, whether it fits the water that arrives." | Pulso suave. |
| 17 | 1:27 a 1:36 | 9,0 | PA (T5) + MG4 | Interruptor de año seco: la línea de agua cae, los meses con falta pasan a naranja. Se vuelve atrás para comparar. Plano dramático, cámara lenta del cambio. | "Escenario de año seco: ~84 % del agua normal" y nota "la entrega más baja observada en cada mes, 2013–2025" / EN: "Dry-year scenario: ~84 % of normal water; lowest delivery seen each month, 2013–2025" | ES: "Activa el escenario de año seco: unos 84 % del agua normal, con la entrega más baja de cada mes. Aquí se ve el déficit." EN: "Switch on the dry-year scenario: about 84 % of normal water, using each month's lowest delivery. Here you can see the shortfall." | Golpe grave, tensión, silencio de medio segundo y vuelta. |
| 18 | 1:36 a 1:43 | 7,0 | PA (T6) | Se toca la parcela en el mapa; aparece lo que registró el satélite en ese punto. | "5. Toca tu parcela" / EN: "5. Tap your plot" | ES: "Toca tu parcela: ves lo que el satélite registró en ese punto." EN: "Tap your plot: see what the satellite recorded at that point." | Ping suave de sonar. |
| 19 | 1:43 a 1:51 | 8,0 | PA (T7) | Perfil Junta de Usuarios: se elige una mezcla de cultivos y la aplicación responde si alcanza el agua; se cambia a año seco y cambia la respuesta. | "6. Junta de Usuarios: ¿alcanza el agua con esta mezcla?" / EN: "6. Water Users Board: is there enough water for this mix?" | ES: "Y para la Junta: ¿alcanza el agua para esta mezcla de cultivos?" EN: "And for the Board: is there enough water for this crop mix?" | Música estable. |
| 20 | 1:51 a 1:56 | 5,0 | TC (MG9) | Acto 5, "Honestidad". Fondo canvas, texto limpio. | "Probamos un modelo predictivo. No superó la línea base. Lo descartamos." / EN: "We tried a predictive model. It did not beat the baseline. We dropped it." | ES: "Probamos un modelo predictivo. No superó la línea base. Lo descartamos." EN: "We tried a predictive model. It did not beat the baseline. We dropped it." | Música baja; silencio breve. |
| 21 | 1:56 a 2:00 | 4,0 | TC sobre HF (final de H4) | Cierre: el hilo dibuja "GreenOrbit"; lema; URL; "Arequipa, Perú · NASA Space Apps Challenge 2026 · Field Shift". | "Apoya la decisión; no la reemplaza." / EN: "It supports the decision; it does not replace it." | ES: "GreenOrbit apoya la decisión. No la reemplaza." EN: "GreenOrbit supports the decision. It does not replace it." | Acorde sostenido y cola de agua. |

---

## 4. Lista de planos Higgsfield

Reglas generales para todos los prompts:
- Sin personas reconocibles: solo manos, siluetas lejanas o nadie. Sin logos, sin insignias de la NASA, sin texto en el cuadro.
- Todo plano que pueda confundirse con metraje documental real de un hecho lleva la insignia "Imágenes ilustrativas generadas con IA" (ver sección 3). Eso incluye H1 a H8. Además la descripción del video en YouTube debe decir que el metraje de paisaje es ilustrativo y generado con IA.
- Ningún plano presenta datos como si fueran reales; los números y gráficos se superponen en edición, nunca se generan.
- Look común para coherencia: luz natural, 35 mm de aspecto documental, tierra pálida, agua turquesa fría (#35bfb0) como único acento de color saturado, grano fino.
- Modelo de imagen de partida: `nano_banana_2_1`, 16:9, 2k, mismo "seed" para toda la serie (anotar el valor del primer resultado y reutilizarlo). Alternativa: `cinematic_studio_2_5` en 16:9.
- Modelo de video primario: `cinematic_studio_3_0`, 16:9, 5 s, 720p, `generate_audio` desactivado, imagen inicial = la imagen del plano. Alternativa: `kling3_0`, modo pro, 5 s, `sound` off. H1 usa `kling3_0` con imagen inicial y final.
- Cada video se genera sin audio; el sonido se construye aparte.
- Exclusiones: no hay campo negativo; van como frase final del prompt.

### H1. Retroceso a la órbita

- **Para qué sirve:** concepto "verlo desde el espacio"; une la pampa con los datos de satélite. Usado en 30 s #4 y 2 min #10.
- **Cadena:** dos imágenes y un video.
- **Imagen inicial (I1a)**, `nano_banana_2_1`, 16:9, 2k:
  > Top-down aerial view from about 3 kilometres altitude of a vast pale-brown Peruvian desert plateau with dozens of perfect green circular center-pivot irrigation fields and rectangular green plots, a thin straight bright canal line crossing the frame diagonally, high sun, crisp natural colours, photorealistic satellite-style aerial photograph. No text, no logos, no labels, no people.
- **Imagen final (I1b)**, `nano_banana_2_1`, 16:9, 2k:
  > View from low Earth orbit looking down at the Pacific coast of southern Peru and the Andes, a tiny cluster of green dots in an otherwise pale desert, thin glowing atmosphere line at the curved horizon, deep black space at the top, photorealistic, natural colours. No text, no logos, no national emblems.
- **Video**, `kling3_0`, modo pro, 16:9, 6 s, `sound` off, start_image = I1a, end_image = I1b:
  > Smooth continuous pull-back and ascent from the irrigated desert fields up through thin cloud to low Earth orbit, camera rising and tilting up slowly to reveal the curvature of the Earth, steady, no cuts. No text, no logos, no shaking, no people.
- **Evitar:** deformación de los círculos de riego durante la subida; nubes que tapan el final. Si el resultado se ve como mapa falso, repetir una vez; si falla, usar el plan B (sección 8: Worldview).

### H2. Cañón del Colca

- **Para qué sirve:** origen del agua del trasvase; apertura del corte de 2 minutos (#1). No se usa en el de 30 s. Es una ilustración, no una toma real del trasvase.
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Aerial view inside a deep steep-walled Andean canyon in southern Peru, ancient stepped agricultural terraces on the slopes, a thin turquoise river at the bottom, low morning mist, dry brown mountains, soft cold light, photorealistic documentary look. No text, no logos, no people, no buildings.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p:
  > Slow drone flight forward down the middle of the canyon, low above the river, mist drifting between the walls, very steady, no cuts.
- **Evitar:** estructuras o presas inventadas con aspecto de obra real; texto en el cuadro; cóndores animados con errores (si aparece alguno, descartar).

### H3. Canal en el desierto

- **Para qué sirve:** plano de apertura del corte de 30 s (#1) y del de 2 min (#2); fuente visual del hilo.
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Low angle view along a straight concrete irrigation canal full of fast clear water running to the horizon across a bare pale-brown desert plateau, a distant snow-capped volcanic peak on the horizon, late afternoon low sun with long soft shadows, dust haze, photorealistic documentary look. No text, no logos, no people, no vehicles.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Low drone tracking forward a metre above the water, following the canal straight toward the horizon, water flowing steadily, subtle heat shimmer, no cuts. No people, no text, no logos.
- **Evitar:** canal que se curva o cambia de ancho; agua que parece estática; estructuras con letreros.

### H4. Borde verde y desierto

- **Para qué sirve:** contraste central (30 s #2 y fondo del cierre #9; 2 min #3 y #21).
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Aerial view at low altitude of the sharp edge where a lush green alfalfa field meets bare pale-brown desert sand, a dirt road along the border, the line running to the horizon, early morning soft light, photorealistic documentary look. No text, no logos, no people.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Slow drone ascent that rises while tilting down, revealing the border between green field and desert stretching to the horizon, steady, no cuts.
- **Evitar:** transición borrosa entre verde y arena (debe verse nítida); maquinaria con letras.

### H5. Riego por pivote al atardecer

- **Para qué sirve:** muestra la tecnología de riego (2 min #4) y puede servir de fondo alternativo del cierre del corte de 30 s.
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Wide shot of a center-pivot irrigation system spraying water arcs across a round green alfalfa field in the middle of a bare desert, golden hour light, the long steel gantry with fine water mist catching the light, dust in the air, photorealistic documentary look. No text, no logos, no people.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Slow lateral camera slide at low altitude while the pivot gantry slowly rotates and water arcs spray, steady, no cuts.
- **Evitar:** pivotes con más de un brazo o geometría imposible; rótulos en la maquinaria.

### H6. Riego por surcos, plano detalle

- **Para qué sirve:** muestra el riego por gravedad (2 min #5).
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Low close-up at ground level of water entering dry dark-brown furrows between crop rows in a desert farm, the first wet edge advancing over cracked dry soil, backlit by low sun with water glints, shallow depth of field, photorealistic. No text, no logos, no people.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Static low camera while the water slowly advances down the furrows toward the lens, soil darkening as it spreads, subtle sparkle, no cuts.
- **Evitar:** agua que fluye hacia atrás; cultivos irreconocibles (aceptable: surcos de ajo o cebolla en general).

### H7. Manos sobre una compuerta

- **Para qué sirve:** el momento humano de decidir (2 min #9). Alternativa preferible: filmar con el teléfono las manos de alguien del equipo; es auténtico y evita errores típicos de manos generadas.
- **Imagen**, `nano_banana_2_1`, 16:9, 2k:
  > Close-up of two weathered hands in work clothes turning a metal handwheel of a small irrigation canal gate, water behind the gate, blurred green field in the background, shallow depth of field, warm soft light, photorealistic. Hands only, no face, no logos, no text.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Slow push-in toward the hands as they turn the wheel and a thin stream of water begins to flow through the gate, steady, no cuts. No face visible, no text, no logos.
- **Evitar:** más de cinco dedos o manos deformadas (repetir una vez; si persiste, usar metraje propio); rostro visible.

### H8. Escenario seco

- **Para qué sirve:** contraste dramático con H3 (30 s #3; 2 min #7). Es una ilustración de un escenario, no de un hecho real; la insignia es obligatoria.
- **Imagen**, `nano_banana_2_1`, 16:9, 2k, usando I3 como referencia de imagen para conservar el lugar:
  > The same straight concrete irrigation canal in the same desert plateau, now with only a thin trickle of water and cracked dry mud along the banks, harsh flat midday light, dust haze, a pale yellowed field edge in the background, photorealistic documentary look, drought scenario. No text, no logos, no people.
- **Video**, `cinematic_studio_3_0`, 16:9, 5 s, 720p, start_image = la imagen:
  > Slow low drone push forward along the almost-dry canal, dust drifting, heat shimmer, no cuts.
- **Evitar:** animales muertos u otras imágenes de tragedia; humo o fuego; escala exagerada.

### Conteo de generaciones

| Concepto | Imágenes | Videos | Total |
|---|---|---|---|
| Ruta mínima (corte de 30 s: H1, H3, H4, H8) | 5 (I1a, I1b, I3, I4, I8) | 4 | 9 |
| Ruta mínima con 1 reintento por plano | 5 | 4 | 12 a 14 |
| Plan completo (H1 a H8, un intento) | 9 | 8 | 17 |
| Plan completo con margen de reintentos (cerca del 50 %) | cerca de 13 | cerca de 12 | 24 a 26 |

Recomendación: generar primero la ruta mínima. Saldo disponible hoy: 645,38 créditos; el costo por generación no se pudo consultar sin generar. Antes de cada generación, mirar el precio que muestre Higgsfield; probar con 720p y 5 s; subir de resolución solo lo que se use. No usar `upscale_*` sin decidirlo.

---

## 5. Especificaciones de motion graphics

Datos desde la API local o desplegada (`/api/model/...`). Re-exportar justo antes de construir. Resolución de trabajo 1920 por 1080, 30 fps. Fondo canvas `#0b1311`.

### MG1. Transición "hilo"
- Línea turquesa `#35bfb0` de 4 px y 0,4 s que cruza el cuadro de izquierda a derecha con una cola difusa; el plano siguiente se revela detrás. Ease-in-out. Sin datos.

### MG2. Contador de agua entregada
- Dato: 334 millones de m³ al año (entregas de Autodema, Pitay; la serie cubre 2013–2025).
- Anima: cifra en JetBrains Mono que sube de 0 a 334 en 1,6 s con ease-out; la unidad "millones de m³ al año" aparece al final. Debajo, fuente en texto pequeño: "Autodema, Pitay".
- Duración: 2,5 s en el corte de 30 s.

### MG3. Alfalfa 48,2 %
- Dato: mezcla "Actual (Autodema 2016)" de `/api/model/mixes`; alfalfa 48,2 % del área.
- Anima: mapa de cuadros regados de `/api/model/irrigated?zone=majes`, atenuados en gris verdoso; los cuadros de alfalfa se encienden en `#8cc46a` hasta cubrir 48,2 % (contador a la derecha). Texto: "La alfalfa ocupa el 48,2 % del área y sostiene la venta de leche."
- Duración: 5 s. Nota: la proporción es del área total, no de cada cuadro; si el mapa no puede asignar alfalfa a cuadros reales, representar con una cuadrícula de 100 puntos, 48 encendidos, y decirlo en la fuente.

### MG4. Agua que llega frente a agua que piden los cultivos (calendario de doce meses)
- Endpoint: `GET /api/model/calendar?sequence=<cultivos>&scenario=normal` y `scenario=dry`.
- Campos: `entrega_m3_ha` (12 valores de enero a diciembre), `entrega_anual_m3_ha`, `cap_pct`, y por campaña `demanda_m3_ha` (12 valores) y `meses_con_deficit` (mes y `falta_m3_ha`).
- Ejemplo de prueba (re-exportar): entrega normal [1872, 1695, 1906, 1811, 1686, 1509, 1552, 1620, 1744, 1882, 1810, 1908], total 20.996 m³/ha al año; entrega seca [1561, 1581, 1724, 1564, 1374, 1347, 1190, 1289, 1319, 1609, 1519, 1493], total 17.570, `cap_pct` 83,7. Una campaña de haba en año seco mostró faltante de 843, 887, 1.027 y 1.182 m³/ha de septiembre a diciembre.
- Anima: eje de doce meses; la entrega es una línea turquesa gruesa (el hilo); la demanda de la campaña es un área ocre `#d6a24a`. Al activar el interruptor seco: la línea baja con ease-in-out en 0,8 s hasta la serie seca, el medidor pasa de 100 a 84 % y las zonas donde la demanda supera la línea se llenan de naranja `#dc6a45` con una pulsación. Etiqueta: "Escenario de año seco: ~84 % del agua normal".
- Duración: 6 s (2 min #8), 9 s en pantalla (2 min #17), 2,5 s en miniatura (30 s #3).
- Regla: la gráfica replica lo que muestra la aplicación; no se dibuja ningún valor que no venga de la respuesta. El escenario seco es un caso de estrés construido con la entrega más baja de cada mes (de años distintos), no un año registrado; el texto no debe llamarlo "año histórico".

### MG5. Embudo de 729 rotaciones
- Dato: 9 cultivos candidatos, 9 por 9 por 9 = 729 secuencias de tres campañas (`model/generador.py`, lista CANDIDATES). Un recuento local con el cultivo actual "Papa" dio 277 secuencias que cumplen las reglas; con otros cultivos actuales el número cambia (277 a 393). Mostrar el número que devuelve el código para el cultivo elegido en la grabación y dejar el mismo en voz y texto.
- Anima: cuadrícula de 27 por 27 puntos (729) que aparece en oleada en 1,2 s. Fase de reglas (1,5 s): los puntos inválidos se atenúan y caen; el contador baja de 729 al número válido. Fase de puntaje (1,5 s): los válidos se ordenan en barras por puntaje (agua, suelo, ingreso). Fase final (1,5 s): tres puntos suben, brillan en turquesa y se conectan con líneas al hilo.
- Duración: 3 s en el corte de 30 s; 7 s en el de 2 min.
- Reglas de texto: decir "reglas agronómicas" sin citar fuentes que no estén respaldadas; no nombrar la regla "no repetir familia" ni atribuirla al INIA. El número de las "mejores" debe coincidir con las que muestra la aplicación; si muestra otro número, decir "las mejores".

### MG6. Camino de la rotación
- Dato: respuesta de `GET /api/model/rotations?crop=<cultivo>&...`; `sequence` y `facts.estrellas` (agua, suelo, ingreso) del resultado principal.
- Anima: el hilo recorre tres nodos (una campaña cada uno) con el nombre del cultivo y un icono; debajo de cada nodo, tres barras pequeñas (agua turquesa, suelo ocre, ingreso verde). Aparece el veredicto en lenguaje llano. Duración 9 s incluidos en la pantalla grabada.

### MG7. Pila de fuentes y verificación
- Dato: fuentes de la sección "Datos" del README; verificación AppEEARS: 715 comparaciones, diferencia 0.
- Anima: seis chips se apilan en 0,4 s cada uno: "MODIS MOD13Q1 · NDVI · 250 m", "MODIS MOD16A3GF · ET · 500 m", "NASA POWER · clima", "USGS SSEBop", "Autodema · entregas en Pitay · 2013–2025", "Midagri · rendimiento, precio, siembra". Luego dos columnas de puntos (nuestra extracción y AppEEARS) se alinean y un contador sube a 715 con "diferencia 0".
- Duración: 9 s. Sin logotipos de la NASA, solo texto.

### MG8. Etiquetas sobre la órbita
- Superposición sobre H1: líneas finas turquesa de 1 px que apuntan a la pampa con "MOD13Q1 · verdor", "MOD16A3GF · consumo de agua", "POWER · clima". Aparecen en 0,3 s escalonadas. Sin logotipos ni insignias de la NASA.

### MG9. Tarjeta de honestidad
- Texto centrado, Fraunces 700, sobre canvas, sin gráficas ni cifras: "Probamos un modelo predictivo. No superó la línea base. Lo descartamos." Aparece palabra por palabra en 1,5 s. No mostrar errores numéricos.

---

## 6. Plan de grabación de pantalla

Condiciones para todas las grabaciones:
- Resolución de captura 1920 por 1080 a 60 fps (OBS u otra herramienta); exportar a 30 fps.
- Navegador Chrome en perfil limpio, sin extensiones ni barra de marcadores, zoom del navegador al 125 %, modo oscuro del sistema, notificaciones desactivadas, ventana a pantalla completa de la página.
- Idioma de la interfaz: español en ambos cortes. Los subtítulos en inglés cubren la traducción. El selector EN solo se muestra si hay tiempo (2 s en 2 min #12).
- Cursor: grande, con un anillo turquesa que pulsa al hacer clic (añadir en edición o con la herramienta de captura). Movimientos lentos, trayectorias suaves, 2 s de pausa antes de cada clic importante.
- Zoom en edición: amplificar la zona de la acción a 130 a 160 % con ease-in-out de 0,6 s; la página se mantiene legible sin cursor encima.
- Cada toma de 20 a 30 s con 2 s de margen quieto al inicio y al final (así sirve para ambos cortes).
- Antes de grabar: verificar que las cifras en pantalla coinciden con la respuesta de la API; no ajustar ni escenificar resultados. Anotar la hora y la URL usadas.
- Plan B si el rediseño no está desplegado: usar la versión actual de https://greenorbit-six.vercel.app/app/ (casilla "Año seco", prioridades en círculos, pestañas "Rotaciones" y "Gráfico", bloque "Agua y tope colectivo").

Recorrido de clics por toma (descrito por lo que ocurre en pantalla):

| Toma | Usada en | Recorrido |
|---|---|---|
| T1 Elegir cultivos | 30 s #6; 2 min #12 | Abrir `/app/`; esperar que cargue la portada con las fichas de cultivos; elegir como cultivo actual "Papa"; marcar los cultivos que se piensa sembrar (por ejemplo ajo, zapallo, paprika). Pausa de 2 s con la selección visible. |
| T2 Prioridades | 30 s #6; 2 min #13 | Arrastrar las tres prioridades: subir "ahorrar agua", dejar "cuidar el suelo" a media altura, bajar "ganar más". Esperar que el resultado se reordene. Pausa de 2 s. |
| T3 Recomendación | 30 s #6; 2 min #15 | Esperar el resultado principal: camino de tres campañas con el veredicto. Pasar el cursor sobre una campaña para mostrar su detalle. Pausa de 3 s con el veredicto completo. |
| T4 Calendario normal | 30 s #7; 2 min #16 | Bajar hasta el calendario de doce meses. Mantener 3 s con el año normal. |
| T5 Interruptor de año seco | 30 s #7; 2 min #17 | Activar el interruptor de año seco; mantener 3 s sobre los meses con falta en naranja; volver al año normal y activar de nuevo una vez (para el plano en cámara lenta). |
| T6 Mapa | 30 s #8; 2 min #18 | Ir al mapa; tocar una parcela dentro de la zona regada; esperar la tarjeta con lo que registró el satélite en ese punto; mantener 3 s. Evitar resaltar la capa de zonas sensibles a la sequía: su lectura no se afirma como confiable. |
| T7 Vista de la Junta | 30 s #8; 2 min #19 | Cambiar al perfil "Junta de Usuarios". Elegir una mezcla de cultivos (por ejemplo "Actual (Autodema 2016)"). Mostrar la respuesta de si alcanza el agua. Activar año seco y mostrar el cambio de la respuesta. |

---

## 7. Identidad visual, subtítulos y música

### Paleta (tomada de `frontend/styles.css`)
| Uso | Valor |
|---|---|
| Fondo (canvas) | `#0b1311` |
| Superficie | `#111b19`; elevado `#182522` |
| Agua / el hilo | `#35bfb0`; resalte `#7fe0d3` |
| Suelo / demanda | `#d6a24a` |
| Ingreso / alfalfa | `#8cc46a` |
| Déficit / alerta | `#dc6a45` |
| Desierto | `#9a9484` |
| Texto principal | `#f3f6f4`; texto secundario `#b6c4bd` |

Regla: el turquesa es el único color saturado que se repite en todos los planos; el naranja aparece solo para déficit.

### Tipografía
- Titulares y lema: Fraunces 600 o 700 (la que usa la aplicación).
- Subtítulos y texto de interfaz: Inter 600.
- Cifras y etiquetas de datos: JetBrains Mono 700.

### Subtítulos en inglés
- Grabados en la imagen, Inter 600, unos 44 px a 1080p, máximo 2 líneas de 38 caracteres, blanco `#f3f6f4` sobre una cinta de canvas al 60 %.
- Franja inferior (últimos 12 % de la altura); los textos en español van arriba o al centro para no solaparse.
- Se entrega también un archivo SRT (apéndice A) por si la plataforma lo pide.

### Voz en off
- Recomendada: voz de una persona del equipo, grabada en el teléfono en un cuarto silencioso, con filtro de ruido; acento y ritmo naturales. Español neutro, sin modismos, tono sereno.
- Respaldo: voz sintética solo si no hay tiempo; revisar pronunciación de "GreenOrbit", "Majes", "Autodema".

### Música y sonido
- Dirección: textura ambiental baja (cuerdas y sintetizador suave) que sube con un pulso a la entrada del 84 %, cae a un zumbido en el momento seco y se resuelve en acordes cálidos con un toque mínimo de guitarra o charango al cierre. Sin canciones comerciales.
- Fuente: música libre de derechos con licencia verificada (por ejemplo la biblioteca de audio de YouTube o similares) o generada; anotar la licencia en la descripción del video. La generación de audio en Higgsfield cuenta como otra generación con costo.
- Efectos: agua corriendo, viento seco, clics suaves de interfaz, golpe grave en el interruptor seco, whoosh de ascenso a la órbita.
- Mezcla: voz a unos -16 LUFS, música con ducking de unos 18 dB bajo la voz, salida final cerca de -14 LUFS integrados, pico real máximo -1 dBTP.

### Exportación
- 1920 por 1080, 30 fps, H.264, audio AAC 48 kHz, entre 8 y 12 Mbps.

### Afirmaciones que no deben aparecer
- No usar "calibrado", "eficiencia de riego de 0,5", "78 % a 99 % del agua disponible", "Autodema 2003–2026" (los datos cubren 2013–2025), "INIA: no repetir familia", ni afirmar que el mapa de sequía identifica zonas sensibles de forma confiable.
- No decir que predice rendimientos; sí que se probó un modelo predictivo y se descartó.
- El año seco es un escenario de estrés, no un año registrado. Decir "escenario de año seco".
- El proyecto apoya la decisión; no la reemplaza.
- No usar el logotipo, la insignia ni el nombre estilizado de la NASA; la mención como texto "datos de la NASA" y "NASA Space Apps Challenge 2026" sí.

---

## 8. Lista de producción, en el orden de las horas disponibles

Hoy es 15 de noviembre y la entrega cierra a las 23:59 hora local. Plan para 2 a 3 personas; la ruta mínima está marcada con (M).

1. (M) **5 min.** Abrir la guía oficial de entrega en el navegador y confirmar los tres puntos de 1.2 (30 s o 7 diapositivas, subtítulos en inglés si la voz no es inglés, enlace público). Decidir dónde se aloja el video.
2. (M) **15 min.** Fijar guion y voz en off del corte de 30 s; una persona graba la voz en el teléfono (3 a 5 tomas).
3. (M) **En paralelo, 60 a 90 min.** Higgsfield, ruta mínima: imágenes I1a, I1b, I3, I4, I8, luego los videos H3, H4, H8, H1 (9 generaciones, 12 a 14 con reintentos). Antes de cada una, mirar el costo. Elegir las mejores tomas y renombrarlas.
4. (M) **En paralelo, 30 a 40 min.** Grabar pantalla T1 a T7 con el flujo disponible (rediseñado si está desplegado, actual si no). Revisar que las cifras de pantalla coinciden con la API.
5. (M) **60 a 90 min.** Construir MG2, MG4 (miniatura y versión larga), MG5, MG8 y el cierre. Opciones de herramienta: HTML animado renderizado a video (HyperFrames o Remotion) si alguien lo domina; si no, CapCut, DaVinci Resolve o After Effects.
6. (M) **45 min.** Montar el corte de 30 s, poner subtítulos en inglés y insignia de IA, mezclar sonido, exportar y revisar que la duración sea 29,0 s o menos.
7. (M) **15 min.** Subir a YouTube (público o no listado), comprobar el enlace en una ventana privada sin sesión, pegar la descripción (nota de "ilustrativo generado con IA", fuentes de datos, licencia de la música) y enviar el proyecto antes de las 23:59.
8. **Después de la entrega.** Generar H2, H5, H6, H7, construir MG3, MG6, MG7, MG9 y montar el corte de 2 minutos para la presentación y la página de aterrizaje.

### Plan B si no se genera metraje con IA

El concepto del hilo funciona sin fotos:
- Sustituir H1 y el mapa por capturas animadas de NASA Worldview o Copernicus Browser de la zona de Majes (acercamiento y retroceso en edición); citar la fuente en pantalla en texto, sin logotipos.
- Sustituir H3, H4, H5, H6 por metraje propio grabado con el teléfono o dron si lo hay, o por videos de archivo gratuitos con licencia revisada (Pexels, Pixabay) de canal de riego, pivote y desierto; en ese caso quitar la insignia "generado con IA" y no afirmar que es Majes.
- Un recurso con datos reales: animar el mapa de cuadros regados de `/irrigated` (los cuadros se encienden sobre fondo de desierto) y el hilo turquesa como línea de canal. No requiere ninguna generación.
- H8: bajar la línea de agua con el calendario seco (MG4) a pantalla completa, sin metraje.
- H7: filmar las manos de alguien del equipo.
- Si el tiempo se acaba por completo: presentación de 7 diapositivas en inglés con los mismos fotogramas de pantalla (opción válida según los requisitos).

---

## Apéndice A. Subtítulos en inglés del corte de 30 segundos (SRT)

```
1
00:00:00,200 --> 00:00:02,900
Majes is desert. Everything green arrives by canal.

2
00:00:03,200 --> 00:00:05,400
334 million cubic metres a year.

3
00:00:05,700 --> 00:00:07,900
And in a dry year, less arrives.

4
00:00:08,200 --> 00:00:11,400
GreenOrbit reads the pampa with NASA data.

5
00:00:11,700 --> 00:00:14,400
We test all 729 possible rotations.

6
00:00:14,700 --> 00:00:19,400
...and show the one that fits your water.

7
00:00:19,700 --> 00:00:23,400
Month by month, dry year included.

8
00:00:23,700 --> 00:00:26,400
For the farmer and the Water Users Board.

9
00:00:26,700 --> 00:00:28,900
GreenOrbit. Make the water last.
```

Notas: los tiempos coinciden con la tabla 3.1 con 0,2 a 0,3 s de entrada. Ajustar al ritmo real de la voz grabada antes de exportar.
