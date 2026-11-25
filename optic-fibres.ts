import * as THREE from 'three';

// Three ferrules each divide into three ribbons. The GPU shares a longitudinal
// sample buffer between the individual strands, including at full resolution.
const lanes = 9;
const strandsPerLane = 512;
const spans = 1024;
export const fibreTopology = Object.freeze({
  strands: lanes * strandsPerLane,
  nodes: lanes * strandsPerLane * (spans + 1),
  edges: lanes * strandsPerLane * spans,
});
export type FibreQuality = 'low' | 'balanced' | 'high' | 'full';
const samples: Record<FibreQuality, [number, number]> = {
  low: [16, 64],
  balanced: [40, 128],
  high: [128, 256],
  full: [strandsPerLane, spans],
};

const colours = [
  '#91afac', '#bcc3ae', '#49878a',
  '#c3844f', '#fac18a', '#9c6347',
  '#547879', '#d4af80', '#aeccc4',
].map(hex => new THREE.Color(hex));
const ferruleZ = [-.362, 0, .362];

function makeRoute(lane: number) {
  const port = Math.floor(lane / 3);
  const spread = (lane - 4) / 4;
  const branch = (lane % 3) - 1;
  const launch = ferruleZ[port];
  const landing = (lane - 4) * .17;
  // Parallel at both connectors. In the open section, the outer ribbons cross
  // at different heights with gentle bend radii, like dressed optical cable.
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, launch),
    new THREE.Vector3(.6, branch * .007, launch + branch * .018),
    new THREE.Vector3(2.05 + spread * .3, .12 + spread * .16, .30 + spread * .62),
    new THREE.Vector3(3.43 + spread * .38, .48 + spread * .44, -.57 + spread * .89),
    new THREE.Vector3(3.45 + spread * .91, .95 + spread * .60, -2.65 + branch * .20),
    new THREE.Vector3(1.77 + spread * 1.20, 1.42 - spread * .60, -4.68 + spread * .58),
    new THREE.Vector3(-.82 + spread * .72, 1.10 - spread * .94, -5.50 - spread * .88),
    new THREE.Vector3(-4.56 + .6 * landing, -.35, -8.12 - .8 * landing),
    new THREE.Vector3(-6.8 + .6 * landing, -.35, -9.8 - .8 * landing),
  ]);
}
const routes = Array.from({ length: lanes }, (_, lane) => makeRoute(lane));

/** Centre of a routed ribbon, in loom-local units measured from the middle ferrule. */
export function fibrePoint(t: number, lane = 4) {
  return routes[THREE.MathUtils.clamp(Math.round(lane), 0, lanes - 1)]
    .getPoint(THREE.MathUtils.clamp(t, 0, 1));
}

// Store the centre, width direction and depth direction of every cross-section.
// The shared frames keep each fibre attached when the camera goes from wide to macro.
function makeFrames() {
  const width = spans + 1;
  const data = new Float32Array(width * lanes * 3 * 4);
  const centre = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const vertical = new THREE.Vector3(0, 1, 0);
  function write(row: number, col: number, vector: THREE.Vector3, w: number) {
    const offset = (row * width + col) * 4;
    data[offset] = vector.x;
    data[offset + 1] = vector.y;
    data[offset + 2] = vector.z;
    data[offset + 3] = w;
  }
  routes.forEach((route, lane) => {
    for (let i = 0; i <= spans; i++) {
      const t = i / spans;
      route.getPoint(t, centre);
      route.getTangent(t, tangent);
      side.crossVectors(tangent, vertical).normalize();
      const open = THREE.MathUtils.smoothstep(t, .075, .44) * (1 - THREE.MathUtils.smoothstep(t, .74, .965));
      const twist = (.62 * Math.sin(t * 9.2 + lane * .28) + .93 * Math.sin(t * 4.7 - .4)) * open;
      side.applyAxisAngle(tangent, twist);
      up.crossVectors(side, tangent).normalize();
      const core = lane >= 3 && lane <= 5 ? .029 : .019;
      write(lane * 3, i, centre, open);
      write(lane * 3 + 1, i, side, core + open * (.18 + .045 * Math.cos(lane * 1.9 + t * 12)));
      write(lane * 3 + 2, i, up, core * .65 + open * .045);
    }
  });
  const frames = new THREE.DataTexture(data, width, lanes * 3, THREE.RGBAFormat, THREE.FloatType);
  frames.minFilter = frames.magFilter = THREE.NearestFilter;
  frames.needsUpdate = true;
  return frames;
}

