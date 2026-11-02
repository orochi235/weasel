import { parseColor } from '@weasel-js/paint';

/**
 * A resolved color at `alpha`, multiplied into any alpha it already carries. The
 * JS side of the alpha extension; the CSS side emits `color-mix()` instead so DOM
 * chrome keeps tracking a downstream override of the referenced token.
 *
 * Hex and `rgb()`/`rgba()` become an `rgba()` literal. Anything else — a named
 * color, `hsl()`, `oklch()`, a `var()` — becomes the same `color-mix()` the CSS
 * side writes, which the browser resolves.
 */
export function withAlpha(color: string, alpha: number): string {
  const rgba = parseRgba(color.trim());
  if (!rgba) return mixAlpha(color.trim(), alpha);
  const [r, g, b, a] = rgba;
  return `rgba(${r}, ${g}, ${b}, ${round(a * alpha, 3)})`;
}

/** `color` at `alpha` as a `color-mix()` with transparent, for a color only the browser can resolve. */
export function mixAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${round(alpha * 100, 4)}%, transparent)`;
}

/** A resolved color with its alpha replaced by `alpha`, as `rgb(from c r g b / alpha)` computes it. */
export function atAlpha(color: string, alpha: number): string {
  const rgba = parseRgba(color.trim());
  if (!rgba) return `rgb(from ${color.trim()} r g b / ${alpha})`;
  const [r, g, b] = rgba;
  return `rgba(${r}, ${g}, ${b}, ${round(alpha, 3)})`;
}

type Rgba = [number, number, number, number];

function round(n: number, places: number): number {
  return Number(n.toFixed(places));
}

/** Hex, `rgb()`/`rgba()` and `transparent` as 0–255 channels and 0–1 alpha; null for any other form, which goes to the browser. */
function parseRgba(s: string): Rgba | null {
  if (!/^(?:#|rgba?\(|transparent$)/i.test(s)) return null;
  let c: readonly [number, number, number, number];
  try {
    c = parseColor(s);
  } catch {
    return null;
  }
  return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), c[3]];
}
