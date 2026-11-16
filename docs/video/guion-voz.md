# GreenOrbit — guion de voz

Narración en inglés, tono sobrio y cercano, ritmo natural (unas 2,8 palabras por segundo). Al ser en inglés no hacen falta subtítulos obligatorios; se pueden agregar igual para verlo sin sonido. El metraje `H*` está en `docs/video/footage/` y lleva la etiqueta "AI-generated illustrative footage".

## Corte de 30 segundos (entrega)

| Tiempo | En pantalla | Voz (EN) |
|---|---|---|
| 0–5 s | `H3-canal.mp4`: avance sobre el canal lleno. Texto: "Majes, Arequipa, Peru" | On the Majes plateau in southern Peru, it never rains. Everything that grows here arrives through a single canal. |
| 5–9 s | Corte seco a `H8-canal-dry.mp4`: el mismo canal casi vacío. Texto grande: "Is it enough?" | So when the canal carries less water, farmers face one question: is it enough? |
| 9–14 s | `H1-pullback-to-orbit.mp4`: de los campos a la órbita. Texto: "NASA MODIS · NASA POWER · canal delivery records" | Using NASA satellite data and the canal's delivery records, we calculate how much water every crop needs. |
| 14–23 s | Grabación de la app en inglés: se elige un cultivo, se mueven las prioridades, aparece la rotación de tres campañas y el calendario de agua. | GreenOrbit compares every possible rotation and recommends what to plant over the next three seasons, balancing water, soil and income. |
| 23–26 s | Grabación de la app: se activa "Dry year"; el agua baja y aparecen los meses en déficit. | Even in a dry year, month by month. |
| 26–30 s | `H4-green-edge.mp4` de fondo, logo y dirección web. Línea pequeña: "It supports the decision. It does not replace it." | GreenOrbit. So the water lasts. |

Texto de voz completo, 30 s (81 palabras):

> On the Majes plateau in southern Peru, it never rains. Everything that grows here arrives through a single canal. So when the canal carries less water, farmers face one question: is it enough? Using NASA satellite data and the canal's delivery records, we calculate how much water every crop needs. GreenOrbit compares every possible rotation and recommends what to plant over the next three seasons, balancing water, soil and income. Even in a dry year, month by month. GreenOrbit. So the water lasts.

## Versión larga, unos 2 minutos (presentación y página)

**1. El lugar.** (canal, cañón, sobrevuelo del terreno)

> The Majes plateau, in Arequipa, Peru, is a desert. It never rains here. Every green hectare exists because a canal brings water down from the Andes: about 334 million cubic metres a year.

**2. La decisión.** (borde entre alfalfa y desierto; surcos)

> A farmer in Majes decides what to plant months before knowing how much water there will be. And almost half the land grows a single, thirsty crop: alfalfa.

**3. La tensión.** (canal casi seco; calendario de agua entrando en déficit)

> While the water keeps coming, the system works. But when deliveries drop, the same crops no longer fit in the same months. The question stops being which crop pays more. It becomes a different one: is there enough water?

**4. Los datos.** (retroceso a órbita; cuadros regados sobre el terreno)

> To answer it, we use what is already being measured. NASA satellites see how green each field is and how much water it consumes. NASA POWER provides the climate. The canal authority records how much water it delivers each month. And Peru's Ministry of Agriculture publishes yields, prices and sowing dates.

**5. El modelo.** (embudo de rotaciones; camino de tres campañas)

> With that, we calculate how much water each crop needs, as a low and a high estimate, because there is no single answer. Then we generate every possible three-season rotation, discard the ones that break agronomic rules, and rank the rest by what matters to the person deciding: saving water, protecting the soil, or earning more.

**6. El producto.** (grabación de la app: cultivo, prioridades, recomendación, año seco, vista de Junta)

> The result is GreenOrbit. A farmer picks what they grow today and sees what to plant next, and whether it fits the water they receive, month by month. The Water Users Board sees whether there is enough water for the whole district's crop mix. And with one switch, both can test a dry year.

**7. Lo que no sabemos.** (tarjeta sobria sobre fondo arena)

> We do not know everything. We tried a model to predict yields; it did not beat the historical average, so we dropped it. We have no production costs and no measured soil salinity per plot. That is why figures are shown as ranges, and why GreenOrbit supports the decision. It does not replace it.

**8. Cierre.** (borde verde, logo, dirección web)

> The water reaching Majes is not going to increase. What can change is what gets planted with it. GreenOrbit. So the water lasts.

## Afirmaciones que no deben decirse

El proyecto no tiene datos que las respalden:

- "La temperatura subió casi 2 °C."
- "30 años de datos en Majes": la serie satelital y las entregas del canal cubren 2013–2025.
- "El agricultor sembró el cultivo equivocado en el 87 % de las campañas": el modelo no calcula eso.
- Que el salitre bloquea las raíces por falta de lluvia en Majes: el modelo solo descuenta rendimiento por salinidad con una tabla de FAO, sin mediciones de campo.
- "Calibrado", "eficiencia de riego ≈ 0,5", "78 %–99 % del agua disponible".
