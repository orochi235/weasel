// HSL, the polar form of gamma-encoded sRGB that CSS `hsl()` writes.

import { wrapDeg } from './hue';

/** HSL to sRGB. Hue in degrees, any number of turns; saturation, lightness and output all 0..1. */
export function hslToSrgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const turn = h / 360;
  const hk = turn >= 0 && turn < 1 ? turn : turn - Math.floor(turn);
  return [hueToChannel(p, q, hk + 1 / 3), hueToChannel(p, q, hk), hueToChannel(p, q, hk - 1 / 3)];
}

function hueToChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** sRGB (0..1) to HSL: `[hue°, saturation, lightness]`, hue in 0..360. An
 *  achromatic color reports hue 0 and saturation 0. */
export function srgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  // Near white or black the denominator cancels to 0, or below d, while d does not.
  const s = Math.min(1, d / (1 - Math.abs(2 * l - 1)));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [wrapDeg(h * 60), s, l];
}
