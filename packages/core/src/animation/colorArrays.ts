import { hslToSrgb } from '@weasel-js/paint';

// Per-anchor RGBA arrays in the 0..1 range the renderer expects: bytes (0..255) clamp every
// channel to 1.0 on the GPU and render white.

/** Build an n-anchor rainbow RGBA array sweeping the hue wheel. The
 *  output is suitable to pass directly into `stroke.vertexColors`,
 *  `tweenVertexColors({ from: rainbowVertexColors(n) })`, or any
 *  other API that wants per-anchor color floats. */
export function rainbowVertexColors(
  n: number,
  opts: { saturation?: number; lightness?: number; alpha?: number } = {},
): number[] {
  const saturation = opts.saturation ?? 0.8;
  const lightness = opts.lightness ?? 0.6;
  const alpha = opts.alpha ?? 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 360) / Math.max(1, n);
    const [r, g, b] = hslToSrgb(h, saturation, lightness);
    out.push(r, g, b, alpha);
  }
  return out;
}

/** Build an n-anchor solid RGBA array. Shorthand for
 *  `[r, g, b, a, r, g, b, a, …]` — the array a `tweenVertexColors`
 *  `to`-target typically needs. */
export function solidVertexColors(
  n: number,
  r: number,
  g: number,
  b: number,
  a = 1,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return out;
}
