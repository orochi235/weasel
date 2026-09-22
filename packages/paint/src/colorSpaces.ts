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

/** 0..1 float channel to the 8-bit index the LUTs are cut for. Rounds and
 *  clamps; `& 0xff` would truncate, and wrap anything out of range. */
const f2u = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));

/**
 * Convert a 0..1 float sRGB triple to OKLab — the renderer's own color space,
 * and what a caller holding a `resolveColor` result has. Rounds into the u8
 * grid the way every other float→u8 crossing in this file does, rather than
 * leaving each caller to pick a convention.
 */
export function srgbFloatToOklab(r: number, g: number, b: number): [number, number, number] {
  return srgbU8ToOklab(f2u(r), f2u(g), f2u(b));
}

/** Convert an 8-bit sRGB triple to OKLab. Channels are indices into a 256-entry
 *  LUT: pass integers, or `srgbFloatToOklab` for 0..1 floats. */
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

/** Convert OKLab back to an 8-bit sRGB triple, clamped into gamut. */
export function oklabToSrgbU8(L: number, A: number, B: number): [number, number, number] {
  const [rl, gl, bl] = clipToGamut(L, A, B);
  return [linearToSrgbByte(rl), linearToSrgbByte(gl), linearToSrgbByte(bl)];
}

/** Blend two 8-bit sRGB colors through OKLab. Perceptually even, and it does
 *  not pass through the muddy midpoints an sRGB blend produces between
 *  complementary hues. */
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

/**
 * `color-mix(in oklab, a p%, b)` for two 0..1 sRGBA colors, `p` as 0..1: the
 * channels mix premultiplied by alpha, as CSS does, so a transparent side
 * lends the result its opacity and none of its color.
 */
export function mixOklab(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
  p: number,
): [number, number, number, number] {
  const alpha = a[3] * p + b[3] * (1 - p);
  if (alpha === 0) return [0, 0, 0, 0];
  const la = srgbFloatToOklab(a[0], a[1], a[2]);
  const lb = srgbFloatToOklab(b[0], b[1], b[2]);
  const mix = (i: number) => (la[i] * a[3] * p + lb[i] * b[3] * (1 - p)) / alpha;
  const [r, g, bl] = oklabToSrgbU8(mix(0), mix(1), mix(2));
  return [r / 255, g / 255, bl / 255, alpha];
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

/** Which space a color blend is computed in. `'rgb'` is cheapest; `'oklab'`
 *  is perceptually even; `'oklch'` additionally travels around the hue wheel
 *  rather than through it. */
export type ColorSpace = 'rgb' | 'oklab' | 'oklch';

const u2f = (v: number): number => v / 255;

/** Lerp a flat RGBA color array `from` toward `to`. Inputs are 0..1
 *  floats (the renderer's color space); outputs are 0..1 floats too.
 *  Alpha is always linearly lerped; RGB channels are lerped in the
 *  requested color space. OKLab / OKLCh paths bounce through u8 because
 *  the gamma-correction LUT and gamut-clip routines are byte-keyed —
 *  the round-trip is lossy at <1% per channel, well under the visible
 *  threshold for these animations. */
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
    // Pure float lerp — no rounding (which previously discretized 0..1
    // inputs to 0/1, giving the cycle its 'choppy 8-corner' look).
    for (let i = 0; i < from.length; i++) {
      out[i] = from[i] + (to[i] - from[i]) * t;
    }
    return out;
  }
  if (space === 'oklch') {
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      const fLab = srgbU8ToOklab(f2u(from[k]), f2u(from[k + 1]), f2u(from[k + 2]));
      const tLab = srgbU8ToOklab(f2u(to[k]), f2u(to[k + 1]), f2u(to[k + 2]));
      const fLch = oklabToOklch(fLab[0], fLab[1], fLab[2]);
      const tLch = oklabToOklch(tLab[0], tLab[1], tLab[2]);
      const midLch = lerpOklch(fLch, tLch, t);
      const midLab = oklchToOklab(midLch[0], midLch[1], midLch[2]);
      const [r, g, b] = oklabToSrgbU8(midLab[0], midLab[1], midLab[2]);
      out[k] = u2f(r);
      out[k + 1] = u2f(g);
      out[k + 2] = u2f(b);
      out[k + 3] = from[k + 3] + (to[k + 3] - from[k + 3]) * t;
    }
    return out;
  }
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const fLab = srgbU8ToOklab(f2u(from[k]), f2u(from[k + 1]), f2u(from[k + 2]));
    const tLab = srgbU8ToOklab(f2u(to[k]), f2u(to[k + 1]), f2u(to[k + 2]));
    const mid = lerpOklab(fLab, tLab, t);
    const [r, g, b] = oklabToSrgbU8(mid[0], mid[1], mid[2]);
    out[k] = u2f(r);
    out[k + 1] = u2f(g);
    out[k + 2] = u2f(b);
    out[k + 3] = from[k + 3] + (to[k + 3] - from[k + 3]) * t;
  }
  return out;
}

// ---------------------------------------------------------------------------
// OKLCh in degrees
// ---------------------------------------------------------------------------

/**
 * OKLCh with the hue in **degrees**, and `#rrggbb` on the other side.
 *
 * The helpers above take radians, because that is what the math wants. Every
 * consumer that authors colors — a theme ramp, a palette generator — wants
 * degrees and a hex string, and two packages independently built the same
 * wrapper before this existed.
 */
export interface OklchDeg {
  readonly L: number;
  readonly C: number;
  /** 0..360. */
  readonly H: number;
}

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/**
 * OKLCh (hue in degrees) to `#rrggbb`. Over-saturated requests come back at
 * the gamut boundary: `oklabToSrgbU8` clips chroma at constant lightness, which
 * is what lets a caller find a hue's ceiling by asking for far more than exists.
 */
export function oklchDegToHex(L: number, C: number, hueDeg: number): string {
  const [l, a, b] = oklchToOklab(L, C, (hueDeg * Math.PI) / 180);
  const [r, g, bl] = oklabToSrgbU8(l, a, b);
  return `#${hex2(r)}${hex2(g)}${hex2(bl)}`;
}

/** `#rrggbb` to OKLCh with the hue wrapped into 0..360. */
export function hexToOklchDeg(hex: string): OklchDeg {
  const n = Number.parseInt(hex.slice(1), 16);
  const [L, A, B] = srgbU8ToOklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
  const [l, c, h] = oklabToOklch(L, A, B);
  return { L: l, C: c, H: ((((h * 180) / Math.PI) % 360) + 360) % 360 };
}
