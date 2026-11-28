import { expect, test } from '@playwright/test';
import { Vector3 } from 'three';
import { ClothSimulation } from '../cloth-response';

test('grabbing the upper and middle cloth moves each grip around the fixed hoist', () => {
  const cloth = new ClothSimulation();
  const uv = cloth.collider.geometry.getAttribute('uv');
  const grips = [
    { u: 0.68, v: 0.74, movement: new Vector3(-0.5, 0.39, 0.15) },
    { u: 0.5, v: 0.42, movement: new Vector3(0.15, 0.42, 0.16) },
  ];

  for (const { u, v, movement } of grips) {
    cloth.reset();
    const start = cloth.grab(u, v);
    cloth.pull(start.clone().add(movement));
    for (let i = 0; i < 26; i++) cloth.advance(1 / 60);

    const lifted = cloth.grab(u, v).sub(start);
    expect(lifted.y).toBeGreaterThan(0.25);
    expect(Math.sign(lifted.x)).toBe(Math.sign(movement.x));
    for (let i = 0; i < uv.count; i++) {
      if (uv.getX(i) === 0) {
        const point = i * 3;
        expect(cloth.positions.slice(point, point + 3)).toEqual(
          cloth.rest.slice(point, point + 3),
        );
      }
    }

    cloth.release();
    for (let i = 0; i < 140; i++) cloth.advance(1 / 60);
    expect(cloth.grab(u, v).distanceTo(start)).toBeLessThan(0.06);
  }
  cloth.dispose();
});

test('the keyboard lift raises the left, middle and right sections of the free hem', () => {
  const cloth = new ClothSimulation();
  const points = [0.29, 0.54, 0.79];
  const rest = points.map((u) => cloth.grab(u, 0.035).y);
  cloth.settle(true);
  for (const [i, u] of points.entries()) {
    expect(cloth.grab(u, 0.035).y - rest[i]).toBeGreaterThan(0.35);
  }
  cloth.dispose();
});
