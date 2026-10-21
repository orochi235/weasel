/**
 * The default `OutlineParser`: opentype.js, loaded on demand.
 *
 * The import is dynamic because opentype.js is ~49 kB gzipped and most
 * consumers render text through a baked atlas and never touch an outline.
 * The other candidate was Typr — smaller, but unmaintained and untyped.
 *
 * `glyph.getPath(0, 0, 1)` already emits exactly what `OutlineFace` promises:
 * font units divided by the em, y flipped to grow downward, and the origin on
 * the baseline at the pen position, so no transform is applied here.
 */

import { OUTLINE_PRECISION, type FaceEmbedding, type OutlineFace, type OutlineParser } from './OutlineFace';
import { sfntFromCollection } from './sfnt';
import { gposPairKerning, type PairKerning } from './gposKerning';
import { faceMetricsFromTables, type FaceMetricTables } from '../faceMetrics';

type OpenType = typeof import('opentype.js');

let modulePromise: Promise<OpenType> | null = null;

/** Load (once) and cache the parser module. */
function loadOpenType(): Promise<OpenType> {
  modulePromise ??= import('opentype.js');
  return modulePromise;
}

/**
 * opentype.js 2.0 publishes ESM under `module` and a UMD bundle under `main`.
 * Only a bundler reads `module`; Node takes the UMD one, whose named exports
 * it cannot detect, so `ns.parse` is `undefined` there and every face fails to
 * load. The registry catches that and degrades to the SDF tier, so a headless
 * consumer, which has no atlas, gets no glyphs and no explanation.
 *
 * Exported for the test: the suite resolves through vite, which reads
 * `module` and therefore cannot reproduce the shape that breaks.
 */
export function parserOf(ns: OpenType): OpenType['parse'] {
  const interop = ns as OpenType & { default?: OpenType };
  return interop.default?.parse ?? ns.parse;
}

/**
 * Wrap a parsed opentype.js font.
 *
 * `charToGlyphIndex` reports 0 — `.notdef` — for a codepoint the font does
 * not cover. That is a real glyph (the tofu box) and it renders, so report
 * the miss instead and let the caller's fallback ladder run.
 */
function faceFor(
  font: import('opentype.js').Font, gpos: PairKerning | null, sfnt: ArrayBuffer,
): OutlineFace {
  const upem = font.unitsPerEm;
  // Typed `any` by the 1.x typings; read through the narrow shape instead.
  const { hhea, post, os2 } = font.tables as Pick<FaceMetricTables, 'hhea' | 'post' | 'os2'>;
  const faceMetrics = faceMetricsFromTables({ unitsPerEm: upem, hhea, post, os2 });
  return {
    unitsPerEm: upem,
    ascender: faceMetrics?.ascent ?? font.ascender / upem,
    ...(faceMetrics ? { faceMetrics } : {}),
    advanceOf(cp: number): number | null {
      const index = font.charToGlyphIndex(String.fromCodePoint(cp));
      if (!index) return null;
      return (font.glyphs.get(index).advanceWidth ?? 0) / upem;
    },
    ...(isSfnt(sfnt) ? { embedding: () => embeddingOf(font, sfnt) } : {}),
    kernOf(left: number, right: number): number {
      const l = font.charToGlyphIndex(String.fromCodePoint(left));
      const r = font.charToGlyphIndex(String.fromCodePoint(right));
      if (!l || !r) return 0;
      if (gpos) return gpos(l, r) / upem;
      return font.getKerningValue(font.glyphs.get(l), font.glyphs.get(r)) / upem;
    },
    glyphD(cp: number): string | null {
      const index = font.charToGlyphIndex(String.fromCodePoint(cp));
      if (!index) return null;
      const d = font.glyphs.get(index).getPath(0, 0, 1).toPathData(OUTLINE_PRECISION);
      // A glyph with no contours (a space) serializes to the empty string.
      return d.length > 0 ? d : null;
    },
  };
}

interface EmbedTables {
  os2?: { fsType?: number; sCapHeight?: number };
  head?: { xMin: number; yMin: number; xMax: number; yMax: number };
  post?: { italicAngle?: number };
  glyf?: unknown;
  cff?: unknown;
}

/** TrueType (`00 01 00 00`, `true`) or CFF (`OTTO`): a WOFF's bytes are not what FontFile2 holds. */
function isSfnt(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  const tag = new DataView(bytes).getUint32(0);
  return tag === 0x00010000 || tag === 0x74727565 || tag === 0x4f54544f;
}

/** fsType bits that rule out embedding the outlines: restricted license, and bitmap embedding only. */
const NO_OUTLINE_EMBEDDING = 0x0002 | 0x0200;

function embeddingOf(font: import('opentype.js').Font, sfnt: ArrayBuffer): FaceEmbedding {
  // Typed `any` by the 1.x typings; read through the narrow shape instead.
  const t = font.tables as EmbedTables;
  const englishName = (font as { getEnglishName?: (key: string) => string | undefined })
    .getEnglishName?.('postScriptName');
  return {
    sfnt,
    postScriptName: englishName ?? '',
    unitsPerEm: font.unitsPerEm,
    outlines: t.cff && !t.glyf ? 'cff' : 'truetype',
    embeddable: ((t.os2?.fsType ?? 0) & NO_OUTLINE_EMBEDDING) === 0,
    glyphIndexOf(cp) {
      return font.charToGlyphIndex(String.fromCodePoint(cp)) || null;
    },
    advanceOfGlyph: (gid) => font.glyphs.get(gid).advanceWidth ?? 0,
    ascent: font.ascender,
    descent: font.descender,
    capHeight: t.os2?.sCapHeight || font.ascender,
    italicAngle: t.post?.italicAngle ?? 0,
    bbox: [t.head?.xMin ?? 0, t.head?.yMin ?? 0, t.head?.xMax ?? 0, t.head?.yMax ?? 0],
  };
}

/**
 * Parse font file bytes into a face. Accepts single fonts and collections
 * (`.ttc`, `.dfont`); `postScriptName` picks the member of a collection, and
 * is ignored for a single font. A collection with no member of that name
 * rejects: its first member is usually Regular, and bold text drawn from it
 * is lighter above the outline threshold than below it.
 */
export function createOpenTypeParser(postScriptName?: string): OutlineParser {
  return async (bytes: ArrayBuffer): Promise<OutlineFace> => {
    const parse = parserOf(await loadOpenType());
    const { bytes: single, matched, names } = sfntFromCollection(bytes, postScriptName);
    if (!matched) {
      throw new Error(
        `no member of the font file is named "${postScriptName}" (it holds ${names.join(', ')})`);
    }
    return faceFor(parse(single), gposPairKerning(single), single);
  };
}

/** The parser used when a registration supplies none of its own. */
export const openTypeParser: OutlineParser = createOpenTypeParser();

/** @internal Test seam — drop the memoized module so a test can re-import. */
export function _resetOpenTypeModuleForTests(): void {
  modulePromise = null;
}
