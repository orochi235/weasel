/**
 * SVG color / paint parsing. Handles the SVG-specific paint surface — the
 * sentinel `none`, `url(#id)` paint-server references, and `currentColor` —
 * then delegates the actual color tokenization (hex, `rgb()`/`rgba()`,
 * `hsl()`, and the full CSS named-color table) to the kit's `parseColor`.
 * Output is normalized to `#rrggbb` plus a separate 0..1 alpha so the rest
 * of the pipeline doesn't have to know about the encoding variants.
 */

import { parseColor, rgbaToHex } from '@weasel-js/core';

/** Result of parsing a `fill=` / `stroke=` attribute value. */
export type ParsedColor =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; alpha: number }
  | { kind: 'ref'; id: string };

/**
 * Parse an SVG paint string. Returns `null` for inputs we don't recognize
 * (so the caller can emit a warning and fall back). `currentColor` resolves
 * to black here as a last-resort default; callers that participate in the
 * cascade (`readPaint`, `readTextStyle`, `readTspanRun`) pre-resolve
 * `currentColor` against the inherited `color` via `resolveCurrentColor`
 * before this function ever sees it.
 */
export function parsePaintAttr(raw: string | null | undefined): ParsedColor | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'none') return { kind: 'none' };
  if (s === 'currentColor' || s === 'currentcolor') {
    return { kind: 'solid', color: '#000000', alpha: 1 };
  }
  // url(#id) reference.
  const urlMatch = /^url\(\s*#([^)\s]+)\s*\)/.exec(s);
  if (urlMatch) return { kind: 'ref', id: urlMatch[1] };
  // Everything else — hex, rgb()/rgba(), hsl()/hsla(), and named colors —
  // goes through the kit's CSS parser. It throws on unrecognized input;
  // we translate that into the `null` the caller expects.
  try {
    const [r, g, b, a] = parseColor(s);
    // Split into the `#rrggbb` + 0..1 alpha contract the rest of the SVG
    // pipeline depends on. `rgbaToHex` of a 3-tuple always emits 6-char,
    // lowercase hex; the alpha is carried separately.
    return { kind: 'solid', color: rgbaToHex([r, g, b]), alpha: a };
  } catch {
    return null;
  }
}
