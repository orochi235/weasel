import { oklabToOklch, oklabToSrgbU8, oklchToOklab, srgbU8ToOklab } from '@weasel-js/core';

/** A color in OKLCH: lightness 0–1, chroma, hue in degrees. */
export interface Lch {
  readonly L: number;
  readonly C: number;
  readonly H: number;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * OKLCH → `#rrggbb`. Over-saturated requests come back at the gamut boundary:
 * core's `oklabToSrgbU8` clips chroma at constant lightness, which is what lets
 * `chromaCap` below find a hue's ceiling by asking for far more than exists.
 */
export function toHex(L: number, C: number, H: number): string {
  const [l, a, b] = oklchToOklab(L, C, (H * Math.PI) / 180);
  const [r, g, bl] = oklabToSrgbU8(l, a, b);
  return `#${[r, g, bl].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

export function toLch(hex: string): Lch {
  const [r, g, b] = hexToRgb(hex);
  const [L, A, B] = srgbU8ToOklab(r, g, b);
  const [l, c, h] = oklabToOklch(L, A, B);
  return { L: l, C: c, H: (((h * 180) / Math.PI) % 360 + 360) % 360 };
}

/** The most chroma this hue can carry at this lightness, inside sRGB. */
export function chromaCap(L: number, H: number): number {
  return toLch(toHex(L, 0.5, H)).C;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const f = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Shortest angular distance between two hues, in degrees. */
export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** OKLab coordinates, for distance work. */
export function toLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return srgbU8ToOklab(r, g, b);
}

/**
 * How far apart two colors look, with chroma weighted up.
 *
 * Two things this is not. It is not WCAG contrast, which reads lightness only
 * and so scores a vivid yellow on white at 1.2:1 and calls it illegible when
 * what separates them is chroma. And it is not plain euclidean OKLab distance:
 * OKLab's chroma range is small beside its lightness range, so an unweighted
 * distance is almost all lightness, and it ranks a mid-gray as further from
 * white than a pale blue is. Measured against CIELAB dE on the same colors,
 * unweighted OKLab put `#c1c1c1` at 0.160 and `#abd9ff` at 0.126 while CIELAB
 * put them at 21.9 and 28.5 — opposite orders.
 *
 * `CHROMA_WEIGHT` restores CIELAB's ordering. It is a weight, not a unit
 * conversion, so these numbers do not transfer to or from CIELAB dE.
 *
 * Rough calibration in the weighted space: 0.17 is a pale wash against paper,
 * 0.25 is a real color, 0.5 is unmistakable.
 */
export const CHROMA_WEIGHT = 3;

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, CHROMA_WEIGHT * (a1 - a2), CHROMA_WEIGHT * (b1 - b2));
}

/** The most chroma this hue can carry at this lightness, as a hex. */
export function vividAt(L: number, H: number): string {
  return toHex(L, chromaCap(L, H), H);
}
