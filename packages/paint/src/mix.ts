import { interpolateSrgbSplit, type ColorInterpolationSpace } from './colorSpaces';
import type { HueInterpolation } from './hue';

type Rgba = readonly [number, number, number, number];

/**
 * `color-mix(in <space>, a p%, b)` for two 0..1 sRGBA colors, `p` as 0..1. The
 * channels mix premultiplied by alpha, as CSS does, so a transparent side lends
 * the result its opacity and none of its color; a polar space's hue is not
 * premultiplied, as in CSS. Out-of-gamut results come back chroma-clipped.
 */
export function mixRgba(
  a: Rgba,
  b: Rgba,
  p: number,
  space: ColorInterpolationSpace = 'oklch',
  hue: HueInterpolation = 'shorter',
): [number, number, number, number] {
  const alpha = a[3] * p + b[3] * (1 - p);
  if (alpha === 0) return [0, 0, 0, 0];
  // Premultiplying each side and dividing by the mixed alpha is a plain lerp at this parameter.
  const t = (b[3] * (1 - p)) / alpha;
  const [r, g, bl] = interpolateSrgbSplit([a[0], a[1], a[2]], [b[0], b[1], b[2]], t, 1 - p, space, hue);
  return [r, g, bl, alpha];
}

/** {@link mixRgba} in OKLab. */
export function mixOklab(a: Rgba, b: Rgba, p: number): [number, number, number, number] {
  return mixRgba(a, b, p, 'oklab');
}

/**
 * The weighted mix of any number of 0..1 sRGBA colors, premultiplied as
 * {@link mixRgba} mixes two. Weights need not sum to 1; a color weighing
 * nothing contributes nothing. Throws on an empty list.
 */
export function mixRgbaWeighted(
  members: readonly { readonly color: Rgba; readonly weight: number }[],
  space: ColorInterpolationSpace = 'oklch',
  hue: HueInterpolation = 'shorter',
): [number, number, number, number] {
  if (members.length === 0) throw new Error('mixRgbaWeighted: no colors');
  let mixed: [number, number, number, number] = [...members[0]!.color];
  let total = members[0]!.weight;
  for (const { color, weight } of members.slice(1)) {
    total += weight;
    if (total > 0) mixed = mixRgba(color, mixed, weight / total, space, hue);
  }
  return mixed;
}
