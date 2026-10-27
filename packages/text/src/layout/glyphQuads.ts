/**
 * A glyph quad as painting packs it: the numbers `LaidOutGroup.quadData`
 * holds for each atlas glyph, and the object view a reader can ask for instead.
 */
import type { BmFontChar } from '@weasel-js/font';
import { lazy } from './layoutColumns';
import type { PlacedGlyph } from './layoutRuns';
import type { LaidOutGroup } from './paintRuns';

/** One textured glyph quad, relative to the text's own top-left: what
 *  `LaidOutGroup.quads` holds, read out of `quadData`. */
export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** The glyph's baseline. The synthetic-italic skew leans vertices about it. */
  baselineY: number;
  /** The glyph's pen on that baseline, which it turns about. */
  penX: number;
  /** Degrees the quad turns, clockwise about `(penX, baselineY)`, after the
   *  skew. 0 is upright. */
  rotate: number;
  /** On a `'color'` group's quads, the glyph's record, which a renderer drawing
   *  it larger than its bake asks for a sharper one (`sharperColorGlyph`). */
  colorGlyph?: BmFontChar;
}

/** Numbers per quad in `LaidOutGroup.quadData`. */
export const QUAD_STRIDE = 11;

/**
 * Whether `g` has an atlas quad: false with no atlas record, for a zero-area
 * glyph, or for a dynamic glyph not baked yet.
 */
export function hasGlyphQuad(g: PlacedGlyph): boolean {
  const { font, glyph } = g;
  return font !== null && glyph !== null && glyph.width !== 0 && glyph.page >= 0;
}

/** Write `g`'s atlas quad, which it must have, into `out` at `at`. */
export function writeGlyphQuad(g: PlacedGlyph, out: number[], at: number): void {
  const font = g.font!, glyph = g.glyph!;
  const scale = g.fontSize / g.metrics.size;
  const x0 = g.x + glyph.xoffset * scale;
  // `yoffset` is measured from the line top in the atlas's own frame, so
  // subtracting that frame's baseline hangs the glyph off its own.
  const y0 = g.baselineY + (glyph.yoffset - g.metrics.base) * scale;
  out[at] = x0;
  out[at + 1] = y0;
  out[at + 2] = x0 + glyph.width * scale;
  out[at + 3] = y0 + glyph.height * scale;
  out[at + 4] = glyph.x / font.common.scaleW;
  out[at + 5] = glyph.y / font.common.scaleH;
  out[at + 6] = (glyph.x + glyph.width) / font.common.scaleW;
  out[at + 7] = (glyph.y + glyph.height) / font.common.scaleH;
  out[at + 8] = g.baselineY;
  out[at + 9] = g.x;
  out[at + 10] = g.rotate ?? 0;
}

/** Groups whose `quads` view was built, which holds their quads as a value
 *  from then on and so cannot be refilled. */
export const quadsViewed = new WeakSet<LaidOutGroup>();

/** The `quads` view over a group's `quadData`. */
export const quadViews: PropertyDescriptorMap = {
  quads: lazy('quads', (group: LaidOutGroup) => {
    quadsViewed.add(group);
    const d = group.quadData;
    const out: LaidOutQuad[] = [];
    for (let at = 0, k = 0; at < d.length; at += QUAD_STRIDE, k++) {
      const q: LaidOutQuad = {
        x0: d[at], y0: d[at + 1], x1: d[at + 2], y1: d[at + 3],
        u0: d[at + 4], v0: d[at + 5], u1: d[at + 6], v1: d[at + 7], baselineY: d[at + 8],
        penX: d[at + 9], rotate: d[at + 10],
      };
      if (group.colorGlyphs) q.colorGlyph = group.colorGlyphs[k];
      out.push(q);
    }
    return out;
  }),
};
