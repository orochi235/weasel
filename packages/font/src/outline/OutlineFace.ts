/**
 * The parsed-font seam for the outline tier.
 *
 * A face describes a glyph as **SVG path data in em space**: one unit is one
 * em, y grows downward, and the origin sits on the baseline at the glyph's pen
 * position. That is independent of size, zoom, and position, so a glyph is
 * tessellated once and transformed per instance.
 *
 * `d` and not a command stream: `@weasel-js/core` depends on this package and
 * never the reverse, so it cannot name core's `PolygonPath`, and SVG `d` is
 * the kit's language for geometry crossing a boundary (`docs/conventions.md`).
 */

import type { FaceMetrics } from '../faceMetrics';

/** A parsed font face, viewed only as a source of glyph outlines. See the
 *  module comment for the em-space contract `glyphD` returns. */
export interface OutlineFace {
  /** Font design units per em. Reported for diagnostics; `glyphD` has already
   *  divided by it, so callers never need to. */
  unitsPerEm: number;
  /**
   * Distance from the line top to the baseline, in em units — the outline
   * tier's analogue of a `BmFont`'s `common.base`.
   *
   * The default parser reports `faceMetrics.ascent`, the ascent a browser
   * sets the face with, so a face used for metrics puts text on the same
   * baseline as an atlas of the same font and as the DOM edit overlay.
   */
  ascender: number;
  /** The face's decoration and script metrics, derived with
   *  `faceMetricsFromTables` so they match an atlas baked from the same
   *  font. Optional: a custom parser that omits it leaves layout on its
   *  defaults. */
  faceMetrics?: FaceMetrics;
  /**
   * Em-space SVG path data for `cp`, or `null` when this face has no glyph
   * for the codepoint *or* the glyph has no contours (a space).
   */
  glyphD(cp: number): string | null;
  /**
   * Advance width for `cp` in em units, or `null` when the face has no glyph
   * for it. A space has an advance and no contours.
   */
  advanceOf(cp: number): number | null;
  /** Kerning adjustment between two codepoints, in em units — negative pulls
   *  them together. `0` when the face kerns neither this pair nor at all. */
  kernOf(left: number, right: number): number;
  /** The face's raw material for embedding it whole in another format (a PDF).
   *  Optional: a custom parser that has no sfnt behind it omits it, and so
   *  does the built-in one for a WOFF file. */
  embedding?(): FaceEmbedding;
}

/** What a document format needs to embed one face as a font program. */
export interface FaceEmbedding {
  /** One face's sfnt: a collection member is cut out of its collection. */
  sfnt: ArrayBuffer;
  postScriptName: string;
  unitsPerEm: number;
  /** `'cff'` when the face has a `CFF ` table and no `glyf`. */
  outlines: 'truetype' | 'cff';
  /** False when OS/2 fsType forbids embedding (bit 1, 0x0002) or allows
   *  bitmaps only (bit 9, 0x0200). */
  embeddable: boolean;
  /** Glyph index for a codepoint; `null` for `.notdef` (0). */
  glyphIndexOf(cp: number): number | null;
  /** Advance of a glyph, in font units. */
  advanceOfGlyph(gid: number): number;
  /** Font units. */
  ascent: number;
  /** Font units, negative below the baseline. */
  descent: number;
  /** Font units. */
  capHeight: number;
  /** Degrees counterclockwise from vertical; negative leans right. */
  italicAngle: number;
  /** `[xMin, yMin, xMax, yMax]` in font units. */
  bbox: readonly [number, number, number, number];
}

/**
 * Turn font file bytes into a face. May be async: the default implementation
 * dynamically imports its parser.
 */
export type OutlineParser = (bytes: ArrayBuffer) => OutlineFace | Promise<OutlineFace>;

/**
 * Decimal places kept when serializing em-space coordinates.
 *
 * Below: 1e-5 em is 0.01px on a 1000px-tall glyph. Above: `pathFromD`'s
 * tokenizer splits argument runs on *letters*, so a coordinate that JavaScript
 * prints in exponential form (`1e-7`) would tokenize as the command `e`.
 * Numbers stay in positional notation down to 1e-6, so five decimals cannot
 * produce one.
 */
export const OUTLINE_PRECISION = 5;
