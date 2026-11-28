import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

const size = 256;
const yarnsPerTile = 8;
const tau = Math.PI * 2;

function yarnProfile(across: number, along: number, index: number) {
  const wandering = Math.sin(tau * (along / 8 + index * 0.27)) * 0.054;
  const width =
    0.48 +
    0.035 * Math.sin(tau * (along / 4 + index * 0.37)) +
    0.017 * Math.sin(tau * (along / 8 + index * 0.61));
  const flank = (across - wandering) / width;
  // Flattened bundles overlap slightly before they pass under the next pick.
  const core = Math.exp(-1.42 * flank ** 4);
  return core * (0.83 + filament(across - wandering, along, index) * 0.043);
}

function filament(across: number, along: number, index: number) {
  const line = across * 5.6 + Math.sin((tau * along) / 4 + index) * 0.19;
  return (
    0.69 * Math.cos(tau * line) + 0.31 * Math.sin(tau * 0.71 * line + index)
  );
}

function pack(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

export function makeSilkWeave(anisotropy: number) {
  // Generate a repeating 2-over/2-under twill in yarn space. RGB stores the
  // surface slopes and dye variation. Alpha identifies the exposed yarn axis.
  const height = new Float32Array(size * size);
  const dye = new Float32Array(size * size);
  const alongWarp = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    const y = ((row + 0.5) * yarnsPerTile) / size;
    const weft = Math.floor(y);
    for (let col = 0; col < size; col++) {
      const x = ((col + 0.5) * yarnsPerTile) / size;
      const warp = Math.floor(x);
      const drapeWarp = 0.5 + 0.5 * Math.cos((Math.PI / 2) * (y - warp - 1));
      const drapeWeft = 0.5 - 0.5 * Math.cos((Math.PI / 2) * (weft - x));
      const vertical =
        yarnProfile(x - warp - 0.5, y, warp) * (0.66 + 0.34 * drapeWarp);
      const horizontal =
        yarnProfile(y - weft - 0.5, x, weft) * (0.66 + 0.34 * drapeWeft);
      const index = row * size + col;
      const top = Math.min(1, Math.max(0, 0.5 + (vertical - horizontal) * 5));
      const blend = top * top * (3 - 2 * top);
      alongWarp[index] = blend;
      height[index] = horizontal * (1 - blend) + vertical * blend;
      const fibres =
        filament(x - warp - 0.5, y, warp) * blend +
        filament(y - weft - 0.5, x, weft) * (1 - blend);
      const variation =
        0.058 * Math.sin(warp * 4.63 + weft * 2.03) +
        0.036 * Math.cos((tau * (x + y)) / 4);
      dye[index] = 0.31 + height[index] * 0.34 + variation + 0.075 * fibres;
    }
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      const next = row * size + ((col + 1) % size);
      const previous = row * size + ((col - 1 + size) % size);
      const above = ((row + 1) % size) * size + col;
      const below = ((row - 1 + size) % size) * size + col;
      const gradX = (height[previous] - height[next]) * 2.8;
      const gradY = (height[below] - height[above]) * 2.8;
      const i = index * 4;
      pixels[i] = pack(0.5 + gradX);
      pixels[i + 1] = pack(0.5 + gradY);
      pixels[i + 2] = pack(dye[index]);
      pixels[i + 3] = pack(alongWarp[index]);
    }
  }

  const weave = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  weave.name = 'Procedural silk twill';
  weave.wrapS = weave.wrapT = RepeatWrapping;
  weave.magFilter = LinearFilter;
  weave.minFilter = LinearMipmapLinearFilter;
  weave.generateMipmaps = true;
  weave.anisotropy = Math.min(anisotropy, 4);
  weave.needsUpdate = true;
  return weave;
}
