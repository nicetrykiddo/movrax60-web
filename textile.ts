import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cameraPose, filmProgress, readingIndex, stops } from './flag-track';
const clamp = THREE.MathUtils.clamp,
  lerp = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) =>
  THREE.MathUtils.smoothstep(x, a, b);

// Fade thread frequencies past the pixel sampling limit as the lens moves.
function shadeSilk(
  material: THREE.MeshStandardMaterial,
  woven: boolean,
  clock: { value: number },
) {
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.loomTime = clock;
    shader.vertexShader =
      'uniform float loomTime; varying vec2 loomUV;\n' +
      shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nloomUV = uv;',
        )
        .replace(
          '#include <morphtarget_vertex>',
          `#include <morphtarget_vertex>
        float freedom=.22+.19*clamp(3.65-position.y,0.,3.8);
        transformed.z+=freedom*(.052*sin(position.x*2.25+position.y*.81+loomTime*.72)+.015*sin(position.y*3.1-position.x+loomTime*.95));
        transformed.y+=freedom*.021*sin(position.x*1.9+loomTime*.8);`,
        );
    if (material.name === 'Copper brocade')
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n if(!gl_FrontFacing) diffuseColor.rgb*=vec3(.41,.32,.44);',
      );
    shader.fragmentShader = 'varying vec2 loomUV;\n' + shader.fragmentShader;
    if (woven)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
      #include <color_fragment>
      vec2 yarn=loomUV*vec2(484.,381.), footprint=fwidth(yarn);
      vec2 clarity=1.-smoothstep(vec2(.17),vec2(.58),footprint);
      vec2 thread=cos(6.28318*yarn);
      float twill=cos(6.28318*(yarn.x-yarn.y)/3.)*(1.-smoothstep(.4,1.8,max(footprint.x,footprint.y)));
      diffuseColor.rgb*=1.+.135*thread.x*clarity.x+.10*thread.y*clarity.y+.075*twill;
      diffuseColor.rgb*=1.+.033*cos(6.28318*(loomUV.x*86.+.18*sin(loomUV.y*13.)));`,
      );
  };
  material.customProgramCacheKey = () =>
    woven ? (material.name === 'Copper brocade' ? 'crest' : 'twill') : 'yarn';
  material.defines = { ...material.defines, USE_UV: '' };
}

export function mountTextile() {
  const surface = document.createElement('div');
  surface.className = 'loom';
  surface.setAttribute('aria-hidden', 'true');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'),
    owner = new AbortController(),
    { signal } = owner;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return () => {};
  }
  document.body.prepend(surface);
  surface.append(renderer.domElement);
  renderer.setClearColor(0x18101b, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 65),
    clock = { value: 0 };
  const key = new THREE.DirectionalLight(0xffcc98, 2.8);
  key.position.set(-4.5, 4.5, 2.75);
  const rim = new THREE.DirectionalLight(0xffa363, 2.4);
  rim.position.set(5.1, 4, -3.3);
  const bounce = new THREE.DirectionalLight(0xb4a7e2, 0.79);
  bounce.position.set(4, 1, 3.1);
  scene.add(
    key,
    rim,
    bounce,
    new THREE.HemisphereLight(0xf1c2a7, 0x29172c, 0.76),
  );
  const cloth = new THREE.Group();
  scene.add(cloth);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader:
        'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 v;void main(){vec2 p=(v-.5)*vec2(3.8,4.8);gl_FragColor=vec4(.025,.009,.023,.62*exp(-dot(p,p)*2.));}',
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(1.62, -0.5, 0.05);
  scene.add(shadow);
  const dustGeo = new THREE.BufferGeometry(),
    motes = new Float32Array(52 * 3);
  for (let i = 0; i < 52; i++) {
    const n = (k: number) =>
      THREE.MathUtils.euclideanModulo(
        Math.sin(i * 71.13 + k * 17.83) * 43758.55,
        1,
      );
    motes.set([n(1) * 11 - 5, n(2) * 6 - 1.5, n(3) * 3.2 + 0.2], i * 3);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xffbd85,
      size: 0.012,
      opacity: 0.43,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const meshes: THREE.Mesh[] = [],
    morphs: THREE.Mesh[] = [];
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  function releaseResources(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(
          (mat) => materials.add(mat),
        );
      }
    });
    materials.forEach((mat) => mat.dispose());
  }
  const target = new THREE.Vector3(),
    angles = new THREE.Vector3();
  const pose: number[] = [];
  let film: HTMLElement | null = null,
    directory = false,
    grab: HTMLButtonElement | null = null,
    control: HTMLButtonElement | null = null;
  let routeInputs = new AbortController();
  let ready = false,
    disposed = false,
    frame = 0,
    last = 0,
    progress = 0,
    reading = 0;
  let lift = 0,
    desired = 0,
    drawn = 0,
    tension = 0,
    look = 0,
    pointer = 0,
    width = 1,
    height = 1,
    quality = 1,
    slow = 0;
  let drag: {
    x: number;
    y: number;
    id: number;
    initial: number;
    horizontal: boolean;
  } | null = null;
  let ignoreClick = false;
  const threads = new Map<number, THREE.MeshStandardMaterial>();
  function setLift(on: boolean) {
    desired = Number(on);
    if (reading === 0) grab?.setAttribute('aria-pressed', String(on));
    control?.setAttribute('aria-pressed', String(on));
    const label = control?.querySelector('span');
    if (label) label.textContent = on ? 'Lower the hem' : 'Lift the hem';
    requestDraw();
  }
  function activate() {
    const visible = ready && !!(film || directory);
    surface.toggleAttribute('data-ready', visible);
    document.body.classList.toggle('has-silk', visible);
  }
  function requestDraw() {
    if (!frame && !disposed && !document.hidden && ready && (film || directory))
      frame = requestAnimationFrame(draw);
  }
  function scroll() {
    const next = directory ? 0.79 : filmProgress();
    progress = next;
    reading = directory ? 6 : readingIndex(next);
    if (grab) {
      const label =
        reading === 0
          ? 'Grab the flag. Drag horizontally or press to lift.'
          : reading === 6
            ? 'Open the team sheet'
            : reading === 7
              ? 'Return to the flag'
              : 'Choose the next competition';
      if (grab.getAttribute('aria-label') !== label)
        grab.setAttribute('aria-label', label);
      if (reading === 0)
        grab.setAttribute('aria-pressed', String(desired >= 0.5));
      else grab.removeAttribute('aria-pressed');
    }
    requestDraw();
  }
  function resize() {
    width = Math.max(1, surface.clientWidth);
    height = Math.max(1, surface.clientHeight);
    renderer.setPixelRatio(
      Math.max(
        1,
        Math.min(devicePixelRatio, width < 730 ? 1.75 : 1.6) * quality,
      ),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    scroll();
  }
  // Target the same parametric surface that generated the Blender geometry.
  function locate(u: number, v: number) {
    const x =
      (u - 0.5) * 4.35 +
      0.43 * Math.sin(v * 2.2 + 0.31) * (u - 0.24) +
      0.18 * (v - 0.5);
    const d =
      0.41 * Math.sin(u * 8.6 + 0.31 + v * 0.85) +
      0.17 * Math.sin(u * 16.1 - v * 5.3) +
      0.22 * (1 - v) * Math.sin(u * 4.6 + 0.31) +
      0.037 * Math.sin(28 * u + 7 * v) * (1 - v) ** 2;
    const y =
      (v - 0.5) * 3.49 +
      0.17 * Math.sin(u * 5.1 + 0.31) +
      0.34 * u +
      0.12 * u * u;
    target.set(
      1.8 + Math.cos(0.11) * x - Math.sin(0.11) * d,
      1.65 + y,
      0.18 - Math.sin(0.11) * x - Math.cos(0.11) * d,
    );
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || document.hidden || !ready || (!film && !directory)) return;
    const elapsed = last ? now - last : 16,
      dt = Math.min(elapsed / 1000, 0.05);
    last = now;
    const quiet = reduce.matches;
    if (!quiet) clock.value += dt;
    const damp = quiet ? 1 : 1 - Math.exp(-dt * 10);
    lift = lerp(lift, desired * (1 - smooth(0.06, 0.22, progress)), damp);
    drawn = lerp(drawn, tension, damp);
    look = lerp(look, quiet ? 0 : pointer, damp);
    for (const mesh of morphs) {
      const map = mesh.morphTargetDictionary!,
        weights = mesh.morphTargetInfluences!;
      weights[map.Lift] = lift;
      weights[map.Draw] = drawn;
    }
    cameraPose(quiet ? stops[reading].at : progress, pose);
    let [u, v, yaw, pitch, dist, fx, fy] = pose;
    locate(u, v);
    const portrait = width < 730 && height > width * 0.86;
    if (portrait) {
      const wideShot =
        1 - smooth(0.02, 0.26, progress) + smooth(0.825, 1, progress);
      dist *= Math.max(1, 0.48 / camera.aspect) * (1.35 + 0.61 * wideShot);
      fx = 0.51;
      fy = 0.3 + 0.075 * (1 - wideShot);
    } else if (camera.aspect < 1.55) {
      dist *= 1.55 / camera.aspect;
      fx = Math.min(0.77, fx + 0.04);
    }
    const a = ((yaw + look * 1.7) * Math.PI) / 180,
      b = (pitch * Math.PI) / 180;
    angles.set(
      Math.sin(a) * Math.cos(b),
      Math.sin(b),
      Math.cos(a) * Math.cos(b),
    );
    camera.position.copy(target).addScaledVector(angles, dist);
    camera.lookAt(target);
    camera.fov = 36;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = 1 - 2 * fx;
    camera.projectionMatrix.elements[9] = 2 * fy - 1;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    for (const [id, mat] of threads)
      mat.emissiveIntensity = reading === id ? 0.58 : 0.06;
    dust.rotation.y = 0.014 * Math.sin(clock.value * 0.16);
    dust.position.y = 0.07 * Math.sin(clock.value * 0.21);
    renderer.render(scene, camera);
    if (elapsed > 30 && elapsed < 160) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 26 && quality > 0.78 && devicePixelRatio > 1) {
      quality = Math.max(0.78, quality - 0.11);
      slow = 0;
      resize();
    }
    if (!quiet) requestDraw();
    else last = 0;
  }
  function hitAt(x: number, y: number) {
    ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return 0;
    const name = hit.object.name + ' ' + hit.object.parent?.name;
    const match = name.match(/Mark_([1-5])/);
    if (match) return Number(match[1]);
    if (name.includes('Roster_')) return 6;
    if (hit.uv && name.includes('House')) {
      const u = hit.uv.x,
        v = 1 - hit.uv.y,
        i = Math.round((u - 0.16) / 0.156);
      if (
        i >= 0 &&
        i < 5 &&
        Math.abs(v - 0.095) < 0.043 &&
        Math.abs(u - 0.16 - i * 0.156) < 0.036
      )
        return i + 1;
      if (reading === 6 && u > 0.62 && u < 0.89 && v > 0.19 && v < 0.38)
        return 6;
    }
    return 0;
  }
  function step(delta: number) {
    document.dispatchEvent(new CustomEvent('flag:step', { detail: delta }));
  }
  function bind() {
    routeInputs.abort();
    routeInputs = new AbortController();
    const options = { signal: routeInputs.signal };
    film = document.querySelector('.film');
    directory = !!document.querySelector('.roster');
    grab = document.querySelector('.grab');
    control = document.querySelector('.fold');
    drag = null;
    tension = desired = 0;
    pointer = 0;
    ignoreClick = false;
    grab?.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        drag = {
          x: e.clientX,
          y: e.clientY,
          id: e.pointerId,
          initial: desired,
          horizontal: false,
        };
        ignoreClick = false;
        tension = reading === 0 ? 0.16 : 0;
        requestDraw();
      },
      options,
    );
    grab?.addEventListener(
      'pointermove',
      (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.x,
          dy = e.clientY - drag.y;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          drag.horizontal = true;
          grab?.setPointerCapture(e.pointerId);
        }
        if (drag.horizontal && reading === 0) {
          desired = clamp(
            drag.initial +
              ((drag.initial < 0.5 ? 1 : -1) * Math.abs(dx)) /
                Math.min(150, width * 0.28),
            0,
            1,
          );
          tension = clamp(Math.abs(dx) / 145, 0, 1);
          requestDraw();
        }
      },
      options,
    );
    function release(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return;
      ignoreClick = drag.horizontal || e.type === 'pointercancel';
      if (e.type === 'pointercancel' && reading === 0)
        setLift(drag.initial >= 0.5);
      else if (drag.horizontal) {
        if (reading === 0) setLift(desired >= 0.5);
        else if (reading <= 5 && Math.abs(e.clientX - drag.x) > 40)
          step(e.clientX < drag.x ? 1 : -1);
      }
      drag = null;
      tension = 0;
      requestDraw();
    }
    window.addEventListener('pointerup', release, options);
    window.addEventListener('pointercancel', release, options);
    grab?.addEventListener(
      'click',
      (e) => {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        const hit = e.detail ? hitAt(e.clientX, e.clientY) : 0;
        if (hit === 6 && reading === 6) {
          film?.querySelector<HTMLAnchorElement>('#team .action')?.click();
          return;
        }
        if (hit >= 1 && hit <= 5) {
          film
            ?.querySelector<HTMLAnchorElement>(
              '.marks-nav a[href="#' + stops[hit].id + '"]',
            )
            ?.click();
          return;
        }
        if (reading === 0) setLift(desired < 0.5);
        else if (reading === 6)
          film?.querySelector<HTMLAnchorElement>('#team .action')?.click();
        else if (reading === 7)
          film?.querySelector<HTMLAnchorElement>('.return-top')?.click();
        else step(reading === 5 ? -4 : 1);
      },
      options,
    );
    control?.addEventListener('click', () => setLift(desired < 0.5), options);
    activate();
    scroll();
  }
  new GLTFLoader().load(
    '/models/standard.glb',
    (gltf) => {
      if (disposed) {
        releaseResources(gltf.scene);
        return;
      }
      cloth.add(gltf.scene);
      gltf.scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        meshes.push(obj);
        shadeSilk(obj.material, !!obj.geometry.attributes.uv, clock);
        if (obj.morphTargetDictionary?.Lift !== undefined) morphs.push(obj);
        const match = obj.name.match(/Mark_([1-5])/);
        if (match) {
          obj.material.emissive = new THREE.Color(0xc47934);
          threads.set(Number(match[1]), obj.material);
        }
      });
      ready = true;
      activate();
      resize();
    },
    undefined,
    () => {
      ready = false;
      activate();
    },
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') pointer = (e.clientX / width) * 2 - 1;
    },
    { signal },
  );
  window.addEventListener('scroll', scroll, { passive: true, signal });
  document.addEventListener('flag:route', bind, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      last = 0;
      requestDraw();
    },
    { signal },
  );
  reduce.addEventListener('change', requestDraw, { signal });
  renderer.domElement.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      ready = false;
      activate();
    },
    { signal },
  );
  renderer.domElement.addEventListener(
    'webglcontextrestored',
    () => {
      ready = meshes.length > 0;
      activate();
      resize();
    },
    { signal },
  );
  const observer = new ResizeObserver(resize);
  observer.observe(surface);
  bind();
  return () => {
    disposed = true;
    routeInputs.abort();
    owner.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    ready = false;
    activate();
    releaseResources(scene);
    renderer.dispose();
    surface.remove();
  };
}
