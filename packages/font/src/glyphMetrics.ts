/**
 * One shape for the advances, kerning and baseline of whichever tier resolved
 * a face. A baked atlas and the canvas tier measure in their bake-size pixels
 * and a parsed face in ems; `size` is the divisor that takes any of them to
 * world units (`fontSize / size`), which is why an em-space face reports 1.
 */
import type { BmFont, BmFontChar } from './FontAtlas';
import { isDefaultIgnorable } from './defaultIgnorable';
import type { DynamicFace } from './dynamic/dynamicAtlas';
import type { OutlineFace } from './outline/OutlineFace';
import type { ResolveResult } from './registerFont';

/** Where a face's advances, kerning and baseline come from. */
export interface GlyphMetrics {
  /** Units per em of everything else here. */
  readonly size: number;
  /** Line top to baseline in the glyph frame: what an atlas glyph's `yoffset`
   *  is measured against. */
  readonly base: number;
  /** Baseline to the top of the face's line box: the ascent a browser sets
   *  the face with, or `base` for a face that states none. */
  readonly ascent: number;
  /** Baseline to the bottom of the face's line box. Absent for a face that
   *  states no ascent and descent, which hangs its baseline `base` below the
   *  line top instead of centering the face in its line. */
  readonly descent?: number;
  /** Advance for `cp`, or null when the face has no glyph for it. On the
   *  canvas tier this measures the glyph and queues its bake. */
  advanceOf(cp: number): number | null;
  kernOf(left: number, right: number): number;
}

/** A canvas face that cannot measure a code point reports no advance and no
 *  ink for it, which is its only way to say it has no glyph, and exactly how
 *  it serves a default-ignorable one. A glyph with ink has no width until its
 *  bake lands, and says so with a negative page. */
export function usableGlyph(glyph: BmFontChar): boolean {
  return glyph.xadvance > 0 || glyph.width > 0 || glyph.page < 0 || isDefaultIgnorable(glyph.id);
}

/** Reads through to `font` rather than copying: the canvas tier measures a
 *  face again in place when its web font lands. */
function atlasMetrics(font: BmFont, advanceOf: (cp: number) => number | null): GlyphMetrics {
  // The products are kept until the face's metrics object is replaced, since
  // each fresh one boxed a number on every read: 120 KB a frame of a HUD readout.
  let seen: BmFont['faceMetrics'] | null = null;
  let ascent = 0.5;
  let descent: number | undefined;
  const stated = (): boolean => {
    const face = font.faceMetrics;
    if (face !== seen) {
      seen = face;
      const has = face?.ascent !== undefined && face.descent !== undefined;
      ascent = has ? face.ascent! * font.info.size : 0.5;
      descent = has ? face.descent! * font.info.size : undefined;
    }
    return descent !== undefined;
  };
  return {
    size: font.info.size,
    get base() { return font.common.base; },
    get ascent() { return stated() ? ascent : font.common.base; },
    get descent() { return stated() ? descent : undefined; },
    advanceOf,
    kernOf: (l, r) => font.kerningMap.get(l)?.get(r) ?? 0,
  };
}

function outlineMetricsOf(face: OutlineFace): GlyphMetrics {
  const descent = face.faceMetrics?.descent;
  return {
    size: 1,
    base: face.ascender,
    ascent: face.faceMetrics?.ascent ?? face.ascender,
    ...(descent !== undefined ? { descent } : {}),
    advanceOf: (cp) => face.advanceOf(cp),
    kernOf: (l, r) => face.kernOf(l, r),
  };
}

function canvasMetrics(face: DynamicFace): GlyphMetrics {
  return atlasMetrics(face.font, (cp) => {
    const glyph = face.requestGlyph(cp);
    return usableGlyph(glyph) ? glyph.xadvance : null;
  });
}

const byFace = new WeakMap<object, GlyphMetrics>();

function memo<F extends object>(face: F, build: (face: F) => GlyphMetrics): GlyphMetrics {
  let m = byFace.get(face);
  if (!m) {
    m = build(face);
    byFace.set(face, m);
  }
  return m;
}

/**
 * The metrics of whichever tier `result` resolved to, or `undefined` for a
 * miss, which has none. One object per face, so two results that landed on the
 * same face compare equal by identity.
 */
export function metricsOf(result: ResolveResult): GlyphMetrics | undefined {
  if (result.outlineFace) return memo(result.outlineFace, outlineMetricsOf);
  if (result.entry) {
    return memo(result.entry.font, (font) => atlasMetrics(font, (cp) => font.charMap.get(cp)?.xadvance ?? null));
  }
  if (result.dynamicFace) return memo(result.dynamicFace, canvasMetrics);
  return undefined;
}