function sequence(index: number, base: number) {
  let result = 0;
  let weight = 1 / base;
  while (index) {
    result += (index % base) * weight;
    index = Math.floor(index / base);
    weight /= base;
  }
  return result;
}

function instances(count: number) {
  // Interleave lanes and use a low-discrepancy sequence. Every lower-detail
  // population is an evenly spread subset of exactly the same physical loom.
  const layout = new Float32Array(count * lanes * 4);
  const albedo = new Float32Array(count * lanes * 3);
  for (let strand = 0; strand < count; strand++) {
    for (let lane = 0; lane < lanes; lane++) {
      const n = strand * lanes + lane;
      const seed = (sequence(strand + 1, 5) + lane * .381966) % 1;
      const across = sequence(strand + 1, 2) * 2 - 1;
      const deep = sequence(strand + 1, 3) * 2 - 1;
      layout.set([lane, across, deep * Math.sqrt(1 - across * across), seed], n * 4);
      const colour = colours[lane];
      const luminance = .43 + seed * .70;
      albedo.set([colour.r * luminance, colour.g * luminance, colour.b * luminance], n * 3);
    }
  }
  return {
    strand: new THREE.InstancedBufferAttribute(layout, 4),
    fibreColour: new THREE.InstancedBufferAttribute(albedo, 3),
  };
}

function strandsGeometry(count: number, radial: number, strands: ReturnType<typeof instances>) {
  const geometry = new THREE.InstancedBufferGeometry();
  // The low/full buffers contain t (a single float) per node. The mesh version
  // uses the other two coordinates for the circular jacket of a few close-up fibres.
  if (!radial) {
    const steps = new Float32Array(count + 1);
    for (let i = 0; i <= count; i++) steps[i] = i / count;
    geometry.setAttribute('position', new THREE.BufferAttribute(steps, 1));
  } else {
    const positions = new Float32Array((count + 1) * radial * 3);
    const index: number[] = [];
    for (let i = 0; i <= count; i++) {
      for (let face = 0; face < radial; face++) {
        const angle = face / radial * Math.PI * 2;
        const a = i * radial + face;
        const b = i * radial + (face + 1) % radial;
        positions.set([i / count, Math.cos(angle), Math.sin(angle)], a * 3);
        if (i < count) index.push(a, b, a + radial, b, b + radial, a + radial);
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
  }
  geometry.setAttribute('strand', strands.strand);
  geometry.setAttribute('fibreColour', strands.fibreColour);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-1.5, .5, -4.5), 9);
  return geometry;
}

// Stable cross-sections and surface highlights. A packet moves along the curves
// by changing a scalar uniform; the CPU never rewrites their vertex positions.
const vertex = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute vec4 strand;
  attribute vec3 fibreColour;
  uniform sampler2D frames;
  varying vec3 tint;
  varying vec3 viewNormal;
  varying vec3 viewDir;
  varying vec4 path;
  void main() {
    float t = position.x;
    ivec2 address = ivec2(int(t * 1024.0 + .5), int(strand.x) * 3);
    vec4 centre = texelFetch(frames, address, 0);
    vec4 side = texelFetch(frames, address + ivec2(0, 1), 0);
    vec4 up = texelFetch(frames, address + ivec2(0, 2), 0);
    float curl = sin(t * 23. + strand.w * 6.283) * .055 * centre.w;
    vec3 p = centre.xyz + side.xyz * (strand.y + curl) * side.w
                        + up.xyz * (strand.z + .4 * curl) * up.w;
    #ifdef JACKET
      vec3 normalDirection = side.xyz * position.y + up.xyz * position.z;
      float radius = (.004 + .006 * centre.w) * (.75 + .46 * strand.w);
      p += normalDirection * radius;
    #else
      vec3 normalDirection = normalize(up.xyz * (.75 + .25 * strand.z) + side.xyz * strand.y);
    #endif
    viewNormal = normalize(normalMatrix * normalDirection);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.);
    viewDir = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    path = vec4(t, strand.w, strand.x, centre.w);
    tint = fibreColour;
    #include <fog_vertex>
  }
