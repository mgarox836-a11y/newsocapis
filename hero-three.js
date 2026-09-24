/* Newsocapis — "Prism Aperture" Calm Surface hero.
   Three.js 0.160 floating prism-glass cards + wavy mesh + neon orbs,
   cinematic post-processing (bloom / radial CA / vignette / grain),
   spring-physics camera, and a scroll-scrubbed burst hand-off.
   Classic script (global THREE) so it runs from file:// and http(s) alike —
   no ES-module CORS restrictions. Motion always runs — reduced motion is
   ignored by design.
   Cleanup: rAF is cancelled, listeners removed, and GPU resources disposed on
   real unload (pagehide) only; a bfcache restore re-arms the loop instead. */

(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('hero-webgl');
  if (!hero || !canvas) return;

  function fail() {
    hero.classList.add('no-webgl');
    if (window.console) console.warn('Newsocapis hero: WebGL unavailable, using static fallback.');
  }

  if (typeof THREE === 'undefined') { fail(); return; }

  /* ---------- adaptive quality ---------- */
  var isMobile =
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ||
    window.innerWidth < 768;
  var maxPx = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  var PARTICLE_COUNT = isMobile ? 280 : 520;
  /* ---------- scene bootstrap ---------- */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    });
  } catch (e) { fail(); return; }

  renderer.setClearColor(0x000000, 0);

  /* one place to catch a bad prism-glass compile → drop to physical glass */
  var glassActive = true;
  var fallbackMats = [];
  renderer.debug.onShaderError = function () { glassFallback(); };

  var scene = new THREE.Scene();
  scene.background = null;
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  var introEnabled = true;
  camera.position.set(0, introEnabled ? 2.4 : 0, introEnabled ? 22 : 9);
  camera.lookAt(0, 0, 0);
  var intro = { on: introEnabled };

  var NEON = {
    cyan: new THREE.Color(0x2ad8ff),
    green: new THREE.Color(0x5dff9e),
    magenta: new THREE.Color(0xff3fc2),
    purple: new THREE.Color(0x9b6bff),
    bone: new THREE.Color(0xfffdf9)
  };

  /* ---------- render targets + post pipeline (custom, classic-script-safe) ----------
     sceneRT   — full-buffer scene (refraction backdrop sampled by the glass).
     backRT    — same scene with the cards hidden, rendered right before the
                 cards so the prism glass refracts THIS frame's backdrop.
     bloomA/B  — half-res ping-pong buffers for the bloom glow. */
  function makeRT(w, h) {
    return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false
    });
  }
  var backRT = makeRT(2, 2);
  var sceneRT = makeRT(2, 2);
  var bloomA = makeRT(2, 2);
  var bloomB = makeRT(2, 2);

  /* ---------- lights + environment (glass transmission needs an envmap) ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);
  scene.add(tinted(new THREE.DirectionalLight(0xff3fc2, 0.5), -2, -1, 3));
  scene.add(tinted(new THREE.DirectionalLight(0x2ad8ff, 0.55), 2, 1, 3));
  scene.add(tinted(new THREE.DirectionalLight(0x9b6bff, 0.45), 0, 3, -2));

  var pmrem = new THREE.PMREMGenerator(renderer);
  try {
    scene.environment = pmrem.fromScene(makeEnvScene(), 0.04).texture;
  } catch (e) { /* envmap is an enhancement, never a blocker */ }

  function makeEnvScene() {
    var s = new THREE.Scene();
    function panel(w, color, x, y, z, rx, ry) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w / 3.2),
        new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })
      );
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      s.add(m);
      return m;
    }
    panel(6, 0xffffff, 0, 4, -6, 0.2, 0);
    panel(8, 0xffffff, 7, 0, 2, -0.9, -0.5);
    panel(5, 0x2ad8ff, -7, 0, 1, -0.9, 0.5);
    panel(6, 0xff3fc2, 0, -3, -5, -0.2, 0);
    panel(5, 0x9b6bff, 0, 3, 5, 0.8, 0);
    panel(8, 0xffffff, 0, 0, -11, 0, 0);
    return s;
  }

  function tinted(light, x, y, z) {
    light.position.set(x, y, z);
    return light;
  }

  function roundedRectShape(w, h, r) {
    var s = new THREE.Shape();
    var x = -w / 2;
    var y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  function makeGlowTexture() {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    var t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  }

  /* ---------- primitive glass — drop-in physical fallback ---------- */
  function makePhysicalGlass(spec) {
    return new THREE.MeshPhysicalMaterial({
      color: spec.tint.clone().multiplyScalar(0.55),
      emissive: spec.tint,
      emissiveIntensity: 0.16,
      metalness: 0.1,
      transmission: 0.92,
      roughness: 0.12,
      ior: 1.45,
      thickness: 0.8,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      transparent: true,
      opacity: 0.9,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function glassFallback() {
    if (!glassActive) return;
    glassActive = false;
    CARD_SPECS.forEach(function (spec, i) {
      var card = cardGroup.children[i];
      if (!card) return;
      var m = makePhysicalGlass(spec);
      fallbackMats.push(m);
      card.material = m;
      if (introEnabled) m.opacity = card.userData.lift != null ? 0 : 0.9;
    });
    /* prune unused uniforms so the glass mats are gc-able on dispose */
    glassMats.length = 0;
  }

  /* ---------- 1. prism glass cards ---------- */
  var cardGroup = new THREE.Group();
  scene.add(cardGroup);

  var CARD_SPECS = [
    { w: 1.9, h: 2.6, x: 2.1, y: 1.6, z: -1.6, ry: 0.45, rz: -0.12, tint: NEON.cyan, edge: NEON.cyan, speed: 0.55, amp: 0.28, phase: 0.0 },
    { w: 1.6, h: 2.3, x: 4.7, y: 0.5, z: -2.5, ry: -0.5, rz: 0.1, tint: NEON.magenta, edge: NEON.magenta, speed: 0.42, amp: 0.34, phase: 1.4 },
    { w: 1.7, h: 2.4, x: -3.0, y: 1.0, z: -2.2, ry: 0.8, rz: 0.06, tint: NEON.purple, edge: NEON.purple, speed: 0.6, amp: 0.26, phase: 2.2 },
    { w: 1.4, h: 2.1, x: 6.1, y: -1.4, z: -2.0, ry: 0.25, rz: -0.2, tint: NEON.green, edge: NEON.green, speed: 0.48, amp: 0.3, phase: 3.1 },
    { w: 1.5, h: 2.2, x: 0.7, y: -1.9, z: -2.9, ry: -0.35, rz: 0.16, tint: NEON.cyan, edge: NEON.bone, speed: 0.36, amp: 0.22, phase: 4.0 },
    { w: 1.8, h: 2.5, x: -5.4, y: -1.0, z: -3.1, ry: -0.55, rz: 0.05, tint: NEON.purple, edge: NEON.purple, speed: 0.52, amp: 0.32, phase: 0.8 },
    { w: 1.3, h: 2.0, x: 3.7, y: 2.3, z: -3.6, ry: 0.5, rz: -0.18, tint: NEON.bone, edge: NEON.magenta, speed: 0.5, amp: 0.3, phase: 5.2 }
  ];

  var glassMats = [];
  var cardGeometries = [];

  var GLASS_VERT = [
    'varying vec3 vWorldPos;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  vNormal = normalize(normalMatrix * normal);',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var GLASS_FRAG = [
    'precision highp float;',
    'uniform sampler2D tRefract;',
    'uniform vec3 uTint;',
    'uniform vec3 uEmissive;',
    'uniform float uEmissiveIntensity;',
    'uniform float uIOR;',
    'uniform float uThickness;',
    'uniform float uChroma;',
    'uniform float uEdgeGlow;',
    'uniform float uOpacity;',
    'uniform vec2 uRes;',
    'varying vec3 vWorldPos;',
    'varying vec3 vNormal;',
    'varying vec2 vUv;',
    'float fresnelSchlick(float f, float f0) { return f0 + (1.0 - f0) * pow(max(1.0 - f, 0.0), 5.0); }',
    'void main() {',
    '  vec3 n = normalize(vNormal);',
    '  vec3 v = normalize(cameraPosition - vWorldPos);',
    '  float f = 1.0 - abs(dot(n, v));',
    '  float fres = fresnelSchlick(f, 0.04);',
    '  vec3 ref = refract(-v, n, 1.0 / uIOR);',
    '  if (dot(ref, ref) < 1e-4) ref = n;',
    '  ref = normalize(ref);',
    '  vec3 worldSample = vWorldPos + ref * (uThickness * 0.35 + fres * 0.6);',
    '  vec4 clip = projectionMatrix * viewMatrix * vec4(worldSample, 1.0);',
    '  vec2 refUv = (clip.xy / clip.w) * 0.5 + 0.5;',
    '  vec2 baseUv = gl_FragCoord.xy * uRes;',
    '  vec2 disp = refUv - baseUv;',
    '  vec3 col;',
    '  col.r = texture2D(tRefract, clamp(refUv + disp * uChroma, 0.0, 1.0)).r;',
    '  col.g = texture2D(tRefract, clamp(refUv, 0.0, 1.0)).g;',
    '  col.b = texture2D(tRefract, clamp(refUv - disp * uChroma, 0.0, 1.0)).b;',
    '  float dens = exp(-uThickness * (0.35 + 0.65 * fres));',
    '  vec3 body = mix(uTint * dens * 1.15, col, clamp(dens + 0.15, 0.0, 1.0));',
    '  vec3 glow = uEmissive * uEmissiveIntensity * (0.35 + 0.65 * fres);',
    '  vec3 outCol = body + glow + uTint * uEdgeGlow * pow(fres, 2.5) * 1.2;',
    '  gl_FragColor = vec4(outCol, uOpacity);',
    '}'
  ].join('\n');

  CARD_SPECS.forEach(function (spec, index) {
    var geo = new THREE.ExtrudeGeometry(roundedRectShape(spec.w, spec.h, 0.14), {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 6
    });
    geo.translate(0, 0, -0.09);
    cardGeometries.push(geo);

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        tRefract: { value: backRT.texture },
        uTint: { value: spec.tint.clone() },
        uEmissive: { value: spec.tint.clone() },
        uEmissiveIntensity: { value: index === 6 ? 0.5 : 0.35 },
        uIOR: { value: 1.45 },
        uThickness: { value: 1.1 + (index % 3) * 0.25 },
        uChroma: { value: 1.6 },
        uEdgeGlow: { value: 0.6 },
        uOpacity: { value: introEnabled ? 0 : 0.92 },
        uRes: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    glassMats.push(mat);

    var card = new THREE.Mesh(geo, mat);
    card.position.set(spec.x, spec.y, spec.z);
    card.rotation.set(0, spec.ry, spec.rz);
    card.userData.spec = spec;
    if (introEnabled) {
      card.userData.lift = -1.4;
    } else {
      card.userData.lift = 0;
    }

    var neonEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({
        color: spec.edge,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    card.add(neonEdge);

    cardGroup.add(card);
  });

  function setGlassOpacity(mat, v) {
    if (mat.uniforms && mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = v;
    else mat.opacity = v;
  }

  /* ---------- 2. wavy mesh — the "calm surface" ---------- */
  var sheet = new THREE.PlaneGeometry(44, 24, 96, 56);
  var sheetPos = sheet.attributes.position;
  sheet.setAttribute('aBase', new THREE.BufferAttribute(sheetPos.array.slice(), 3));
  var sheetMat = new THREE.MeshBasicMaterial({
    color: NEON.cyan,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  var wave = new THREE.Mesh(sheet, sheetMat);
  wave.rotation.x = -Math.PI / 2;
  wave.rotation.z = 0.12;
  wave.position.set(1.4, -2.6, -4.5);
  scene.add(wave);

  function ripple() {
    var arr = sheetPos.array;
    var base = sheet.attributes.aBase.array;
    for (var i = 0; i < arr.length; i += 3) {
      var x = base[i];
      var y = base[i + 1];
      arr[i + 2] =
        0.62 * Math.sin(x * 0.55 + clock * 0.8) +
        0.34 * Math.cos(y * 0.8 - clock * 0.55) +
        0.18 * Math.sin((x * 0.35 - y * 0.4) + clock * 0.3);
    }
    sheetPos.needsUpdate = true;
  }

  /* ---------- 3. orb particles + soft orbs ---------- */
  var COUNT = PARTICLE_COUNT;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(COUNT * 3);
  var pCol = new Float32Array(COUNT * 3);
  var palette = [NEON.cyan, NEON.green, NEON.magenta, NEON.purple];
  for (var pi = 0; pi < COUNT; pi++) {
    pPos[pi * 3] = (Math.random() * 2 - 1) * 14;
    pPos[pi * 3 + 1] = (Math.random() * 2 - 1) * 6.5;
    pPos[pi * 3 + 2] = (Math.random() * 2 - 1) * 5 - 3;
    var c = palette[(Math.random() * palette.length) | 0];
    pCol[pi * 3] = c.r;
    pCol[pi * 3 + 1] = c.g;
    pCol[pi * 3 + 2] = c.b;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

  var pMat = new THREE.PointsMaterial({
    size: 0.07,
    map: makeGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  var stars = new THREE.Points(pGeo, pMat);
  stars.position.set(0.8, 0.2, -1.5);
  scene.add(stars);

  var orbSpecs = [
    { x: 4.8, y: -1.8, z: -5, r: 1.9, color: NEON.magenta, op: 0.09, speed: 0.5 },
    { x: -4.6, y: 1.6, z: -6, r: 2.4, color: NEON.purple, op: 0.08, speed: 0.42 },
    { x: 0.8, y: 2.8, z: -6, r: 1.5, color: NEON.cyan, op: 0.08, speed: 0.6 }
  ];
  var orbs = orbSpecs.map(function (os) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(os.r, 24, 24),
      new THREE.MeshBasicMaterial({
        color: os.color,
        transparent: true,
        opacity: os.op,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    m.position.set(os.x, os.y, os.z);
    m.userData.op = os.op;
    m.userData.speed = os.speed;
    scene.add(m);
    return m;
  });

  /* ---------- post-processing passes (bright → gaussian bloom → composite) ---------- */
  var postScene = new THREE.Scene();
  var postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var postQuad = new THREE.PlaneGeometry(2, 2);

  var FS_VERT = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  var FS_BRIGHT = [
    'uniform sampler2D tScene;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec3 c = texture2D(tScene, vUv).rgb;',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '  float f = smoothstep(0.68, 0.84, l);',
    '  gl_FragColor = vec4(c * f, 1.0);',
    '}'
  ].join('\n');

  var FS_BLUR = [
    'uniform sampler2D tSource;',
    'uniform vec2 uDir;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec2 off = uDir;',
    '  vec3 col = texture2D(tSource, vUv).rgb * 0.227027;',
    '  col += texture2D(tSource, vUv + off).rgb * 0.1945946;',
    '  col += texture2D(tSource, vUv - off).rgb * 0.1945946;',
    '  col += texture2D(tSource, vUv + off * 2.0).rgb * 0.1216216;',
    '  col += texture2D(tSource, vUv - off * 2.0).rgb * 0.1216216;',
    '  col += texture2D(tSource, vUv + off * 3.0).rgb * 0.054054;',
    '  col += texture2D(tSource, vUv - off * 3.0).rgb * 0.054054;',
    '  col += texture2D(tSource, vUv + off * 4.0).rgb * 0.016216;',
    '  col += texture2D(tSource, vUv - off * 4.0).rgb * 0.016216;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var FS_COMPOSITE = [
    'uniform sampler2D tScene;',
    'uniform sampler2D tBloom;',
    'uniform float uTime;',
    'uniform float uChroma;',
    'uniform float uVignette;',
    'uniform float uGrain;',
    'uniform float uBloom;',
    'varying vec2 vUv;',
    'float hash12(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 c = uv - 0.5;',
    '  float d = length(c);',
    '  vec2 caOff = c * d * uChroma;',
    '  vec3 col;',
    '  col.r = texture2D(tScene, uv + caOff).r;',
    '  col.g = texture2D(tScene, uv).g;',
    '  col.b = texture2D(tScene, uv - caOff).b;',
    '  col += texture2D(tBloom, uv).rgb * uBloom;',
    '  float vig = smoothstep(1.0, 0.4, d);',
    '  col *= mix(uVignette, 1.0, vig);',
    '  float g = (hash12(uv * 1600.0 + vec2(uTime * 7.0, uTime * 13.0)) - 0.5) * uGrain * 2.0;',
    '  col += g;',
    '  float a = texture2D(tScene, uv).a;',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  var brightMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null } },
    vertexShader: FS_VERT,
    fragmentShader: FS_BRIGHT
  });
  var brightMesh = new THREE.Mesh(postQuad, brightMat);
  postScene.add(brightMesh);

  var blurMat = new THREE.ShaderMaterial({
    uniforms: { tSource: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: FS_VERT,
    fragmentShader: FS_BLUR
  });
  var blurMesh = new THREE.Mesh(postQuad, blurMat);
  postScene.add(blurMesh);

  var compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      uTime: { value: 0 },
      uChroma: { value: 0.0035 },
      uVignette: { value: 0.72 },
      uGrain: { value: 0.012 },
      uBloom: { value: 0.6 }
    },
    vertexShader: FS_VERT,
    fragmentShader: FS_COMPOSITE
  });
  var compositeMesh = new THREE.Mesh(postQuad, compositeMat);
  postScene.add(compositeMesh);

  /* ---------- sizing / resize ---------- */
  var W = 1;
  var H = 1;

  renderer.setPixelRatio(maxPx);

  function resize() {
    var r = hero.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(maxPx);

    var dpr = renderer.getPixelRatio() || maxPx;
    var bw = Math.round(W * dpr);
    var bh = Math.round(H * dpr);
    backRT.setSize(bw, bh);
    sceneRT.setSize(bw, bh);
    var bhalfW = Math.max(2, bw >> 1);
    var bhalfH = Math.max(2, bh >> 1);
    bloomA.setSize(bhalfW, bhalfH);
    bloomB.setSize(bhalfW, bhalfH);

    var inv = new THREE.Vector2(1 / bw, 1 / bh);
    glassMats.forEach(function (m) { m.uniforms.uRes.value.copy(inv); });
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---------- initial camera glide ----------
     The glide is pure state; animate() consumes it so the spring-driven
     camera never fights a second writer. */
  var camStarted = false;
  var glide = null;
  var revealRaFs = [];
  var revealTimer = null;
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function enterCamera(ms) {
    if (camStarted || disposed) return;
    camStarted = true;
    intro.on = false;
    glide = {
      t0: performance.now(),
      dur: ms || 1200,
      fromZ: camera.position.z,
      fromY: camera.position.y
    };

    var t0 = glide.t0;
    cardGroup.children.forEach(function (card, i) {
      var cStart = t0 + (0.05 + i * 0.05) * 1000;
      var mat = card.material;
      var liftStart = card.userData.lift || -1.4;
      var handle = { id: null };
      function cStep(now) {
        var p = Math.min(1, Math.max(0, (now - cStart) / 650));
        var e = easeOutQuart(p);
        card.userData.lift = liftStart * (1 - e);
        setGlassOpacity(mat, 0.92 * e);
        if (p < 1) {
          handle.id = requestAnimationFrame(cStep);
        } else {
          handle.id = null;
          card.userData.lift = 0;
          setGlassOpacity(mat, 0.92);
        }
      }
      handle.id = requestAnimationFrame(cStep);
      revealRaFs.push(function () { if (handle.id !== null) cancelAnimationFrame(handle.id); });
    });
  }

  /* ---------- spring physics (camera inertia = premium pointer follow) ---------- */
  var spring = { x: 0, y: 0, vx: 0, vy: 0 };
  var SPRING_STIFFNESS = 120;
  var SPRING_DAMPING = 0.0008;

  var springTarget = { x: 0, y: 0 };
  function onPointerMove(e) {
    springTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    springTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }
  if (window.PointerEvent) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  } else {
    window.addEventListener('mousemove', onPointerMove, { passive: true });
  }

  function stepSpring(s, target, dt) {
    s.vx += (target.x - s.x) * SPRING_STIFFNESS * dt;
    s.vy += (target.y - s.y) * SPRING_STIFFNESS * dt;
    var m = Math.pow(SPRING_DAMPING, dt);
    s.vx *= m;
    s.vy *= m;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  /* scroll-scrubbed "card burst" — consumed by animate() */
  var burst = { p: 0 };

  /* ---------- lifecycle (pause when hidden / off-screen) ---------- */
  var inView = true;
  var pageHidden = false;
  var rafId = null;
  var clock = 0;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { inView = en.isIntersecting; });
    }, { rootMargin: '120px' }).observe(hero);
  }

  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
  });

  window.addEventListener('pagehide', function (e) {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    if (e && e.persisted) return;
    dispose();
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !pageHidden) startLoop();
  });

  /* ---------- render ---------- */
  function renderFrame() {
    if (glassActive) {
      cardGroup.visible = false;
      renderer.setRenderTarget(backRT);
      renderer.render(scene, camera);
      cardGroup.visible = true;
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
    } else {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
    }

    brightMat.uniforms.tScene.value = sceneRT.texture;
    renderer.setRenderTarget(bloomA);
    renderer.render(postScene, postCam);

    blurMat.uniforms.uDir.value.set(1 / Math.max(1, bloomA.width), 0);
    blurMat.uniforms.tSource.value = bloomA.texture;
    renderer.setRenderTarget(bloomB);
    renderer.render(postScene, postCam);

    blurMat.uniforms.uDir.value.set(0, 1 / Math.max(1, bloomB.height));
    blurMat.uniforms.tSource.value = bloomB.texture;
    renderer.setRenderTarget(bloomA);
    renderer.render(postScene, postCam);

    compositeMat.uniforms.tScene.value = sceneRT.texture;
    compositeMat.uniforms.tBloom.value = bloomA.texture;
    compositeMat.uniforms.uTime.value = clock;
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  var lastT = null;
  // Animate loop — always re-arms, but a disposed renderer must never bis' again
  function animate(now) {
    if (disposed) { rafId = null; return; }
    rafId = requestAnimationFrame(animate);
    if (pageHidden || !inView) return;

    var dt = 0.016;
    if (typeof now === 'number' && isFinite(now)) {
      if (typeof lastT === 'number' && isFinite(lastT)) {
        dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
      }
      lastT = now;
    }
    clock += dt;

    var bp = burst.p;

    if (!intro.on) stepSpring(spring, springTarget, dt);

    if (intro.on) {
      var introP = Math.min(1, clock / 3.0);
      var ki = 1 - Math.pow(1 - introP, 2);
      camera.position.z = 22 - (22 - 12) * ki;
      camera.position.y = 2.4 - (2.4 - 0.6) * ki;
      camera.position.x = Math.sin(clock * 0.18) * 0.18;
      camera.lookAt(0, 0, 0);
    } else if (glide) {
      var gp = Math.min(1, (performance.now() - glide.t0) / glide.dur);
      var ge = easeOutExpo(gp);
      camera.position.z = glide.fromZ + (9 - glide.fromZ) * ge;
      camera.position.y = glide.fromY + (0 - glide.fromY) * ge;
      if (gp >= 1) glide = null;
    } else {
      camera.position.y = spring.y * 0.5 + Math.cos(clock * 0.14) * 0.12;
      camera.position.z = bp > 0.001 ? 9 - bp * 4.2 : 9;
    }
    if (!intro.on) {
      camera.position.x = spring.x * 0.85 + Math.sin(clock * 0.18) * 0.18 + bp * 0.5;
      camera.lookAt(0, bp > 0.001 ? 0.25 : 0, bp > 0.001 ? -1.2 : 0);
    }

    cardGroup.rotation.y = spring.x * 0.22 + Math.sin(clock * 0.05) * 0.05;
    cardGroup.rotation.x = -spring.y * 0.06;

    cardGroup.children.forEach(function (card, i) {
      var s = card.userData.spec;
      var dir = card.userData.burstDir;
      if (!dir) {
        var a = (i / CARD_SPECS.length) * Math.PI * 2;
        dir = card.userData.burstDir = {
          x: Math.cos(a),
          y: Math.sin(a) * 0.6,
          rz: (Math.random() * 2 - 1) * 1.4,
          z: 2.0 + ((i * 37) % 5) * 0.5
        };
      }
      card.position.x = s.x + dir.x * bp * 3.0 + Math.sin(clock * s.speed + s.phase) * s.amp * 0.4;
      card.position.y = s.y + Math.sin(clock * s.speed + s.phase) * s.amp + dir.y * bp * 2.2 + (card.userData.lift || 0);
      card.position.z = s.z - dir.z * bp * 2.6;
      card.rotation.y = s.ry + dir.rz * bp;
      card.rotation.z = s.rz + Math.sin(clock * s.speed * 0.8 + s.phase) * 0.05 + bp * 0.18;
      card.scale.setScalar(1 + bp * 0.06);
    });

    orbs.forEach(function (orb) {
      var k = 1 + Math.sin(clock * orb.userData.speed + orb.userData.op) * 0.18;
      orb.scale.setScalar(k + bp * 0.4);
      orb.material.opacity = orb.userData.op * (0.75 + 0.25 * Math.sin(clock * orb.userData.speed));
    });

    stars.rotation.y = clock * 0.02 + bp * 1.6;
    stars.position.y = 0.2 + Math.sin(clock * 0.3) * 0.15;
    stars.scale.setScalar(1 + bp * 0.35);

    wave.position.y = -2.6 + bp * 0.7;
    sheetMat.opacity = 0.16 + bp * 0.12;

    ripple();
    renderFrame();
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(animate);
  }

  /* ---------- public handle ---------- */
  window.NewsocHero = {
    enter: enterCamera,
    scrollBurst: function (p) {
      burst.p = Math.min(1, Math.max(0, p || 0));
    }
  };

  /* ---------- dispose ---------- */
  var disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (revealTimer !== null) clearTimeout(revealTimer);
    revealRaFs.forEach(function (cancel) { cancel(); });
    revealRaFs = [];
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('mousemove', onPointerMove);
    scene.traverse(function (o) { disposeObj(o); });
    sheet.dispose();
    sheetMat.dispose();
    pGeo.dispose();
    pMat.dispose();
    cardGeometries.forEach(function (g) { g.dispose(); });
    glassMats.forEach(function (m) { m.dispose(); });
    fallbackMats.forEach(function (m) { m.dispose(); });
    brightMat.dispose();
    blurMat.dispose();
    compositeMat.dispose();
    postQuad.dispose();
    backRT.dispose();
    sceneRT.dispose();
    bloomA.dispose();
    bloomB.dispose();
    if (pmrem) pmrem.dispose();
    renderer.dispose();
  }

  function disposeObj(o) {
    if (!o) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
      else o.material.dispose();
    }
    if (o.map) o.map.dispose();
  }

  startLoop();

  /* auto-reveal safety — if script.js never hands off NewsocHero.enter() */
  revealTimer = window.setTimeout(function () {
    revealTimer = null;
    if (!camStarted) enterCamera(1200);
  }, 4300);
})();