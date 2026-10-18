/**
 * Color glyphs baked again larger. A color glyph is a bitmap baked at
 * `BAKE_SIZE`, so it blurs when drawn much bigger than that; this re-rasters
 * it at `BAKE_SIZE × 2^level` onto pages of its own, the way a vector image
 * re-rasterizes in power-of-two steps. One emoji at the largest level takes
 * the room of sixty at the base size, so these pages fill and empty without
 * taking the base bakes with them.
 */

import type { BmFontChar } from '../FontAtlas';
import { onSharpPagesEmptied, requestBake } from './bakeQueue';
import { BAKE_SIZE, type RasterizedColorGlyph } from './glyphRasterizer';

/** The largest level baked: `BAKE_SIZE × 2^3`, 384px. */
export const MAX_SHARP_LEVEL = 3;

/** A color glyph baked at `BAKE_SIZE × 2^level`. */
export interface SharperColorGlyph {
  level: number;
  /**
   * Its rect on sharp color page `glyph.page` (`sharpColorPageTextureId`), in
   * that bake's texels. Its `xoffset` and `yoffset` are in the base bake's px,
   * as the base record's are, so both place from the same pen; it covers
   * `width / 2^level` of them.
   */
  glyph: BmFontChar;
}

interface Source {
  raster(size: number): RasterizedColorGlyph | null;
  /** The face's baseline, which the base record's `yoffset` is measured from. */
  base: number;
  /** By level; null where the platform drew nothing. Read only while
   *  `generation` is current. */
  levels: (SharperColorGlyph | null)[];
  generation: number;
}

const sources = new WeakMap<BmFontChar, Source>();
let generation = 0;

onSharpPagesEmptied(() => {
  generation++;
});

/** Let `char`, a base color bake, be baked again larger by `raster`. */
export function addSharpSource(
  char: BmFontChar, base: number, raster: (size: number) => RasterizedColorGlyph | null,
): void {
  sources.set(char, { raster, base, levels: [], generation });
}

function levelsOf(source: Source): (SharperColorGlyph | null)[] {
  if (source.generation !== generation) {
    source.levels = [];
    source.generation = generation;
  }
  return source.levels;
}

/** The sharper bakes `char` has asked for, baked or waiting. */
export function sharpBakesOf(char: BmFontChar): BmFontChar[] {
  const source = sources.get(char);
  if (!source) return [];
  return levelsOf(source).flatMap((sharp) => (sharp ? [sharp.glyph] : []));
}

function requestLevel(source: Source, level: number): SharperColorGlyph | null {
  const levels = levelsOf(source);
  const known = levels[level];
  if (known !== undefined) return known;
  const k = 2 ** level;
  const raster = source.raster(BAKE_SIZE * k);
  const sharp: SharperColorGlyph | null = raster && {
    level,
    glyph: {
      id: 0, x: 0, y: 0, width: 0, height: 0,
      xoffset: raster.left / k,
      yoffset: source.base - raster.top / k,
      xadvance: raster.advance / k,
      page: -1,
      color: true,
    },
  };
  levels[level] = sharp;
  if (sharp && raster) requestBake(sharp.glyph, raster, true);
  return sharp;
}

/**
 * A bake of `char`, a base color bake, sharper than it for drawing at `scale`
 * device pixels to one of its texels: the power of two at or above `scale`,
 * up to {@link MAX_SHARP_LEVEL}. Asks for that bake if it has not been, and
 * until it lands serves the sharpest level that has. Null when the base bake
 * is the sharpest there is.
 */
export function sharperColorGlyph(char: BmFontChar, scale: number): SharperColorGlyph | null {
  const source = sources.get(char);
  if (!source || !(scale > 1)) return null;
  const wanted = Math.min(MAX_SHARP_LEVEL, Math.ceil(Math.log2(scale)));
  requestLevel(source, wanted);
  const levels = levelsOf(source);
  for (let level = wanted; level > 0; level--) {
    const sharp = levels[level];
    if (sharp && sharp.glyph.page >= 0) return sharp;
  }
  return null;
}
