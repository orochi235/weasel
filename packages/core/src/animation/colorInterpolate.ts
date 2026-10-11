import { lerpColorArray, type ColorSpace } from '@weasel-js/paint';

/**
 * Color interpolator: receives two flat RGBA float arrays (values in
 * 0..1, the renderer's color space — same shape as
 * `stroke.vertexColors`) and a normalized progress `t` in 0..1.
 * Returns the same-length blended array, also in 0..1 floats. Override
 * the default per-channel lerp via `TweenVertexColorsOptions.interpolate`
 * when a custom color-space or shaping is needed.
 */
export type ColorInterpolate = (
  from: readonly number[],
  to: readonly number[],
  t: number,
) => number[];

/** The interpolator the options ask for: `interpolate` itself, else a lerp in `interpolation`'s space. */
export function resolveInterpolator(
  opts: { interpolation?: ColorSpace; interpolate?: ColorInterpolate },
): ColorInterpolate {
  if (opts.interpolate) return opts.interpolate;
  const space: ColorSpace = opts.interpolation ?? 'rgb';
  return (a, b, t) => lerpColorArray(a, b, t, space);
}
