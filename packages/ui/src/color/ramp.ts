import {
  hexToOklchDeg,
  hexToRgba,
  interpolateSrgb,
  rgbaToHex,
  type ColorInterpolationSpace,
  type HueInterpolation,
} from '@weasel-js/core';
import { chromaAt, oklchToHex, type ChromaCurve } from './oklch';

/**
 * How {@link rampColor} and {@link colorRamp} travel between two endpoints.
 *
 * What each space interpolates:
 *
 * | `space`         | components lerped            | hue                  |
 * | --------------- | ---------------------------- | -------------------- |
 * | `'oklch'`       | L, C, H                      | around the wheel     |
 * | `'hsl'`         | H, S, L                      | around the wheel     |
 * | `'oklab'`       | L, a, b                      | through the wheel    |
 * | `'srgb'`        | gamma-encoded R, G, B        | through the wheel    |
 * | `'srgb-linear'` | linear-light R, G, B         | through the wheel    |
 *
 * A lightness ramp is two endpoints that differ in lightness, and a hue ramp
 * two that differ in hue: the polar spaces keep chroma or saturation fixed
 * while they move, and the others cut a straight line between the two colors,
 * which for a hue ramp passes through gray.
 *
 * `chroma` is an OKLCH envelope in every space, since {@link ChromaCurve}'s
 * numbers are OKLCH chroma over OKLCH lightness. It runs after the
 * interpolation: each sample keeps its lightness and hue, and its chroma is
 * replaced with the curve's value at that lightness. A sample left with no
 * hue (a gray midpoint) takes the hue an OKLCH ramp would have had there.
 */
export interface ColorRampOptions {
  /** Default `'oklch'`. */
  space?: ColorInterpolationSpace;
  /** Polar spaces only. Default `'shorter'`. */
  hue?: HueInterpolation;
  chroma?: ChromaCurve;
}

const rgb = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgba(hex);
  return [r, g, b];
};

/** One sample of a ramp from `from` to `to` (`#rrggbb`), `t` in 0..1. */
export function rampColor(from: string, to: string, t: number, options: ColorRampOptions = {}): string {
  const { space = 'oklch', hue = 'shorter', chroma } = options;
  const a = rgb(from);
  const b = rgb(to);
  const hex = rgbaToHex(interpolateSrgb(a, b, t, space, hue));
  if (!chroma) return hex;
  const s = hexToOklchDeg(hex);
  const H = s.C > 1e-4 ? s.H : hexToOklchDeg(rgbaToHex(interpolateSrgb(a, b, t, 'oklch', hue))).H;
  return oklchToHex(s.L, chromaAt(s.L, chroma), H);
}

/** `steps` evenly spaced samples from `from` to `to`, both ends included. */
export function colorRamp(from: string, to: string, steps: number, options: ColorRampOptions = {}): string[] {
  if (steps <= 1) return steps === 1 ? [rampColor(from, to, 0, options)] : [];
  return Array.from({ length: steps }, (_, i) => rampColor(from, to, i / (steps - 1), options));
}
