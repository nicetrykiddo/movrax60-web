import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RGBAFormat,
  DoubleSide,
  Vector3,
} from 'three';
import { flagSurface, hoistPivot } from './flag-surface';

const columns = 27;
const rows = 21;
const count = columns * rows;
const timeStep = 1 / 120;
const solverPasses = 6;

type Binding = {
  corners: number[];
  weights: number[];
};
type Grip = Binding & { target: Vector3 };

function binding(u: number, v: number): Binding {
  const x = Math.max(0, Math.min(1, u)) * (columns - 1);
  const y = Math.max(0, Math.min(1, v)) * (rows - 1);
  const col = Math.min(columns - 2, Math.floor(x));
  const row = Math.min(rows - 2, Math.floor(y));
  const a = row * columns + col;
  const tx = x - col,
    ty = y - row;
  return {
    corners: [a, a + 1, a + columns, a + columns + 1],
    weights: [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty],
  };
}

function sample(
  points: Float32Array,
  { corners, weights }: Binding,
  out: Vector3,
) {
  out.set(0, 0, 0);
  for (let j = 0; j < 4; j++) {
    const i = corners[j] * 3,
      w = weights[j];
    out.x += points[i] * w;
    out.y += points[i + 1] * w;
    out.z += points[i + 2] * w;
  }
  return out;
}

const vector = new Vector3();

// The lattice simulates the silk. Both the flag and its sewn detail sample
// the same deformation, while the collider uses the current lattice positions.
export const clothShader = `
attribute vec3 _cloth;
attribute vec3 clothOffset;
uniform sampler2D clothDelta;
uniform sampler2D clothRotation;

vec4 sampleCloth(sampler2D field) {
  vec2 p = clamp(_cloth.xy, 0., 1.) * vec2(${columns - 1}., ${rows - 1}.);
  ivec2 a = min(ivec2(p), ivec2(${columns - 2}, ${rows - 2}));
  vec2 t = p - vec2(a);
  return mix(
    mix(texelFetch(field, a, 0), texelFetch(field, a + ivec2(1, 0), 0), t.x),
    mix(texelFetch(field, a + ivec2(0, 1), 0), texelFetch(field, a + ivec2(1, 1), 0), t.x),
    t.y);
}

vec3 rotateWithCloth(vec3 v, vec4 q) {
  return v + 2. * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
`;

export class ClothSimulation {
  readonly rest = new Float32Array(count * 3);
  readonly positions = new Float32Array(count * 3);
  readonly delta = new DataTexture(
    new Float32Array(count * 4),
    columns,
    rows,
    RGBAFormat,
    FloatType,
  );
  readonly rotation = new DataTexture(
    new Float32Array(count * 4),
    columns,
    rows,
    RGBAFormat,
    FloatType,
  );
  readonly collider: Mesh<BufferGeometry, MeshBasicMaterial>;

  private readonly previous = new Float32Array(count * 3);
  private readonly mass = new Float32Array(count);
  private readonly restFrames = new Float32Array(count * 4);
  private readonly frame = new Quaternion();
  private readonly inverseRest = new Quaternion();
  private readonly basis = new Matrix4();
  private readonly along = new Vector3();
  private readonly up = new Vector3();
  private readonly normal = new Vector3();
  private readonly constraints: {
    a: number;
    b: number;
    distance: number;
    stretch: number;
    compression: number;
  }[] = [];
  private readonly hem: Grip[];
  private grip:
    | (Grip & {
        origin: Vector3;
        anchor: Vector3;
        reach: number;
        travel: number;
      })
    | null = null;
  private lifted = false;
  private accumulator = 0;
  private time = 0;

