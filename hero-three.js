/* Newsocapis — Calm Surface hero background.
   Three.js 0.160 floating glass cards + wavy mesh + neon orbs.
   Classic script (global THREE), so it runs from file:// and http(s) alike —
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
    /* no failIfMajorPerformanceCaveat: software GL (SwiftShader in VMs/RDP)
       must keep working instead of throwing and hiding the whole canvas */
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false
    });
  } catch (e) { fail(); return; }

  /* truly transparent backing — force a clear color with zero alpha so the
     canvas never paints an opaque slab behind the artwork. scene.background
     stays null (default), so every frame clears to transparent. */
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  scene.background = null;
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  /* boot far back at a high angle for the preloader: the render loop eases
     the camera forward during the intro, then NewsocHero.enter() glides it
     to rest (z=9). */
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
    /* lightbox environment — a substitute for RoomEnvironment so no extra
       module import is needed (classic-script friendly) */
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

  /* ---------- helpers ---------- */
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

  /* ---------- 1. floating glass cards ---------- */
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

  var glassMaterials = [];
  var cardGeometries = [];

  CARD_SPECS.forEach(function (spec) {
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

    var mat = new THREE.MeshPhysicalMaterial({
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
    glassMaterials.push(mat);

    var card = new THREE.Mesh(geo, mat);
    card.position.set(spec.x, spec.y, spec.z);
    card.rotation.set(0, spec.ry, spec.rz);
    card.userData.spec = spec;
    /* dormant during the preloader intro — staggered back in by enter();
       lift offsets below rest so the cards "fly up" at the seamless entrance */
    if (introEnabled) {
      card.scale.setScalar(0.92);
      card.userData.lift = -1.4;
      mat.opacity = 0;
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

  /* ---------- 2. wavy mesh — the "calm surface" ---------- */
  var sheet = new THREE.PlaneGeometry(44, 24, 96, 56);
  var sheetPos = sheet.attributes.position;
  /* store resting positions so waves never drift away */
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
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---------- initial camera glide ----------
     The preloader drives the hero z from the deep high-angle offset toward
     the rest position (9) with an expo-out settle, plus a staggered slide-in
     of the glass cards. Self-contained (no GSAP dep). */
  var camRaf = null;
  var camStarted = false;
  var revealRaFs = [];
  var revealTimer = null;
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
  function enterCamera(ms) {
    if (camStarted || disposed) return;
    camStarted = true;
    intro.on = false;
    var fromZ = camera.position.z;
    var fromY = camera.position.y;
    var t0 = performance.now();
    var dur = ms || 1200;
    function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = easeOutExpo(p);
      camera.position.z = fromZ + (9 - fromZ) * e;
      camera.position.y = fromY + (0 - fromY) * e;
      if (p < 1) { camRaf = requestAnimationFrame(step); }
      else { camRaf = null; }
    }
    camRaf = requestAnimationFrame(step);

    /* staggered glass cards fly up from below + fade into their resting float */
    cardGroup.children.forEach(function (card, i) {
      var cStart = t0 + (0.05 + i * 0.05) * 1000;
      var mat = card.material;
      var liftStart = card.userData.lift || -1.4;
      var handle = { id: null };
      function cStep(now) {
        var p = Math.min(1, Math.max(0, (now - cStart) / 650));
        var e = easeOutQuart(p);
        card.scale.setScalar(0.92 + 0.08 * e);
        card.userData.lift = liftStart * (1 - e);
        mat.opacity = 0.9 * e;
        if (p < 1) {
          handle.id = requestAnimationFrame(cStep);
        } else {
          handle.id = null;
          card.scale.setScalar(1);
          card.userData.lift = 0;
          mat.opacity = 0.9;
        }
      }
      handle.id = requestAnimationFrame(cStep);
      revealRaFs.push(function () { if (handle.id !== null) cancelAnimationFrame(handle.id); });
    });
  }

  /* public handle — wired by script.js entrance */
  window.NewsocHero = {
    enter: enterCamera
  };

  /* ---------- pointer parallax ---------- */
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointerMove(e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  }
  if (window.PointerEvent) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  } else {
    window.addEventListener('mousemove', onPointerMove, { passive: true });
  }

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
    /* dispose fully only on a real leave; keep the context alive for bfcache */
    if (e && e.persisted) return;
    dispose();
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !pageHidden) startLoop();
  });

  /* ---------- render loop ---------- */
  function renderFrame() {
    renderer.render(scene, camera);
  }

  var lastT = null;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    if (pageHidden || !inView) return;

    /* frame delta — intro + creative timers stay refresh-rate-proof.
       Guarded: a malformed rAF timestamp (undefined/NaN) must never poison
       `clock`, or the wavy sheet / camera / all sine motion go NaN and the
       whole canvas renders blank. */
    var dt = 0.016;
    if (typeof now === 'number' && isFinite(now)) {
      if (typeof lastT === 'number' && isFinite(lastT)) {
        dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
      }
      lastT = now;
    }
    clock += dt;

    /* smooth parallax (lerp toward the pointer) */
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    /* camera drift + parallax */
    if (intro.on) {
      /* preloader intro — slow zoom from the high corner, keyed to clock */
      var introP = Math.min(1, clock / 3.0);
      var ki = 1 - Math.pow(1 - introP, 2);
      camera.position.z = 22 - (22 - 12) * ki;
      camera.position.y = 2.4 - (2.4 - 0.6) * ki;
      camera.position.x = Math.sin(clock * 0.18) * 0.18;
    } else {
      camera.position.x = pointer.x * 0.85 + Math.sin(clock * 0.18) * 0.18;
      camera.position.y = pointer.y * 0.5 + Math.cos(clock * 0.14) * 0.12;
    }
    camera.lookAt(0, 0, 0);

    /* card group — slow auto-turn plus pointer response */
    cardGroup.rotation.y = pointer.x * 0.22 + Math.sin(clock * 0.05) * 0.05;
    cardGroup.rotation.x = -pointer.y * 0.06;

    /* floating sine motion per card (+ the enter lift that eases to 0) */
    cardGroup.children.forEach(function (card) {
      var s = card.userData.spec;
      card.position.y = s.y + Math.sin(clock * s.speed + s.phase) * s.amp + (card.userData.lift || 0);
      card.rotation.z = s.rz + Math.sin(clock * s.speed * 0.8 + s.phase) * 0.05;
    });

    /* soft orbs breathing */
    orbs.forEach(function (orb) {
      var k = 1 + Math.sin(clock * orb.userData.speed + orb.userData.op) * 0.18;
      orb.scale.setScalar(k);
      orb.material.opacity = orb.userData.op * (0.75 + 0.25 * Math.sin(clock * orb.userData.speed));
    });

    /* particles slow drift */
    stars.rotation.y = clock * 0.02;
    stars.position.y = 0.2 + Math.sin(clock * 0.3) * 0.15;

    ripple();
    renderFrame();
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(animate);
  }

  /* ---------- dispose ---------- */
  var disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (camRaf !== null) cancelAnimationFrame(camRaf);
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
    glassMaterials.forEach(function (m) { m.dispose(); });
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

  /* auto-reveal safety — if script.js never hands off NewsocHero.enter()
     (slow CDN, racy teardown), glide the camera in + fly the cards up
     anyway, so the hero is never left on the dormant intro frame */
  revealTimer = window.setTimeout(function () {
    revealTimer = null;
    if (!camStarted) enterCamera(1200);
  }, 4300);
})();