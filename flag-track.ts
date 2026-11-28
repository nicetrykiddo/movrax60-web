// The camera positions are the same cloth UVs and orbit angles used to draw
// the editable OpenPencil study. Distances are in the Blender rig's units.
export const stops = [
  { id: 'identity', at: 0, enter: 0 },
  { id: 'results', at: 0.26, enter: 0.2 },
  { id: 'nullcon', at: 0.34, enter: 0.3 },
  { id: 'ritsec', at: 0.42, enter: 0.38 },
  { id: 'script', at: 0.5, enter: 0.46 },
  { id: 'chronos', at: 0.58, enter: 0.54 },
  { id: 'team', at: 0.79, enter: 0.735 },
  { id: 'contact', at: 1, enter: 0.895 },
] as const;

export function filmProgress() {
  const end = document.getElementById('contact');
  if (!end || !document.querySelector('.film[data-playing]')) return 0;
  return Math.max(0, Math.min(1, scrollY / Math.max(1, end.offsetTop)));
}

export function readingIndex(p: number) {
  let i = stops.length - 1;
  while (i > 0 && p < stops[i].enter) i--;
  return i;
}

const keys = [
  [0, 0.48, 0.5, -18, 6, 7.55, 0.68, 0.5],
  [0.16, 0.34, 0.33, -9, 7, 5.38, 0.71, 0.51],
  [0.26, 0.16, 0.095, -5, 11, 3.38, 0.7, 0.62],
  [0.34, 0.316, 0.095, 4, 10, 2.78, 0.71, 0.61],
  [0.42, 0.472, 0.095, 12, 9, 2.62, 0.72, 0.62],
  [0.5, 0.628, 0.095, 21, 9, 2.73, 0.72, 0.59],
  [0.58, 0.784, 0.095, 33, 11, 2.86, 0.7, 0.55],
  [0.65, 0.92, 0.13, 69, 13, 3.14, 0.67, 0.57],
  [0.7, 0.95, 0.16, 108, 14, 3.22, 0.67, 0.56],
  [0.79, 0.755, 0.284, 151, 13, 3.4, 0.7, 0.51],
  [0.87, 0.74, 0.32, 158, 10, 3.78, 0.69, 0.5],
  [1, 0.5, 0.49, 162, 7, 7.7, 0.68, 0.51],
];
function slope(i: number, c: number) {
  if (i === 0 || i === keys.length - 1) return 0;
  const prev = keys[i - 1],
    cur = keys[i],
    next = keys[i + 1];
  const left = cur[0] - prev[0],
    right = next[0] - cur[0];
  const a = (cur[c] - prev[c]) / left,
    b = (next[c] - cur[c]) / right;
  if (a * b <= 0) return 0;
  return (
    (3 * (left + right)) / ((2 * right + left) / a + (right + 2 * left) / b)
  );
}
const slopes = keys.map((key, i) => key.map((_, c) => slope(i, c)));

export function cameraPose(p: number, out: number[]) {
  let i = keys.length - 2;
  while (i > 0 && p < keys[i][0]) i--;
  const a = keys[i],
    b = keys[i + 1],
    span = b[0] - a[0],
    t = (p - a[0]) / span;
  const t2 = t * t,
    t3 = t2 * t;
  for (let c = 1; c < a.length; c++)
    out[c - 1] =
      (2 * t3 - 3 * t2 + 1) * a[c] +
      (t3 - 2 * t2 + t) * span * slopes[i][c] +
      (-2 * t3 + 3 * t2) * b[c] +
      (t3 - t2) * span * slopes[i + 1][c];
}
