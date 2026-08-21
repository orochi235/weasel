/**
 * The parsed-font seam for the outline tier.
 *
 * A face answers exactly one question — "what does codepoint N look like?" —
 * and answers it as **SVG path data in em space**: one unit is one em, y
 * grows downward, and the origin sits on the baseline at the glyph's pen
 * position. That is a complete description of the glyph independent of size,
 * zoom, and position, which is the whole reason the tier exists: tessellate
 * once, transform per instance.
 *
 * ### Why `d` and not a command stream
 *
 * `@weasel-js/font` is a Tier A leaf — `@weasel-js/core` depends on it and
 * never the reverse (see `leaf-purity.test.ts`), so this package cannot name
 * core's `PolygonPath`. The alternative to a string would be re-declaring
 * core's `PATH_M`/`PATH_L`/… opcodes over here and trusting two packages to
 * keep the same numbering forever. SVG `d` is the kit's documented language
 * for geometry crossing a boundary (`docs/conventions.md`), core already
 * ships `pathFromD`, and a glyph outline is exactly the case it describes.
 *
 * The string is also a natural cache key and costs nothing to hold: the
 * parse happens once per glyph, and core caches the *tessellation*, not the
 * text.
 */

/** Weight/style pair identifying one face within a family. */
export type OutlineFontStyle = 'normal' | 'italic';

/** A parsed font face, viewed only as a source of glyph outlines. See the
 *  module comment for the em-space contract `glyphD` returns. */
export interface OutlineFace {
  /** Font design units per em. Reported for diagnostics; `glyphD` has already
   *  divided by it, so callers never need to. */
  unitsPerEm: number;
  /**
   * Em-space SVG path data for `cp`, or `null` when this face has no glyph
   * for the codepoint *or* the glyph has no contours (a space). Both answers
   * mean the same thing to a caller: there is nothing here to tessellate, so
   * fall through to whatever tier would have drawn it.
   */
  glyphD(cp: number): string | null;
}

/**
 * Turn font file bytes into a face. Async because the default implementation
 * dynamically imports its parser — see `opentypeParser.ts` for why that
 * matters — and because a caller may want to hand back a face that finishes
 * initializing off-thread.
 */
export type OutlineParser = (bytes: ArrayBuffer) => OutlineFace | Promise<OutlineFace>;

/**
 * Decimal places kept when serializing em-space coordinates.
 *
 * Five is chosen against two constraints, not by taste. Below: 1e-5 em is
 * 0.01px on a 1000px-tall glyph, an order of magnitude under anything a
 * display can show. Above: `pathFromD`'s tokenizer splits argument runs on
 * *letters*, so a coordinate that JavaScript chooses to print in exponential
 * form (`1e-7`) would tokenize as the command `e`. Numbers stay in
 * positional notation down to 1e-6, so five decimals cannot produce one.
 */
export const OUTLINE_PRECISION = 5;
