import { hexToOklchDeg, oklchDegToHex, srgbU8ToOklab, type OklchDeg } from '@weasel-js/paint';

/** A color in OKLCH: lightness 0–1, chroma, hue in degrees. paint's own type,
 *  under the name this engine has always called it. */
export type Lch = OklchDeg;

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = oklchDegToHex;
export const toLch: (hex: string) => Lch = hexToOklchDeg;

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