`;
const fragment = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform float seconds;
  uniform float pulse;
  uniform float strength;
  uniform float densityAlpha;
  varying vec3 tint;
  varying vec3 viewNormal;
  varying vec3 viewDir;
  varying vec4 path;
  void main() {
    float t = path.x;
    vec3 N = normalize(viewNormal);
    vec3 V = normalize(viewDir);
    vec3 light = normalize(vec3(.52, .78, .58));
    float silver = pow(max(dot(normalize(light + V), N), 0.), 18.);
    float grazing = pow(1. - abs(dot(N, V)), 3.);
    float reflection = pow(.5 + .5 * sin(16. * t + path.z * .51), 7.);
    float packetDelta = t - pulse - (path.y - .5) * .025;
    float hot = exp(-abs(packetDelta) * 86.) * step(0., pulse) * strength;
    float tail = exp(-abs(packetDelta + .024) * 27.) * step(0., pulse) * strength;
    float idlePos = fract(t * 1.12 - seconds * .054 + path.z * .104);
    float idle = pow(max(0., 1. - abs(idlePos - .47) * 26.), 4.) * step(.78, path.y);
    vec3 col = tint * (.24 + .66 * max(.0,dot(N, light)) + .32 * grazing);
    col += reflection * tint * (.11 + .33 * path.y);
    col += silver * vec3(.34,.38,.36);
    col += (hot * 2.8 + idle * .43) * mix(tint, vec3(1., .80, .51), .67) + tail * tint * .54;
    #ifdef JACKET
      col += grazing * vec3(.09,.10,.09);
      gl_FragColor = vec4(col, 1.);
    #else
      gl_FragColor = vec4(col, min(.95, densityAlpha * (.65 + .35 * path.y) + .13 * hot));
    #endif
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createOpticFibres(initial: FibreQuality = 'balanced') {
  const group = new THREE.Group();
  group.name = 'Optical fibre loom';
  const frames = makeFrames();
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    frames: { value: frames },
    seconds: { value: 0 },
    pulse: { value: -1 },
    strength: { value: 1 },
    densityAlpha: { value: 1 },
  };
  const glass = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, fog: true,
  });
  const jacket = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    defines: { JACKET: 1 }, side: THREE.DoubleSide, fog: true,
  });
  const population = instances(strandsPerLane);
  const fineGeometries = Object.fromEntries(
    Object.entries(samples).map(([key, [, segments]]) => [key, strandsGeometry(segments, 0, population)]),
  ) as Record<FibreQuality, THREE.InstancedBufferGeometry>;
  const lines = new THREE.Line(fineGeometries[initial], glass);
  lines.name = 'Drawn silica filaments';
  const tubes = strandsGeometry(128, 6, instances(8));
  const jackets = new THREE.Mesh(tubes, jacket);
  jackets.name = 'Clad filaments';
  group.add(lines, jackets);

  const boot = new THREE.MeshStandardMaterial({color: 0x273230, roughness: .44, metalness: .36});
  const brass = new THREE.MeshStandardMaterial({color: 0xad855a, roughness: .24, metalness: .87});
  const sleeveForm = new THREE.CylinderGeometry(1, .81, 1, 16);
  const ringForm = new THREE.TorusGeometry(1, .099, 6, 16);
  const sleeves = new THREE.InstancedMesh(sleeveForm, boot, 3);
  const rings = new THREE.InstancedMesh(ringForm, brass, 9);
  const part = new THREE.Object3D();
  ferruleZ.forEach((z, port) => {
    const r = port === 1 ? .039 : .027;
    part.rotation.set(0, 0, Math.PI / 2);
    part.position.set(.103, 0, z);
    part.scale.set(r, .206, r);
    part.updateMatrix();
    sleeves.setMatrixAt(port, part.matrix);
    part.rotation.set(0, Math.PI / 2, 0);
    [.014, .050, .176].forEach((x, i) => {
      part.position.x = x;
      part.scale.setScalar(r * (i === 2 ? .86 : 1));
      part.updateMatrix();
      rings.setMatrixAt(port * 3 + i, part.matrix);
    });
  });
  group.add(sleeves, rings);
  let quality = initial;
  function setQuality(next: FibreQuality) {
    quality = next;
    const [count] = samples[quality];
    lines.geometry = fineGeometries[quality];
    lines.geometry.instanceCount = count * lanes;
    tubes.instanceCount = lanes * (quality === 'low' ? 3 : 8);
    uniforms.densityAlpha.value = Math.min(.85, (30 / count) ** .73);
  }
  setQuality(initial);
  return {
    group,
    setQuality,
    counts() {
      const [strands, segments] = samples[quality];
      return { strands: lanes * strands, nodes: lanes * strands * (segments + 1), edges: lanes * strands * segments };
    },
    update(time: number, pulseProgress = -1, intensity = 1) {
      uniforms.seconds.value = time;
      uniforms.pulse.value = pulseProgress;
      uniforms.strength.value = intensity;
    },
    dispose() {
      group.removeFromParent();
      Object.values(fineGeometries).forEach(geometry => geometry.dispose());
      [tubes, sleeveForm, ringForm, sleeves, rings, glass, jacket, boot, brass, frames].forEach(resource => resource.dispose());
    },
  };
}
