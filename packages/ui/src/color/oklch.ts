// OKLCH math from Björn Ottosson: https://bottosson.github.io/posts/oklab/
import { oklchDegToHex } from '@weasel-js/core';

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
export const oklchToHex = oklchDegToHex;

/** Evaluates a {@link ChromaCurve} at a lightness, clamping outside its range. */
export function chromaAt(L: number, curve: ChromaCurve): number {
  const [lo, hi] = curve.lRange;
  if (L <= lo) return curve.cBot;
  if (L >= hi) return curve.cTop;
  if (L <= curve.midL) return curve.cBot + (curve.cPeak - curve.cBot) * ((L - lo) / (curve.midL - lo));
  return curve.cPeak + (curve.cTop - curve.cPeak) * ((L - curve.midL) / (hi - curve.midL));
}
