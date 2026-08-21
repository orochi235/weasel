// OKLCH math from Björn Ottosson: https://bottosson.github.io/posts/oklab/
import { oklchToOklab, oklabToSrgbU8, rgbaToHex } from '@weasel-js/core';

/**
 * A chroma envelope over lightness, as three linear segments: flat at `cBot`
 * below `lRange[0]`, rising to `cPeak` at `midL`, falling to `cTop` at
 * `lRange[1]`, flat beyond. Keeps a color ramp inside gamut at the light and
 * dark ends while staying saturated through the middle.
 */
export type ChromaCurve = {
  lRange: [number, number];
  midL: number;
  cBot: number;
  cPeak: number;
  cTop: number;
};

/** A single lightness/chroma sample. */
export type ChromaCurvePoint = { L: number; C: number };

/**
 * Converts an OKLCH color to a gamut-clipped `#rrggbb` string. Hue is in
 * degrees, unlike the kit's OKLab helpers which take radians.
 */
export function oklchToHex(L: number, C: number, Hdeg: number): string {
  // Delegate to the kit's OKLab pipeline (kit angle unit is radians) →
  // gamut-clipped u8 sRGB → `#rrggbb`.
  const [l, a, b] = oklchToOklab(L, C, (Hdeg * Math.PI) / 180);
  const [r, g, bl] = oklabToSrgbU8(l, a, b);
  return rgbaToHex([r / 255, g / 255, bl / 255]);
}

/** Evaluates a {@link ChromaCurve} at a lightness, clamping outside its range. */
export function chromaAt(L: number, curve: ChromaCurve): number {
  const [lo, hi] = curve.lRange;
  if (L <= lo) return curve.cBot;
  if (L >= hi) return curve.cTop;
  if (L <= curve.midL) return curve.cBot + (curve.cPeak - curve.cBot) * ((L - lo) / (curve.midL - lo));
  return curve.cPeak + (curve.cTop - curve.cPeak) * ((L - curve.midL) / (hi - curve.midL));
}
