/* LUNAR – Solar System explorer and rover gameplay.
   Uses the existing LUNAR renderer (window.Space.renderer) and takes over the frame loop
   while the explorer views are open. Real textures/models come from window.LUNAR_ASSETS. */
(function () {
  'use strict';
  const S = window.Space, A = window.LUNAR_ASSETS;
  const $ = (s) => document.querySelector(s);
  const unsupported = (why) => { window.Explore = { supported: false, why, enterSpace() {}, exit() {}, inRover: () => false }; };
  if (!S || !S.ok || !S.renderer) return unsupported('WebGL is not available in this browser.');
  if (!THREE.OrbitControls || !THREE.GLTFLoader) return unsupported('The 3D controls or model loader could not be loaded.');

  const renderer = S.renderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- loading screen ---------- */
  const ld = { el: $('#ex-loading'), title: $('#ex-ld-title'), bar: $('#ex-ld-bar'), text: $('#ex-ld-text'), err: $('#ex-ld-err'), btn: $('#ex-ld-btn'), pick: $('#ex-ld-pick'), file: $('#ex-ld-file') };
  function showLoading(title) { ld.el.hidden = false; ld.title.textContent = title; ld.bar.style.transform = 'scaleX(0)'; ld.text.textContent = 'Starting…'; ld.err.textContent = ''; ld.btn.hidden = true; ld.pick.hidden = true; }
  function progress(done, total, label) { ld.bar.style.transform = `scaleX(${total ? done / total : 0})`; ld.text.textContent = label || `${done} of ${total} files`; }
  function hideLoading() { ld.el.hidden = true; }
  ld.btn.addEventListener('click', hideLoading);
  ld.pick.addEventListener('click', () => ld.file.click());
  ld.file.addEventListener('change', () => {
    const f = ld.file.files && ld.file.files[0]; ld.file.value = ''; if (!f) return;
    loadRoverFromFile(f); ld.btn.onclick = null; ld.btn.textContent = 'Continue';
    landOn(landingKey || 'mars');
  });

  /* ---------- asset loading (local copies, lazy) ---------- */
  const texLoader = new THREE.TextureLoader();
  const texCache = {}, missing = new Set();
  function loadTex(path) {
    if (!path) return Promise.resolve(null);
    if (texCache[path]) return texCache[path];
    texCache[path] = new Promise((res) => {
      const ok = (t) => { t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); res(t); };
      const mirror = A.mirrors && A.mirrors[path.split('/').pop()];
      // 1) this site's own copy, 2) the identical file on Wikimedia Commons
      texLoader.load(A.base + path, ok, undefined, () => {
        if (!mirror) { missing.add(path); res(null); return; }
        texLoader.load(mirror, ok, undefined, () => { missing.add(path); res(null); });
      });
    });
    return texCache[path];
  }
  const T = (key, hi) => (A.textures[key] ? (hi ? A.textures[key].hi : A.textures[key].lo) : null);

  /* ---------- real data (NASA Planetary Fact Sheet; moons as of mid-2026) ---------- */
  const BODIES = [
    { key: 'sun', name: 'Sun', type: 'Star', r: 16, color: 0xffcc66,
      blurb: 'A G-type main-sequence star holding 99.8% of the Solar System’s mass.',
      facts: { Diameter: '1,392,700 km', 'Surface gravity': '274 m/s² (28× Earth)', Composition: '73% hydrogen, 25% helium', Temperature: '5,500 °C surface, 15 million °C core', Rotation: '25 days at the equator', Age: 'About 4.6 billion years' } },
    { key: 'mercury', name: 'Mercury', type: 'Terrestrial planet', r: 1.1, a: 30, period: 87.97, rot: 1407.6, tilt: .03, incl: 7, color: 0x9a948c,
      blurb: 'The smallest planet and closest to the Sun, with a cratered surface and almost no atmosphere.',
      facts: { Diameter: '4,879 km', Gravity: '3.7 m/s² (0.38 g)', Atmosphere: 'Thin exosphere: oxygen, sodium, hydrogen, helium, potassium', Temperature: '−173 °C to 427 °C', Moons: '0', 'Orbital period': '88 days', 'Day length': '58.6 Earth days (rotation)', 'Distance from Sun': '57.9 million km (0.39 AU)' } },
    { key: 'venus', name: 'Venus', type: 'Terrestrial planet', r: 2.4, a: 42, period: 224.7, rot: -5832.5, tilt: 177.4, incl: 3.4, color: 0xe6c88a,
      blurb: 'Wrapped in thick sulfuric acid clouds, Venus is the hottest planet. The texture shows its cloud tops, which is how it looks from space.',
      facts: { Diameter: '12,104 km', Gravity: '8.87 m/s² (0.90 g)', Atmosphere: '96.5% carbon dioxide, 3.5% nitrogen, ~92 bar', Temperature: '464 °C average', Moons: '0', 'Orbital period': '224.7 days', 'Day length': '243 Earth days, spinning backwards', 'Distance from Sun': '108.2 million km (0.72 AU)' } },
    { key: 'earth', name: 'Earth', type: 'Terrestrial planet', r: 2.6, a: 56, period: 365.26, rot: 23.93, tilt: 23.44, incl: 0, color: 0x3a6fb0, land: true,
      blurb: 'The only world known to host life, with liquid water oceans covering about 71% of its surface.',
      facts: { Diameter: '12,756 km', Gravity: '9.81 m/s² (1 g)', Atmosphere: '78% nitrogen, 21% oxygen, 1% argon', Temperature: '15 °C average', Moons: '1', 'Orbital period': '365.25 days', 'Day length': '23.9 hours', 'Distance from Sun': '149.6 million km (1 AU)' } },
    { key: 'moon', name: 'Moon', type: 'Earth’s natural satellite', parent: 'earth', r: .72, a: 6.2, period: 27.32, rot: 655.7, tilt: 6.68, incl: 5.1, color: 0x9a9a9a, land: true,
      blurb: 'Earth’s only natural satellite, tidally locked so the same side always faces us. Twelve astronauts have walked on it.',
      facts: { Diameter: '3,475 km', Gravity: '1.62 m/s² (0.17 g)', Atmosphere: 'Almost none (a trace exosphere)', Temperature: '−173 °C to 127 °C', 'Orbital period': '27.3 days around Earth', 'Day length': '29.5 Earth days (sunrise to sunrise)', 'Distance from Earth': '384,400 km' } },
    { key: 'mars', name: 'Mars', type: 'Terrestrial planet', r: 1.5, a: 74, period: 686.98, rot: 24.62, tilt: 25.19, incl: 1.85, color: 0xc1440e, land: true,
      blurb: 'A cold desert world with the tallest volcano in the Solar System, Olympus Mons. Curiosity has been exploring Gale Crater since 2012.',
      facts: { Diameter: '6,792 km', Gravity: '3.71 m/s² (0.38 g)', Atmosphere: '95% carbon dioxide, 2.8% nitrogen, 2% argon, ~0.006 bar', Temperature: '−65 °C average', Moons: '2 (Phobos, Deimos)', 'Orbital period': '687 days', 'Day length': '24.6 hours', 'Distance from Sun': '227.9 million km (1.52 AU)' } },
    { key: 'jupiter', name: 'Jupiter', type: 'Gas giant', r: 8.5, a: 108, period: 4332.6, rot: 9.93, tilt: 3.13, incl: 1.3, color: 0xd8b48a, gas: true,
      blurb: 'The largest planet, more than twice as massive as all the others combined. Its Great Red Spot is a storm bigger than Earth.',
      facts: { Diameter: '142,984 km', Gravity: '24.79 m/s² (2.5 g) at the cloud tops', Atmosphere: '~90% hydrogen, ~10% helium', Temperature: '−110 °C at the 1-bar level', Moons: '115 (as of mid-2026)', 'Orbital period': '11.86 years', 'Day length': '9.9 hours', 'Distance from Sun': '778.5 million km (5.2 AU)' } },
    { key: 'saturn', name: 'Saturn', type: 'Gas giant', r: 7.2, a: 146, period: 10759, rot: 10.66, tilt: 26.73, incl: 2.49, color: 0xe3cf9a, gas: true, rings: true,
      blurb: 'Famous for its rings of ice and rock, Saturn is less dense than water. It has the most known moons of any planet.',
      facts: { Diameter: '120,536 km', Gravity: '10.44 m/s² (1.07 g) at the cloud tops', Atmosphere: '~96% hydrogen, ~3% helium', Temperature: '−140 °C at the 1-bar level', Moons: '293 (as of mid-2026)', 'Orbital period': '29.4 years', 'Day length': '10.7 hours', 'Distance from Sun': '1.43 billion km (9.5 AU)' } },
    { key: 'uranus', name: 'Uranus', type: 'Ice giant', r: 4, a: 178, period: 30687, rot: -17.24, tilt: 97.77, incl: .77, color: 0x9fd3dc, gas: true,
      blurb: 'An ice giant tipped on its side, so each pole gets about 42 years of sunlight followed by 42 years of darkness.',
      facts: { Diameter: '51,118 km', Gravity: '8.87 m/s² (0.90 g)', Atmosphere: '83% hydrogen, 15% helium, 2% methane', Temperature: '−195 °C at the 1-bar level', Moons: '29', 'Orbital period': '84 years', 'Day length': '17.2 hours, spinning backwards', 'Distance from Sun': '2.87 billion km (19.2 AU)' } },
    { key: 'neptune', name: 'Neptune', type: 'Ice giant', r: 3.9, a: 206, period: 60190, rot: 16.11, tilt: 28.32, incl: 1.77, color: 0x3f63d8, gas: true,
      blurb: 'The most distant planet, with the fastest winds in the Solar System at over 2,000 km/h.',
      facts: { Diameter: '49,528 km', Gravity: '11.15 m/s² (1.14 g)', Atmosphere: '80% hydrogen, 19% helium, 1.5% methane', Temperature: '−200 °C at the 1-bar level', Moons: '16', 'Orbital period': '164.8 years', 'Day length': '16.1 hours', 'Distance from Sun': '4.5 billion km (30.1 AU)' } }
  ];
  const byKey = {}; BODIES.forEach((b) => (byKey[b.key] = b));

  /* =====================================================================
     SOLAR SYSTEM VIEW
     ===================================================================== */
  const sScene = new THREE.Scene();
  const sCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 30000);
  const HOME_POS = new THREE.Vector3(-40, 95, 215), HOME_TARGET = new THREE.Vector3(30, 0, 0);
  sCam.position.copy(HOME_POS);
  const controls = new THREE.OrbitControls(sCam, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.rotateSpeed = .6; controls.zoomSpeed = .9;
  controls.minDistance = 4; controls.maxDistance = 1400; controls.target.copy(HOME_TARGET); controls.enabled = false;
  controls.update();

  const sunLight = new THREE.PointLight(0xfff4e6, 2.1, 0, 0); sScene.add(sunLight);
  sScene.add(new THREE.AmbientLight(0x223344, .07));

  function glowTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  }
  const sunGlowTex = glowTexture([[0, 'rgba(255,240,200,1)'], [.2, 'rgba(255,200,120,.55)'], [.5, 'rgba(255,150,60,.12)'], [1, 'rgba(255,120,40,0)']]);
  const dotTex = glowTexture([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']]);

  // star background (real Milky Way map if downloaded, otherwise LUNAR's own sky)
  const bgMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, color: 0x8a8a8a });
  const bg = new THREE.Mesh(new THREE.SphereGeometry(15000, 64, 32), bgMat); bg.renderOrder = -1; sScene.add(bg);

  const sphereGeos = [new THREE.SphereGeometry(1, 128, 64), new THREE.SphereGeometry(1, 48, 24), new THREE.SphereGeometry(1, 16, 8)];
  const objs = {}; // key -> { body, group, tilt, lod, mats[], label }

  function makeLOD(mat, r) {
    const lod = new THREE.LOD();
    lod.addLevel(new THREE.Mesh(sphereGeos[0], mat), 0);
    lod.addLevel(new THREE.Mesh(sphereGeos[1], mat), r * 14);
    lod.addLevel(new THREE.Mesh(sphereGeos[2], mat), r * 70);
    lod.scale.setScalar(r);
    return lod;
  }
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: null }, nightMap: { value: null }, sunPos: { value: new THREE.Vector3() }, hasDay: { value: 0 }, hasNight: { value: 0 }, base: { value: new THREE.Color(0x3a6fb0) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunPos; uniform float hasDay; uniform float hasNight; uniform vec3 base;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 L=normalize(sunPos-vW); float d=dot(normalize(vN),L);
        vec3 day=mix(base,texture2D(dayMap,vUv).rgb,hasDay); vec3 night=texture2D(nightMap,vUv).rgb*hasNight;
        float k=smoothstep(-0.12,0.22,d);
        gl_FragColor=vec4(day*max(d,0.0)*1.15+night*(1.0-k)*1.3+day*0.02,1.0); }`
  });
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    uniforms: { sunPos: { value: new THREE.Vector3() }, color: { value: new THREE.Color(0x5aa0ff) } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 sunPos; uniform vec3 color; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 V=normalize(cameraPosition-vW); float rim=pow(1.0-abs(dot(normalize(vN),V)),3.0);
        float lit=clamp(dot(normalize(vN),normalize(sunPos-vW))+0.3,0.0,1.0); gl_FragColor=vec4(color*rim*lit*1.4,1.0); }`
  });
  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { map: { value: null }, hasMap: { value: 0 }, sunPos: { value: new THREE.Vector3() }, pCenter: { value: new THREE.Vector3() }, pRadius: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D map; uniform float hasMap; uniform vec3 sunPos; uniform vec3 pCenter; uniform float pRadius; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 c=hasMap>0.5?texture2D(map,vec2(vUv.x,0.5)):vec4(vec3(0.8,0.75,0.6),0.5*smoothstep(0.0,0.1,vUv.x)*smoothstep(1.0,0.85,vUv.x));
        vec3 L=normalize(sunPos-vW); vec3 oc=vW-pCenter; float b=dot(oc,L); float h=b*b-(dot(oc,oc)-pRadius*pRadius);
        float sh=(h>0.0&&b<0.0)?0.12:1.0; gl_FragColor=vec4(c.rgb*sh*1.1,c.a); }`
  });

  BODIES.forEach((b) => {
    const group = new THREE.Group(), tilt = new THREE.Group(); group.add(tilt);
    let mat, lod;
    if (b.key === 'sun') {
      mat = new THREE.MeshBasicMaterial({ color: b.color });
      lod = makeLOD(mat, b.r); tilt.add(lod);
      [[b.r * 5.5, .9], [b.r * 11, .25]].forEach(([s, o]) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunGlowTex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); g.scale.setScalar(s); group.add(g); });
    } else if (b.key === 'earth') {
      mat = earthMat; lod = makeLOD(mat, b.r); tilt.add(lod);
      const clouds = new THREE.Mesh(sphereGeos[1], new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, roughness: 1 }));
      clouds.scale.setScalar(b.r * 1.012); tilt.add(clouds); b.clouds = clouds;
      const atmo = new THREE.Mesh(sphereGeos[1], atmoMat); atmo.scale.setScalar(b.r * 1.08); group.add(atmo);
    } else {
      mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 1, metalness: 0 });
      lod = makeLOD(mat, b.r); tilt.add(lod);
    }
    tilt.rotation.z = (b.tilt || 0) * DEG;
    if (b.rings) {
      const ri = b.r * 1.24, ro = b.r * 2.27, g = new THREE.RingGeometry(ri, ro, 160, 1), p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - ri) / (ro - ri), .5); }
      const ring = new THREE.Mesh(g, ringMat); ring.rotation.x = -Math.PI / 2; tilt.add(ring); b.ring = ring;
      ringMat.uniforms.pRadius.value = b.r;
    }
    sScene.add(group);
    // orbit path
    if (b.a) {
      const pts = []; for (let i = 0; i <= 256; i++) { const t = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * b.a, Math.sin(t) * b.a * Math.sin((b.incl || 0) * DEG), Math.sin(t) * b.a)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: b.parent ? .1 : .14 }));
      if (!b.parent) sScene.add(line); b.orbitLine = line;
    }
    const label = document.createElement('button'); label.className = 'pl-label'; label.type = 'button'; label.textContent = b.name; label.dataset.key = b.key;
    label.addEventListener('click', (e) => { e.stopPropagation(); focus(b.key); });
    $('#solar-labels').appendChild(label);
    objs[b.key] = { body: b, group, tilt, lod, mat, label, phase: Math.random() * Math.PI * 2, spin: Math.random() * Math.PI * 2 };
  });
  // the Moon's orbit line follows Earth
  const moonOrbit = objs.moon.body.orbitLine; sScene.add(moonOrbit);

  // selection ring
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.36, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
  selRing.visible = false; sScene.add(selRing);

  /* texture loading for space view: 2k first, 8k only for the planet you zoom into */
  let spaceLoaded = false;
  async function loadSpaceTextures() {
    if (spaceLoaded) return; spaceLoaded = true;
    const jobs = [
      ['stars', (t) => { bgMat.map = t; bgMat.color.set(0xffffff); bgMat.needsUpdate = true; }],
      ['sun', (t) => { objs.sun.mat.map = t; objs.sun.mat.color.set(0xffffff); objs.sun.mat.needsUpdate = true; }],
      ['earth', (t) => { earthMat.uniforms.dayMap.value = t; earthMat.uniforms.hasDay.value = 1; }],
      ['earthNight', (t) => { earthMat.uniforms.nightMap.value = t; earthMat.uniforms.hasNight.value = 1; }],
      ['earthClouds', (t) => { const m = byKey.earth.clouds.material; m.alphaMap = t; m.opacity = .9; m.needsUpdate = true; }],
      ['saturnRing', (t) => { ringMat.uniforms.map.value = t; ringMat.uniforms.hasMap.value = 1; }]
    ];
    ['mercury', 'venus', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach((k) => jobs.push([k, (t) => { const m = objs[k].mat; m.map = t; m.color.set(0xffffff); m.needsUpdate = true; }]));
    showLoading('Loading the Solar System');
    let done = 0;
    await Promise.all(jobs.map(([k, apply]) => loadTex(T(k)).then((t) => { if (t) apply(t); else if (k === 'stars') { bgMat.map = S.skyTexture(); bgMat.color.set(0xffffff); bgMat.needsUpdate = true; } progress(++done, jobs.length); })));
    hideLoading();
    if (missing.size) $('#solar-warn').hidden = false; // small, non-blocking notice
  }
  const hiLoaded = new Set();
  function loadHi(key) {
    if (hiLoaded.has(key)) return; hiLoaded.add(key);
    const std = (k) => [k, (t) => { objs[k].mat.map = t; objs[k].mat.needsUpdate = true; }];
    const HI = {
      sun: [std('sun')],
      earth: [['earth', (t) => { earthMat.uniforms.dayMap.value = t; earthMat.uniforms.hasDay.value = 1; }], ['earthNight', (t) => { earthMat.uniforms.nightMap.value = t; earthMat.uniforms.hasNight.value = 1; }],
        ['earthClouds', (t) => { const m = byKey.earth.clouds.material; m.alphaMap = t; m.opacity = .9; m.needsUpdate = true; }]],
      saturn: [std('saturn'), ['saturnRing', (t) => { ringMat.uniforms.map.value = t; ringMat.uniforms.hasMap.value = 1; }]]
    };
    const jobs = (HI[key] || [std(key)]).filter(([k]) => T(k, true));
    if (!jobs.length) return;
    const hint = $('#solar-hires'); hint.hidden = false;
    Promise.all(jobs.map(([k, apply]) => loadTex(T(k, true)).then((t) => { if (t) apply(t); }))).then(() => { hint.hidden = true; });
  }

  /* simulation clock */
  let simSpeed = 1, simDays = 0;
  const ORBIT_DAYS_PER_SEC = 6, SPIN_DAYS_PER_SEC = .04;
  const tmpV = new THREE.Vector3();
  function bodyPos(b, out) {
    const o = objs[b.key];
    if (!b.a) return out.set(0, 0, 0);
    const ang = o.phase + simDays / b.period * Math.PI * 2;
    out.set(Math.cos(ang) * b.a, Math.sin(ang) * b.a * Math.sin((b.incl || 0) * DEG), Math.sin(ang) * b.a);
    if (b.parent) { const p = objs[b.parent].group.position; out.add(p); }
    return out;
  }

  /* focus + camera transitions */
  let focused = null, tween = null;
  const panel = $('#planet-panel');
  function focus(key) {
    const prevTarget = controls.target.clone(), prevPos = sCam.position.clone();
    focused = key;
    if (key) {
      const b = byKey[key], dist = b.r * (key === 'sun' ? 3.4 : 4.6);
      const dir = prevPos.clone().sub(prevTarget).normalize();
      if (dir.y < .15) { dir.y = .25; dir.normalize(); }
      tween = { t: 0, dur: 1.6, fromPos: prevPos, fromTarget: prevTarget, dir, dist };
      controls.minDistance = b.r * 1.35; controls.maxDistance = Math.max(80, b.r * 40);
      loadHi(key); showPanel(b);
    } else {
      tween = { t: 0, dur: 1.6, fromPos: prevPos, fromTarget: prevTarget, home: true };
      controls.minDistance = 4; controls.maxDistance = 1400; panel.hidden = true;
    }
    $('#solar-back').hidden = !key;
    document.querySelectorAll('.pl-label').forEach((l) => l.classList.toggle('sel', l.dataset.key === key));
  }
  function showPanel(b) {
    panel.hidden = false;
    $('#pp-type').textContent = b.type; $('#pp-name').textContent = b.name; $('#pp-blurb').textContent = b.blurb;
    const dl = $('#pp-facts'); dl.textContent = '';
    Object.entries(b.facts).forEach(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
    const land = $('#pp-land'), note = $('#pp-note');
    land.hidden = !b.land; land.textContent = `Land on ${b.name}`; land.dataset.key = b.key;
    note.textContent = b.land ? 'Drive NASA’s Curiosity rover on a surface built from this world’s real conditions.' : b.gas ? `${b.name} has no solid surface to land on: it is a deep atmosphere of gas and liquid that gets denser all the way down.` : b.key === 'sun' ? 'There is nowhere to land on a star.' : `Surface driving isn’t available for ${b.name} yet. ${b.key === 'venus' ? 'Its 464 °C surface and crushing pressure are hidden under the clouds.' : 'You can still orbit and zoom in.'}`;
  }
  $('#solar-back').addEventListener('click', () => focus(null));
  $('#pp-close').addEventListener('click', () => focus(null));
  $('#pp-land').addEventListener('click', (e) => landOn(e.currentTarget.dataset.key));
  document.querySelectorAll('#solar-speed .chip').forEach((c) => c.addEventListener('click', () => {
    simSpeed = +c.dataset.s; document.querySelectorAll('#solar-speed .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
  }));

  /* picking + hover */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hovered = null, downAt = null;
  function pick(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, sCam);
    let best = null, bd = Infinity;
    BODIES.forEach((b) => {
      const p = objs[b.key].group.position, r = Math.max(b.r * 1.15, sCam.position.distanceTo(p) * .012);
      if (ray.ray.distanceToPoint(p) < r) { const d = sCam.position.distanceTo(p); if (d < bd) { bd = d; best = b.key; } }
    });
    return best;
  }
  canvas.addEventListener('pointerdown', (e) => { if (mode === 'space') downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (mode !== 'space' || !downAt) return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) { const k = pick(e.clientX, e.clientY); if (k) focus(k); }
    downAt = null;
  });
  let hoverT = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'space' || performance.now() - hoverT < 50) return; hoverT = performance.now();
    hovered = pick(e.clientX, e.clientY); canvas.style.cursor = hovered ? 'pointer' : '';
    document.querySelectorAll('.pl-label').forEach((l) => l.classList.toggle('hot', l.dataset.key === hovered));
  });

  function updateSpace(dt) {
    simDays += dt * ORBIT_DAYS_PER_SEC * simSpeed;
    BODIES.forEach((b) => {
      const o = objs[b.key]; bodyPos(b, o.group.position);
      if (b.rot) o.lod.rotation.y += dt * SPIN_DAYS_PER_SEC * simSpeed * (24 / b.rot) * Math.PI * 2;
      else o.lod.rotation.y += dt * .02 * simSpeed;
    });
    if (byKey.earth.clouds) byKey.earth.clouds.rotation.y += dt * .01 * simSpeed;
    moonOrbit.position.copy(objs.earth.group.position);
    earthMat.uniforms.sunPos.value.set(0, 0, 0); atmoMat.uniforms.sunPos.value.set(0, 0, 0);
    ringMat.uniforms.pCenter.value.copy(objs.saturn.group.position);

    // camera tween / follow
    if (tween) {
      tween.t += dt; const k = ease(clamp(tween.t / tween.dur, 0, 1));
      let tgt, pos;
      if (tween.home) { tgt = HOME_TARGET; pos = HOME_POS; }
      else { tgt = objs[focused].group.position; pos = tgt.clone().addScaledVector(tween.dir, tween.dist); }
      controls.target.lerpVectors(tween.fromTarget, tgt, k); sCam.position.lerpVectors(tween.fromPos, pos, k);
      if (k >= 1) { tween = null; if (focused) lastFocusPos.copy(objs[focused].group.position); }
    } else if (focused) {
      const p = objs[focused].group.position; tmpV.copy(p).sub(lastFocusPos);
      controls.target.add(tmpV); sCam.position.add(tmpV); lastFocusPos.copy(p);
    }
    controls.update();

    // selection ring + LOD + labels
    const sel = focused || hovered;
    if (sel) { const b = byKey[sel]; selRing.visible = true; selRing.position.copy(objs[sel].group.position); selRing.scale.setScalar(b.r * (b.rings ? 2.4 : 1.12)); selRing.lookAt(sCam.position); selRing.material.opacity = focused ? .35 : .7; }
    else selRing.visible = false;
    BODIES.forEach((b) => objs[b.key].lod.update(sCam));
    const w = innerWidth, h = innerHeight;
    BODIES.forEach((b) => {
      const o = objs[b.key]; tmpV.copy(o.group.position); tmpV.y += b.r * 1.25; tmpV.project(sCam);
      const dist = sCam.position.distanceTo(o.group.position);
      const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1 && !(b.parent && dist > 160) && !(focused && focused !== b.key && dist < byKey[focused].r * 3);
      o.label.style.display = vis ? '' : 'none';
      if (vis) o.label.style.transform = `translate(-50%,-100%) translate(${(tmpV.x * .5 + .5) * w}px,${(-tmpV.y * .5 + .5) * h}px)`;
    });
    renderer.render(sScene, sCam);
  }
  const lastFocusPos = new THREE.Vector3();

  /* =====================================================================
     ROVER GAMEPLAY
     ===================================================================== */
  // value noise + fbm for terrain (deterministic)
  function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return lerp(lerp(a, b, u), lerp(c, d, u), v); }
  function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); f *= 2.02; a *= .5; } return s; }
  function ridged(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(noise(x * f, y * f) * 2 - 1)); f *= 2.02; a *= .5; } return s; }
  function craters(x, z, cell, depth, seed) {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell); let h = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const gx = cx + i, gz = cz + j, r0 = hash2(gx * 7 + seed, gz * 13 - seed);
      if (r0 > .55) continue;
      const px = (gx + hash2(gx + seed, gz)) * cell, pz = (gz + hash2(gx, gz + seed)) * cell, R = cell * (.15 + hash2(gx - seed, gz + 3) * .3);
      const d = Math.hypot(x - px, z - pz) / R;
      if (d < 1) h -= depth * R * .18 * (1 - d * d); else if (d < 1.5) h += depth * R * .05 * Math.pow(1 - (d - 1) / .5, 2);
    }
    return h;
  }
  const flat = (x, z) => clamp((Math.hypot(x, z) - 25) / 120, 0, 1); // keep the landing zone drivable
  const WORLDS = {
    earth: { name: 'Earth', g: 9.81, sky: [0x5d8fd6, 0xbcd6f0], fog: 0xa9c4e0, fogDensity: .0025, sun: 0xfff2dd, sunI: 1.5, hemi: [0xbcd6f0, 0x4d5a35, .55],
      colors: { low: [0.29, 0.42, 0.20], mid: [0.36, 0.38, 0.24], high: [0.45, 0.43, 0.40], rock: [0.38, 0.36, 0.34], snow: [0.93, 0.94, 0.96] }, rock: 0x8a8378, rockDensity: .05, dust: 0x9c8a6a, dustAmt: .3,
      h(x, z) { const f = flat(x, z); return fbm(x * .004, z * .004) * 30 * f + ridged(x * .0016 + 9, z * .0016) * 150 * f * f + fbm(x * .04, z * .04, 3) * 2.2; } },
    moon: { name: 'Moon', g: 1.62, sky: [0x000000, 0x000000], fog: null, sun: 0xffffff, sunI: 1.9, hemi: [0x223344, 0x111111, .12],
      colors: { low: [0.42, 0.42, 0.41], mid: [0.5, 0.5, 0.49], high: [0.56, 0.56, 0.55], rock: [0.36, 0.36, 0.36], snow: [0.62, 0.62, 0.6] }, rock: 0x77777a, rockDensity: .07, dust: 0x8a8a88, dustAmt: 1,
      h(x, z) { const f = flat(x, z); return fbm(x * .006, z * .006) * 10 * f + craters(x, z, 70, 1, 3) + craters(x, z, 260, 1.2, 11) * f + craters(x, z, 18, .8, 21) + fbm(x * .05, z * .05, 3) * .8; } },
    mars: { name: 'Mars', g: 3.71, sky: [0xb58a63, 0xe0b48a], fog: 0xd2a27a, fogDensity: .0035, sun: 0xfff0dc, sunI: 1.45, hemi: [0xe0b48a, 0x5a2e1a, .5],
      colors: { low: [0.62, 0.34, 0.20], mid: [0.70, 0.42, 0.26], high: [0.55, 0.33, 0.22], rock: [0.38, 0.24, 0.17], snow: [0.78, 0.55, 0.40] }, rock: 0x6e4a36, rockDensity: .08, dust: 0xc08560, dustAmt: 1,
      h(x, z) { const f = flat(x, z); return fbm(x * .003, z * .003) * 40 * f + ridged(x * .002 + 4, z * .002) * 45 * f * f + Math.sin(x * .09 + fbm(x * .01, z * .01) * 6) * .6 * f + craters(x, z, 300, .9, 7) * f + fbm(x * .05, z * .05, 3) * 1.2; } }
  };

  const rScene = new THREE.Scene();
  const rCam = new THREE.PerspectiveCamera(110, innerWidth / innerHeight, .1, 6000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, .5); rScene.add(hemi);
  const sunD = new THREE.DirectionalLight(0xffffff, 1.5); sunD.castShadow = true;
  sunD.shadow.mapSize.set(2048, 2048); Object.assign(sunD.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 300 }); sunD.shadow.bias = -.0006;
  rScene.add(sunD, sunD.target);
  const sunDir = new THREE.Vector3(.45, .55, .35).normalize();

  // sky dome
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color(1, .95, .85) } },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD;
      void main(){ float t=pow(clamp(vD.y,0.0,1.0),0.55); vec3 c=mix(hor,top,t); float s=max(dot(normalize(vD),sunDir),0.0);
        c+=sunCol*(pow(s,900.0)*3.0+pow(s,12.0)*0.25*length(hor)); gl_FragColor=vec4(c,1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), skyMat); rScene.add(sky);
  const starSky = new THREE.Mesh(new THREE.SphereGeometry(2900, 48, 24), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, color: 0x777777 })); rScene.add(starSky);
  const earthInSky = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), new THREE.MeshStandardMaterial({ color: 0x3a6fb0, roughness: 1 }));
  earthInSky.position.set(-900, 700, -1400); rScene.add(earthInSky);

  // procedural detail texture for close-up ground grain (labeled as procedural in the credits)
  const detailTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = .55 + fbm(x / 16, y / 16, 4) * .35 + (hash2(x, y) - .5) * .18, v = clamp(n, 0, 1) * 255, i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex, roughness: 1, metalness: 0 });

  // terrain level of detail: a fine grid around the rover plus a coarse far grid, both re-centered as you drive
  function makeGrid(size, seg) { const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3)); return g; }
  const near = { mesh: new THREE.Mesh(makeGrid(320, 160), groundMat), size: 320, step: 40, cx: NaN, cz: NaN };
  const far = { mesh: new THREE.Mesh(makeGrid(4000, 140), groundMat), size: 4000, step: 400, cx: NaN, cz: NaN, drop: .6 };
  near.mesh.receiveShadow = true; rScene.add(near.mesh, far.mesh);
  let W = WORLDS.mars;
  function H(x, z) { return W.h(x, z); }
  function rebuildGrid(gr, cx, cz) {
    gr.cx = cx; gr.cz = cz;
    const g = gr.mesh.geometry, p = g.attributes.position, col = g.attributes.color, uv = g.attributes.uv;
    const half = gr.size / 2, n1 = Math.round(Math.sqrt(p.count)), st = gr.size / (n1 - 1), C = W.colors, isEarth = W === WORLDS.earth;
    const hs = gr.hs && gr.hs.length === p.count ? gr.hs : (gr.hs = new Float32Array(p.count));
    for (let i = 0; i < p.count; i++) { const x = cx - half + (i % n1) * st, z = cz - half + Math.floor(i / n1) * st; hs[i] = H(x, z); }
    for (let i = 0; i < p.count; i++) {
      const ix = i % n1, iz = Math.floor(i / n1), x = cx - half + ix * st, z = cz - half + iz * st, y = hs[i];
      const hx = hs[iz * n1 + Math.min(n1 - 1, ix + 1)] - hs[iz * n1 + Math.max(0, ix - 1)], hz = hs[Math.min(n1 - 1, iz + 1) * n1 + ix] - hs[Math.max(0, iz - 1) * n1 + ix];
      const sl = Math.min(1, (Math.abs(hx) + Math.abs(hz)) / (2 * st) * 1.2);
      p.setXYZ(i, x, y - (gr.drop || 0), z); uv.setXY(i, x / 6, z / 6);
      const hn = clamp((y + 10) / 120, 0, 1), nz = noise(x * .07, z * .07);
      let c = hn < .5 ? mix3(C.low, C.mid, hn * 2) : mix3(C.mid, C.high, (hn - .5) * 2);
      c = mix3(c, C.rock, clamp(sl * 1.3, 0, 1));
      if (isEarth && y > 95) c = mix3(c, C.snow, clamp((y - 95) / 20, 0, 1) * (1 - sl * .6));
      const k = .85 + nz * .3; col.setXYZ(i, c[0] * k, c[1] * k, c[2] * k);
    }
    p.needsUpdate = col.needsUpdate = uv.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  // rocks (reuse LUNAR's rock geometry), instanced
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  const ROCKS_MAX = 1400, rocks = new THREE.InstancedMesh(S.rockGeos[1], rockMat, ROCKS_MAX); rocks.castShadow = rocks.receiveShadow = true; rocks.frustumCulled = false; rScene.add(rocks);
  let rockList = [];
  function rebuildRocks(cx, cz) {
    const d = new THREE.Object3D(), cell = 7, R = 150; let n = 0; rockList = [];
    for (let gx = Math.floor((cx - R) / cell); gx <= Math.floor((cx + R) / cell) && n < ROCKS_MAX; gx++) for (let gz = Math.floor((cz - R) / cell); gz <= Math.floor((cz + R) / cell) && n < ROCKS_MAX; gz++) {
      if (hash2(gx * 3 + 1, gz * 5 + 2) > W.rockDensity) continue;
      const x = (gx + hash2(gx, gz + 9)) * cell, z = (gz + hash2(gx + 9, gz)) * cell;
      if (Math.hypot(x, z) < 8) continue;
      const big = hash2(gx - 4, gz + 4), s = big > .93 ? 1.4 + big * 1.6 : .18 + big * .7;
      d.position.set(x, H(x, z) - s * .25, z); d.rotation.set(big * 6, hash2(gx, gz) * 6, big * 3); d.scale.set(s, s * (.6 + hash2(gz, gx) * .5), s); d.updateMatrix();
      rocks.setMatrixAt(n++, d.matrix); if (s > .65) rockList.push({ x, z, r: s * .9 });
    }
    rocks.count = n; rocks.instanceMatrix.needsUpdate = true;
  }

  // dust particles
  const DUST = 400, dustPos = new Float32Array(DUST * 3), dustVel = new Float32Array(DUST * 3), dustLife = new Float32Array(DUST);
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ size: .5, map: dotTex, transparent: true, opacity: .55, depthWrite: false, color: 0xc08560 });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; rScene.add(dust);
  let dustNext = 0;
  function emitDust(x, y, z, vx, vz) {
    const i = dustNext; dustNext = (dustNext + 1) % DUST;
    dustPos.set([x, y, z], i * 3); dustVel.set([vx + (Math.random() - .5) * 1.5, 1 + Math.random() * 2, vz + (Math.random() - .5) * 1.5], i * 3); dustLife[i] = 1.6;
  }
  function updateDust(dt) {
    const drag = W === WORLDS.moon ? 0 : 1.5;
    for (let i = 0; i < DUST; i++) {
      if (dustLife[i] <= 0) { dustPos[i * 3 + 1] = -9999; continue; }
      dustLife[i] -= dt;
      dustVel[i * 3 + 1] -= W.g * dt * (W === WORLDS.moon ? 1 : .15);
      for (let k = 0; k < 3; k++) { dustVel[i * 3 + k] *= 1 - drag * dt; dustPos[i * 3 + k] += dustVel[i * 3 + k] * dt; }
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  // the rover (NASA/JPL-Caltech Curiosity glTF)
  const rover = { root: new THREE.Group(), model: null, wheels: [], contacts: [], x: 0, z: 0, y: 0, vy: 0, heading: 0, speed: 0, steer: 0, pitch: 0, roll: 0, air: false };
  rScene.add(rover.root);
  let roverPromise = null;
  function makeLoader() {
    const loader = new THREE.GLTFLoader();
    if (THREE.DRACOLoader) { const dr = new THREE.DRACOLoader(); dr.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/'); loader.setDRACOLoader(dr); }
    return loader;
  }
  const onProg = (e) => { if (e.total > 0 && e.loaded > 0) progress(e.loaded, e.total, `Rover model ${(e.loaded / 1048576).toFixed(1)} of ${(e.total / 1048576).toFixed(1)} MB`); };
  // use a curiosity.glb picked from the player's computer (works even where downloads are blocked)
  function loadRoverFromFile(file) {
    roverPromise = new Promise((res) => {
      const url = URL.createObjectURL(file);
      makeLoader().load(url, (gltf) => { URL.revokeObjectURL(url); res(prepareRover(gltf.scene)); }, onProg, () => { URL.revokeObjectURL(url); roverPromise = null; res(null); });
    });
    return roverPromise;
  }
  function loadRover() {
    if (roverPromise) return roverPromise;
    roverPromise = new Promise((res) => {
      const loader = makeLoader();
      const done = (gltf) => res(prepareRover(gltf.scene)), fail = () => { roverPromise = null; res(null); };
      // 1) this site's own copy, 2) straight from NASA
      loader.load(A.base + A.rover.file, done, onProg, () => { if (A.rover.remote) loader.load(A.rover.remote, done, onProg, fail); else fail(); });
    });
    return roverPromise;
  }
  function prepareRover(model) {
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { ['map', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].encoding = THREE.LinearEncoding; }); m.needsUpdate = true; }); }
    });
    // orient: longest horizontal axis becomes forward (+Z), then scale to real size
    let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    if (size.x > size.z) model.rotation.y = Math.PI / 2;
    model.rotation.y += (A.rover.yawOffsetDeg || 0) * DEG;
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model); size = box.getSize(new THREE.Vector3());
    const s = A.rover.lengthMeters / Math.max(size.z, .001); model.scale.multiplyScalar(s); model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model); const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y; model.updateMatrixWorld(true);
    const holder = new THREE.Group(); holder.add(model);

    // wheels: look for nodes named like wheels and give each a pivot at its center
    const found = [];
    model.traverse((o) => { if (/wheel/i.test(o.name || '')) { let p = o.parent, nested = false; while (p) { if (found.includes(p)) nested = true; p = p.parent; } if (!nested) found.push(o); } });
    const wheels = [];
    found.slice(0, 8).forEach((w) => {
      holder.updateMatrixWorld(true);
      const wb = new THREE.Box3().setFromObject(w); if (wb.isEmpty()) return;
      const centerW = wb.getCenter(new THREE.Vector3()), parent = w.parent, pivot = new THREE.Group();
      parent.add(pivot); pivot.position.copy(parent.worldToLocal(centerW.clone())); pivot.updateMatrixWorld(true); pivot.attach(w);
      const q = new THREE.Quaternion(); parent.getWorldQuaternion(q); q.invert(); const ws = new THREE.Vector3(); parent.getWorldScale(ws);
      wheels.push({ pivot, base: pivot.position.clone(), axis: new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize(), up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
        radius: Math.max(.15, wb.getSize(new THREE.Vector3()).y / 2), local: centerW.clone(), k: 1 / Math.max(1e-6, ws.y), spin: 0 });
    });
    const contacts = wheels.length >= 4 ? wheels.map((w) => new THREE.Vector2(w.local.x, w.local.z)) : [[-1.1, 1.2], [1.1, 1.2], [-1.1, 0], [1.1, 0], [-1.1, -1.2], [1.1, -1.2]].map(([x, z]) => new THREE.Vector2(x, z));
    return { holder, wheels, contacts };
  }

  /* rover HUD + input */
  const keys = {};
  const hud = { speed: $('#rv-speed'), grav: $('#rv-grav'), planet: $('#rv-planet'), status: $('#rv-status'), pause: $('#rv-pause'), terrain: $('#rv-terrain') };
  let camYaw = 0, camPitch = .25, mouseIdle = 0, paused = false, mode = 'off', roverReady = false, shake = 0;
  addEventListener('keydown', (e) => {
    if (mode !== 'rover') return;
    if (e.code === 'Escape') { setPaused(!paused); e.preventDefault(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { keys[e.code] = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('click', () => { if (mode === 'rover' && !paused && roverReady && canvas.requestPointerLock && !matchMedia('(pointer: coarse)').matches) canvas.requestPointerLock(); });
  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => { if (mode === 'rover' && document.pointerLockElement !== canvas) dragging = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => { dragging = null; });
  addEventListener('mousemove', (e) => {
    if (mode !== 'rover' || paused) return;
    let dx = 0, dy = 0;
    if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
    else if (dragging) { dx = e.clientX - dragging[0]; dy = e.clientY - dragging[1]; dragging = [e.clientX, e.clientY]; }
    if (dx || dy) { camYaw -= dx * .0035; camPitch = clamp(camPitch + dy * .0025, -.15, 1.1); mouseIdle = 0; }
  });
  document.addEventListener('pointerlockchange', () => { if (mode === 'rover' && document.pointerLockElement !== canvas && !paused && roverReady) setPaused(true); });
  function setPaused(p) {
    paused = p; hud.pause.hidden = !p;
    if (p && document.pointerLockElement === canvas) document.exitPointerLock();
    for (const k in keys) keys[k] = false;
  }
  $('#rv-resume').addEventListener('click', () => { setPaused(false); });
  ['#rv-space', '#rv-space2'].forEach((s) => $(s).addEventListener('click', () => { location.hash = '#'; }));
  // touch controls
  document.querySelectorAll('.rv-touch [data-k]').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[k] = true; b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => { keys[k] = false; }));
  });

  let landing = false, landingKey = null;
  async function landOn(key) {
    const world = WORLDS[key]; if (!world) return; landingKey = key;
    W = world; landing = true; location.hash = '#rover';
    showLoading(`Landing on ${world.name}`);
    progress(0, 1, 'Loading the Curiosity rover model…');
    const r = await loadRover();
    if (!r) {
      ld.title.textContent = 'Rover model not found';
      ld.text.textContent = '';
      ld.err.textContent = 'NASA’s server doesn’t let other websites load the Curiosity model directly, so it has to be on this site (assets/space/models/curiosity.glb). If you’ve downloaded curiosity.glb from NASA, you can also pick it below to drive right now.';
      ld.pick.hidden = false;
      landing = false; ld.btn.hidden = false; ld.btn.textContent = 'Back to space'; ld.btn.onclick = () => { hideLoading(); ld.btn.textContent = 'Continue'; ld.btn.onclick = null; location.hash = '#'; };
      return;
    }
    if (!rover.model) { rover.model = r; rover.root.add(r.holder); }
    progress(1, 2, 'Building terrain…');
    await new Promise((res) => setTimeout(res, 30));
    setupWorld();
    progress(2, 2); hideLoading();
    roverReady = true; landing = false; setPaused(false);
    hud.status.textContent = r.wheels.length ? `Wheels animated: ${r.wheels.length}` : 'This NASA model is a single static mesh, so its wheels can’t spin. The chassis still follows the terrain.';
  }
  function setupWorld() {
    skyMat.uniforms.top.value.set(W.sky[0]); skyMat.uniforms.hor.value.set(W.sky[1]);
    rScene.fog = W.fog ? new THREE.FogExp2(W.fog, W.fogDensity) : null;
    renderer.setClearColor(W.fog || 0x000000, 1);
    sky.visible = W !== WORLDS.moon; starSky.visible = W === WORLDS.moon; earthInSky.visible = W === WORLDS.moon;
    if (W === WORLDS.moon) loadTex(T('stars')).then((t) => { if (t) { starSky.material.map = t; starSky.material.color.set(0xffffff); starSky.material.needsUpdate = true; } });
    if (W === WORLDS.moon) loadTex(T('earth')).then((t) => { if (t) { earthInSky.material.map = t; earthInSky.material.color.set(0xffffff); earthInSky.material.needsUpdate = true; } });
    hemi.color.set(W.hemi[0]); hemi.groundColor.set(W.hemi[1]); hemi.intensity = W.hemi[2];
    sunD.color.set(W.sun); sunD.intensity = W.sunI;
    rockMat.color.set(W.rock); dustMat.color.set(W.dust);
    near.cx = far.cx = NaN; Object.assign(rover, { x: 0, z: 0, heading: 0, speed: 0, steer: 0, vy: 0, air: false, prevG: null, pitch: 0, roll: 0 });
    rover.y = H(0, 0) + .05; camYaw = 0; camPitch = .25;
    recenter(true);
    rCam.position.set(0, rover.y + 4, -9);
    hud.planet.textContent = W.name; hud.grav.textContent = `${W.g} m/s²`;
    hud.terrain.textContent = `Terrain is procedurally generated from ${W.name}’s real gravity, colors and surface features. It is not a map of a real location.`;
  }
  function recenter(force) {
    const snap = (v, s) => Math.round(v / s) * s;
    const nx = snap(rover.x, near.step), nz = snap(rover.z, near.step);
    if (force || nx !== near.cx || nz !== near.cz) { rebuildGrid(near, nx, nz); rebuildRocks(nx, nz); }
    const fx = snap(rover.x, far.step), fz = snap(rover.z, far.step);
    if (force || fx !== far.cx || fz !== far.cz) rebuildGrid(far, fx, fz);
  }

  const fwd = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camWant = new THREE.Vector3(), look = new THREE.Vector3();
  function updateRover(dt) {
    if (!roverReady) { renderer.render(rScene, rCam); return; }
    const r = rover, M = r.model;
    if (!paused) {
      const up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown, left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
      const boost = keys.ShiftLeft || keys.ShiftRight, hand = keys.Space;
      const maxF = boost ? 15 : 9, maxR = -4;
      if (!r.air) {
        if (up) r.speed += (r.speed < 0 ? 10 : boost ? 6 : 3.6) * dt;
        else if (down) r.speed -= (r.speed > .3 ? 10 : 2.5) * dt;
        else r.speed *= Math.max(0, 1 - 1.2 * dt);
        if (hand) r.speed *= Math.max(0, 1 - 6 * dt);
        // slope pulls you down hills
        fwd.set(Math.sin(r.heading), 0, Math.cos(r.heading));
        const slope = (H(r.x + fwd.x, r.z + fwd.z) - H(r.x - fwd.x, r.z - fwd.z)) / 2;
        r.speed -= W.g * slope * .35 * dt;
      }
      r.speed = clamp(r.speed, maxR, maxF);
      const steerWant = ((left ? 1 : 0) - (right ? 1 : 0)) * .55 * (1 - Math.min(.5, Math.abs(r.speed) / 30));
      r.steer = lerp(r.steer, steerWant, 1 - Math.exp(-6 * dt));
      if (!r.air) r.heading += r.speed / 2.8 * Math.tan(r.steer) * dt;
      r.x += Math.sin(r.heading) * r.speed * dt; r.z += Math.cos(r.heading) * r.speed * dt;
      // rocks
      for (const k of rockList) {
        const dx = r.x - k.x, dz = r.z - k.z, d = Math.hypot(dx, dz), min = k.r + 1.3;
        if (d < min && d > 0) { r.x = k.x + dx / d * min; r.z = k.z + dz / d * min; if (Math.abs(r.speed) > 3) shake = Math.min(1, Math.abs(r.speed) / 10); r.speed *= -.25; }
      }
      // vertical: follow ground, or fly under this world's gravity
      const ground = H(r.x, r.z), prevG = r.prevG == null ? ground : r.prevG;
      r.vy -= W.g * dt; r.y += r.vy * dt;
      if (r.y <= ground) {
        if (r.air && r.vy < -4) shake = Math.min(1, -r.vy / 12);
        r.y = ground; r.vy = clamp((ground - prevG) / Math.max(dt, .001), -30, 30);
      }
      r.air = r.y > ground + .08; r.prevG = ground;
      // chassis pitch/roll from wheel contacts (suspension)
      const ch = Math.cos(r.heading), sh = Math.sin(r.heading);
      const hs = M.contacts.map((c) => H(r.x + c.y * sh + c.x * ch, r.z + c.y * ch - c.x * sh));
      let fz = 0, bz = 0, lx = 0, rx = 0, nf = 0, nb = 0, nl = 0, nr = 0;
      M.contacts.forEach((c, i) => { if (c.y > 0) { fz += hs[i]; nf++; } else { bz += hs[i]; nb++; } if (c.x > 0) { lx += hs[i]; nl++; } else { rx += hs[i]; nr++; } });
      const len = Math.max(1, Math.max(...M.contacts.map((c) => c.y)) - Math.min(...M.contacts.map((c) => c.y)));
      const wid = Math.max(1, Math.max(...M.contacts.map((c) => c.x)) - Math.min(...M.contacts.map((c) => c.x)));
      const pitchWant = nf && nb ? -Math.atan2(fz / nf - bz / nb, len) : 0, rollWant = nl && nr ? Math.atan2(lx / nl - rx / nr, wid) : 0;
      if (!r.air) { r.pitch = lerp(r.pitch, pitchWant, 1 - Math.exp(-10 * dt)); r.roll = lerp(r.roll, rollWant, 1 - Math.exp(-10 * dt)); }
      const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
      // wheels: spin and suspension travel
      M.wheels.forEach((w, i) => {
        w.spin = r.speed * dt / w.radius; w.pivot.rotateOnAxis(w.axis, w.spin);
        const c = M.contacts[i], planeH = avg + (c.y * Math.tan(-r.pitch)) + (c.x * Math.tan(r.roll));
        const travel = r.air ? -.12 : clamp(hs[i] - planeH, -.18, .18);
        w.pivot.position.copy(w.base).addScaledVector(w.up, travel * w.k);
      });
      // dust from the wheels
      if (Math.abs(r.speed) > 1.5 && !r.air && Math.random() < W.dustAmt * Math.min(1, Math.abs(r.speed) / 8)) for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1, bx = r.x - sh * 1.2 * Math.sign(r.speed) + ch * side * 1.1, bz2 = r.z - ch * 1.2 * Math.sign(r.speed) - sh * side * 1.1;
        emitDust(bx, H(bx, bz2) + .2, bz2, -sh * r.speed * .2, -ch * r.speed * .2);
      }
      recenter(false);
      mouseIdle += dt; if (mouseIdle > 2.5 && Math.abs(r.speed) > 2) camYaw = lerp(camYaw, 0, 1 - Math.exp(-1.5 * dt));
    }
    updateDust(dt);
    r.root.position.set(r.x, r.y, r.z);
    r.root.rotation.set(0, 0, 0); r.root.rotateY(r.heading); r.root.rotateX(r.pitch); r.root.rotateZ(r.roll);

    // third-person camera with terrain collision
    const yaw = r.heading + camYaw, dist = 7.5;
    camWant.set(r.x - Math.sin(yaw) * dist * Math.cos(camPitch), r.y + 1.6 + Math.sin(camPitch) * dist, r.z - Math.cos(yaw) * dist * Math.cos(camPitch));
    const minY = H(camWant.x, camWant.z) + .8; if (camWant.y < minY) camWant.y = minY;
    rCam.position.lerp(camWant, 1 - Math.exp(-8 * dt));
    const cMin = H(rCam.position.x, rCam.position.z) + .6; if (rCam.position.y < cMin) rCam.position.y = cMin;
    look.set(r.x, r.y + 1.3, r.z); rCam.lookAt(look);
    if (shake > 0) { rCam.position.x += (Math.random() - .5) * shake * .3; rCam.position.y += (Math.random() - .5) * shake * .3; shake = Math.max(0, shake - dt * 2.5); }

    // shadows follow the rover
    sunD.position.set(r.x + sunDir.x * 120, r.y + sunDir.y * 120, r.z + sunDir.z * 120); sunD.target.position.set(r.x, r.y, r.z);
    sky.position.copy(rCam.position); starSky.position.copy(rCam.position);
    if (earthInSky.visible) { earthInSky.position.set(rCam.position.x - 900, rCam.position.y + 700, rCam.position.z - 1400); earthInSky.rotation.y += dt * .02; }

    hud.speed.textContent = Math.round(Math.abs(r.speed) * 3.6);
    renderer.render(rScene, rCam);
  }

  /* =====================================================================
     MODE SWITCHING (driven by LUNAR's router)
     ===================================================================== */
  function frame(dt) { if (mode === 'space') updateSpace(dt); else if (mode === 'rover') updateRover(dt); }
  function enterSpace() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    const wasRover = mode === 'rover';
    mode = 'space'; controls.enabled = true; renderer.setClearColor(0x000000, 1);
    S.setOverride(frame); loadSpaceTextures();
    if (wasRover && focused) focus(focused);
  }
  function enterRover() {
    if (!roverReady && !landing) { location.hash = '#'; return; }
    mode = 'rover'; controls.enabled = false; canvas.style.cursor = ''; S.setOverride(frame);
  }
  function exit() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    mode = 'off'; controls.enabled = false; canvas.style.cursor = ''; renderer.setClearColor(0x000000, 1); S.setOverride(null);
    roverReady = false; hud.pause.hidden = true;
  }
  addEventListener('resize', () => { [sCam, rCam].forEach((c) => { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }); });

  window.Explore = { supported: true, enterSpace, enterRover, exit, inRover: () => mode === 'rover', hasRover: () => roverReady, missing: () => [...missing] };
})();
