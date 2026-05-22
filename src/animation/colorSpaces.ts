// sRGB ↔ OKLab conversion. Reference: https://bottosson.github.io/posts/oklab/

const SRGB_TO_LINEAR: Float64Array = (() => {
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

function linearToSrgbByte(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 255;
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

export function srgbU8ToOklab(r: number, g: number, b: number): [number, number, number] {
  const rl = SRGB_TO_LINEAR[r & 0xff];
  const gl = SRGB_TO_LINEAR[g & 0xff];
  const bl = SRGB_TO_LINEAR[b & 0xff];
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const lp = Math.cbrt(l);
  const mp = Math.cbrt(m);
  const sp = Math.cbrt(s);
  return [
    0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp,
    1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp,
    0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp,
  ];
}

function oklabToLinearSrgb(L: number, A: number, B: number): [number, number, number] {
  const lp = L + 0.3963377774 * A + 0.2158037573 * B;
  const mp = L - 0.1055613458 * A - 0.0638541728 * B;
  const sp = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = lp * lp * lp;
  const m = mp * mp * mp;
  const s = sp * sp * sp;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function inGamut(rl: number, gl: number, bl: number): boolean {
  // Small epsilon absorbs float-roundtrip noise on pure-primary colors.
  const eps = 1e-6;
  return (
    rl >= -eps && rl <= 1 + eps &&
    gl >= -eps && gl <= 1 + eps &&
    bl >= -eps && bl <= 1 + eps
  );
}

function clipToGamut(L: number, A: number, B: number): [number, number, number] {
  let [rl, gl, bl] = oklabToLinearSrgb(L, A, B);
  if (inGamut(rl, gl, bl)) return [rl, gl, bl];
  let lo = 0;
  let hi = 1;
  // 5 iterations → ~3% chroma precision; sufficient for u8 output.
  for (let i = 0; i < 5; i++) {
    const t = (lo + hi) / 2;
    [rl, gl, bl] = oklabToLinearSrgb(L, A * t, B * t);
    if (inGamut(rl, gl, bl)) lo = t; else hi = t;
  }
  [rl, gl, bl] = oklabToLinearSrgb(L, A * lo, B * lo);
  return [rl, gl, bl];
}

export function oklabToSrgbU8(L: number, A: number, B: number): [number, number, number] {
  const [rl, gl, bl] = clipToGamut(L, A, B);
  return [linearToSrgbByte(rl), linearToSrgbByte(gl), linearToSrgbByte(bl)];
}

export function lerpOklab(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

/** Convert OKLab (L, a, b) to OKLCh (L, C, h). h is in radians, range [-π, π]. */
export function oklabToOklch(L: number, A: number, B: number): [number, number, number] {
  const C = Math.hypot(A, B);
  const h = Math.atan2(B, A);
  return [L, C, h];
}

/** Convert OKLCh (L, C, h) to OKLab (L, a, b). h is in radians. */
export function oklchToOklab(L: number, C: number, h: number): [number, number, number] {
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

/** Lerp OKLCh values with shortest-arc hue interpolation. Lightness and
 *  chroma lerp linearly. When chroma is near zero on either endpoint, hue
 *  is taken from the other endpoint (avoids hue snap-from-undefined).
 *  h inputs are in radians. */
export function lerpOklch(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const [L1, C1, h1Raw] = from;
  const [L2, C2, h2Raw] = to;
  const C_EPS = 1e-4;
  // When one endpoint is near-achromatic, take hue from the other endpoint
  // to avoid spurious arc rotation through undefined hue space.
  const h1 = C1 < C_EPS ? h2Raw : h1Raw;
  const h2 = C2 < C_EPS ? h1Raw : h2Raw;
  const TWO_PI = Math.PI * 2;
  // Shortest-arc delta in [-π, π].
  let dh = h2 - h1;
  while (dh > Math.PI) dh -= TWO_PI;
  while (dh < -Math.PI) dh += TWO_PI;
  return [
    L1 + (L2 - L1) * t,
    C1 + (C2 - C1) * t,
    h1 + dh * t,
  ];
}

export type ColorSpace = 'rgb' | 'oklab' | 'oklch';

/** Lerp a flat RGBA byte array `from` toward `to`. Alpha is always linearly
 *  lerped; RGB channels are lerped in the requested color space. */
export function lerpColorArray(
  from: readonly number[],
  to: readonly number[],
  t: number,
  space: ColorSpace = 'rgb',
): number[] {
  if (from.length !== to.length) {
    throw new Error(`lerpColorArray: length mismatch (from=${from.length}, to=${to.length})`);
  }
  if (from.length % 4 !== 0) {
    throw new Error(`lerpColorArray: length ${from.length} not divisible by 4`);
  }
  const out = new Array<number>(from.length);
  const n = from.length / 4;
  if (space === 'rgb') {
    for (let i = 0; i < from.length; i++) {
      out[i] = Math.round(from[i] + (to[i] - from[i]) * t);
    }
    return out;
  }
  if (space === 'oklch') {
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      const fLab = srgbU8ToOklab(from[k], from[k + 1], from[k + 2]);
      const tLab = srgbU8ToOklab(to[k], to[k + 1], to[k + 2]);
      const fLch = oklabToOklch(fLab[0], fLab[1], fLab[2]);
      const tLch = oklabToOklch(tLab[0], tLab[1], tLab[2]);
      const midLch = lerpOklch(fLch, tLch, t);
      const midLab = oklchToOklab(midLch[0], midLch[1], midLch[2]);
      const [r, g, b] = oklabToSrgbU8(midLab[0], midLab[1], midLab[2]);
      out[k] = r;
      out[k + 1] = g;
      out[k + 2] = b;
      out[k + 3] = Math.round(from[k + 3] + (to[k + 3] - from[k + 3]) * t);
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const fLab = srgbU8ToOklab(from[k], from[k + 1], from[k + 2]);
    const tLab = srgbU8ToOklab(to[k], to[k + 1], to[k + 2]);
    const mid = lerpOklab(fLab, tLab, t);
    const [r, g, b] = oklabToSrgbU8(mid[0], mid[1], mid[2]);
    out[k] = r;
    out[k + 1] = g;
    out[k + 2] = b;
    out[k + 3] = Math.round(from[k + 3] + (to[k + 3] - from[k + 3]) * t);
  }
  return out;
}
