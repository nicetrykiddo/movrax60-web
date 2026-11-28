import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ClothSimulation, clothShader } from './cloth-response';
import { flagSurface, hoistPivot } from './flag-surface';
import { makeSilkWeave } from './woven-silk';
import { cameraPose, filmProgress, readingIndex, stops } from './flag-track';
const clamp = THREE.MathUtils.clamp,
  lerp = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) =>
  THREE.MathUtils.smoothstep(x, a, b);

// Use the top yarn's direction for the elongated highlights at close range.
function shadeSilk(
  material: THREE.MeshStandardMaterial,
  woven: boolean,
  cloth: ClothSimulation,
  weave: THREE.DataTexture,
) {
  material.side = THREE.DoubleSide;
  const brocade = material.name === 'Copper brocade';
  const physical = material instanceof THREE.MeshPhysicalMaterial;
  const useWeave = physical && woven;
  if (physical) {
    const clothRoughness = brocade ? 0.51 : 0.61;
    material.roughness = woven ? clothRoughness : 0.68;
    material.sheen = woven ? 0.78 : 0.51;
    material.sheenRoughness = woven ? 0.57 : 0.66;
    material.sheenColor
      .copy(material.color)
      .lerp(new THREE.Color(0.57, 0.37, 0.28), 0.28);
    if (useWeave) {
      material.anisotropy = brocade ? 0.49 : 0.37;
      material.anisotropyRotation = Math.PI / 2;
      if (brocade) material.color.multiplyScalar(0.84);
    } else {
      material.anisotropy = 0;
    }
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.clothDelta = { value: cloth.delta };
    shader.uniforms.clothRotation = { value: cloth.rotation };
    shader.vertexShader =
      clothShader +
      'varying vec2 loomUV;\n' +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
        vec4 rotation = normalize(sampleCloth(clothRotation));
        objectNormal = rotateWithCloth(objectNormal, rotation);`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        loomUV = uv;
        transformed += sampleCloth(clothDelta).xyz + rotateWithCloth(clothOffset, rotation) - clothOffset;`,
        );
    if (!useWeave) return;
    shader.uniforms.silkWeave = { value: weave };
    shader.fragmentShader =
      'uniform sampler2D silkWeave; varying vec2 loomUV;\n' +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec2 repeats = vec2(41., 33.);
        vec4 silkSample = texture2D(silkWeave, loomUV * repeats);
        vec2 yarnFootprint = fwidth(loomUV * repeats * 8.);
        float yarnDetail = 1. - smoothstep(.28, .95, max(yarnFootprint.x, yarnFootprint.y));
        float dyeVariation = 0.024 * sin(loomUV.x * 224. + 0.6 * sin(loomUV.y * 71.))
                           + 0.018 * sin(loomUV.y * 192. - 0.7 * sin(loomUV.x * 29.));
        diffuseColor.rgb *= ${brocade ? '0.66 + 0.65' : '0.78 + 0.44'} * silkSample.b + dyeVariation;
        ${brocade ? 'if (!gl_FrontFacing) diffuseColor.rgb *= vec3(.48,.35,.45);' : ''}`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
        vec2 silkSlope = (silkSample.rg * 2. - 1.) * (.15 + .18 * yarnDetail);
        normal = normalize(normal + silkSlope.x * tbn[0] + silkSlope.y * tbn[1]);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
        roughnessFactor += (0.52 - silkSample.b) * 0.24;`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          THREE.ShaderChunk.lights_physical_fragment.replace(
            'vec2 anisotropyV = anisotropyVector;',
            'vec2 yarnAxis = mix(vec2(1., 0.), vec2(0., 1.), silkSample.a);\n' +
              'vec2 anisotropyV = mix(anisotropyVector * .64, normalize(yarnAxis) * length(anisotropyVector), yarnDetail);',
          ),
        );
  };
  material.customProgramCacheKey = () =>
    useWeave ? (brocade ? 'brocade' : 'twill') : 'yarn';
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
  const weave = makeSilkWeave(renderer.capabilities.getMaxAnisotropy());
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
  const simulation = new ClothSimulation();
  const cloth = new THREE.Group();
  cloth.name = 'Hoist pivot';
  cloth.position.copy(hoistPivot);
  simulation.collider.visible = false;
  cloth.add(simulation.collider);
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
    grab: HTMLButtonElement | null = null;
  let routeInputs = new AbortController();
  let ready = false,
    disposed = false,
    frame = 0,
    last = 0,
    progress = 0,
    reading = 0;
  let look = 0,
    pointer = 0,
    width = 1,
    height = 1,
    quality = 1,
    slow = 0;
  let drag: {
    x: number;
    y: number;
    id: number;
    grip: {
      origin: THREE.Vector3;
      contact: THREE.Vector3;
      plane: THREE.Plane;
      normal: THREE.Vector3;
    } | null;
    started: number;
    moved: boolean;
    held: boolean;
  } | null = null;
  let ignoreClick = false;
  let touchedMark = 0;
  let modelLoaded = false;
  const threads = new Map<number, THREE.MeshStandardMaterial>();
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
          ? ''
          : reading === 6
            ? 'Open the team sheet'
            : reading === 7
              ? 'Return to the flag'
              : 'Choose the next competition';
      if (label) {
        grab.setAttribute('aria-label', label);
        grab.removeAttribute('aria-hidden');
        grab.tabIndex = 0;
      } else {
        grab.removeAttribute('aria-label');
        grab.setAttribute('aria-hidden', 'true');
        grab.tabIndex = -1;
      }
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
  function draw(now: number) {
    frame = 0;
    if (disposed || document.hidden || !ready || (!film && !directory)) return;
    const elapsed = last ? now - last : 16,
      dt = Math.min(elapsed / 1000, 0.05);
    last = now;
    const quiet = reduce.matches;
    if (!quiet) {
      clock.value += dt;
      simulation.advance(dt);
    }
    look = lerp(look, quiet ? 0 : pointer, quiet ? 1 : 1 - Math.exp(-dt * 10));
    cameraPose(quiet ? stops[reading].at : progress, pose);
    let [u, v, yaw, pitch, dist, fx, fy] = pose;
    flagSurface(u, v, target);
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
  function setRay(x: number, y: number) {
    ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2);
    ray.setFromCamera(ndc, camera);
  }
  function markAt(uv: THREE.Vector2 | undefined) {
    if (!uv) return 0;
    const { x: u, y: v } = uv;
    const i = Math.round((u - 0.16) / 0.156);
    if (
      i >= 0 &&
      i < 5 &&
      Math.abs(v - 0.095) < 0.043 &&
      Math.abs(u - 0.16 - i * 0.156) < 0.036
    )
      return i + 1;
    if (reading === 6 && u > 0.62 && u < 0.89 && v > 0.19 && v < 0.38) return 6;
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
    drag = null;
    pointer = 0;
    ignoreClick = false;
    touchedMark = 0;
    simulation.reset();
    function isSceneTarget(target: EventTarget | null) {
      return (
        target instanceof Element &&
        (target === grab ||
          !target.closest('a, button, [role="dialog"], .member-sheet'))
      );
    }
    const targetPoint = new THREE.Vector3();
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (
          !ready ||
          (!film && !directory) ||
          drag ||
          !e.isPrimary ||
          e.button !== 0 ||
          !isSceneTarget(e.target)
        )
          return;
        ignoreClick = false;
        touchedMark = 0;
        setRay(e.clientX, e.clientY);
        const hit = ray.intersectObject(simulation.collider, false)[0];
        if (!hit?.uv && e.target !== grab) return;
        touchedMark = markAt(hit?.uv);
        let grip = null;
        if (hit?.uv && !reduce.matches) {
          const normal = camera.getWorldDirection(new THREE.Vector3());
          grip = {
            origin: simulation.grab(hit.uv.x, hit.uv.y),
            contact: hit.point,
            plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
              normal,
              hit.point,
            ),
            normal,
          };
          simulation.pull(
            targetPoint.copy(grip.origin).addScaledVector(normal, -0.085),
          );
        }
        drag = {
          x: e.clientX,
          y: e.clientY,
          id: e.pointerId,
          grip,
          started: e.timeStamp,
          moved: false,
          held: false,
        };
        requestDraw();
      },
      options,
    );
    document.addEventListener(
      'pointermove',
      (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        if (
          !drag.moved &&
          Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7
        ) {
          drag.moved = true;
          drag.held ||= e.timeStamp - drag.started > 180;
        }
        const { grip } = drag;
        if (grip && drag.moved && !reduce.matches) {
          setRay(e.clientX, e.clientY);
          if (ray.ray.intersectPlane(grip.plane, targetPoint)) {
            targetPoint
              .sub(grip.contact)
              .clampLength(0, 1.05)
              .add(grip.origin)
              .addScaledVector(grip.normal, -0.12);
            simulation.pull(targetPoint);
          }
        }
        requestDraw();
      },
      options,
    );
    // Quick vertical swipes stay native. Holding the cloth before dragging
    // gives touch users a way to pull up or down without scrolling the page.
    document.addEventListener(
      'touchmove',
      (e) => {
        if (!drag?.grip || e.touches.length !== 1 || !e.cancelable) return;
        if (!drag.moved && e.timeStamp - drag.started > 180) drag.held = true;
        if (drag.held) e.preventDefault();
      },
      { ...options, passive: false },
    );
    function cancelGrab() {
      simulation.release();
      drag = null;
      requestDraw();
    }
    function release(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      const cancelled = e.type === 'pointercancel';
      ignoreClick = cancelled || drag.moved;
      const quickSwipe = e.pointerType === 'touch' && !drag.held;
      if (
        !cancelled &&
        quickSwipe &&
        film &&
        reading >= 1 &&
        reading <= 5 &&
        Math.abs(dx) > 98 &&
        Math.abs(dx) > Math.abs(dy) * 1.7
      ) {
        step(dx < 0 ? 1 : -1);
      }
      cancelGrab();
    }
    window.addEventListener('pointerup', release, options);
    window.addEventListener('pointercancel', release, options);
    window.addEventListener('blur', cancelGrab, options);
    document.addEventListener(
      'click',
      (e) => {
        if (!film || !isSceneTarget(e.target)) return;
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        const keyboard = e.detail === 0 && e.target === grab;
        if (!keyboard && e.detail === 0) return;
        const mark = keyboard ? 0 : touchedMark;
        touchedMark = 0;
        if ((mark === 6 || keyboard) && reading === 6) {
          film.querySelector<HTMLAnchorElement>('#team .action')?.click();
        } else if (mark >= 1 && mark <= 5) {
          film
            .querySelector<HTMLAnchorElement>(
              '.marks-nav a[href="#' + stops[mark].id + '"]',
            )
            ?.click();
        } else if (keyboard && reading !== 0) {
          if (reading === 7)
            film.querySelector<HTMLAnchorElement>('.return-top')?.click();
          else step(reading === 5 ? -4 : 1);
        }
      },
      options,
    );
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
      const yarnMaterials = new Set<THREE.MeshStandardMaterial>();
      gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && !obj.geometry.hasAttribute('uv'))
          yarnMaterials.add(obj.material);
      });
      const wovenVariants = new Map<
        THREE.MeshStandardMaterial,
        THREE.MeshStandardMaterial
      >();
      const configured = new Set<THREE.MeshStandardMaterial>();
      let hasBinding = true;
      gltf.scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        if (!obj.geometry.getAttribute('_cloth')) {
          hasBinding = false;
          return;
        }
        obj.geometry.translate(-hoistPivot.x, -hoistPivot.y, -hoistPivot.z);
        simulation.bindMesh(obj.geometry);
        obj.frustumCulled = false;
        const woven = obj.geometry.hasAttribute('uv');
        if (woven && yarnMaterials.has(obj.material)) {
          // A shared GLB material needs separate shaders on the woven crest
          // and on the raised trim, since only one has cloth UVs.
          const source = obj.material as THREE.MeshStandardMaterial;
          if (!wovenVariants.has(source))
            wovenVariants.set(source, source.clone());
          obj.material = wovenVariants.get(source)!;
        }
        if (!configured.has(obj.material)) {
          shadeSilk(obj.material, woven, simulation, weave);
          configured.add(obj.material);
        }
        const match = obj.name.match(/Mark_([1-5])/);
        if (match) {
          obj.material.emissive = new THREE.Color(0xc47934);
          threads.set(Number(match[1]), obj.material);
        }
      });
      if (!hasBinding) {
        releaseResources(gltf.scene);
        return;
      }
      cloth.add(gltf.scene);
      modelLoaded = true;
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
      if (e.pointerType === 'mouse' && !drag)
        pointer = (e.clientX / width) * 2 - 1;
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
  reduce.addEventListener(
    'change',
    () => {
      if (reduce.matches) {
        drag = null;
        simulation.reset();
      }
      requestDraw();
    },
    { signal },
  );
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
      ready = modelLoaded;
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
    cloth.remove(simulation.collider);
    simulation.dispose();
    weave.dispose();
    releaseResources(scene);
    renderer.dispose();
    surface.remove();
  };
}
