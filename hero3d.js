(function () {
  const THREE = window.THREE;
  const el = document.getElementById('hero3d');
  if (!el) return;
  if (!THREE) return;
  if (!window.WebGLRenderingContext) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  el.appendChild(canvas);

  const group = new THREE.Group();
  scene.add(group);

  function fitObject() {
    let w = el.clientWidth;
    let h = el.clientHeight;
    if (!w || !h) {
      w = window.innerWidth;
      h = window.innerHeight;
    }
    if (!w || !h) return;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const halfW = halfH * aspect;
    const scale = Math.max(0.25, Math.min(1, (halfW - 0.35) / 3.4, (halfH - 0.35) / 3.4));
    group.scale.setScalar(scale);
  }

  function resize() {
    let w = el.clientWidth;
    let h = el.clientHeight;
    if (!w || !h) {
      w = window.innerWidth;
      h = window.innerHeight;
    }
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitObject();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(el);
  window.addEventListener('resize', resize);
  resize();

  const glowTexture = (function makeGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(179, 240, 33, 0.5)');
    grad.addColorStop(0.35, 'rgba(163, 230, 53, 0.18)');
    grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  aura.scale.setScalar(7);
  group.add(aura);

  const knotGeo = new THREE.TorusKnotGeometry(1.5, 0.42, 150, 22);
  const knot = new THREE.Mesh(knotGeo, new THREE.MeshBasicMaterial({
    color: 0xa3e635,
    wireframe: true
  }));
  group.add(knot);

  const glowFill = new THREE.Mesh(knotGeo.clone(), new THREE.MeshBasicMaterial({
    color: 0xa3e635,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  glowFill.scale.multiplyScalar(0.92);
  group.add(glowFill);

  const halo = new THREE.Mesh(knotGeo.clone(), new THREE.MeshBasicMaterial({
    color: 0xb3f021,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  halo.scale.multiplyScalar(1.07);
  group.add(halo);

  const ringGeo = new THREE.TorusGeometry(2.7, 0.018, 8, 160);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xa3e635,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.set(Math.PI / 2.35, 0.5, 0);
  group.add(ring1);

  const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
  ring2.material.opacity = 0.25;
  ring2.scale.setScalar(1.22);
  ring2.rotation.set(Math.PI / 1.9, -0.5, 0.6);
  group.add(ring2);

  const satGeo = new THREE.IcosahedronGeometry(0.08, 0);
  const satMat = new THREE.MeshBasicMaterial({ color: 0xb3f021, wireframe: true });
  const sats = [];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(satGeo, satMat);
    group.add(mesh);
    sats.push({
      mesh,
      a: (i * Math.PI * 2) / 3,
      r: 3.05,
      y: -0.7 + i * 0.7,
      s: 0.45 + i * 0.12
    });
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let dragRX = 0.35;
  let dragRY = 0;
  let curRX = 0.35;
  let curRY = 0;
  let hoverX = 0;
  let hoverY = 0;
  let autoX = 0;
  let autoY = 0;

  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener('pointermove', e => {
    if (dragging) {
      dragRY += (e.clientX - lastX) * 0.009;
      dragRX += (e.clientY - lastY) * 0.009;
      dragRX = Math.max(-1.3, Math.min(1.3, dragRX));
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    const r = canvas.getBoundingClientRect();
    if (r.width) {
      hoverX = ((e.clientX - r.left) / r.width) * 2 - 1;
      hoverY = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }
  });

  const endDrag = () => {
    dragging = false;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { hoverX = 0; hoverY = 0; });

  const start = performance.now();
  let last = start;

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - start) / 1000;

    if (!reduce) {
      autoX += 0.005 * 60 * dt;
      autoY += 0.008 * 60 * dt;
    }

    if (dragging) {
      const k = 1 - Math.pow(0.4, dt);
      curRX += (dragRX - curRX) * k;
      curRY += (dragRY - curRY) * k;
      group.rotation.x = curRX;
      group.rotation.y = curRY;
    } else {
      const trX = dragRX + hoverY * 0.22;
      const trY = dragRY + hoverX * 0.4;
      const k = 1 - Math.pow(0.001, dt);
      curRX += (trX - curRX) * k;
      curRY += (trY - curRY) * k;
      group.rotation.x = autoX + curRX;
      group.rotation.y = autoY + curRY;
    }

    group.position.y = reduce ? 0 : Math.sin(t * 1.2) * 0.09;

    ring1.rotation.z += dt * 0.14;
    ring2.rotation.z -= dt * 0.1;

    for (const s of sats) {
      s.a += dt * s.s;
      s.mesh.position.set(Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r);
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();