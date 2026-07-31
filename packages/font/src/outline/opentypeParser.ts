/**
 * The default `OutlineParser`: opentype.js, loaded on demand.
 *
 * ### Why the dynamic import
 *
 * opentype.js is ~49 kB gzipped and it is the *only* runtime dependency this
 * package has. Charging that to every consumer of `@weasel-js/font` — most of
 * whom render text through a baked atlas and never touch an outline — would
 * be a poor trade for a tier that only engages above a size threshold. The
 * tier is inherently asynchronous anyway (font bytes arrive over `fetch` or
 * `queryLocalFonts`), so there is no synchronous path to slow down: the
 * import rides along with the load that was already going to happen, and a
 * bundler splits it into a chunk nobody fetches until large text appears.
 *
 * The other candidate was Typr — smaller, but unmaintained and untyped, and
 * this is a runtime dependency of a published package.
 *
 * ### Coordinate convention
 *
 * `glyph.getPath(0, 0, 1)` already emits exactly what `OutlineFace` promises:
 * font units divided by the em, y flipped to grow downward, and the origin on
 * the baseline at the pen position. That is opentype.js's canvas-rendering
 * convention, and it happens to be the kit's world convention too, so no
 * transform is applied here — a flip would have to be undone downstream.
 */

import { OUTLINE_PRECISION, type OutlineFace, type OutlineParser } from './OutlineFace';
import { sfntFromCollection } from './sfnt';

type OpenType = typeof import('opentype.js');

let modulePromise: Promise<OpenType> | null = null;

/** Load (once) and cache the parser module. */
function loadOpenType(): Promise<OpenType> {
  modulePromise ??= import('opentype.js');
  return modulePromise;
}

/**
 * Wrap a parsed opentype.js font.
 *
 * `charToGlyphIndex` reports 0 — `.notdef` — for a codepoint the font does
 * not cover. That is a real glyph (the tofu box) and it renders, so returning
 * its outline would silently substitute a box for a character the atlas tier
 * might have been able to serve. Report the miss instead and let the caller's
 * fallback ladder run.
 */
function faceFor(font: import('opentype.js').Font): OutlineFace {
  return {
    unitsPerEm: font.unitsPerEm,
    glyphD(cp: number): string | null {
      const index = font.charToGlyphIndex(String.fromCodePoint(cp));
      if (!index) return null;
      const d = font.glyphs.get(index).getPath(0, 0, 1).toPathData(OUTLINE_PRECISION);
      // A glyph with no contours (a space) serializes to the empty string.
      // Same answer as a missing glyph from the caller's point of view:
      // nothing to tessellate.
      return d.length > 0 ? d : null;
    },
  };
}

/**
 * Parse font file bytes into a face. Accepts single fonts and collections
 * (`.ttc`); `postScriptName` picks the member of a collection, and is
 * ignored for a single font.
 */
export function createOpenTypeParser(postScriptName?: string): OutlineParser {
  return async (bytes: ArrayBuffer): Promise<OutlineFace> => {
    const opentype = await loadOpenType();
    const { bytes: single } = sfntFromCollection(bytes, postScriptName);
    return faceFor(opentype.parse(single));
  };
}

/** The parser used when a registration supplies none of its own. */
export const openTypeParser: OutlineParser = createOpenTypeParser();

/** @internal Test seam — drop the memoized module so a test can re-import. */
export function _resetOpenTypeModuleForTests(): void {
  modulePromise = null;
}
