import { oklabToSrgbU8, srgbU8ToOklab } from './colorSpaces';
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
