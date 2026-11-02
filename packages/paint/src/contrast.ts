import { parseColor } from './color';
import { oklabToSrgbU8, srgbToLinear, srgbU8ToOklab } from './colorSpaces';
import { parseHexBytes } from './hex';

const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/**
 * A line color that reads against `background` — a grid, a rule, a guide
 * drawn over a surface whose color the document chooses, where theme tokens
 * would be keyed to the chrome instead.
 *
 * The line is the background moved `strength` in OKLab lightness (0..1) away
 * from its nearer end: darker over light, lighter over dark, with its hue and
 * chroma kept. Returns `#rrggbb`; the background's alpha is ignored. A color
 * that is not hex comes back as black at `strength` alpha.
 */
export function contrastLineColor(background: string, strength: number): string {
  const rgb = parseHexBytes(background.trim());
  if (!rgb) return `rgba(0, 0, 0, ${strength})`;
  const [L, A, B] = srgbU8ToOklab(rgb[0], rgb[1], rgb[2]);
  const next = L > 0.5 ? Math.max(0, L - strength) : Math.min(1, L + strength);
  const [r, g, b] = oklabToSrgbU8(next, A, B);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** WCAG 2.x relative luminance of an sRGB color, channels 0..1: 0 for black, 1 for white. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** The WCAG 2.x contrast ratio of two {@link relativeLuminance}s, in either order: 1 up to 21. */
export function luminanceContrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The WCAG 2.x contrast ratio of `foreground` text on `background`: 1 for two
 * equal colors up to 21 for black on white, whichever is the lighter. A
 * translucent foreground is laid over the background first; the background's
 * own alpha is ignored. `null` for a color {@link parseColor} cannot read.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  let fg: [number, number, number, number];
  let bg: [number, number, number, number];
  try {
    fg = parseColor(foreground);
    bg = parseColor(background);
  } catch {
    return null;
  }
  const a = fg[3];
  const lf = relativeLuminance(a * fg[0] + (1 - a) * bg[0], a * fg[1] + (1 - a) * bg[1], a * fg[2] + (1 - a) * bg[2]);
  return luminanceContrast(lf, relativeLuminance(bg[0], bg[1], bg[2]));
}

/** Whether `ratio` passes WCAG AA and AAA: 4.5 and 7, or 3 and 4.5 for large text. */
export function wcagLevels(ratio: number, largeText: boolean): { aa: boolean; aaa: boolean } {
  return { aa: ratio >= (largeText ? 3 : 4.5), aaa: ratio >= (largeText ? 4.5 : 7) };
}
