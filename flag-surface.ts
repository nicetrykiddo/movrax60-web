import { Vector3 } from 'three';

// Matches the authored rest surface and straight hoist edge in weave.py.
function drape(u: number, v: number, out: Vector3) {
  const x =
    (u - 0.5) * 4.35 +
    0.43 * Math.sin(v * 2.2 + 0.31) * (u - 0.24) +
    0.18 * (v - 0.5);
  const depth =
    0.41 * Math.sin(u * 8.6 + 0.31 + v * 0.85) +
    0.17 * Math.sin(u * 16.1 - v * 5.3) +
    0.22 * (1 - v) * Math.sin(u * 4.6 + 0.31) +
    0.037 * Math.sin(28 * u + 7 * v) * (1 - v) ** 2;
  const y =
    (v - 0.5) * 3.49 +
    0.17 * Math.sin(u * 5.1 + 0.31) +
    0.34 * u +
    0.12 * u * u;
  return out.set(
    1.8 + Math.cos(0.11) * x - Math.sin(0.11) * depth,
    1.65 + y,
    0.18 - Math.sin(0.11) * x - Math.cos(0.11) * depth,
  );
}

const hoistBottom = drape(0, 0, new Vector3());
const hoistTop = drape(0, 1, new Vector3());

export const hoistPivot = hoistBottom.clone().lerp(hoistTop, 0.5);

export function flagSurface(u: number, v: number, out: Vector3) {
  drape(u, v, out);
  if (u < 0.16) {
    const t = u / 0.16;
    const blend = 1 - t * t * (3 - 2 * t);
    const edge = drape(0, v, new Vector3());
    return out
      .addScaledVector(hoistBottom, (1 - v) * blend)
      .addScaledVector(hoistTop, v * blend)
      .addScaledVector(edge, -blend);
  }
  return out;
}