  constructor() {
    const uv = new Float32Array(count * 2);
    const triangles: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const i = row * columns + col;
        const u = col / (columns - 1),
          v = row / (rows - 1);
        flagSurface(u, v, vector)
          .sub(hoistPivot)
          .toArray(this.rest, i * 3);
        uv.set([u, v], i * 2);
        // A fixed line through the model's origin is the hoist constraint.
        this.mass[i] = col === 0 ? 0 : 1;
        if (col < columns - 1 && row < rows - 1)
          triangles.push(
            i,
            i + 1,
            i + columns,
            i + columns,
            i + 1,
            i + columns + 1,
          );
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const i = row * columns + col;
        this.surfaceFrame(this.rest, i).toArray(this.restFrames, i * 4);
        if (col + 1 < columns) this.connect(i, i + 1, 0.96, 0.74);
        if (row + 1 < rows) this.connect(i, i + columns, 0.96, 0.74);
        if (row + 1 < rows && col + 1 < columns)
          this.connect(i, i + columns + 1, 0.63, 0.52);
        if (row + 1 < rows && col > 0)
          this.connect(i, i + columns - 1, 0.63, 0.52);
        if (col + 2 < columns) this.connect(i, i + 2, 0.24, 0.16);
        if (row + 2 < rows) this.connect(i, i + columns * 2, 0.24, 0.16);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.setIndex(triangles);
    this.positions.set(this.rest);
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius += 2;
    this.collider = new Mesh(
      geometry,
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    this.hem = [0.29, 0.54, 0.79].map((u) => {
      const bind = binding(u, 0.035);
      return {
        ...bind,
        target: sample(this.rest, bind, new Vector3()).add(
          new Vector3(-0.18, 0.63, 0.36),
        ),
      };
    });
    this.reset();
  }

  private connect(a: number, b: number, stretch: number, compression: number) {
    const p = this.rest,
      i = a * 3,
      j = b * 3;
    const distance = Math.hypot(
      p[i] - p[j],
      p[i + 1] - p[j + 1],
      p[i + 2] - p[j + 2],
    );
    this.constraints.push({ a, b, distance, stretch, compression });
  }

  private surfaceFrame(points: Float32Array, i: number) {
    const col = i % columns,
      row = Math.floor(i / columns);
    const left = (col === 0 ? i : i - 1) * 3;
    const right = (col === columns - 1 ? i : i + 1) * 3;
    const bottom = (row === 0 ? i : i - columns) * 3;
    const top = (row === rows - 1 ? i : i + columns) * 3;
    this.along
      .fromArray(points, right)
      .sub(this.normal.fromArray(points, left))
      .normalize();
    this.up.fromArray(points, top).sub(this.normal.fromArray(points, bottom));
    this.normal.crossVectors(this.along, this.up).normalize();
    this.up.crossVectors(this.normal, this.along);
    return this.frame.setFromRotationMatrix(
      this.basis.makeBasis(this.along, this.up, this.normal),
    );
  }

  private updateField() {
    const offset = this.delta.image.data as Float32Array;
    const rotation = this.rotation.image.data as Float32Array;
    for (let i = 0; i < count; i++) {
      const xyz = i * 3,
        rgba = i * 4;
      for (let axis = 0; axis < 3; axis++)
        offset[rgba + axis] =
          this.positions[xyz + axis] - this.rest[xyz + axis];
      this.inverseRest.fromArray(this.restFrames, rgba).invert();
      const q = this.surfaceFrame(this.positions, i)
        .multiply(this.inverseRest)
        .normalize();
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      q.toArray(rotation, rgba);
    }
    this.delta.needsUpdate = this.rotation.needsUpdate = true;
  }

  private constrainGrip(grip: Grip, strength: number) {
    sample(this.positions, grip, vector).sub(grip.target);
    let total = 0;
    for (let j = 0; j < 4; j++)
      total += grip.weights[j] ** 2 * this.mass[grip.corners[j]];
    if (total < 0.025) return;
    for (let j = 0; j < 4; j++) {
      const node = grip.corners[j],
        offset = node * 3;
      const correction = (strength * grip.weights[j] * this.mass[node]) / total;
      this.positions[offset] -= vector.x * correction;
      this.positions[offset + 1] -= vector.y * correction;
      this.positions[offset + 2] -= vector.z * correction;
    }
  }

  private step(wind: boolean) {
    const p = this.positions,
      old = this.previous,
      rest = this.rest;
    this.time += timeStep;
    for (let node = 0; node < count; node++) {
      if (this.mass[node] === 0) continue;
      const i = node * 3;
      const free = (node % columns) / (columns - 1);
      // The authored drape is the pre-tensioned equilibrium. Gravity and a
      // damped restoring force bring the displaced cloth back to that drape.
      const air = wind
        ? free *
          (1.15 * Math.sin(this.time * 2 - rest[i] * 1.7 + rest[i + 1] * 0.6))
        : 0;
      for (let axis = 0; axis < 3; axis++) {
        const j = i + axis;
        const acc =
          (rest[j] - p[j]) * (axis === 1 ? 31 : 22) +
          (axis === 1 ? -0.95 * free : axis === 2 ? air : 0);
        const current = p[j];
        p[j] += (p[j] - old[j]) * 0.95 + acc * timeStep ** 2;
        old[j] = current;
      }
    }
    for (let pass = 0; pass < solverPasses; pass++) {
      if (this.lifted) {
        for (const bound of this.hem) this.constrainGrip(bound, 0.31);
      }
      if (this.grip && pass < solverPasses - 2)
        this.constrainGrip(this.grip, 0.7);
      for (const edge of this.constraints) {
        const a = edge.a * 3,
          b = edge.b * 3;
        const wa = this.mass[edge.a],
          wb = this.mass[edge.b];
        if (wa + wb === 0) continue;
        const x = p[a] - p[b],
          y = p[a + 1] - p[b + 1],
          z = p[a + 2] - p[b + 2];
        const length = Math.sqrt(x * x + y * y + z * z);
        if (length < 0.0001) continue;
        const stiffness =
          length > edge.distance ? edge.stretch : edge.compression;
        const scale = ((1 - edge.distance / length) * stiffness) / (wa + wb);
        p[a] -= x * scale * wa;
        p[a + 1] -= y * scale * wa;
        p[a + 2] -= z * scale * wa;
        p[b] += x * scale * wb;
        p[b + 1] += y * scale * wb;
        p[b + 2] += z * scale * wb;
      }
    }
  }

  bindMesh(geometry: BufferGeometry) {
    const coords = geometry.getAttribute('_cloth');
    const position = geometry.getAttribute('position');
    const offsets = new Float32Array(position.count * 3);
    const base = new Vector3();
    for (let i = 0; i < position.count; i++) {
      sample(this.rest, binding(coords.getX(i), coords.getY(i)), base);
      vector
        .fromBufferAttribute(position, i)
        .sub(base)
        .toArray(offsets, i * 3);
    }
    geometry.setAttribute('clothOffset', new BufferAttribute(offsets, 3));
  }

  grab(u: number, v: number) {
    const bind = binding(u, v);
    const origin = sample(this.positions, bind, new Vector3());
    const anchor = sample(this.rest, binding(0, v), new Vector3());
    const previous = anchor.clone();
    let reach = 0;
    for (let column = 1; column <= Math.ceil(u * (columns - 1)); column++) {
      sample(
        this.rest,
        binding(Math.min(u, column / (columns - 1)), v),
        vector,
      );
      reach += vector.distanceTo(previous);
      previous.copy(vector);
    }
    this.grip = {
      ...bind,
      origin,
      target: origin.clone(),
      anchor,
      reach,
      travel: Math.min(1.05, u * 2.35),
    };
    return origin.clone();
  }

  pull(target: Vector3) {
    if (!this.grip) return;
    const grip = this.grip;
    grip.target
      .copy(target)
      .sub(grip.origin)
      .clampLength(0, grip.travel)
      .add(grip.origin)
      .sub(grip.anchor)
      .clampLength(0, grip.reach * 1.025)
      .add(grip.anchor);
  }
  release() {
    this.grip = null;
  }
  lift(enabled: boolean) {
    this.lifted = enabled;
  }

  advance(seconds: number) {
    this.accumulator = Math.min(this.accumulator + seconds, timeStep * 5);
    if (this.accumulator < timeStep) return;
    while (this.accumulator >= timeStep) {
      this.step(true);
      this.accumulator -= timeStep;
    }
    this.updateField();
  }

  settle(lifted: boolean) {
    this.reset();
    if (!lifted) return;
    this.lifted = true;
    for (let i = 0; i < 70; i++) this.step(false);
    this.updateField();
  }

  reset() {
    this.grip = null;
    this.lifted = false;
    this.accumulator = this.time = 0;
    this.positions.set(this.rest);
    this.previous.set(this.rest);
    this.updateField();
  }

  dispose() {
    this.delta.dispose();
    this.rotation.dispose();
    this.collider.geometry.dispose();
    this.collider.material.dispose();
  }
}
