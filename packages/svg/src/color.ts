/**
 * SVG color / paint parsing. Handles the SVG-specific paint surface — the
 * sentinel `none`, `url(#id)` paint-server references, and `currentColor` —
 * then delegates the actual color tokenization (hex, `rgb()`/`rgba()`,
 * `hsl()`, and the full CSS named-color table) to the kit's `parseColor`.
 * Output is normalized to `#rrggbb` plus a separate 0..1 alpha so the rest
 * of the pipeline doesn't have to know about the encoding variants.
 */

import { rgbaToHex, tryParseColor } from '@weasel-js/core';

/** Result of parsing a `fill=` / `stroke=` attribute value. */
export type ParsedColor =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; alpha: number }
  | { kind: 'ref'; id: string; fallback?: { kind: 'none' } | { kind: 'solid'; color: string; alpha: number } };

/**
 * The id a same-document `url(#id)` names, its id bare or quoted, and the text
 * after it; null for any other value.
 */
export function parseUrlRef(s: string): { id: string; rest: string } | null {
  const m = /^url\(\s*(?:"#([^"]+)"|'#([^']+)'|#([^)\s"']+))\s*\)([\s\S]*)$/i.exec(s.trim());
  return m ? { id: (m[1] ?? m[2] ?? m[3]) as string, rest: m[4].trim() } : null;
}

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
  if (s.toLowerCase() === 'none') return { kind: 'none' };
  if (s.toLowerCase() === 'currentcolor') {
    return { kind: 'solid', color: '#000000', alpha: 1 };
  }
  // url(#id) reference, optionally followed by the fallback paint SVG's own
  // grammar allows — what a renderer takes when it cannot resolve the
  // reference. A mesh gradient or any other paint outside this package's
  // vocabulary arrives that way.
  const url = parseUrlRef(s);
  if (url) {
    const out: ParsedColor = { kind: 'ref', id: url.id };
    if (url.rest !== '') {
      const fallback = parsePaintAttr(url.rest);
      if (fallback?.kind === 'solid' || fallback?.kind === 'none') {
        (out as { fallback?: typeof fallback }).fallback = fallback;
      }
    }
    return out;
  }
  // Everything else — hex, rgb()/rgba(), hsl()/hsla(), and named colors —
  // goes through the kit's CSS parser.
  const rgba = tryParseColor(s);
  if (!rgba) return null;
  const [r, g, b, a] = rgba;
  // Split into the `#rrggbb` + 0..1 alpha contract the rest of the SVG
  // pipeline depends on. `rgbaToHex` of a 3-tuple always emits 6-char,
  // lowercase hex; the alpha is carried separately.
  return { kind: 'solid', color: rgbaToHex([r, g, b]), alpha: a };
}
