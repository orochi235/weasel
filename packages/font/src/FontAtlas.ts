/**
 * BmFont JSON types and parser for the MSDF atlas format produced by
 * msdf-bmfont-xml. The parser builds accelerator maps (charMap, kerningMap)
 * for O(1) glyph and kerning lookup during layout.
 */

export interface BmFontInfo {
  face: string;
  size: number;
}

/** Font-wide vertical metrics and the atlas page dimensions, in pixels. */
export interface BmFontCommon {
  lineHeight: number;
  base: number;
  scaleW: number;
  scaleH: number;
}

/** One glyph: where it sits in the atlas page (`x`/`y`/`width`/`height`),
 *  where to draw it relative to the pen (`xoffset`/`yoffset`), and how far the
 *  pen then advances. */
export interface BmFontChar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
  page: number;
}

/** A kerning pair: `amount` px to add to the advance when `second` follows
 *  `first`. Codepoints, not glyph indices. */
export interface BmFontKerning {
  first: number;
  second: number;
  amount: number;
}

/** A parsed MSDF atlas: the BmFont record plus the `charMap` / `kerningMap`
 *  accelerators layout reads per glyph. */
export interface BmFont {
  info: BmFontInfo;
  common: BmFontCommon;
  chars: BmFontChar[];
  kernings: BmFontKerning[];
  charMap: Map<number, BmFontChar>;
  kerningMap: Map<number, Map<number, number>>;
}

/** Two-glyph fixture for unit tests. */
export const FIXTURE_FONT = {
  info: { face: 'Inter', size: 32 },
  common: { lineHeight: 38, base: 29, scaleW: 512, scaleH: 512 },
  chars: [
    { id: 65, x: 0,  y: 0, width: 22, height: 28, xoffset: 1, yoffset: 4, xadvance: 23, page: 0 },
    { id: 66, x: 24, y: 0, width: 20, height: 28, xoffset: 2, yoffset: 4, xadvance: 22, page: 0 },
  ],
  kernings: [
    { first: 65, second: 66, amount: -1 },
  ],
};

/** Validate a BmFont JSON document and build its lookup maps. Throws with the
 *  missing or malformed field named. */
export function parseBmFont(raw: unknown): BmFont {
  if (typeof raw !== 'object' || raw === null) throw new Error('parseBmFont: expected object');
  const r = raw as Record<string, unknown>;

  if (!r.info || typeof r.info !== 'object') throw new Error('parseBmFont: missing info');
  if (!r.common || typeof r.common !== 'object') throw new Error('parseBmFont: missing common');
  if (!Array.isArray(r.chars)) throw new Error('parseBmFont: chars must be an array');

  const info = r.info as BmFontInfo;
  const common = r.common as BmFontCommon;
  const chars = r.chars as BmFontChar[];
  const kernings: BmFontKerning[] = Array.isArray(r.kernings)
    ? (r.kernings as BmFontKerning[])
    : [];

  const charMap = new Map<number, BmFontChar>();
  for (const ch of chars) charMap.set(ch.id, ch);

  const kerningMap = new Map<number, Map<number, number>>();
  for (const k of kernings) {
    let inner = kerningMap.get(k.first);
    if (!inner) { inner = new Map(); kerningMap.set(k.first, inner); }
    inner.set(k.second, k.amount);
  }

  return { info, common, chars, kernings, charMap, kerningMap };
}
