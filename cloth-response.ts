import { Vector4 } from 'three';

// Rest coordinates keep the embroidery and fringe attached to the moving cloth.
export const clothResponseShader = `
uniform vec4 clothPress;
uniform vec4 clothWaves[3];
uniform float loomTime;

vec3 clothDeformation(vec2 point) {
  const vec2 tension = vec2(1., 1.28);
  vec2 offset = (point - clothPress.xy) * tension;
  float press = clothPress.z * exp(-dot(offset, offset) * 6.);
  vec3 change = vec3(press, -12. * press * offset * tension);
  for (int i = 0; i < 3; i++) {
    vec4 impulse = clothWaves[i];
    float age = loomTime - impulse.z;
    if (age >= 0. && age < 2. && impulse.w != 0.) {
      vec2 delta = (point - impulse.xy) * tension;
      float radius = length(delta);
      float crest = radius - 1.95 * age;
      float envelope = impulse.w * exp(-crest * crest * 10. - 2.8 * age);
      float wave = cos(11. * crest);
      float slope = envelope * (-20. * crest * wave - 11. * sin(11. * crest));
      change += vec3(envelope * wave, slope * delta * tension / max(radius, .001));
    }
  }
  float t = clamp((point.x + .57) / .49, 0., 1.);
  return change * (t * t * (3. - 2. * t)) +
    vec3(0., change.x * 6. * t * (1. - t) / .49, 0.);
}
`;

export function createClothResponse() {
  const press = new Vector4();
  const waves = Array.from({ length: 3 }, () => new Vector4());
  let cursor = 0;
  let pressure = 0;

  return {
    press,
    waves,
    hold(x: number, y: number, force: number) {
      press.x = x;
      press.y = y;
      pressure = force;
    },
    release(clock: number) {
      if (pressure !== 0) {
        waves[cursor].set(press.x, press.y, clock, pressure * 0.72);
        cursor = (cursor + 1) % waves.length;
      }
      pressure = 0;
    },
    advance(dt: number, quiet: boolean) {
      press.z += (pressure - press.z) * (1 - Math.exp(-21 * dt));
      if (quiet) {
        press.z = pressure = 0;
        for (const wave of waves) wave.w = 0;
      }
    },
    reset() {
      pressure = 0;
      press.set(0, 0, 0, 0);
      for (const wave of waves) wave.w = 0;
    },
  };
}
