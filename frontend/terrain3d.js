/* GreenOrbit 3D terrain: the Majes irrigation district as a real WebGL relief.
 *
 * Data (baked once into ./terrain-assets/, see ATTRIBUTION.md):
 *   relief  NASA SRTM-derived elevation (AWS Terrain Tiles, Terrarium encoding)
 *   image   Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)
 *   paths   Canal de Majes, rivers, main roads and place positions from OpenStreetMap (ODbL)
 *
 * VERTICAL EXAGGERATION: x1.6 (VE below). Stated on screen in the caption.
 *
 * Contract (fixed, other pages code against it):
 *   GreenOrbitTerrain.isSupported(): boolean
 *   GreenOrbitTerrain.mount(container, { mode, lang, interactive, showPixels, assetsBase }): Promise<handle>
 *   handle: setDry, setProgress, flyTo, playTour, setLang, resize, destroy
 * Extra, optional: options.pixels (array of [lat, lon, ...]) to skip the fetch, options.apiBase,
 * options.labels (default: every mode except 'hero'), handle.setPixels(array).
 *
 * three.js is loaded lazily from a pinned CDN URL; nothing here runs at import time except
 * registering window.GreenOrbitTerrain, so a failed CDN can never break the host page.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const VE = 1.6;            // vertical exaggeration
const LIFT = 0.04;         // km, lines and points float this far above the surface
const KM_LAT = 110.6;

const TEXT = {
  es: { attr: 'Relieve: NASA SRTM · Imagen: Sentinel-2 cloudless (EOX) · Trazos: © OpenStreetMap',
        ve: 'Relieve exagerado ×1,6', drag: 'Arrastra para girar' },
  en: { attr: 'Relief: NASA SRTM · Imagery: Sentinel-2 cloudless (EOX) · Paths: © OpenStreetMap',
        ve: 'Vertical exaggeration ×1.6', drag: 'Drag to look around' },
};

let threeP = null;
const loadThree = () => threeP || (threeP = import(THREE_URL).catch((e) => { threeP = null; throw e; }));
const assetCache = new Map();

function isSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) { return false; }
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image failed: ' + url));
    im.src = url;
  });
}

function loadAssets(base) {
  if (assetCache.has(base)) return assetCache.get(base);
  const p = (async () => {
    const meta = await fetch(base + 'meta.json').then((r) => { if (!r.ok) throw new Error('meta ' + r.status); return r.json(); });
    const [hBlob, img, geo] = await Promise.all([
      fetch(base + meta.height).then((r) => { if (!r.ok) throw new Error('height ' + r.status); return r.blob(); }),
      loadImage(base + meta.texture),
      fetch(base + meta.paths).then((r) => { if (!r.ok) throw new Error('paths ' + r.status); return r.json(); }),
    ]);
    const bmp = await createImageBitmap(hBlob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const { w, h } = meta.grid;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data;
    const H = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) H[i] = (px[i * 4] * 256 + px[i * 4 + 1]) * meta.hstep;   // metres
    return { meta, H, img, geo };
  })();
  p.catch(() => assetCache.delete(base));
  assetCache.set(base, p);
  return p;
}

let styleDone = false;
function injectStyle() {
  if (styleDone) return; styleDone = true;
  const s = document.createElement('style');
  s.textContent = `
.gt-root{position:absolute;inset:0;overflow:hidden;background:#6f868c}
.gt-root canvas{display:block;width:100%;height:100%}
.gt-sky{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(7,16,14,.55) 0%,rgba(7,16,14,.14) 30%,rgba(7,16,14,0) 50%)}
.gt-lab{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:500 11px/1 'Instrument Sans',system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#f3f6f1;text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 10px rgba(0,0,0,.6);opacity:0;transition:opacity .35s;will-change:transform}
.gt-lab::before{content:'';display:block;width:5px;height:5px;margin:0 auto 5px;border-radius:50%;background:#7fe0d3;box-shadow:0 0 0 2px rgba(7,16,14,.55)}
.gt-lab[data-t=volcano]::before{background:#fff}
.gt-lab small{display:block;text-align:center;font-weight:400;letter-spacing:.04em;opacity:.8;margin-top:3px;text-transform:none}
.gt-cap{position:absolute;left:12px;bottom:10px;right:12px;pointer-events:none;font:400 10.5px/1.45 'Instrument Sans',system-ui,sans-serif;color:rgba(250,252,248,.96);text-shadow:0 0 3px rgba(0,0,0,.9),0 1px 4px rgba(0,0,0,.8)}
.gt-cap b{font-weight:500;color:#fff}
`;
  document.head.appendChild(s);
}

async function mount(container, options) {
  if (!container) throw new Error('container required');
  const o = Object.assign({ mode: 'explore', lang: 'es', interactive: false, showPixels: false, assetsBase: './terrain-assets/', apiBase: '' }, options || {});
  const base = new URL(o.assetsBase.endsWith('/') ? o.assetsBase : o.assetsBase + '/', document.baseURI).href;
  if (!isSupported()) throw new Error('WebGL2 not available');
  const [THREE, A] = await Promise.all([loadThree(), loadAssets(base)]);
  injectStyle();

  const { meta, H, img, geo } = A;
  const { S, N, W, E } = meta.bounds;
  const GW = meta.grid.w, GH = meta.grid.h;
  const latC = (S + N) / 2, lonC = (W + E) / 2;
  const kx = 111.32 * Math.cos(latC * Math.PI / 180);
  const X = (lon) => (lon - lonC) * kx;
  const Z = (lat) => -(lat - latC) * KM_LAT;
  const halfW = ((E - W) * kx) / 2, halfD = ((N - S) * KM_LAT) / 2;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const small = Math.min(container.clientWidth || 800, window.innerWidth) < 520;
  const dprCap = small ? 1.5 : 2;

  /* ---------- mesh (displaced grid) ---------- */
  const step = (o.mode === 'hero' || small) ? 2 : 1;
  const nx = Math.ceil((GW - 1) / step) + 1, ny = Math.ceil((GH - 1) / step) + 1;
  const xi = new Int32Array(nx), yj = new Int32Array(ny);
  for (let k = 0; k < nx; k++) xi[k] = Math.min(k * step, GW - 1);
  for (let k = 0; k < ny; k++) yj[k] = Math.min(k * step, GH - 1);
  const mer = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const mS = mer(S), mN = mer(N);
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), hv = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = N + (S - N) * yj[j] / (GH - 1);
    const v = (mer(lat) - mS) / (mN - mS);
    for (let k = 0; k < nx; k++) {
      const lon = W + (E - W) * xi[k] / (GW - 1);
      const h = H[yj[j] * GW + xi[k]] / 1000 * VE;
      const n = j * nx + k;
      hv[n] = h;
      pos[n * 3] = X(lon); pos[n * 3 + 1] = h; pos[n * 3 + 2] = Z(lat);
      uv[n * 2] = xi[k] / (GW - 1); uv[n * 2 + 1] = v;
    }
  }
  const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let q = 0;
  for (let j = 0; j < ny - 1; j++) for (let k = 0; k < nx - 1; k++) {
    const a = j * nx + k, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tg.setIndex(new THREE.BufferAttribute(idx, 1));
  tg.computeVertexNormals();

  // surface height (km, exaggerated) exactly on the rendered triangles
  function heightAt(x, z) {
    const lon = lonC + x / kx, lat = latC - z / KM_LAT;
    let fi = (lon - W) / (E - W) * (GW - 1), fj = (N - lat) / (N - S) * (GH - 1);
    fi = Math.min(Math.max(fi, 0), GW - 1); fj = Math.min(Math.max(fj, 0), GH - 1);
    const k = Math.min(Math.floor(fi / step), nx - 2), j = Math.min(Math.floor(fj / step), ny - 2);
    const tx = (fi - xi[k]) / (xi[k + 1] - xi[k]), ty = (fj - yj[j]) / (yj[j + 1] - yj[j]);
    const ha = hv[j * nx + k], hb = hv[j * nx + k + 1], hc = hv[(j + 1) * nx + k], hd = hv[(j + 1) * nx + k + 1];
    return tx + ty <= 1 ? ha + tx * (hb - ha) + ty * (hc - ha) : hd + (1 - tx) * (hc - hd) + (1 - ty) * (hb - hd);
  }
  const ll = (lat, lon, y) => new THREE.Vector3(X(lon), y, Z(lat));
  const llg = (lat, lon, up) => { const p = ll(lat, lon, 0); p.y = heightAt(p.x, p.z) + (up || 0); return p; };

  /* ---------- renderer / scene ---------- */
  const root = document.createElement('div'); root.className = 'gt-root';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // shaders do their own gamma
  renderer.setClearColor(0x6f868c, 1);
  root.appendChild(renderer.domElement);
  const sky = document.createElement('div'); sky.className = 'gt-sky'; root.appendChild(sky);
  const cap = document.createElement('div'); cap.className = 'gt-cap'; root.appendChild(cap);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.mode === 'hero' ? 38 : 42, 1, 0.3, 400);
  const fogCol = new THREE.Color(0x6f868c);
  const U = {
    uMap: { value: null }, uSun: { value: new THREE.Vector3(0.6, 0.5, -0.55).normalize() },
    uFogColor: { value: fogCol }, uCam: { value: camera.position }, uFog: { value: 0.0085 },
    uDry: { value: 0 }, uExposure: { value: o.mode === 'hero' ? 0.86 : 1.0 }, uHalf: { value: new THREE.Vector2(halfW, halfD) },
  };
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.NoColorSpace; tex.flipY = true; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  U.uMap.value = tex;

  const terrainMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normal; vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uSun, uFogColor, uCam; uniform float uFog, uDry, uExposure; uniform vec2 uHalf;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 t = texture2D(uMap, vUv).rgb;
        float gr = t.g - 0.5*(t.r+t.b);
        float veg = smoothstep(0.010, 0.060, gr);
        float luma = dot(t, vec3(0.299,0.587,0.114));
        vec3 sandy = vec3(luma)*vec3(1.30,1.08,0.78) + vec3(0.06,0.045,0.0);
        t = mix(t, sandy, veg*uDry*0.92);
        vec3 alb = pow(t, vec3(2.2));
        vec3 n = normalize(vN);
        float diff = max(dot(n,uSun),0.0);
        vec3 amb = mix(vec3(0.17,0.20,0.27), vec3(0.34,0.31,0.27), n.y*0.5+0.5);
        vec3 lit = alb*(amb + vec3(1.0,0.88,0.72)*diff*1.45)*uExposure;
        float d = length(vW-uCam);
        float fh = 0.5 + 0.5*exp(-max(vW.y,0.0)*0.16);
        float f = 1.0 - exp(-uFog*d*fh);
        vec3 fc = pow(uFogColor, vec3(2.2));
        vec3 col = mix(lit, fc, f);
        vec2 e = uHalf - abs(vW.xz);
        col = mix(fc, col, smoothstep(0.0, 6.0, min(e.x,e.y)));
        gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(tg, terrainMat));

  /* ---------- draped ribbons (canal, rivers, roads) ---------- */
  const res = new THREE.Vector2(1, 1);
  const T = { time: { value: 0 } };
  function ribbonGeometry(lines) {
    const P = [], TA = [], SD = [], DS = [], IX = [];
    let base = 0;
    for (const ln of lines) {
      const pts = [];
      for (let i = 0; i < ln.length; i++) {
        const a = ln[i];
        if (i === 0) { pts.push([X(a[0]), Z(a[1])]); continue; }
        const b = pts[pts.length - 1], cx = X(a[0]), cz = Z(a[1]);
        const L = Math.hypot(cx - b[0], cz - b[1]), n = Math.max(1, Math.ceil(L / 0.16));
        for (let s = 1; s <= n; s++) pts.push([b[0] + (cx - b[0]) * s / n, b[1] + (cz - b[1]) * s / n]);
      }
      if (pts.length < 2) continue;
      let dist = 0;
      const ys = pts.map((p) => heightAt(p[0], p[1]) + LIFT);
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[Math.max(i - 1, 0)], p1 = pts[Math.min(i + 1, pts.length - 1)];
        const y0 = ys[Math.max(i - 1, 0)], y1 = ys[Math.min(i + 1, pts.length - 1)];
        let tx = p1[0] - p0[0], ty = y1 - y0, tz = p1[1] - p0[1];
        const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
        if (i > 0) dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        for (const sd of [-1, 1]) { P.push(pts[i][0], ys[i], pts[i][1]); TA.push(tx, ty, tz); SD.push(sd); DS.push(dist); }
        if (i < pts.length - 1) {
          const a = base + i * 2;
          IX.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      base += pts.length * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('tangent', new THREE.Float32BufferAttribute(TA, 3));
    g.setAttribute('side', new THREE.Float32BufferAttribute(SD, 1));
    g.setAttribute('dist', new THREE.Float32BufferAttribute(DS, 1));
    g.setIndex(IX);
    return g;
  }
  const lineVS = `
    attribute vec3 tangent; attribute float side; attribute float dist;
    uniform vec2 uRes; uniform float uWidth;
    varying float vSide; varying float vDist; varying float vD;
    void main(){
      vec4 c0 = projectionMatrix*viewMatrix*vec4(position,1.0);
      vec4 c1 = projectionMatrix*viewMatrix*vec4(position+tangent*0.08,1.0);
      vec2 s0 = c0.xy/max(c0.w,0.001)*uRes*0.5, s1 = c1.xy/max(c1.w,0.001)*uRes*0.5;
      vec2 d = s1-s0; float l = length(d); d = l>1e-5 ? d/l : vec2(1.0,0.0);
      vec2 n = vec2(-d.y,d.x);
      gl_Position = c0; gl_Position.xy += n*side*uWidth*0.5/(uRes*0.5)*c0.w;
      vSide = side; vDist = dist; vD = c0.w;
    }`;
  const mats = [];
  function lineMat(frag, uniforms, blending) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uRes: { value: res }, uWidth: { value: 2 }, uTime: T.time }, uniforms),
      vertexShader: lineVS, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: true,
      blending: blending || THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide,
    });
    mats.push(m); return m;
  }
  const byKind = (k) => geo.features.filter((f) => f.properties.kind === k && f.geometry.type === 'LineString').map((f) => f.geometry.coordinates);

  const canalU = { uDry: { value: 0 }, uCol: { value: new THREE.Color('#35bfb0') } };
  const canalGeo = ribbonGeometry(byKind('canal'));
  const canalFrag = (glow) => `
    uniform float uDry, uTime; uniform vec3 uCol; varying float vSide; varying float vDist; varying float vD;
    void main(){
      float a = ${glow ? 'exp(-vSide*vSide*2.6)*0.42' : '1.0-smoothstep(0.55,1.0,abs(vSide))'};
      float pulse = 0.5+0.5*sin(vDist*2.2 - uTime*${reduced ? '0.0' : '1.7'});
      vec3 col = mix(uCol, vec3(0.78,1.0,0.96), ${glow ? '0.0' : '0.35*pulse*(1.0-uDry)'});
      col = mix(col, vec3(0.62,0.55,0.42), uDry*0.55);
      float k = mix(1.0, 0.42, uDry);
      float fade = 1.0 - 0.45*clamp(vD/260.0,0.0,1.0);
      gl_FragColor = vec4(col, a*k*fade);
    }`;
  const canalGlowMat = lineMat(canalFrag(true), canalU, THREE.AdditiveBlending);
  const canalCoreMat = lineMat(canalFrag(false), canalU);
  const canalGlow = new THREE.Mesh(canalGeo, canalGlowMat), canalCore = new THREE.Mesh(canalGeo, canalCoreMat);
  canalGlow.renderOrder = 3; canalCore.renderOrder = 4;
  scene.add(canalGlow, canalCore);

  const riverMat = lineMat(`
    uniform float uDry; varying float vSide; varying float vD;
    void main(){ float a = 1.0-smoothstep(0.5,1.0,abs(vSide)); gl_FragColor = vec4(mix(vec3(0.36,0.66,0.86),vec3(0.55,0.58,0.55),uDry*0.5), a*0.82*(1.0-0.4*clamp(vD/260.0,0.0,1.0))); }`, { uDry: canalU.uDry });
  const river = new THREE.Mesh(ribbonGeometry(byKind('river')), riverMat); river.renderOrder = 2; scene.add(river);
  const roadMat = lineMat(`
    varying float vSide; varying float vD;
    void main(){ float a = 1.0-smoothstep(0.5,1.0,abs(vSide)); gl_FragColor = vec4(0.93,0.86,0.70, a*0.3*(1.0-0.5*clamp(vD/220.0,0.0,1.0))); }`, {});
  const road = new THREE.Mesh(ribbonGeometry(byKind('road')), roadMat); road.renderOrder = 1; scene.add(road);

  /* ---------- irrigated pixels ---------- */
  let points = null;
  const pointU = { uDry: canalU.uDry, uRes: { value: res }, uPx: { value: 1 } };
  const pointMat = new THREE.ShaderMaterial({
    uniforms: pointU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `
      uniform vec2 uRes; uniform float uPx; varying float vK;
      void main(){
        vec4 c = projectionMatrix*viewMatrix*vec4(position,1.0);
        float s = 0.17 * projectionMatrix[1][1] * uRes.y * 0.5 / max(c.w,0.01);
        gl_PointSize = clamp(s, 1.6*uPx, 8.0*uPx); vK = 1.0; gl_Position = c;
      }`,
    fragmentShader: `
      uniform float uDry; varying float vK;
      void main(){
        vec2 p = gl_PointCoord-0.5; float d = length(p); if(d>0.5) discard;
        vec3 g = mix(vec3(0.42,0.86,0.45), vec3(0.78,0.68,0.44), uDry);
        gl_FragColor = vec4(g, (1.0-smoothstep(0.30,0.5,d))*mix(0.78,0.5,uDry));
      }`,
  });
  function setPixels(arr) {
    if (points) { scene.remove(points); points.geometry.dispose(); points = null; }
    if (!Array.isArray(arr) || !arr.length) { invalidate(); return; }
    const p = new Float32Array(arr.length * 3);
    let n = 0;
    for (const r of arr) {
      const la = +r[0], lo = +r[1];
      if (!(la >= S && la <= N && lo >= W && lo <= E)) continue;
      const x = X(lo), z = Z(la);
      p[n * 3] = x; p[n * 3 + 1] = heightAt(x, z) + LIFT + 0.02; p[n * 3 + 2] = z; n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.subarray(0, n * 3), 3));
    points = new THREE.Points(g, pointMat); points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points); invalidate();
  }

  /* ---------- labels (positions come from the OSM extract) ---------- */
  let lang = o.lang === 'en' ? 'en' : 'es';
  const labels = [];
  if (o.labels !== undefined ? o.labels : o.mode !== 'hero') {
    for (const f of geo.features) {
      if (f.properties.kind !== 'place') continue;
      const el = document.createElement('div');
      el.className = 'gt-lab'; el.dataset.t = f.properties.type;
      root.appendChild(el);
      const [lon, lat] = f.geometry.coordinates;
      const up = f.properties.type === 'volcano' ? 0.9 : 0.7;
      labels.push({ el, p: llg(lat, lon, up), g: llg(lat, lon, 0), f, vis: 0 });
    }
  }
  function setLabelText() {
    for (const L of labels) {
      const pr = L.f.properties;
      L.el.innerHTML = '';
      L.el.appendChild(document.createTextNode(pr[lang]));
      if (pr.ele) { const s = document.createElement('small'); s.textContent = pr.ele.toLocaleString(lang === 'es' ? 'es-PE' : 'en-US') + ' m'; L.el.appendChild(s); }
    }
  }
  function setCap() {
    cap.innerHTML = '';
    const t = TEXT[lang];
    const l1 = document.createElement('div'); l1.textContent = t.attr;
    const l2 = document.createElement('div'); l2.innerHTML = '<b></b>';
    l2.firstChild.textContent = t.ve + (o.interactive && o.mode === 'explore' ? ' · ' + t.drag : '');
    cap.append(l1, l2);
  }
  setLabelText(); setCap();
  const v3 = new THREE.Vector3();
  function updateLabels() {
    const w = root.clientWidth, h = root.clientHeight;
    const placed = [];
    for (const L of labels) {
      v3.copy(L.p).project(camera);
      let show = v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 0.96 && Math.abs(v3.y) < 0.94;
      if (show) {   // hidden when a ridge is between the camera and the label
        const c = camera.position;
        for (let s = 1; s < 28; s++) {
          const k = s / 28, x = c.x + (L.p.x - c.x) * k, z = c.z + (L.p.z - c.z) * k, y = c.y + (L.p.y - c.y) * k;
          if (heightAt(x, z) > y + 0.05) { show = false; break; }
        }
      }
      if (show) {
        const d = c3.copy(L.p).sub(camera.position).length();
        show = d < 150;
      }
      if (show) {   // drop a label that would sit on top of one already placed
        const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h;
        for (const r of placed) if (Math.abs(r[0] - sx) < 120 && Math.abs(r[1] - sy) < 34) { show = false; break; }
        if (show) placed.push([sx, sy]);
      }
      L.el.style.opacity = show ? '1' : '0';
      if (show) L.el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v3.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%,-6px)`;
    }
  }
  const c3 = new THREE.Vector3();

  /* ---------- camera: named views, tour spline, drag ---------- */
  const VIEWS = {
    pampa:     { c: [-16.56, -72.50, 13],  t: [-16.15, -72.10, 1.2] },
    canal:     { c: [-15.99, -72.22, 13],  t: [-15.70, -71.92, 2.0] },
    canyon:    { c: [-15.56, -71.86, 12.5], t: [-15.66, -72.12, 1.5] },
    volcanoes: { c: [-16.25, -72.05, 17],  t: [-15.80, -72.05, 3.5] },
    orbit:     { c: [-17.20, -73.40, 38],  t: [-16.00, -72.30, 0] },
  };
  const view = (name) => {
    const v = VIEWS[name] || VIEWS.pampa;
    return { pos: ll(v.c[0], v.c[1], v.c[2]), tgt: ll(v.t[0], v.t[1], v.t[2]) };
  };
  const TOUR = ['pampa', 'canal', 'canyon', 'volcanoes', 'orbit'];
  const tourPos = new THREE.CatmullRomCurve3(TOUR.map((n) => view(n).pos), false, 'centripetal');
  const tourTgt = new THREE.CatmullRomCurve3(TOUR.map((n) => view(n).tgt), false, 'centripetal');
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const drift = { a: 0, on: o.mode === 'hero' && !reduced };
  let flight = null, tour = null;

  function applyCamera() {
    const off = c3.copy(camPos).sub(camTgt);
    if (drift.a) {
      const s = Math.sin(drift.a), c = Math.cos(drift.a);
      off.set(off.x * c - off.z * s, off.y, off.x * s + off.z * c);
    }
    camera.position.copy(camTgt).add(off);
    const g = heightAt(camera.position.x, camera.position.z) + 0.55;
    if (camera.position.y < g) camera.position.y = g;
    camera.lookAt(camTgt);
  }
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const setView = (v) => { camPos.copy(v.pos); camTgt.copy(v.tgt); };
  setView(view('pampa'));

  function setProgress(t) {
    t = Math.min(Math.max(+t || 0, 0), 1);
    tourPos.getPoint(t, camPos); tourTgt.getPoint(t, camTgt);
    drift.on = false; invalidate();
  }
  function flyTo(name, seconds) {
    const to = view(name), secs = seconds == null ? 3.2 : seconds;
    if (flight) flight.done();
    tour = null; drift.on = false;
    if (reduced || secs <= 0) { setView(to); invalidate(); return Promise.resolve(); }
    return new Promise((resolve) => {
      const from = { pos: camPos.clone(), tgt: camTgt.clone() };
      const dist = from.pos.distanceTo(to.pos);
      flight = { t0: performance.now(), dur: secs * 1000, from, to, arc: Math.min(dist * 0.12, 8), done: () => { flight = null; resolve(); } };
      invalidate();
    });
  }
  function playTour(seconds) {
    const secs = seconds == null ? 36 : seconds;
    if (flight) flight.done();
    if (reduced) { setProgress(0); return Promise.resolve(); }
    return new Promise((resolve) => {
      tour = { t0: performance.now(), dur: secs * 1000, done: () => { tour = null; resolve(); } };
      drift.on = false; invalidate();
    });
  }

  // drag to look around (only when interactive; page scroll stays free otherwise)
  const el = renderer.domElement;
  let drag = null;
  const sph = new THREE.Spherical();
  function onDown(e) {
    if (e.button > 0) return;
    if (flight) flight.done(); if (tour) tour.done();
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    el.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    c3.copy(camPos).sub(camTgt); sph.setFromVector3(c3);
    sph.theta -= dx * 0.0055; sph.phi = Math.min(Math.max(sph.phi - dy * 0.0045, 0.28), 1.5);
    c3.setFromSpherical(sph); camPos.copy(camTgt).add(c3); invalidate();
  }
  function onUp() { drag = null; el.style.cursor = o.interactive ? 'grab' : ''; }
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey)) return;    // plain wheel keeps scrolling the page
    e.preventDefault();
    c3.copy(camPos).sub(camTgt); sph.setFromVector3(c3);
    sph.radius = Math.min(Math.max(sph.radius * Math.exp(e.deltaY * 0.0012), 6), 140);
    c3.setFromSpherical(sph); camPos.copy(camTgt).add(c3); invalidate();
  }
  if (o.interactive) {
    el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
  } else {
    el.style.pointerEvents = 'none';
  }

  /* ---------- dry switch + render loop ---------- */
  let dryTarget = 0;
  function setDry(b) { dryTarget = b ? 1 : 0; if (reduced) canalU.uDry.value = dryTarget; invalidate(); }
  function widths() {
    const d = canalU.uDry.value, px = Math.min(window.devicePixelRatio || 1, dprCap);
    const wide = o.mode === 'hero' ? 1.0 : 1.15;
    canalCoreMat.uniforms.uWidth.value = px * wide * (4.6 - 2.8 * d);
    canalGlowMat.uniforms.uWidth.value = px * wide * (22 - 12 * d);
    riverMat.uniforms.uWidth.value = px * wide * 1.7;
    roadMat.uniforms.uWidth.value = px * 1.1;
    pointU.uPx.value = px;
  }

  let visible = true, tabVisible = !document.hidden, rafId = 0, last = performance.now();
  const active = () => !destroyed && visible && tabVisible;
  function invalidate() { if (!rafId && active()) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
  function frame(now) {
    rafId = 0;
    if (!active()) return;
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    let moving = false;
    if (flight) {
      const k = Math.min(Math.max((now - flight.t0) / flight.dur, 0), 1), e = ease(k);
      camPos.lerpVectors(flight.from.pos, flight.to.pos, e); camPos.y += Math.sin(Math.PI * e) * flight.arc;
      camTgt.lerpVectors(flight.from.tgt, flight.to.tgt, e);
      moving = true; if (k >= 1) flight.done();
    } else if (tour) {
      const k = Math.min(Math.max((now - tour.t0) / tour.dur, 0), 1), e = k < 0.04 ? ease(k / 0.04) * 0.04 : k;
      tourPos.getPoint(e, camPos); tourTgt.getPoint(e, camTgt);
      moving = true; if (k >= 1) tour.done();
    } else if (drift.on) {
      drift.a = Math.sin(now / 1000 * 0.11) * 0.09; moving = true;
    }
    const dd = dryTarget - canalU.uDry.value;
    if (Math.abs(dd) > 0.002) { canalU.uDry.value += dd * (1 - Math.exp(-dt * 3.2)); moving = true; }
    else canalU.uDry.value = dryTarget;
    T.time.value = now / 1000;
    U.uDry.value = canalU.uDry.value;
    widths();
    applyCamera();
    renderer.render(scene, camera);
    if (labels.length) updateLabels();
    if (moving || !reduced) rafId = requestAnimationFrame(frame);
  }

  function resize() {
    const w = Math.max(container.clientWidth, 1), h = Math.max(container.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    res.set(w * dpr, h * dpr);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', resize);
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); if (visible) invalidate(); }, { rootMargin: '80px' }) : null;
  if (io) io.observe(container);
  const onVis = () => { tabVisible = !document.hidden; if (tabVisible) invalidate(); };
  document.addEventListener('visibilitychange', onVis);

  let destroyed = false;
  if (Array.isArray(o.pixels)) setPixels(o.pixels);
  else if (o.showPixels) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
    fetch((o.apiBase || '') + '/api/model/irrigated?zone=majes', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((a) => { if (!destroyed) setPixels(a); })
      .catch(() => {}).finally(() => clearTimeout(to));
  }

  resize();
  renderer.render(scene, camera);   // first frame immediately so the host can fade in
  invalidate();

  return {
    setDry, setProgress, flyTo, playTour, resize, setPixels,
    setLang(l) { lang = l === 'en' ? 'en' : 'es'; setLabelText(); setCap(); invalidate(); },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (flight) flight.done(); if (tour) tour.done();
      tg.dispose(); terrainMat.dispose(); tex.dispose();
      for (const m of mats) m.dispose();
      for (const g of [canalGeo, river.geometry, road.geometry]) g.dispose();
      if (points) points.geometry.dispose();
      pointMat.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (_) {}
      root.remove();
    },
  };
}

const api = { isSupported, mount };
try { window.GreenOrbitTerrain = api; } catch (e) { /* non-window context */ }
export default api;
export { isSupported, mount };
