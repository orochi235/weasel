/**
 * The font size `em` and `ex` are of. The cascade computes it once per element
 * ({@link computeFontRelative}, called from `deriveStyle`), and every length
 * reader converts with {@link emsPer} against {@link fontSizeOf}.
 */

import { ABSOLUTE_PX } from './absoluteUnits';

/** CSS's `medium`, the size in effect where nothing sets one. */
export const DEFAULT_FONT_SIZE = 16;

// No font metrics are at hand here, so `ex` takes CSS's fallback of half an em.
const EMS: Readonly<Record<string, number>> = Object.assign(Object.create(null), { em: 1, ex: 0.5 });

/** How many ems one of `unit` is; `undefined` for a unit that is not font-relative. */
export function emsPer(unit: string): number | undefined {
  return EMS[unit.toLowerCase()];
}

const NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?';
const DIMENSION = new RegExp(`^\\s*(${NUMBER})\\s*([a-z%]*)\\s*$`, 'i');
const FONT_RELATIVE = new RegExp(`(?<![\\w.])(${NUMBER})(em|ex)(?![\\w%])`, 'gi');

/** Property names whose values are lengths, and so may be written in `em` or `ex`. */
const LENGTH_PROPERTIES = ['stroke-width', 'stroke-dasharray', 'letter-spacing'] as const;

type FontRelativeStyle = { [K in 'font-size' | (typeof LENGTH_PROPERTIES)[number]]?: string };

/** A `font-size` value in user units, a relative one taken against
 *  `parentSize`; `undefined` for a keyword or a unit that is not converted. */
function computedFontSize(raw: string, parentSize: number): number | undefined {
  const m = DIMENSION.exec(raw);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === '') return n;
  if (unit === '%') return (n / 100) * parentSize;
  const ems = emsPer(unit);
  if (ems != null) return n * ems * parentSize;
  const scale = ABSOLUTE_PX[unit];
  return scale == null ? undefined : n * scale;
}

/** The font size in effect at `style`, in user units. */
export function fontSizeOf(style: { readonly 'font-size'?: string }): number {
  const raw = style['font-size'];
  if (raw == null) return DEFAULT_FONT_SIZE;
  const size = computedFontSize(raw, DEFAULT_FONT_SIZE);
  if (size != null) return size;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : DEFAULT_FONT_SIZE;
}

/**
 * Rewrite, in place, the font-relative values an element just set as the user
 * units they compute to: its `font-size` against `parentSize`, then its lengths
 * against that size. A child then inherits the computed length, as CSS has it,
 * and not a multiple of its own font size.
 */
export function computeFontRelative(style: FontRelativeStyle, parentSize: number): void {
  const raw = style['font-size'];
  if (raw != null && /(?:%|em|ex)\s*$/i.test(raw)) {
    const size = computedFontSize(raw, parentSize);
    if (size != null) style['font-size'] = String(size);
  }
  const size = fontSizeOf(style);
  for (const prop of LENGTH_PROPERTIES) {
    const value = style[prop];
    if (value == null) continue;
    style[prop] = value.replace(FONT_RELATIVE, (_, n: string, unit: string) => String(Number(n) * EMS[unit.toLowerCase()] * size));
  }
}
