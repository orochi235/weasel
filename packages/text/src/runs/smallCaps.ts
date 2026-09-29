/**
 * Synthetic small caps: lowercase drawn as capitals at a smaller size, the
 * way a browser synthesizes `font-variant: small-caps` for a face with no
 * `smcp` feature. It is the one run style that sizes characters within a run
 * differently, so it reports a per-unit size map beside the text.
 *
 * It reads the text *after* `textTransform`, as CSS does: `uppercase` leaves
 * nothing to shrink, and `lowercase` shrinks everything.
 */

import { faceMetricsOf, resolveFontVariant, type FaceMetrics, type FontStyle } from '@weasel-js/font';
import type { RunSourceMap } from './textTransform';

/** The CSS `font-variant-caps` keywords the run model carries. `normal` is an
 *  explicit override: a run can turn off small caps it would inherit. */
export type FontVariantCaps = 'normal' | 'small-caps';

/**
 * The small-caps size, as a fraction of the run's, for a face that states no
 * x-height and cap height. 0.7 is the factor Chromium and WebKit synthesize
 * with.
 */
export const SMALL_CAPS_SCALE = 0.7;

/** The small-caps size for a face: its x-height over its cap height, so a
 *  small capital stands as tall as its lowercase letters do, or
 *  {@link SMALL_CAPS_SCALE} where the face lacks either. */
export function smallCapsScale(face?: FaceMetrics): number {
  const x = face?.xHeight;
  const cap = face?.capHeight;
  if (x === undefined || cap === undefined || x >= cap) return SMALL_CAPS_SCALE;
  return x / cap;
}

/** The small-caps scale a run set in `(family, weight, style)` gets —
 *  resolved through the font registry exactly as layout resolves the run. */
export function smallCapsScaleFor(family: string, weight: number, style: FontStyle): number {
  return smallCapsScale(faceMetricsOf(resolveFontVariant(family, weight, style)));
}

/** Whether small caps draws `ch` as a smaller capital: whether it has a
 *  capital other than itself. */
export function isSmallCapsLetter(ch: string): boolean {
  return ch.toUpperCase() !== ch;
}

/** A run's drawn text under small caps. `small[i]` says whether UTF-16 unit
 *  `i` of `text` draws at the small size; absent when none does. */
export interface SmallCapsText {
  text: string;
  srcMap?: RunSourceMap;
  small?: readonly boolean[];
}

/**
 * Apply small caps to a run's drawn text. `srcMap` is the map `textTransform`
 * already produced for it, if any; the result's map composes the two, so
 * each drawn unit still names the source character it came from.
 */
export function smallCapsText(text: string, srcMap?: RunSourceMap): SmallCapsText {
  let out = '';
  const small: boolean[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let resized = false;
  let anySmall = false;
  let at = 0;
  for (const ch of text) {
    const shrink = isSmallCapsLetter(ch);
    const piece = shrink ? ch.toUpperCase() : ch;
    if (piece.length !== ch.length) resized = true;
    anySmall ||= shrink;
    const start = srcMap ? srcMap.starts[at] : at;
    const end = srcMap ? srcMap.ends[at] : at + ch.length;
    for (let k = 0; k < piece.length; k++) {
      small.push(shrink);
      starts.push(start);
      ends.push(end);
    }
    out += piece;
    at += ch.length;
  }
  if (!anySmall) return srcMap ? { text, srcMap } : { text };
  const map = resized
    ? { length: srcMap?.length ?? text.length, starts, ends }
    : srcMap;
  return { text: out, ...(map ? { srcMap: map } : {}), small };
}
