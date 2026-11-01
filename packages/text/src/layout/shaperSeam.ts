/**
 * The shaping contract, declared here and implemented elsewhere.
 *
 * This package does not depend on `@weasel-js/text-shaping` and must not, for the
 * reason it does not depend on `@weasel-js/bidi`: a consumer setting only
 * Latin text never downloads HarfBuzz's WebAssembly, and another engine can
 * stand in. `@weasel-js/text-shaping` satisfies these types structurally.
 *
 * Without a shaper, layout finds each code point's glyph on its own and kerns
 * pairs, which is right for Latin, Greek, Cyrillic and CJK and wrong for any
 * script whose letters change shape with their neighbors.
 */

/** One glyph a shaping produced. Every length is in ems, and y grows down. */
export interface ShapedGlyph {
  /** Glyph index in the face; 0 (`.notdef`) when it has none for the cluster. */
  gid: number;
  /** UTF-16 offset in the shaped text where the glyph's cluster starts. */
  cluster: number;
  advance: number;
  /** Where it is drawn, from the pen. */
  dx: number;
  dy: number;
  /** Whether it was shaped right to left, in which case the shaper already
   *  drew a mirrored character as its mirror. */
  rtl: boolean;
}

/**
 * A shaping engine: registered with `registerShaper` or passed to
 * `layoutRuns` as `opts.shaper`. `@weasel-js/text-shaping`'s `loadShaper()`
 * resolves with one. `face` is a font file's bytes (an sfnt), the same buffer
 * every call for the same face.
 */
export interface TextShaper {
  /** Glyphs in logical order: clusters by ascending `cluster`, and the glyphs
   *  of one cluster in the order they are drawn, left to right. `language` is
   *  a BCP 47 tag selecting the face's forms for that language; absent draws
   *  its default forms. */
  shape(face: ArrayBuffer, text: string, features?: readonly string[], language?: string): readonly ShapedGlyph[];
  /** Em-space path data for glyph `gid`, moved by `(dx, dy)`; null for one
   *  with no contours. */
  glyphD(face: ArrayBuffer, gid: number, dx?: number, dy?: number): string | null;
  /** Whether the face has OpenType feature `tag`. */
  hasFeature(face: ArrayBuffer, tag: string): boolean;
}

/**
 * What a shaped code point draws: the glyphs of the cluster it opens, set
 * from its pen. The other code points of a cluster carry one with no glyphs.
 */
export interface ShapedCluster {
  /** Em-space outline of every glyph in the cluster at its place, or null
   *  when none has contours. */
  d: string | null;
  /** Names `d` among the glyphs of one face, for caching what is built from it. */
  key: string;
  /** Each glyph, where it is drawn, and how far the shaper moved the pen past it, in ems
   *  from the pen, y down. A mark the shaper set over its base has no advance. */
  glyphs: readonly { gid: number; x: number; y: number; advance: number }[];
  /** Whether it was shaped right to left. */
  rtl: boolean;
  /** The text the cluster's glyphs stand for, in logical order: what a reader
   *  copies or searches for when it reads them back. Empty on a code point
   *  another one draws. */
  text: string;
}
