# Terrain assets: sources and licences

Baked once for the GreenOrbit 3D scene. Area: lat -16.65 to -15.40, lon -72.85 to -71.80 (Majes plateau, Colca canyon, Ampato, Sabancaya, Coropuna).

| File | What it is | Source | Licence |
|---|---|---|---|
| `height.png` | Elevation grid, 512 x 608, 2 m steps (R*256+G, times 2 m). Resampled from zoom 10 tiles. | AWS Terrain Tiles (Terrarium), built from NASA SRTM and other public elevation sources. https://registry.opendata.aws/terrain-tiles/ | Public data; attribution to the original sources listed at https://github.com/tilezen/joerd/blob/master/docs/attribution.md (includes NASA SRTM) |
| `texture.jpg` | Surface image, Sentinel-2 cloudless 2016, zoom 11 tiles cropped to the area. | EOX IT Services GmbH, "Sentinel-2 cloudless 2016" (contains modified Copernicus Sentinel data 2016). https://s2maps.eu | CC BY 4.0 (the 2016 layer only; later EOX years are CC BY-NC-SA) |
| `paths.geojson` | Canal de Majes (route relation 19378866), rivers, trunk and primary roads, and the positions of the place labels. Simplified. | OpenStreetMap contributors, via the Overpass API | ODbL 1.0, https://www.openstreetmap.org/copyright |
| `meta.json` | Bounds and grid description of the files above. | Generated | n/a |

Required credit, shown inside the scene:
"Relieve: NASA SRTM · Imagen: Sentinel-2 cloudless (EOX) · Trazos: © OpenStreetMap" (EN: "Relief: NASA SRTM · Imagery: Sentinel-2 cloudless (EOX) · Paths: © OpenStreetMap").

Notes
- The OSM canal ends where OSM stops mapping it (about lat -15.91). The tunnelled and piped stretch to the Majes plateau is not in OSM as a waterway, so it is not drawn.
- Vertical exaggeration in the scene is x1.6.
- The 3D library (three.js r160, MIT) is loaded from the jsDelivr CDN, not stored here.
