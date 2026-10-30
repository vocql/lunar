/* LUNAR – 3D space engine (three.js r128)
   Universes, 1,000 generated events and all objects are built in code: no image files. */
(function () {
  'use strict';

  /* ---------- event catalogue (works even without WebGL) ---------- */
  const COLORS = [['White', 0xffffff], ['Crimson', 0xff4d5e], ['Amber', 0xffa040], ['Golden', 0xffd86b], ['Emerald', 0x4dffa0],
    ['Cyan', 0x5ee7ff], ['Azure', 0x5b8cff], ['Violet', 0xa77bff], ['Magenta', 0xff5fd2], ['Solar', 0xfff1c9]];
  const MODS = [['Tiny', .5, 1], ['', 1, 1], ['Mega', 1.8, 1], ['Twin', 1, 2], ['Swarm', .6, 5]];
  const PRIMS = ['Warp', 'Hyperspace jump', 'Wormhole', 'Supernova', 'Black hole', 'Pulsar', 'Gamma-ray burst', 'Eclipse', 'Rogue planet', 'Satellite flyby',
    'Fireball barrage', 'Asteroid storm', 'Comet', 'Meteor shower', 'Galaxy spin', 'Star pulse', 'Core flare', 'Constellations', 'Shockwave', 'Starfall'];
  const EVENT_COUNT = PRIMS.length * MODS.length * COLORS.length; // 1000
  const parts = (id) => ({ p: Math.floor(id / 50), m: Math.floor(id / 10) % 5, c: id % 10 });
  function eventName(id) {
    const { p, m, c } = parts(id), prim = PRIMS[p].toLowerCase(), col = COLORS[c][0], mod = MODS[m][0];
    if (mod === 'Swarm') return `${col} ${prim} swarm`;
    if (mod) return `${mod} ${col.toLowerCase()} ${prim}`;
    return `${col} ${prim}`;
  }
  const eventColor = (id) => '#' + COLORS[id % 10][1].toString(16).padStart(6, '0');
  const PRESET_NAMES = [['home', 'Milky Way'], ['crimson', 'Crimson Expanse'], ['frost', 'Frost Reach'], ['gold', 'Golden Drift'],
    ['emerald', 'Emerald Void'], ['violet', 'Violet Abyss'], ['twin', 'Twin Suns'], ['silence', 'Dead Silence']];

  const flashEl = document.getElementById('flash');
  function flash(a, color) {
    if (!flashEl) return;
    flashEl.style.background = color || '#fff';
    flashEl.style.transition = 'none'; flashEl.style.opacity = a; void flashEl.offsetWidth;
    flashEl.style.transition = 'opacity .8s ease-out'; flashEl.style.opacity = 0;
  }
  function zeroG() {
    document.body.classList.remove('zerog'); void document.body.offsetWidth; document.body.classList.add('zerog');
    setTimeout(() => document.body.classList.remove('zerog'), 5200);
  }
  const loadJSON = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const settings = loadJSON('lunar-settings', {});

  const canvas = document.getElementById('space');
  let renderer = null;
  try {
    if (!window.THREE) throw new Error('three.js missing');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance' });
  } catch (e) {
    document.body.classList.add('no-webgl');
    const none = () => null;
    window.Space = { ok: false, EVENT_COUNT, PRIMS, eventName, eventColor, flash, zeroG, runEvent: none, randomEvent: none, combo: () => [],
      setCalm() {}, setMotion() {}, setQuality() {}, shake() {}, shootingStar() {},
      presets: PRESET_NAMES.map(([key, name]) => ({ key, name })), preview: (sel) => ({ name: sel && sel.preset ? (PRESET_NAMES.find((p) => p[0] === sel.preset) || [0, 'Universe'])[1] : 'Universe ' + (sel && sel.seed), swatches: [], traits: '' }),
      goUniverse() {}, current: () => ({ name: 'Milky Way', key: 'home' }), setOverride() {}, renderer: null,
      defense: { start() {}, stop() {}, pause() {}, resume() {}, click() { return false; } } };
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const QCAP = { low: .75, medium: 1, high: 1.5 };
  let qCap = QCAP[settings.quality] || 1.5;
  let curPR = Math.min(window.devicePixelRatio || 1, qCap);
  renderer.setPixelRatio(curPR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 1);
  const maxT = renderer.capabilities.maxTextureSize || 4096;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 4000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  /* ---------- helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash3(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L = (a, b, t) => a + (b - a) * t, c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v), L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
  }
  function fbm(x, y, z) { let s = 0, a = .5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= .5; } return s; }
  const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 1) + 1) % 1, Math.max(0, Math.min(1, s)), l);
  const WHITE = new THREE.Color(1, 1, 1);

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); }
  const softGlow = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.12, 'rgba(255,255,255,.65)'); gr.addColorStop(.35, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
  const spikeTex = canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 60);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'lighter';
    const h = g.createLinearGradient(0, 0, 256, 0); h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(.5, 'rgba(255,255,255,.9)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = h; g.fillRect(0, 127, 256, 2);
    const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(.5, 'rgba(255,255,255,.9)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(127, 0, 2, 256);
  });
  const streakTex = canvasTex(512, 64, (g) => {
    const lg = g.createLinearGradient(0, 0, 512, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.8, 'rgba(255,255,255,.5)'); lg.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = lg; g.fillRect(0, 0, 512, 64); g.globalCompositeOperation = 'destination-in';
    const vg = g.createLinearGradient(0, 0, 0, 64); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.5, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.fillRect(0, 0, 512, 64);
  });
  const ADD = THREE.AdditiveBlending;
  const spriteMat = (map, color, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: ADD, depthWrite: false });
  const plane = new THREE.PlaneGeometry(1, 1);
  const skySphere = new THREE.SphereGeometry(1500, 64, 48); skySphere.userData.keep = true;
  const UP = new THREE.Vector3(0, 1, 0);
  function disposeTree(o) { o.traverse((c) => { if (c.geometry && c.geometry !== plane && !c.geometry.userData.keep) c.geometry.dispose(); if (c.material && !c.material.userData.keep) c.material.dispose(); }); }

  const NOISE_GLSL = `
    float hh(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n3(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float s=0.0;float a=0.5;for(int i=0;i<6;i++){s+=a*n3(p);p*=2.02;a*=0.5;}return s;}`;

  /* ---------- shared materials ---------- */
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: ADD,
    uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uPR: { value: curPR }, uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uTime; uniform float uPulse; uniform float uPR; uniform vec3 uTint; uniform float uTintAmt; varying vec3 vCol;
      void main(){ float tw=0.72+0.28*sin(uTime*(1.2+aPhase*2.5)+aPhase*40.0);
        float br=max(max(aColor.r,aColor.g),aColor.b);
        vCol=mix(aColor,uTint*br,uTintAmt)*tw;
        gl_PointSize=aSize*uPR*(1.0+uPulse*2.2);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vCol; void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p); float a=smoothstep(0.5,0.0,d); a*=a; gl_FragColor=vec4(vCol*a,a); }`
  });
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  starMat.userData.keep = true; rockMat.userData.keep = true;

  function makeRockGeo(seed, detail) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, col = new Float32Array(p.count * 3);
    const s = seed * 13.37, st = [rand(.75, 1.25), rand(.65, 1), rand(.8, 1.3)];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = fbm(x * 1.6 + s, y * 1.6 + s, z * 1.6 + s), cr = vnoise(x * 4 + s, y * 4 + s, z * 4 + s);
      let r = .72 + n * .6; if (cr > .7) r -= (cr - .7) * .7;
      p.setXYZ(i, x * r * st[0], y * r * st[1], z * r * st[2]);
      const sh = .45 + n * .5 - (cr > .7 ? .14 : 0);
      col[i * 3] = sh * .94; col[i * 3 + 1] = sh * .88; col[i * 3 + 2] = sh * .82;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.userData.keep = true;
    return g;
  }
  const heroGeos = [1, 2, 3, 4].map((i) => makeRockGeo(i, 4));
  const gameGeos = [11, 12, 13, 14, 15].map((i) => makeRockGeo(i, 3));
  const beltGeo = makeRockGeo(42, 2);

  const dl = new THREE.DirectionalLight(0xfff1e0, 2.3); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0); scene.add(dl2);
  scene.add(new THREE.AmbientLight(0x1c2233, .35));

  /* ---------- universes ---------- */
  const PRESETS = {
    home: { name: 'Milky Way', seed: 101, classic: true, hue: .6, mwAmt: .42, dust: .88, galaxies: 1, planets: 1, binary: false, clusters: 3, belt: true, starSat: 0, rockTint: 0xffffff, heroes: 4 },
    crimson: { name: 'Crimson Expanse', seed: 202, hue: .99, starSat: .55, mwAmt: .5, planets: 2, galaxies: 1, binary: true, sunHue: .02, sunSat: .8, rockTint: 0xd08a78, clusters: 2 },
    frost: { name: 'Frost Reach', seed: 303, hue: .55, starSat: .45, mwAmt: .45, planets: 2, rings: true, galaxies: 2, rockTint: 0xbcd8ee, sunHue: .58, sunSat: .5, clusters: 4 },
    gold: { name: 'Golden Drift', seed: 404, hue: .11, starSat: .5, mwAmt: .55, galaxies: 3, planets: 1, rockTint: 0xd8c08a, sunHue: .12, sunSat: .7 },
    emerald: { name: 'Emerald Void', seed: 505, hue: .38, starSat: .45, mwAmt: .4, planets: 2, galaxies: 1, rockTint: 0x9cc8a8, sunHue: .3, sunSat: .4 },
    violet: { name: 'Violet Abyss', seed: 606, hue: .76, starSat: .5, mwAmt: .5, galaxies: 2, planets: 1, rockTint: 0xb4a0d8, sunHue: .8, sunSat: .5, clusters: 3 },
    twin: { name: 'Twin Suns', seed: 707, hue: .08, starSat: .3, mwAmt: .35, binary: true, planets: 3, galaxies: 0, rockTint: 0xc8b8a0, sunHue: .1, sunSat: .6 },
    silence: { name: 'Dead Silence', seed: 808, hue: 0, starSat: 0, mwAmt: .06, starCount: 2500, galaxies: 0, planets: 1, clusters: 0, belt: false, heroes: 2, rockTint: 0x888888, sunHue: 0, sunSat: 0, binary: false }
  };
  const SYL = ['ka', 'vel', 'or', 'the', 'ri', 'zan', 'mor', 'lys', 'qua', 'nex', 'tal', 'ion', 'sar', 'dra', 'ven', 'oth', 'ae', 'kor', 'syl', 'umi', 'rha', 'ce'];
  const SUF = ['Expanse', 'Reach', 'Drift', 'Void', 'Cluster', 'Abyss', 'Rift', 'Halo', 'Deep', 'Veil', 'Field', 'Sea', 'Fold', 'Wake'];
  function genName(r) { let w = ''; const n = 2 + (r() < .4 ? 1 : 0); for (let i = 0; i < n; i++) w += SYL[Math.floor(r() * SYL.length)]; return w[0].toUpperCase() + w.slice(1) + ' ' + SUF[Math.floor(r() * SUF.length)]; }

  function makeCfg(o) {
    o = o || {};
    const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 1e6), r = mulberry32(seed + 99), R = (a, b) => a + r() * (b - a);
    const h = o.hue != null ? o.hue : r(), cl = !!o.classic;
    const pickN = (v, a, b) => (v != null ? v : Math.floor(R(a, b)));
    const bandN = cl ? new THREE.Vector3(.28, 1, .42).normalize() : new THREE.Vector3(R(-.6, .6), 1, R(-.7, .7)).normalize();
    const core = cl ? new THREE.Vector3(-.55, -.12, -1).normalize() : new THREE.Vector3(R(-1, 1), R(-.3, .1), -1).normalize();
    core.sub(bandN.clone().multiplyScalar(core.dot(bandN))).normalize();
    const sunDir = cl ? new THREE.Vector3(1, .3, -.45).normalize() : new THREE.Vector3(R(.4, 1) * (r() < .5 ? -1 : 1), R(.1, .5), R(-.8, -.2)).normalize();
    const anchors = [[-470, -175, -860], [540, 230, -950], [-660, 300, -1000], [320, -320, -820], [820, -40, -1080], [-880, 40, -920]];
    if (!cl) for (let i = anchors.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [anchors[i], anchors[j]] = [anchors[j], anchors[i]]; }
    const planets = [];
    for (let i = 0, n = pickN(o.planets, 0, 3.3); i < n; i++) {
      const ph = h + R(-.15, .15);
      planets.push(cl ? { pos: anchors[0], radius: 40, c1: new THREE.Color(.55, .45, .33), c2: new THREE.Color(.86, .78, .62), bands: 38, rings: true, ringColor: new THREE.Color(.78, .72, .6), tilt: [.38, 0, .32] }
        : { pos: anchors[i], radius: R(20, 58), c1: hsl(ph, R(.25, .6), R(.22, .38)), c2: hsl(ph + R(-.05, .05), R(.2, .5), R(.6, .8)), bands: R(14, 60),
          rings: o.rings != null ? o.rings : r() < .55, ringColor: hsl(ph, R(.1, .4), R(.55, .75)), tilt: [R(-.6, .6), 0, R(-.5, .5)] });
    }
    const galaxies = [];
    for (let i = 0, n = pickN(o.galaxies, 0, 3.3); i < n; i++) {
      const a = anchors[anchors.length - 1 - i];
      galaxies.push(cl ? { pos: [-520, 330, -1050], arms: 2, size: 120, tilt: [1.05, 0, .5], coreCol: new THREE.Color(1, .85, .7), armCol: new THREE.Color(.6, .75, 1) }
        : { pos: [a[0] * 1.15, a[1] + 120, a[2] * 1.1], arms: 2 + Math.floor(R(0, 4)), size: R(90, 150), tilt: [R(.6, 1.3), 0, R(-.6, .6)], coreCol: hsl(h + .1, .5, .8), armCol: hsl(h - .05, R(.3, .6), .75) });
    }
    return {
      seed, key: o.key || null, name: o.name || genName(r), classic: cl, hue: h,
      starSat: o.starSat != null ? o.starSat : R(0, .6), starCount: o.starCount || Math.floor(R(5000, 9000)), bandFrac: R(.35, .6),
      bandN, core, mwCool: cl ? new THREE.Color(.62, .70, .92) : hsl(h, R(.3, .6), .72), mwWarm: cl ? new THREE.Color(1, .82, .6) : hsl(h + R(.04, .12), R(.4, .7), .72),
      mwAmt: o.mwAmt != null ? o.mwAmt : R(.25, .6), dust: o.dust != null ? o.dust : R(.4, .95),
      sunDir, sunColor: cl ? new THREE.Color(1, .96, .88) : hsl(o.sunHue != null ? o.sunHue : r(), o.sunSat != null ? o.sunSat : R(.1, .8), .88), sunSize: cl ? 70 : R(40, 110),
      binary: o.binary != null ? o.binary : r() < .22, sun2Dir: new THREE.Vector3(-sunDir.x * .6 + R(-.2, .2), R(.1, .5), -1).normalize(), sun2Color: hsl(R(0, 1), R(.3, .9), .8),
      planets, galaxies, clusters: pickN(o.clusters, 0, 5), clusterColor: cl ? new THREE.Color(.75, .83, 1) : hsl(h + .5, R(.2, .5), .85),
      rockTint: new THREE.Color(o.rockTint != null ? o.rockTint : hsl(h, R(0, .35), R(.55, .85)).getHex()),
      belt: o.belt != null ? o.belt : r() < .75, beltCount: Math.floor(R(180, 420)), heroes: pickN(o.heroes, 2, 5)
    };
  }
  function resolve(sel) {
    if (sel && sel.preset && PRESETS[sel.preset]) return Object.assign({ key: sel.preset }, PRESETS[sel.preset]);
    if (sel && sel.seed != null) return { seed: sel.seed };
    return Object.assign({ key: 'home' }, PRESETS.home);
  }
  function describe(cfg) {
    const t = [];
    t.push(cfg.planets.length === 1 ? '1 planet' : `${cfg.planets.length} planets`);
    t.push(cfg.galaxies.length === 1 ? '1 galaxy' : `${cfg.galaxies.length} galaxies`);
    if (cfg.binary) t.push('twin suns');
    if (cfg.belt) t.push('asteroid belt');
    return t.join(', ');
  }
  function preview(sel) {
    const c = makeCfg(resolve(sel)), star = c.classic ? '#cad7ff' : '#' + hsl(c.hue, c.starSat, .78).getHexString();
    return { name: c.name, seed: c.seed, key: c.key, traits: describe(c), swatches: [star, '#' + c.mwWarm.getHexString(), '#' + c.sunColor.getHexString(), c.planets[0] ? '#' + c.planets[0].c2.getHexString() : '#222'] };
  }

  function makePlanet(pc, sunDirRef) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(pc.radius, 64, 48), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDirRef }, uC1: { value: pc.c1 }, uC2: { value: pc.c2 }, uB: { value: pc.bands } },
      vertexShader: `varying vec3 vN; varying vec3 vL; void main(){ vN=normalize(mat3(modelMatrix)*normal); vL=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: NOISE_GLSL + `uniform vec3 uSun; uniform vec3 uC1; uniform vec3 uC2; uniform float uB; varying vec3 vN; varying vec3 vL;
        void main(){ vec3 p=normalize(vL); float lat=p.y+(fbm(p*6.0)-0.5)*0.08;
          float b=0.5+0.5*sin(lat*uB)+0.25*sin(lat*uB*2.4);
          vec3 col=mix(uC1,uC2,clamp(b,0.0,1.0));
          float diff=smoothstep(0.0,0.6,max(dot(normalize(vN),uSun),0.0));
          gl_FragColor=vec4(col*diff*0.9,1.0); }`
    }));
    g.add(body);
    if (pc.rings) {
      const ri = pc.radius * 1.4, ro = pc.radius * 2.45;
      const ring = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 160, 1), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uC: { value: pc.ringColor }, uI: { value: ri }, uO: { value: ro } },
        vertexShader: `varying float vR; void main(){ vR=length(position.xy); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uC; uniform float uI; uniform float uO; varying float vR;
          void main(){ float t=(vR-uI)/(uO-uI); float a=0.55+0.3*sin(t*80.0)+0.15*sin(t*230.0);
            a*=smoothstep(0.0,0.05,t)*smoothstep(1.0,0.9,t); if(t>0.55&&t<0.6) a*=0.1;
            gl_FragColor=vec4(uC*0.75,a*0.75); }`
      }));
      ring.rotation.x = -Math.PI / 2; g.add(ring);
    }
    return g;
  }
  function makeGalaxy(gc) {
    const g = new THREE.Group(), N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N);
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const arm = i % gc.arms, r = Math.pow(Math.random(), .7) * 120;
      const a = arm * 6.2831853 / gc.arms + r * .055 + gauss() * (.32 - r / 600);
      pos.set([Math.cos(a) * r + gauss() * 3, gauss() * (6 - r / 30), Math.sin(a) * r + gauss() * 3], i * 3);
      tmp.copy(gc.coreCol).lerp(gc.armCol, r / 120).multiplyScalar(.5 + Math.random() * .5);
      col.set([tmp.r, tmp.g, tmp.b], i * 3); size[i] = 1 + Math.random() * 1.3; ph[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    g.add(new THREE.Points(geo, starMat));
    const core = new THREE.Sprite(spriteMat(softGlow, gc.coreCol, .55)); core.scale.setScalar(70); g.add(core);
    g.position.set(gc.pos[0], gc.pos[1], gc.pos[2]); g.rotation.set(gc.tilt[0], gc.tilt[1], gc.tilt[2]); g.scale.setScalar(gc.size / 120);
    return g;
  }

  const PAL = [[155,176,255],[170,191,255],[202,215,255],[248,247,255],[255,244,234],[255,210,161],[255,204,111]], PW = [.05,.08,.17,.3,.22,.12,.06];
  function classicColor() { let r = Math.random(), i = 0; while (i < PW.length - 1 && (r -= PW[i]) > 0) i++; return new THREE.Color(PAL[i][0] / 255, PAL[i][1] / 255, PAL[i][2] / 255); }

  let U = null;
  function buildUniverse(cfg) {
    if (U) { scene.remove(U.group); disposeTree(U.group); U.rt.dispose(); }
    const group = new THREE.Group(), sky = new THREE.Group(); scene.add(group); group.add(sky);
    // Milky Way baked once into a texture
    const TW = Math.min(qCap < 1 ? 2048 : 4096, maxT), rt = new THREE.WebGLRenderTarget(TW, TW / 2, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    const bakeMat = new THREE.ShaderMaterial({
      uniforms: { uN: { value: cfg.bandN }, uCore: { value: cfg.core }, uCool: { value: cfg.mwCool }, uWarm: { value: cfg.mwWarm }, uAmt: { value: cfg.mwAmt }, uDust: { value: cfg.dust } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: NOISE_GLSL + `uniform vec3 uN; uniform vec3 uCore; uniform vec3 uCool; uniform vec3 uWarm; uniform float uAmt; uniform float uDust; varying vec2 vUv;
        void main(){
          float ph=vUv.x*6.2831853; float th=(1.0-vUv.y)*3.1415927; vec3 d=vec3(-cos(ph)*sin(th),cos(th),sin(ph)*sin(th));
          float lat=dot(d,uN); float wl=lat+(fbm(d*4.0)-0.5)*0.12;
          float band=exp(-(wl*wl)/(0.13*0.13));
          float c=max(dot(normalize(d-uN*lat),uCore),0.0);
          float core=pow(c,10.0)*exp(-(lat*lat)/(0.22*0.22));
          float cloud=fbm(d*5.0+2.0); float fine=fbm(d*18.0); float dn=fbm(d*7.0+vec3(9.1,3.3,1.7));
          float dl=lat-0.015; float dust=smoothstep(0.42,0.7,dn)*exp(-(dl*dl)/(0.06*0.06))*uDust;
          float lum=band*(0.18+0.9*cloud*cloud)*(0.5+0.7*fine)+core*(0.8+cloud);
          lum*=1.0-0.88*dust;
          vec3 col=mix(uCool,uWarm,clamp(core*1.6+(cloud-0.5)*0.6,0.0,1.0))*lum;
          col+=vec3(pow(n3(d*260.0),22.0)*band*6.0);
          col=max(col*uAmt-vec3(0.025),vec3(0.0));
          gl_FragColor=vec4(col,1.0); }`
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat), bs = new THREE.Scene(); q.frustumCulled = false; bs.add(q);
    renderer.setRenderTarget(rt); renderer.render(bs, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)); renderer.setRenderTarget(null);
    q.geometry.dispose(); bakeMat.dispose();
    rt.texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const mwMat = new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.BackSide, depthWrite: false });
    const mw = new THREE.Mesh(skySphere, mwMat); mw.renderOrder = -1; sky.add(mw);

    // stars
    const N = cfg.starCount, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N), v = new THREE.Vector3();
    const starCol = () => (cfg.classic ? classicColor() : Math.random() < .3 ? new THREE.Color(.97, .97, 1) : hsl(cfg.hue + gauss() * .06, cfg.starSat * rand(.5, 1.2), .8));
    for (let i = 0; i < N; i++) {
      v.set(gauss(), gauss(), gauss()).normalize();
      if (i < N * cfg.bandFrac) { const lat = v.dot(cfg.bandN); v.addScaledVector(cfg.bandN, gauss() * .085 - lat).normalize(); }
      v.multiplyScalar(1300); pos.set([v.x, v.y, v.z], i * 3);
      const m = Math.pow(Math.random(), 7), c = starCol(), b = .35 + .65 * Math.min(1, m * 3 + .2);
      col.set([c.r * b, c.g * b, c.b * b], i * 3); size[i] = 1.1 + m * 5.5; ph[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); sg.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    sky.add(new THREE.Points(sg, starMat));
    const brightStars = [];
    for (let i = 0; i < Math.round(N / 190); i++) {
      v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(1250);
      const s = new THREE.Sprite(spriteMat(spikeTex, starCol(), rand(.55, 1))); s.position.copy(v); s.scale.setScalar(rand(16, 42)); sky.add(s); brightStars.push(s);
    }
    // suns
    const sunDir = cfg.sunDir.clone();
    const sun = new THREE.Group(); sun.position.copy(sunDir).multiplyScalar(1200); group.add(sun);
    const sunCore = new THREE.Sprite(spriteMat(softGlow, cfg.sunColor, 1)); sunCore.scale.setScalar(cfg.sunSize); sun.add(sunCore);
    const sunHalo = new THREE.Sprite(spriteMat(softGlow, cfg.sunColor, .05)); sunHalo.scale.setScalar(cfg.sunSize * 6); sun.add(sunHalo);
    dl.color.copy(cfg.sunColor); dl.position.copy(sunDir); dl.intensity = 2.3;
    if (cfg.binary) {
      const s2 = new THREE.Sprite(spriteMat(softGlow, cfg.sun2Color, 1)); s2.position.copy(cfg.sun2Dir).multiplyScalar(1200); s2.scale.setScalar(cfg.sunSize * .7); group.add(s2);
      dl2.color.copy(cfg.sun2Color); dl2.position.copy(cfg.sun2Dir); dl2.intensity = 1.2;
    } else dl2.intensity = 0;
    // galaxies, planets, clusters
    const galaxies = cfg.galaxies.map((gc) => { const g = makeGalaxy(gc); group.add(g); return g; });
    const planets = cfg.planets.map((pc) => { const g = makePlanet(pc, sunDir); g.position.set(pc.pos[0], pc.pos[1], pc.pos[2]); g.rotation.set(pc.tilt[0], pc.tilt[1], pc.tilt[2]); group.add(g); return g; });
    const cAnch = [[380, 360, -1150], [-900, -120, -700], [700, -380, -900], [-300, 420, -1100], [950, 150, -800]];
    for (let k = 0; k < cfg.clusters; k++) {
      const [x, y, z] = cAnch[k];
      for (let i = 0; i < 18; i++) {
        const s = new THREE.Sprite(spriteMat(i < 6 ? spikeTex : softGlow, cfg.clusterColor, rand(.5, 1)));
        s.position.set(x + gauss() * 14, y + gauss() * 10, z + gauss() * 14); s.scale.setScalar(i < 6 ? rand(14, 26) : rand(3, 7)); group.add(s);
      }
    }
    // asteroids
    rockMat.color.copy(cfg.rockTint);
    const beltGroup = new THREE.Group();
    if (cfg.belt) {
      const belt = new THREE.InstancedMesh(beltGeo, rockMat, cfg.beltCount), d = new THREE.Object3D();
      for (let i = 0; i < cfg.beltCount; i++) {
        const a = Math.random() * 6.2831853, r = rand(360, 520);
        d.position.set(Math.cos(a) * r, gauss() * 8, Math.sin(a) * r); d.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
        d.scale.setScalar(Math.pow(Math.random(), 3) * 6 + .8); d.updateMatrix(); belt.setMatrixAt(i, d.matrix);
      }
      belt.frustumCulled = false; beltGroup.add(belt);
      beltGroup.position.set(rand(-60, 60), -140, -520); beltGroup.rotation.set(rand(.2, .45), 0, rand(-.25, .25));
      group.add(beltGroup);
    }
    const heroes = [];
    [[-42, 16, -80, 7], [52, -24, -110, 10], [-75, -38, -170, 13], [88, 40, -210, 9], [10, 60, -260, 8]].slice(0, cfg.heroes).forEach(([x, y, z, s], i) => {
      const m = new THREE.Mesh(heroGeos[i % 4], rockMat); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(rand(0, 6), rand(0, 6), 0); group.add(m);
      heroes.push({ m, rx: rand(-.12, .12), ry: rand(-.15, .15), base: y, ph: rand(0, 6) });
    });
    U = { cfg, group, sky, rt, mwMat, sunDir, sunHalo, brightStars, galaxies, planets, beltGroup, heroes };
  }

  /* ---------- satellites, fireballs ---------- */
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: .8, roughness: .35 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: .3 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x18223d, metalness: .6, roughness: .25, emissive: 0x05070d });
  const radMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: .6 });
  [metal, foil, panelMat, radMat].forEach((m) => (m.userData.keep = true));
  const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 20), dish: new THREE.CylinderGeometry(1.1, .2, .5, 24) };
  Object.values(G).forEach((g) => (g.userData.keep = true));
  const part = (geo, mat, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); return m; };
  function makeSatellite() {
    const g = new THREE.Group(); g.add(part(G.box, foil, 1.4, 1.4, 2));
    const dish = new THREE.Mesh(G.dish, metal); dish.position.z = 1.4; dish.rotation.x = Math.PI / 2; g.add(dish);
    [-1, 1].forEach((sd) => { const p = part(G.box, panelMat, 4.5, .05, 1.6); p.position.x = sd * 3.1; g.add(p); });
    return g;
  }
  function makeStation() {
    const g = new THREE.Group(); g.add(part(G.box, metal, 18, .45, .45));
    for (let i = 0; i < 3; i++) { const m = part(G.cyl, metal, .75, 3.4, .75); m.rotation.x = Math.PI / 2; m.position.set(-1.2 + i * 1.2, 0, 1.9 + (i === 1 ? .8 : 0)); g.add(m); }
    [-8, -5.5, 5.5, 8].forEach((x) => [-1, 1].forEach((sd) => { const p = part(G.box, panelMat, 2, .05, 6); p.position.set(x, 0, sd * 3.4); g.add(p); }));
    [-3, 3].forEach((x) => { const r = part(G.box, radMat, 1.2, .04, 3); r.position.set(x, 0, -2); g.add(r); });
    return g;
  }
  const craft = [];
  function spawnCraft(swarm, blinkColor) {
    const station = Math.random() < .4, g = station ? makeStation() : makeSatellite();
    const blink = new THREE.Sprite(spriteMat(softGlow, blinkColor || 0xff5040, 1)); blink.scale.setScalar(1.6); blink.position.y = .8; g.add(blink);
    const z = rand(-170, -110), hw = Math.tan(THREE.MathUtils.degToRad(30)) * -z * camera.aspect, left = Math.random() < .5;
    g.position.set((left ? -hw * 1.3 : hw * 1.3) * (swarm ? rand(1, 1.6) : 1), swarm ? rand(-60, 60) : rand(-25, 35), z);
    g.rotation.set(rand(-.6, .6), rand(0, 6), rand(-.4, .4)); g.scale.setScalar(station ? 1 : 1.3); scene.add(g);
    craft.push({ g, blink, v: new THREE.Vector3((left ? 1 : -1) * hw * 2.6 / (swarm ? rand(9, 15) : rand(45, 70)), rand(-.3, .3), 0), spin: rand(-.08, .08), t: 0 });
  }
  function updateCraft(dt, T) {
    for (let i = craft.length - 1; i >= 0; i--) {
      const c = craft[i]; c.t += dt; c.g.position.addScaledVector(c.v, dt); c.g.rotation.y += c.spin * dt;
      c.blink.material.opacity = (T * 1.2 % 1) < .12 ? 1 : 0;
      if (Math.abs(c.g.position.x) > 420 || c.t > 90) { scene.remove(c.g); c.blink.material.dispose(); craft.splice(i, 1); }
    }
  }

  /* ---------- shooting stars ---------- */
  const streaks = [];
  function spawnStreak(opt = {}) {
    const dir = new THREE.Vector3(rand(-1.1, 1.1), rand(-.25, .85), -1).normalize();
    const grp = new THREE.Group(); grp.position.copy(dir).multiplyScalar(opt.dist || 900); grp.lookAt(0, 0, 0);
    const pivot = new THREE.Group(); pivot.rotation.z = opt.angle != null ? opt.angle + rand(-.12, .12) : rand(0, 6.283); grp.add(pivot);
    const mat = new THREE.MeshBasicMaterial({ map: streakTex, color: opt.color || 0xffffff, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
    const len = rand(90, 240) * (opt.fast ? 1.25 : 1), m = new THREE.Mesh(plane, mat);
    m.scale.set(len, len * .03, 1); m.position.x = -len; pivot.add(m); scene.add(grp);
    streaks.push({ grp, m, mat, t: 0, dur: rand(.55, 1.1), speed: rand(500, 900) * (opt.fast ? 1.5 : 1) });
  }
  function updateStreaks(dt) {
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]; s.t += dt; const p = s.t / s.dur;
      s.m.position.x += s.speed * dt; s.mat.opacity = Math.sin(Math.min(1, p) * Math.PI);
      if (p >= 1) { scene.remove(s.grp); s.mat.dispose(); streaks.splice(i, 1); }
    }
  }

  /* ---------- warp lines ---------- */
  const WN = 900, wPos = new Float32Array(WN * 6), wData = [];
  for (let i = 0; i < WN; i++) { const a = rand(0, 6.283), r = rand(5, 70); wData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: rand(-700, -10) }); }
  const wGeo = new THREE.BufferGeometry(); wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  const wMat = new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, blending: ADD, depthWrite: false });
  const warpLines = new THREE.LineSegments(wGeo, wMat); warpLines.frustumCulled = false; camera.add(warpLines);
  function updateWarp(dt, w) {
    wMat.opacity = Math.min(1, w) * .9; warpLines.visible = w > .01; if (!warpLines.visible) return;
    const sp = w * 900, len = 2 + w * 90;
    wData.forEach((d, i) => { d.z += sp * dt; if (d.z > -6) d.z = -700; wPos.set([d.x, d.y, d.z, d.x, d.y, d.z - len], i * 6); });
    wGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- envelopes + effects ---------- */
  const envs = [], fx = [];
  let shake = 0, calm = false, motion = settings.motion !== false;
  function env(type, dur, color, str) { envs.push({ type, t: 0, dur, color: color ? color.clone() : null, str: str || 1 }); }
  function envK(e) { const p = e.t / e.dur; return Math.max(0, Math.min(1, p * 5, (1 - p) * 3)); }
  function level(type) { let v = 0; for (const e of envs) if (e.type === type) v = Math.max(v, envK(e) * e.str); return v; }
  function strongest(type) { let best = null, v = 0; for (const e of envs) if (e.type === type && envK(e) * e.str > v) { v = envK(e) * e.str; best = e; } return best; }
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const later = (delay, fn) => { let t = 0; fx.push({ update(dt) { t += dt; if (t >= delay) { fn(); return false; } return true; } }); };
  const skyPoint = (dist, y0 = -.1, y1 = .6) => new THREE.Vector3(rand(-.8, .8), rand(y0, y1), -1).normalize().multiplyScalar(dist);
  const cssHex = (c) => '#' + c.getHexString();

  function explode(pos, color, scale = 1) {
    const n = 80, g = new THREE.BufferGeometry(), arr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { arr.set([pos.x, pos.y, pos.z], i * 3); vel.push(new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(rand(8, 46) * scale)); }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ size: 1.8 * scale, map: softGlow, color, transparent: true, depthWrite: false, blending: ADD });
    const pts = new THREE.Points(g, mat), fl = new THREE.Sprite(spriteMat(softGlow, color, .9)); fl.position.copy(pos); scene.add(pts, fl);
    let t = 0;
    fx.push({ update(dt) {
      t += dt;
      for (let i = 0; i < n; i++) { arr[i * 3] += vel[i].x * dt; arr[i * 3 + 1] += vel[i].y * dt; arr[i * 3 + 2] += vel[i].z * dt; vel[i].multiplyScalar(.975); }
      g.attributes.position.needsUpdate = true; mat.opacity = Math.max(0, 1 - t / 1.2);
      fl.scale.setScalar(scale * (6 + t * 40)); fl.material.opacity = Math.max(0, .9 - t * 2.4);
      if (t > 1.2) { scene.remove(pts, fl); g.dispose(); mat.dispose(); fl.material.dispose(); return false; }
      return true;
    } });
  }
  function beamPair(len, width, color) {
    const pivot = new THREE.Group();
    [0, Math.PI].forEach((r) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: streakTex, color, transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      const arm = new THREE.Group(); arm.rotation.z = r; m.scale.set(len, width, 1); m.position.x = len / 2; m.rotation.z = Math.PI; arm.add(m); pivot.add(arm);
    });
    return pivot;
  }
  const eachMat = (o, f) => o.traverse((c) => { if (c.material) f(c.material); });
  function timed(obj, dur, step, parent) {
    (parent || scene).add(obj); let t = 0;
    fx.push({ update(dt) { t += dt; step(t, Math.min(1, t / dur), dt); if (t >= dur) { (parent || scene).remove(obj); disposeTree(obj); return false; } return true; } });
  }

  /* ---------- the 20 event primitives: (color, scale) ---------- */
  function fireball(c) {
    const z = rand(-420, -260), hw = Math.tan(THREE.MathUtils.degToRad(30)) * -z * camera.aspect;
    const left = Math.random() < .5, a = (left ? 0 : Math.PI) + (left ? -1 : 1) * rand(.25, .55);
    const g = new THREE.Group(); g.position.set(left ? -hw * 1.2 : hw * 1.2, rand(40, 160), z);
    const vel = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(hw * 2.4 / rand(2.2, 3.2));
    const pivot = new THREE.Group(); pivot.rotation.z = a; g.add(pivot);
    const tail = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: streakTex, color: c || 0xffa860, transparent: true, opacity: .95, blending: ADD, depthWrite: false }));
    tail.scale.set(140, 9, 1); tail.position.x = -70; pivot.add(tail);
    const rock = new THREE.Mesh(gameGeos[0], rockMat); rock.scale.setScalar(2.2); g.add(rock);
    const glow = new THREE.Sprite(spriteMat(softGlow, c || 0xffb070, 1)); glow.scale.setScalar(20); g.add(glow);
    timed(g, 4, (t, p, dt) => { g.position.addScaledVector(vel, dt); rock.rotation.x += dt * 3; glow.scale.setScalar(18 + Math.sin(t * 40) * 2); });
  }
  const P = [
    /* Warp */ (c, s) => env('warp', 3 * Math.max(.8, s), c, Math.min(1.4, s)),
    /* Hyperspace */ (c, s) => { env('warp', 3, c, 1); later(2.5, () => { flash(.85, cssHex(c)); shake = .8 * s; env('flare', 2.5, c, s); }); },
    /* Wormhole */ (c, s) => {
      const g = new THREE.Group(), rings = [];
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(13 * s, 13.8 * s, 64), new THREE.MeshBasicMaterial({ color: i % 3 ? c : WHITE, transparent: true, opacity: 0, blending: ADD, depthWrite: false, side: THREE.DoubleSide }));
        m.position.z = -20 - i * 22; g.add(m); rings.push(m);
      }
      env('warp', 4.5, c, .9); shake = .5;
      timed(g, 4.5, (t, p, dt) => { const k = Math.max(0, Math.min(1, t * 3, (4.5 - t) * 2));
        rings.forEach((m, i) => { m.position.z += dt * 260; if (m.position.z > -6) m.position.z -= 572; const z = -m.position.z;
          m.position.x = Math.sin(z * .012 + t * 2) * 10; m.position.y = Math.cos(z * .01 + t * 1.6) * 7; m.rotation.z += dt * (i % 2 ? 1 : -1);
          m.material.opacity = k * Math.min(1, z / 60) * Math.max(0, 1 - z / 560); }); }, camera);
    },
    /* Supernova */ (c, s) => {
      const g = new THREE.Group(); g.position.copy(skyPoint(800)); g.lookAt(0, 0, 0);
      const core = new THREE.Sprite(spriteMat(softGlow, WHITE, 1)), halo = new THREE.Sprite(spriteMat(softGlow, c, .5));
      const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 128), new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: ADD, depthWrite: false, side: THREE.DoubleSide }));
      g.add(core, halo, ring);
      timed(g, 3.2, (t, q) => { core.scale.setScalar((20 + 260 * ease(Math.min(1, t / .35)) * (1 - q * .7)) * s); core.material.opacity = 1 - q;
        halo.scale.setScalar((80 + 900 * ease(q)) * s); halo.material.opacity = .5 * (1 - q); ring.scale.setScalar((10 + 650 * ease(q)) * s); ring.material.opacity = .9 * (1 - q); });
      flash(.5 * Math.min(1, s), cssHex(c)); shake = Math.max(shake, s);
    },
    /* Black hole */ (c, s) => {
      const g = new THREE.Group(); g.position.set(rand(-60, 60), rand(-15, 30), -230);
      const hole = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      const diskMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uCol: { value: c.clone() } },
        vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform float uFade; uniform vec3 uCol; varying vec3 vP;
          void main(){ float r=length(vP.xy); float a=atan(vP.y,vP.x); float t=clamp((r-16.0)/44.0,0.0,1.0);
            float s=0.55+0.45*sin(a*6.0-uTime*3.0+r*0.35)*sin(a*2.0+uTime*1.1-r*0.12);
            float b=pow(1.0-t,2.4)*(0.35+0.9*s); vec3 col=mix(uCol,vec3(1.0,0.97,0.9),pow(1.0-t,5.0));
            gl_FragColor=vec4(col*b*uFade,1.0); }` });
      const disk = new THREE.Mesh(new THREE.RingGeometry(16, 60, 160, 1), diskMat); disk.rotation.x = -1.22;
      const photon = new THREE.Mesh(new THREE.RingGeometry(14.1, 16, 128), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      const glow = new THREE.Sprite(spriteMat(softGlow, c, 0)); glow.scale.setScalar(190);
      g.add(glow, disk, hole, photon); shake = .6;
      timed(g, 5.5, (t, p, dt) => { const k = Math.max(0, Math.min(1, p * 4, (1 - p) * 3));
        g.scale.setScalar((.2 + .8 * ease(k)) * s); diskMat.uniforms.uTime.value += dt; diskMat.uniforms.uFade.value = k;
        photon.material.opacity = k * .9; glow.material.opacity = k * .35; disk.rotation.z += dt * .4; });
    },
    /* Pulsar */ (c, s) => {
      const g = new THREE.Group(); g.position.copy(skyPoint(700)); g.lookAt(0, 0, 0);
      const core = new THREE.Sprite(spriteMat(softGlow, WHITE, 1)), beams = beamPair(420 * s, 18 * s, c); g.add(core, beams);
      timed(g, 5.5, (t, p, dt) => { const k = Math.max(0, Math.min(1, t * 2, (5.5 - t) * 2));
        beams.rotation.z += dt * 4 * (1 + s); core.scale.setScalar((26 + Math.abs(Math.sin(t * 11)) * 22) * k * s); eachMat(beams, (m) => { m.opacity = k * .85; }); });
    },
    /* Gamma-ray burst */ (c, s) => {
      const g = new THREE.Group(); g.position.copy(skyPoint(650, 0, .5)); g.lookAt(0, 0, 0);
      const beams = beamPair(1100 * s, 10 * s, c); beams.rotation.z = rand(0, 3.14); const core = new THREE.Sprite(spriteMat(softGlow, WHITE, 1)); g.add(beams, core);
      timed(g, 3, (t, p) => { const k = 1 - p; beams.scale.set(1, 1 + p * 6, 1); eachMat(beams, (m) => { m.opacity = k; }); core.scale.setScalar((40 + 200 * Math.sin(Math.min(1, p * 3) * Math.PI / 2) * k) * s); });
      flash(.45, cssHex(c)); shake = Math.max(shake, .7 * s);
    },
    /* Eclipse */ (c, s) => {
      const sd = U.sunDir, right = new THREE.Vector3().crossVectors(sd, UP).normalize(), g = new THREE.Group();
      const disk = new THREE.Mesh(new THREE.CircleGeometry(15 * s, 64), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      const corona = new THREE.Sprite(spriteMat(spikeTex, c, 0)); corona.scale.setScalar(190 * s); corona.position.copy(sd).multiplyScalar(1190);
      const ringC = new THREE.Sprite(spriteMat(softGlow, c, 0)); ringC.scale.setScalar(70 * s); ringC.position.copy(corona.position);
      g.add(disk, corona, ringC);
      timed(g, 7, (t, p) => { const off = (p - .5) * 90 * s; disk.position.copy(sd).multiplyScalar(1100).addScaledVector(right, off); disk.lookAt(0, 0, 0);
        const tot = Math.max(0, 1 - Math.abs(off) / (14 * s)); corona.material.opacity = tot; ringC.material.opacity = tot * .5;
        dl.intensity = 2.3 * (1 - tot * .85); if (p >= 1) dl.intensity = 2.3; });
    },
    /* Rogue planet */ (c, s) => {
      const pc = { radius: 30 * s, c1: c.clone().multiplyScalar(.4), c2: c.clone().lerp(WHITE, .45), bands: rand(18, 50), rings: Math.random() < .6, ringColor: c.clone().lerp(WHITE, .3) };
      const g = makePlanet(pc, U.sunDir), left = Math.random() < .5, z = -360, hw = Math.tan(THREE.MathUtils.degToRad(30)) * -z * camera.aspect;
      const from = new THREE.Vector3(left ? -hw - 100 * s : hw + 100 * s, rand(-60, 60), z), to = new THREE.Vector3(-from.x, rand(-60, 60), z);
      g.rotation.set(rand(-.5, .5), 0, rand(-.5, .5));
      timed(g, 10, (t, p, dt) => { g.position.lerpVectors(from, to, p); g.rotation.y += dt * .1; });
    },
    /* Satellite flyby */ (c, s) => { for (let i = 0; i < Math.round(2 + 3 * s); i++) spawnCraft(true, c); },
    /* Fireball barrage */ (c, s) => { const n = Math.round(3 + 5 * s); for (let i = 0; i < n; i++) later(i * .3, () => fireball(c)); shake = .3; },
    /* Asteroid storm */ (c, s) => {
      const rocks = [], dur = 4; let t = 0, next = 0; shake = .4 * s;
      fx.push({ update(dt) {
        t += dt; next -= dt;
        if (t < dur && next <= 0) {
          next = .07 / s;
          const m = new THREE.Mesh(gameGeos[Math.random() * gameGeos.length | 0], rockMat); m.position.set(rand(-160, 160), rand(-100, 100), -520); m.scale.setScalar(rand(1.5, 6) * s);
          const gl = new THREE.Sprite(spriteMat(softGlow, c, .45)); gl.scale.setScalar(3); m.add(gl);
          const target = new THREE.Vector3(rand(-1, 1), rand(-1, 1), 0).normalize().multiplyScalar(rand(25, 80)); target.z = 30;
          rocks.push({ m, gl, v: target.sub(m.position).normalize().multiplyScalar(rand(260, 420)), r: new THREE.Vector3(rand(-2, 2), rand(-2, 2), 0) }); scene.add(m);
        }
        for (let i = rocks.length - 1; i >= 0; i--) { const r = rocks[i]; r.m.position.addScaledVector(r.v, dt); r.m.rotation.x += r.r.x * dt; r.m.rotation.y += r.r.y * dt;
          if (r.m.position.z > 25) { scene.remove(r.m); r.gl.material.dispose(); rocks.splice(i, 1); } }
        return t < dur || rocks.length > 0;
      } });
    },
    /* Comet */ (c, s) => {
      const z = -380, hw = Math.tan(THREE.MathUtils.degToRad(30)) * -z * camera.aspect, left = Math.random() < .5, a = (left ? 0 : Math.PI) + rand(-.22, .22);
      const g = new THREE.Group(); g.position.set(left ? -hw * 1.5 : hw * 1.5, rand(-40, 80), z);
      const vel = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(hw * 3.2 / 7), pivot = new THREE.Group(); pivot.rotation.z = a; g.add(pivot);
      const ion = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: streakTex, color: c, transparent: true, opacity: .9, blending: ADD, depthWrite: false })); ion.scale.set(300 * s, 20 * s, 1); ion.position.x = -150 * s;
      const dt_ = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: streakTex, color: 0xffe9cc, transparent: true, opacity: .3, blending: ADD, depthWrite: false })); dt_.scale.set(220 * s, 46 * s, 1); dt_.position.set(-105 * s, -8, 0); dt_.rotation.z = .07;
      const head = new THREE.Sprite(spriteMat(softGlow, c.clone().lerp(WHITE, .5), 1)); head.scale.setScalar(34 * s);
      const nuc = new THREE.Sprite(spriteMat(softGlow, WHITE, 1)); nuc.scale.setScalar(9 * s);
      pivot.add(dt_, ion); g.add(head, nuc);
      timed(g, 7.5, (t, p, dt) => g.position.addScaledVector(vel, dt));
    },
    /* Meteor shower */ (c, s) => env('shower', 4, c, s),
    /* Galaxy spin */ (c, s) => { env('spin', 4, c, s); env('tint', 4, c, .7); },
    /* Star pulse */ (c, s) => { env('pulse', 2.2, c, s); env('tint', 2.2, c, .9); },
    /* Core flare */ (c, s) => env('flare', 3.5, c, s),
    /* Constellations */ (c, s) => {
      const bs = U.brightStars, pts = [], seen = new Set(), k = s >= 1.5 ? 3 : 2;
      bs.forEach((a, i) => bs.map((b, j) => [j, a.position.distanceTo(b.position)]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, k)
        .forEach(([j, d]) => { const key = Math.min(i, j) + '-' + Math.max(i, j); if (d < 560 && !seen.has(key)) { seen.add(key); pts.push(a.position.x, a.position.y, a.position.z, bs[j].position.x, bs[j].position.y, bs[j].position.z); } }));
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, blending: ADD, depthWrite: false }));
      timed(lines, 6, (t) => { lines.material.opacity = Math.max(0, Math.min(1, t * 1.5, (6 - t) * 1.5)) * .6; }, U.sky);
    },
    /* Shockwave */ (c, s) => {
      const g = new THREE.Group(); g.position.copy(skyPoint(520)); g.lookAt(0, 0, 0);
      const rings = [0, .25, .5].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 128), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: ADD, depthWrite: false, side: THREE.DoubleSide })); g.add(m); return m; });
      timed(g, 3, (t) => rings.forEach((m, i) => { const q = Math.max(0, Math.min(1, (t - i * .25) / 2.5)); m.scale.setScalar((5 + 700 * ease(q)) * s); m.material.opacity = q > 0 ? (1 - q) * .9 : 0; }));
      shake = Math.max(shake, .7 * s);
    },
    /* Starfall */ (c, s) => { let t = 0; fx.push({ update(dt) { t += dt; if (Math.random() < dt * 30 * s) spawnStreak({ fast: true, angle: -Math.PI / 2, color: c, dist: rand(600, 950) }); return t < 3.5; } }); }
  ];

  let lastId = -1;
  function runEvent(id) {
    if (!(id >= 0 && id < EVENT_COUNT) || !U) return null;
    const { p, m, c } = parts(id), [, s, n] = MODS[m], col = new THREE.Color(COLORS[c][1]);
    for (let k = 0; k < n; k++) { const go = () => { try { P[p](col, s, k); } catch (e) { console.warn(e); } }; k ? later(k * (n > 2 ? .35 : 1), go) : go(); }
    return { id, name: eventName(id) };
  }
  function randomEvent() { let id; do { id = Math.floor(Math.random() * EVENT_COUNT); } while (id === lastId); lastId = id; return runEvent(id); }

  /* ---------- universe travel ---------- */
  let override = null;
  let switching = false, currentSel = loadJSON('lunar-universe', { preset: 'home' });
  function goUniverse(sel) {
    if (switching) return false; switching = true; currentSel = sel;
    env('warp', 3.2, WHITE, 1.3); shake = .6; let built = false, t = 0;
    fx.push({ update(dt) { t += dt; if (!built && t > 1.5) { built = true; flash(1); buildUniverse(makeCfg(resolve(sel))); } if (t > 3.2) { switching = false; return false; } return true; } });
    return true;
  }

  /* ---------- meteor defense game ---------- */
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const crystalGeo = new THREE.OctahedronGeometry(1, 0); crystalGeo.userData.keep = true;
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7f93c0, emissiveIntensity: .7, roughness: .25, metalness: .2, flatShading: true }); crystalMat.userData.keep = true;
  const D = { active: false, paused: false, rocks: [], score: 0, lives: 3, spawnIn: 0, cb: {} };
  function dClear() { D.rocks.forEach((r) => { scene.remove(r.m); if (r.glow) r.glow.material.dispose(); }); D.rocks = []; }
  function dSpawn() {
    const crystal = Math.random() < .09, z = -330, hh = Math.tan(THREE.MathUtils.degToRad(30)) * -z, hw = hh * camera.aspect;
    let m, glow = null;
    if (crystal) { m = new THREE.Mesh(crystalGeo, crystalMat); glow = new THREE.Sprite(spriteMat(softGlow, 0xcfe0ff, .8)); glow.scale.setScalar(4.5); m.add(glow); }
    else m = new THREE.Mesh(gameGeos[Math.random() * gameGeos.length | 0], rockMat);
    const r = crystal ? 3 : rand(3.2, 6.5); m.scale.setScalar(r); m.position.set(rand(-.8, .8) * hw, rand(-.7, .7) * hh, z);
    const target = new THREE.Vector3(m.position.x * .04 + rand(-5, 5), m.position.y * .04 + rand(-3, 3), 0);
    const speed = Math.min(240, 70 + D.score * 1.6) * rand(.85, 1.15);
    D.rocks.push({ m, r, crystal, glow, v: target.sub(m.position).normalize().multiplyScalar(speed), spin: new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-1, 1)) });
    scene.add(m);
  }
  function dUpdate(dt) {
    if (!D.active || D.paused) return;
    D.spawnIn -= dt; if (D.spawnIn <= 0) { dSpawn(); D.spawnIn = Math.max(.32, 1.15 - D.score * .009) * rand(.6, 1.2); }
    for (let i = D.rocks.length - 1; i >= 0; i--) {
      const r = D.rocks[i]; r.m.position.addScaledVector(r.v, dt); r.m.rotation.x += r.spin.x * dt; r.m.rotation.y += r.spin.y * dt; r.m.rotation.z += r.spin.z * dt;
      if (r.m.position.z > -5) {
        scene.remove(r.m); if (r.glow) r.glow.material.dispose(); D.rocks.splice(i, 1);
        if (!r.crystal) {
          D.lives--; shake = .9; flash(.3); D.cb.onLife && D.cb.onLife(D.lives);
          if (D.lives <= 0) { D.active = false; D.rocks.forEach((q) => explode(q.m.position, 0xffc79a, 1)); dClear(); D.cb.onEnd && D.cb.onEnd(D.score); return; }
        }
      }
    }
  }
  const defense = {
    start(cb) { dClear(); Object.assign(D, { active: true, paused: false, score: 0, lives: 3, spawnIn: .5, cb: cb || {} }); },
    stop() { D.active = false; dClear(); }, pause() { D.paused = true; }, resume() { D.paused = false; },
    click(x, y) {
      if (!D.active || D.paused) return false;
      ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
      let best = -1, bz = -Infinity;
      D.rocks.forEach((r, i) => { if (raycaster.ray.distanceToPoint(r.m.position) < r.r * 1.6 && r.m.position.z > bz) { bz = r.m.position.z; best = i; } });
      if (best < 0) return false;
      const r = D.rocks[best]; D.rocks.splice(best, 1); scene.remove(r.m); if (r.glow) r.glow.material.dispose();
      explode(r.m.position, r.crystal ? 0xdfeaff : 0xffc79a, r.crystal ? 1.3 : 1);
      D.score += r.crystal ? 5 : 1; D.cb.onScore && D.cb.onScore(D.score, r.crystal);
      return true;
    }
  };

  /* ---------- main loop ---------- */
  buildUniverse(makeCfg(resolve(currentSel)));
  const clock = new THREE.Clock(); let T = 0, craftIn = 4, fireIn = 6, perfT = 0, perfN = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = e.clientY / innerHeight * 2 - 1; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  function loop() {
    const raw = clock.getDelta(), dt = Math.min(raw, .05); T += dt;
    perfT += raw; perfN++;
    if (perfT > 2) { if (perfT / perfN > 1 / 45 && curPR > .6) { curPR = Math.max(.6, curPR - .2); renderer.setPixelRatio(curPR); starMat.uniforms.uPR.value = curPR; } perfT = 0; perfN = 0; }
    if (override) { try { override(dt, T); } catch (e) { console.error(e); } requestAnimationFrame(loop); return; }
    for (let i = envs.length - 1; i >= 0; i--) { envs[i].t += dt; if (envs[i].t >= envs[i].dur) envs.splice(i, 1); }
    const warp = level('warp'), spin = level('spin'), pulse = level('pulse'), flare = level('flare');

    mouse.x += (mouse.tx - mouse.x) * .04; mouse.y += (mouse.ty - mouse.y) * .04;
    const amp = (calm ? .3 : 1) * (reduce ? .3 : 1) * (motion ? 1 : 0);
    camera.position.set(mouse.x * 4 * amp, -mouse.y * 2.5 * amp, 0);
    camera.rotation.set(Math.sin(T * .023) * .035 * amp - mouse.y * .03 * amp + (Math.random() - .5) * shake * .03,
      Math.sin(T * .035) * .07 * amp - mouse.x * .05 * amp + (Math.random() - .5) * shake * .03, Math.sin(T * .017) * .01 * amp);
    shake = Math.max(0, shake - dt * 1.6);
    const fov = 60 + Math.min(1.3, warp) * 30; if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }

    const we = strongest('warp'); if (we && we.color) wMat.color.copy(we.color);
    const te = strongest('tint'); starMat.uniforms.uTintAmt.value = te ? envK(te) * te.str : 0; if (te) starMat.uniforms.uTint.value.copy(te.color);
    const fe = strongest('flare');
    if (fe) U.mwMat.color.copy(WHITE).lerp(fe.color, envK(fe) * .7).multiplyScalar(1 + flare * 1.5); else U.mwMat.color.setScalar(1 + warp * .5);
    starMat.uniforms.uTime.value = T; starMat.uniforms.uPulse.value = pulse;
    U.sky.rotateOnAxis(U.cfg.bandN, dt * (.003 + spin * 1.3));
    U.sunHalo.material.opacity = .05 + flare * .2;
    U.beltGroup.rotateY(dt * (.012 + warp * .4));
    U.galaxies.forEach((g) => g.rotateOnAxis(UP, dt * (.02 + spin * .8)));
    U.planets.forEach((g) => { g.rotation.y += dt * .01; });
    U.heroes.forEach((h) => { h.m.rotation.x += h.rx * dt; h.m.rotation.y += h.ry * dt; h.m.position.y = h.base + Math.sin(T * .2 + h.ph) * 2; });
    updateWarp(dt, warp);

    craftIn -= dt; if (craftIn <= 0 && craft.length < 2) { spawnCraft(false); craftIn = rand(25, 55); }
    updateCraft(dt, T);
    fireIn -= dt; if (fireIn <= 0) { fireball(); fireIn = rand(9, 18); }
    if (!reduce && Math.random() < dt * .3) spawnStreak();
    const se = strongest('shower'); if (se && Math.random() < dt * 24 * se.str) spawnStreak({ fast: true, angle: 4, color: se.color, dist: rand(600, 950) });
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(dt)) fx.splice(i, 1);
    updateStreaks(dt);
    dUpdate(dt);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.Space = {
    ok: true, EVENT_COUNT, PRIMS, eventName, eventColor, flash, zeroG, runEvent, randomEvent, defense,
    combo(n) { const out = []; for (let i = 0; i < (n || 3); i++) { const e = randomEvent(); if (e) out.push(e); } return out; },
    setCalm(v) { calm = !!v; }, setMotion(v) { motion = !!v; },
    setQuality(q) { qCap = QCAP[q] || 1.5; curPR = Math.min(window.devicePixelRatio || 1, qCap); renderer.setPixelRatio(curPR); starMat.uniforms.uPR.value = curPR; },
    shake(v) { shake = Math.max(shake, v || .5); }, shootingStar() { spawnStreak({ fast: true }); },
    presets: Object.keys(PRESETS).map((key) => ({ key, name: PRESETS[key].name })),
    renderer, rockGeos: gameGeos, skyTexture: () => U.rt.texture,
    setOverride(fn) { override = fn || null; clock.getDelta(); },
    preview, goUniverse, current: () => ({ name: U.cfg.name, key: U.cfg.key, seed: U.cfg.seed, sel: currentSel })
  };
})();
