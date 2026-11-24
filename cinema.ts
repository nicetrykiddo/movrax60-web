import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import outline from './art/pin/outline.json';
import enamel from './art/pin/enamel.json';

const spacing = 10.4;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const ease = (t: number) => t * t * (3 - 2 * t);
type Cue = { element: HTMLElement; y: number; side: number };
type Input = { x: number; y: number };
const palette = [
  '#dfab79',
  '#b77250',
  '#e6ab75',
  '#c4ad85',
  '#aeb8b4',
  '#d18b5f',
  '#cb9570',
  '#8ba3ac',
];

function shapes(polygons: number[][][][]) {
  return polygons.map(([border, ...holes]) => {
    const points = (path: number[][]) =>
      path
        .filter((_, i) => i % 2 === 0)
        .map(([x, y]) => new THREE.Vector2((x - 625) / 300, (y - 600) / 300));
    const shape = new THREE.Shape(points(border));
    holes.forEach((hole) => shape.holes.push(new THREE.Path(points(hole))));
    return shape;
  });
}

export function mountCinema(reducedMotion = false) {
  const main = document.querySelector<HTMLElement>('main')!;
  const cueElements = [...main.querySelectorAll<HTMLElement>('[data-cue]')];
  if (!cueElements.length) return () => {};
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return () => {};
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.26;

  const world = new THREE.Scene();
  world.background = new THREE.Color(0x130e0e);
  world.fog = new THREE.FogExp2(0x211516, 0.049);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const reflection = pmrem.fromScene(room, 0.05);
  world.environment = reflection.texture;
  world.environmentIntensity = 0.39;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 110);
  const canvas = renderer.domElement;
  canvas.className = 'live-stage';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  document.body.classList.add('room-rendered');

  const body = new THREE.MeshStandardMaterial({
    color: 0x44312b,
    metalness: 0.16,
    roughness: 0.85,
  });
  const charcoal = new THREE.MeshStandardMaterial({
    color: 0x201718,
    metalness: 0.37,
    roughness: 0.49,
  });
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0x8d5734,
    metalness: 0.86,
    roughness: 0.25,
    clearcoat: 0.28,
  });
  const ivory = new THREE.MeshPhysicalMaterial({
    color: 0xffdfaf,
    metalness: 0.04,
    roughness: 0.29,
    clearcoat: 0.46,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: 0x20150f,
    metalness: 0.38,
    roughness: 0.54,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x735448,
    metalness: 0.51,
    roughness: 0.4,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfec183,
    emissive: 0xff8c40,
    emissiveIntensity: 1.1,
  });
  function grained(
    material: THREE.MeshStandardMaterial,
    scale: number,
    strength: number,
  ) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 timber;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntimber=(modelMatrix*vec4(position,1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 timber;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 grainPoint = timber * vec3(17.5, .57, 8.8);
          float wave = sin(grainPoint.x * ${scale.toFixed(2)} + sin(grainPoint.y * 4.) * 2.5 + sin(grainPoint.z * 3.1));
          float fineGrain = fract(sin(dot(floor(timber * 412.),vec3(12.9898,78.233,27.17)))*43758.5453);
          diffuseColor.rgb *= 1. - ${strength.toFixed(2)} + (wave*.32 + fineGrain*.27+.51)*${strength.toFixed(2)};`,
        );
    };
    material.customProgramCacheKey = () => 'grain' + scale;
  }
  grained(body, 0.77, 0.43);
  grained(trim, 1.4, 0.18);
  const pool = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(0xdc8547) },
      power: { value: 0.46 },
    },
    vertexShader:
      'varying vec2 coords; void main(){coords=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:
      'varying vec2 coords; uniform vec3 tint; uniform float power; void main(){float d=length((coords-.5)*2.);gl_FragColor=vec4(tint, pow(max(0.,1.-d),2.)*power);}',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const floorLight = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), pool);
  floorLight.rotation.x = -Math.PI * 0.5;
  floorLight.position.set(2.3, 0.008, -0.35);
  world.add(floorLight);
  const box = new THREE.BoxGeometry(1, 1, 1);
  function block(
    target: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const item = new THREE.Mesh(box, material);
    item.position.set(x, y, z);
    item.scale.set(w, h, d);
    target.add(item);
    return item;
  }

  const key = new THREE.PointLight(0xffb578, 78, 25, 1.65);
  world.add(key);
  const rim = new THREE.PointLight(0x8fadca, 40, 25, 1.65);
  world.add(rim);
  world.add(new THREE.HemisphereLight(0xf1dacc, 0x412330, 0.51));

  const cues: Cue[] = cueElements.map((element) => ({
    element,
    y: 0,
    side: element.closest('.player')
      ? 1
      : element.classList.contains('reverse')
        ? -1
        : 1,
  }));
  const length = spacing * cues.length;
  block(world, body, length / 2 - 4, -0.12, 0, length + 18, 0.22, 15);
  block(world, charcoal, length / 2 - 4, 2.5, -5.4, length + 22, 7.5, 0.36);
  block(world, trim, length / 2 - 4, 0.15, -4.68, length + 18, 0.17, 0.19);
  block(world, lightMat, length / 2 - 4, 0.25, -4.68, length + 18, 0.02, 0.055);
  block(world, charcoal, length / 2 - 4, 4.65, -3, length + 18, 0.15, 5.2);
  for (let i = 0; i < cues.length * 4 + 4; i++) {
    const x = (i - 2) * 2.6;
    block(world, body, x, 2.64, -4.87, 2.44, 4.26, 0.18);
    block(
      world,
      i % 4 === 1 ? lightMat : trim,
      x - 1.27,
      2.69,
      -4.74,
      0.026,
      4.36,
      0.041,
    );
  }
  for (let i = 0; i < cues.length + 1; i++) {
    const x = i * spacing - 4.9;
    block(world, charcoal, x, 2.53, -3.69, 0.42, 5.21, 3.0);
    block(world, trim, x + 0.27, 2.59, -2.17, 0.12, 5.15, 0.12);
    block(world, lightMat, x + 0.34, 4.14, -2.1, 0.024, 1.89, 0.036);
    block(world, brass, x + 2.5, 0.023, -1.92, 3.8, 0.024, 0.014);
  }

  // Warm practicals, walnut fins, and recessed fasteners are actual world geometry.
  const lampShape = new THREE.CylinderGeometry(0.19, 0.31, 0.15, 32);
  const capShape = new THREE.SphereGeometry(0.037, 12, 8);
  for (let i = 0; i < cues.length; i++) {
    const x = i * spacing + cues[i].side * 0.7;
    for (let j = 0; j < 13; j++) {
      block(
        world,
        j % 4 === 0 ? trim : charcoal,
        x - 2.25 + j * 0.122,
        1.62,
        -4.63,
        0.047,
        2.52,
        0.09,
      );
    }
    block(world, brass, x, 3.81, -3.14, 0.022, 0.95, 0.025);
    const lamp = new THREE.Mesh(lampShape, brass);
    lamp.position.set(x, 3.33, -3.14);
    world.add(lamp);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      lightMat,
    );
    bulb.position.set(x, 3.24, -3.14);
    bulb.scale.y = 0.38;
    world.add(bulb);
    const bounce = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.4),
      pool.clone(),
    );
    bounce.material.uniforms.power.value = 0.33;
    bounce.position.set(x, 3.07, -4.73);
    world.add(bounce);
    for (const side of [-1, 1]) {
      const fastener = new THREE.Mesh(capShape, brass);
      fastener.position.set(x + side * 0.87, 0.77, -4.67);
      fastener.scale.z = 0.38;
      world.add(fastener);
    }
  }
  const pedestal = new THREE.CylinderGeometry(1.59, 1.67, 0.33, 72);
  const haloGeometry = new THREE.TorusGeometry(
    1.94,
    0.018,
    12,
    128,
    Math.PI * 1.64,
  );
  const plaques: THREE.Group[] = [];
  const displays: THREE.Group[] = [];
  const mascots = new THREE.Group();
  const avatar = new THREE.Group();
  mascots.add(avatar);
  const addMark = (target: THREE.Group, scale: number) => {
    const backing = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shapes(outline), {
        depth: 0.096,
        bevelEnabled: true,
        bevelSize: 0.026,
        bevelThickness: 0.032,
        bevelSegments: 3,
      }),
      [ink, brass],
    );
    const face = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shapes(enamel), {
        depth: 0.033,
        bevelEnabled: true,
        bevelSize: 0.0055,
        bevelThickness: 0.006,
        bevelSegments: 2,
      }),
      [ivory, brass],
    );
    face.position.z = 0.109;
    const model = new THREE.Group();
    model.add(backing, face);
    model.scale.setScalar(scale);
    target.add(model);
    return model;
  };
  const logo = addMark(avatar, 1);
  const wavePose = { value: 0 };
  for (const material of [ivory, ink]) {
    const base = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      base.call(material, shader, renderer);
      shader.uniforms.wavePose = wavePose;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float wavePose;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float wrist = smoothstep(.78,1.74,position.x) * smoothstep(-.12,1.03,position.y);
          transformed.y += wavePose * wrist * .18;
          transformed.z += wavePose * wrist * .26;`,
        );
    };
    material.customProgramCacheKey = () => 'greeting-sleeve';
  }
  const pinBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.33, 0.2, 28),
    brass,
  );
  pinBack.rotation.x = Math.PI * 0.5;
  pinBack.position.set(0, -0.07, -0.14);
  logo.add(pinBack);
  const roomMarks: THREE.Mesh[] = [];
  const shapesCache = new THREE.ShapeGeometry(shapes(outline));
  const isHome = document.body.classList.contains('home');

  cues.forEach((cue, i) => {
    const display = new THREE.Group();
    display.position.set(i * spacing + cue.side * 2.42, 0, -0.28);
    world.add(display);
    displays.push(display);
    const base = new THREE.Mesh(pedestal, charcoal);
    base.position.y = 0.22;
    display.add(base);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.59, 1.59, 0.034, 72),
      brass,
    );
    platform.position.y = 0.402;
    display.add(platform);
    const accent = new THREE.MeshStandardMaterial({
      color: palette[i % palette.length],
      emissive: palette[i % palette.length],
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.37,
    });
    if (i === 0 && isHome) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.14, 1.31, 20),
        brass,
      );
      stand.position.set(0, 0.85, 0.02);
      display.add(stand);
      mascots.position.y = 2.27;
      display.add(mascots);
      for (let j = 0; j < 2; j++) {
        const line = new THREE.Mesh(haloGeometry, accent);
        line.position.set(0, 2.31, -0.24 - j * 0.14);
        line.scale.setScalar(1.02 + j * 0.12);
        line.rotation.z = Math.PI * (0.64 + j * 0.25);
        display.add(line);
        roomMarks.push(line);
      }
    } else {
      const group = new THREE.Group();
      group.position.y = 2.03;
      group.rotation.z = ((i % 3) - 1) * 0.13;
      display.add(group);
      for (let j = 0; j < 7; j++) {
        const distance = j - 3;
        const panel = block(
          group,
          j === 3 ? brass : charcoal,
          distance * (0.31 + (i % 3) * 0.075),
          Math.abs(distance) * -0.08,
          -Math.abs(distance) * 0.26,
          0.72,
          2.34 - Math.abs(distance) * (0.14 + (i % 3) * 0.08),
          0.133,
        );
        panel.rotation.y = distance * -0.3;
        const slot = new THREE.Mesh(box, accent);
        slot.position.set(0, 0.36, 0.542);
        slot.scale.set(0.45, 0.012, 0.04);
        panel.add(slot);
      }
      const emblem = new THREE.Mesh(shapesCache, accent);
      emblem.scale.setScalar(0.24);
      emblem.position.set(0, 0.1, 0.09);
      group.add(emblem);
      plaques.push(group);
    }
  });

  const glints = new Float32Array(180 * 3);
  for (let i = 0; i < glints.length; i += 3) {
    glints[i] = ((i * 0.61809) % 1) * (length + 9) - 5;
    glints[i + 1] = ((i * 0.38197) % 1) * 4.8;
    glints[i + 2] = ((i * 0.71378) % 1) * 8 - 4;
  }
  const motes = new THREE.BufferGeometry();
  motes.setAttribute('position', new THREE.BufferAttribute(glints, 3));
  const dust = new THREE.Points(
    motes,
    new THREE.PointsMaterial({
      color: 0xddad7f,
      size: 0.034,
      transparent: true,
      opacity: 0.37,
      sizeAttenuation: true,
      depthWrite: false,
    }),
  );
  world.add(dust);

  const action = document.querySelector<HTMLButtonElement>('.mascot-action');
  const dragTarget =
    document.querySelector<HTMLButtonElement>('.mascot-surface');
  if (action) action.hidden = false;
  if (dragTarget) dragTarget.hidden = false;
  const caseControl = document.createElement('button');
  caseControl.type = 'button';
  caseControl.className = 'case-handle button';
  caseControl.setAttribute('aria-label', 'Fan the display plates');
  caseControl.textContent = '◈';
  caseControl.hidden = true;
  main.prepend(caseControl);
  let spreadIndex = -1;
  caseControl.addEventListener('click', () => {
    const current = Number(caseControl.dataset.index);
    spreadIndex = spreadIndex === current ? -1 : current;
    caseControl.setAttribute('aria-pressed', String(spreadIndex === current));
    invalidate();
  });
  const point = new THREE.Vector3();
  const cursor: Input = { x: 0, y: 0 };
  const scrollCue = new THREE.Vector2();
  let narrow = false;
  let startX = 0;
  let dragId = -1;
  let drag = false;
  let turn = 0;
  let facing = -0.2;
  let nodAt = -Infinity;
  let playhead = 0;
  let last = 0;
  let frame = 0;
  let renderOnce = true;
  let focus = false;
  let cueIndex = -1;

  function measure() {
    narrow = innerWidth / Math.max(innerHeight, 1) < 1.08;
    camera.aspect = innerWidth / Math.max(innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
    renderer.setSize(innerWidth, innerHeight);
    for (const cue of cues) {
      cue.y =
        scrollY +
        cue.element.getBoundingClientRect().top -
        (parseFloat(getComputedStyle(cue.element).scrollMarginTop) || 0);
    }
    cues[0].y = 0;
    renderOnce = true;
  }
  function location() {
    let i = 0;
    while (i < cues.length - 1 && scrollY >= cues[i + 1].y) i++;
    const next = cues[i + 1];
    const t = next
      ? clamp((scrollY - cues[i].y) / Math.max(1, next.y - cues[i].y), 0, 1)
      : 0;
    return i + t;
  }
  function wave() {
    nodAt = performance.now();
    canvas.dataset.greeting = String(Number(canvas.dataset.greeting ?? 0) + 1);
    if (reducedMotion) turn += 0.48;
    renderOnce = true;
    document.body.classList.add('mascot-awake');
    if (action) action.textContent = 'Wave again';
  }
  action?.addEventListener('click', wave);
  dragTarget?.addEventListener('click', (event) => {
    if (!drag || event.detail === 0) wave();
    drag = false;
  });
  dragTarget?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    turn += event.key === 'ArrowRight' ? 0.28 : -0.28;
    renderOnce = true;
  });
  dragTarget?.addEventListener('focus', () => {
    focus = true;
    renderOnce = true;
  });
  dragTarget?.addEventListener('blur', () => {
    focus = false;
    renderOnce = true;
  });
  dragTarget?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    dragId = event.pointerId;
    drag = false;
    startX = event.clientX;
    dragTarget.setPointerCapture(dragId);
  });
  dragTarget?.addEventListener('pointermove', (event) => {
    if (event.pointerId !== dragId) return;
    const delta = event.clientX - startX;
    if (!drag && Math.abs(delta) < 5) return;
    drag = true;
    turn += delta * 0.01;
    startX = event.clientX;
    renderOnce = true;
  });
  function endDrag() {
    dragId = -1;
  }
  dragTarget?.addEventListener('lostpointercapture', endDrag);
  dragTarget?.addEventListener('pointercancel', endDrag);
  function pointTo(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    cursor.x = event.clientX / innerWidth - 0.5;
    cursor.y = 0.5 - event.clientY / innerHeight;
  }
  let visible = true;
  const observer = new ResizeObserver(measure);
  observer.observe(main);
  addEventListener('resize', measure, { passive: true });
  addEventListener('pointermove', pointTo, { passive: true });
  addEventListener('scroll', invalidate, { passive: true });
  function invalidate() {
    renderOnce = true;
  }
  function loop(time: number) {
    if (!visible) return;
    frame = requestAnimationFrame(loop);
    if (document.hidden || (reducedMotion && !renderOnce)) return;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
    last = time;
    renderOnce = false;
    const actual = location();
    const rate = 1 - Math.exp(-dt * 12);
    playhead =
      reducedMotion || Math.abs(playhead - actual) > 1.7
        ? actual
        : mix(playhead, actual, rate);
    const i = Math.min(Math.floor(playhead), cues.length - 1);
    const next = Math.min(i + 1, cues.length - 1);
    const p = playhead - i;
    if (i !== cueIndex) {
      cueIndex = i;
      canvas.dataset.cue = cueElements[i].id;
    }
    const crossing = Math.sin(p * Math.PI);
    const side = mix(cues[i].side, cues[next].side, ease(p));
    const cameraX = (i + ease(p)) * spacing;
    const mouse = reducedMotion ? 0 : 1;
    scrollCue.set(
      scrollCue.x + (cursor.x - scrollCue.x) * rate,
      scrollCue.y + (cursor.y - scrollCue.y) * rate,
    );
    const distance = narrow ? 12.6 : 8.1;
    camera.position.set(
      cameraX + mouse * scrollCue.x * 0.5 + crossing * 0.7,
      2.47 + crossing * 0.56,
      distance - crossing * 1.28,
    );
    camera.lookAt(
      cameraX +
        (narrow ? side * 2.42 : 0.34 * side) +
        mouse * scrollCue.x * 0.73,
      narrow ? 1.0 : 2.24,
      -0.22,
    );
    key.position.set(cameraX + (narrow ? side * 3.4 : 2.1), 4.2, 4.15);
    rim.position.set(cameraX - 1.8, 3.98, -0.6);
    const waveTime = (time - nodAt) / 1000;
    const response =
      waveTime < 1.9
        ? Math.sin(waveTime * 7.1) * Math.pow(1 - waveTime / 1.9, 2)
        : 0;
    facing = reducedMotion
      ? turn
      : mix(facing, turn - 0.18 + scrollCue.x * 0.4, rate);
    avatar.rotation.set(
      mouse * (-0.1 - scrollCue.y * 0.31 + response * 0.18),
      facing,
      mouse * response * 0.26,
    );
    avatar.position.y =
      mouse * (Math.sin(time * 0.0014) * 0.063 + Math.max(0, response) * 0.18);
    logo.position.z = focus ? 0.13 : 0;
    wavePose.value = response;
    floorLight.position.x = cameraX + side * 2.2;
    pool.uniforms.power.value = 0.46 + Math.max(0, response) * 0.39;
    canvas.dataset.angle = facing.toFixed(3);
    ivory.emissive.set(0xffab5e);
    ivory.emissiveIntensity =
      0.015 + (focus ? 0.077 : 0) + Math.max(0, response) * 0.12;
    roomMarks.forEach(
      (ring, index) =>
        (ring.rotation.z =
          2.1 + index * 0.84 + mouse * time * 0.000034 * (index ? 1 : -1)),
    );
    const station = Math.round(playhead);
    for (const [j, plaque] of plaques.entries()) {
      const displayIndex = j + (isHome ? 1 : 0);
      const gap = playhead - displayIndex;
      const expanded = spreadIndex === displayIndex;
      plaque.scale.x = reducedMotion
        ? expanded
          ? 1.37
          : 1
        : mix(plaque.scale.x, expanded ? 1.37 : 1, rate);
      plaque.scale.y = reducedMotion
        ? expanded
          ? 1.11
          : 1
        : mix(plaque.scale.y, expanded ? 1.11 : 1, rate);
      plaque.rotation.y = clamp(gap, -1, 1) * 0.84 + mouse * scrollCue.x * 0.2;
      plaque.position.y =
        2.03 + mouse * Math.sin(time * 0.0012 + j * 0.58) * 0.052;
    }
    dust.position.y = mouse * ((time * 0.00002) % 1);
    dust.rotation.y = mouse * Math.sin(time * 0.00028) * 0.021;
    if (dragTarget) {
      point.copy(mascots.getWorldPosition(new THREE.Vector3())).project(camera);
      const x = (point.x * 0.5 + 0.5) * innerWidth;
      const y = (0.5 - point.y * 0.5) * innerHeight;
      const size = Math.min(innerHeight * 0.62, innerWidth * 0.91);
      dragTarget.style.setProperty('--mascot-x', x + 'px');
      dragTarget.style.setProperty('--mascot-y', y + 'px');
      dragTarget.style.setProperty('--mascot-size', size + 'px');
      dragTarget.style.pointerEvents = playhead < 0.46 ? 'auto' : 'none';
      dragTarget.tabIndex = playhead < 0.46 ? 0 : -1;
    }
    const currentCue = cues[station].element;
    const hasCase =
      currentCue.matches('.crew,.spotlight,.result-scene') &&
      Math.abs(station - playhead) < 0.3;
    caseControl.hidden = !hasCase;
    if (hasCase) {
      caseControl.dataset.index = String(station);
      caseControl.setAttribute('aria-pressed', String(spreadIndex === station));
      point.copy(displays[station].position);
      point.y = 1.1;
      point.z += 0.8;
      point.project(camera);
      caseControl.style.left =
        clamp((point.x * 0.5 + 0.5) * innerWidth, 28, innerWidth - 28) + 'px';
      caseControl.style.top =
        clamp((0.5 - point.y * 0.5) * innerHeight, 90, innerHeight - 30) + 'px';
    }
    renderer.render(world, camera);
    canvas.dataset.ready = '';
  }
  measure();
  frame = requestAnimationFrame(loop);
  function lost(event: Event) {
    event.preventDefault();
    visible = false;
    caseControl.hidden = true;
    cancelAnimationFrame(frame);
    document.body.classList.remove('room-rendered');
    if (action) action.hidden = true;
    if (dragTarget) dragTarget.hidden = true;
  }
  canvas.addEventListener('webglcontextlost', lost);
  return () => {
    visible = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    removeEventListener('resize', measure);
    removeEventListener('pointermove', pointTo);
    removeEventListener('scroll', invalidate);
    action?.removeEventListener('click', wave);
    if (action) action.hidden = true;
    if (dragTarget) dragTarget.hidden = true;
    document.body.classList.remove('room-rendered', 'mascot-awake');
    world.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          material.dispose();
      }
    });
    reflection.dispose();
    renderer.dispose();
    caseControl.remove();
    canvas.remove();
  };
}
