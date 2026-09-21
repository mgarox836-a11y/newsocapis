import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const PrismShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.001 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      float r = texture2D(tDiffuse, vUv + vec2(amount, 0.0)).r;
      float g = texture2D(tDiffuse, vUv - vec2(amount, 0.0)).g;
      float b = texture2D(tDiffuse, vUv + vec2(0.0, amount)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

const container = document.getElementById('prism');
if (container) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    renderer = null;
  }

  if (renderer && window.WebGLRenderingContext) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));

    const canvas = renderer.domElement;
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const group = new THREE.Group();
    scene.add(group);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      transmission: 1,
      thickness: 0.8,
      roughness: 0.08,
      ior: 1.5,
      metalness: 0,
      transparent: true
    });

    const layout = [
      { size: 1.5, pos: [0, 0, 0], rz: 0 },
      { size: 1.0, pos: [-1.7, 1.15, -0.7], rz: 0.22 },
      { size: 0.92, pos: [1.65, -1.1, -0.42], rz: -0.18 },
      { size: 0.78, pos: [1.28, 1.32, 0.55], rz: 0.3 },
      { size: 0.66, pos: [-1.42, -1.3, 0.62], rz: -0.26 }
    ];

    const cubes = [];
    layout.forEach((l, i) => {
      const geo = new THREE.BoxGeometry(l.size, l.size, l.size);
      const mat = glassMaterial.clone();
      mat.thickness = i === 0 ? 0.8 : 0.55 + i * 0.1;
      const mesh = new THREE.Mesh(geo, mat);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({
          color: 0xfffdf9,
          transparent: true,
          opacity: 0.32
        })
      );

      const cube = new THREE.Group();
      cube.add(mesh, edges);
      cube.position.set(l.pos[0], l.pos[1], l.pos[2]);
      cube.rotation.z = l.rz;
      group.add(cube);

      cubes.push({ cube, spin: (0.05 + i * 0.02) * (i % 2 === 0 ? 1 : -0.6) });
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    const rgbLights = [0xff2a2a, 0x2a7fff, 0x2aff2a];
    rgbLights.forEach((color, i) => {
      const l = new THREE.PointLight(color, 40, 10, 2);
      const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
      l.position.set(Math.cos(a) * 3.4, Math.sin(i * 0.9) * 1.6, Math.sin(a) * 3.4);
      scene.add(l);
    });

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const prismPass = new ShaderPass(PrismShiftShader);
    prismPass.uniforms.amount.value = 0.001;
    composer.addPass(prismPass);
    composer.addPass(new OutputPass());

    function fitObject() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (!w || !h) return;
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      const halfW = halfH * aspect;
      const scale = Math.max(0.22, Math.min(1, Math.min((halfW - 0.6) / 3.6, (halfH - 0.6) / 3.6)));
      group.scale.setScalar(scale);
    }

    let raf = 0;
    let running = false;

    function resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 768 ? 1.5 : 2));
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitObject();
    }

    let start = performance.now();
    let last = start;

    function frame() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - start) / 1000;

      group.rotation.x += 0.08 * dt;
      group.rotation.y += 0.12 * dt;
      group.position.y = Math.sin(t * 0.45) * 0.18;

      cubes.forEach(c => {
        c.cube.rotation.z += c.spin * dt;
      });

      composer.render();
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }

    function renderOnce() {
      composer.render();
    }

    resize();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
    }
    window.addEventListener('resize', resize, { passive: true });
    canvas.addEventListener('webglcontextlost', stopLoop, false);

    if (typeof document.hidden !== 'undefined' && 'visibilitychange' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop();
        else if (inView && !reduceMotion) startLoop();
      });
    }

    let inView = true;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          inView = entry.isIntersecting;
          if (inView && !document.hidden && !reduceMotion) startLoop();
          else if (!inView) stopLoop();
        });
      }, { threshold: 0 });
      io.observe(container);
    }

    if (reduceMotion) {
      renderOnce();
    } else {
      startLoop();
    }
  }
}