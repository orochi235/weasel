import { luminanceContrast, parseColor, relativeLuminance } from '@weasel-js/paint';

/** Red, green and blue in 0–255, and alpha in 0–1. */
export type Rgba = [number, number, number, number];

/** A computed color as Chromium serializes it — `color(srgb r g b / a)` for a relative color, `rgb[a](r, g, b[, a])` for a plain one — or any other form paint reads. */
export function parseComputedColor(css: string): Rgba {
  const [r, g, b, a] = parseColor(css);
  return [r * 255, g * 255, b * 255, a];
}

const luminance = ([r, g, b]: Rgba): number => relativeLuminance(r / 255, g / 255, b / 255);

/** WCAG contrast of `fg`, at its own alpha, over an opaque `bg`. */
export function contrastOver(fg: Rgba, bg: Rgba): number {
  const a = fg[3];
  const shown: Rgba = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  return luminanceContrast(luminance(shown), luminance(bg));
}
