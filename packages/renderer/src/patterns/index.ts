/**
 * Tile-pattern primitive — a small helper for building repeating texture
 * tiles from a draw callback. The result plugs into a `FillStyle` of
 * `{ fill: 'pattern', pattern }` (see `@weasel-js/paint`).
 *
 * For ready-to-use named patterns (hatch, crosshatch, dots, chunks),
 * see the `@weasel-js/renderer/patterns-builtin` subpath.
 */

import { registerTexture } from '../textures/registerTexture';
import type { TextureHandle } from '../textures/registerTexture';
import { rasterizeTile } from './rasterizeTile';

/** Options for `createTilePattern`. */
export interface TilePatternOpts {
  /** Edge length (in pixels) of the square offscreen tile. */
  size: number;
  /** FillStyle one tile at integer-pixel coordinates `(0, 0) .. (size, size)`. */
  draw: (oc: CanvasRenderingContext2D, size: number) => void;
}

/**
 * Render a single tile and register it as a GL texture, returning a
 * `TextureHandle` you can wrap in a `FillStyle` of
 * `{ fill: 'pattern', pattern }`. Returns `null` only when an
 * `OffscreenCanvas`/2D context can't be acquired.
 */
export function createTilePattern(opts: TilePatternOpts): TextureHandle | null {
  const bitmap = rasterizeTile(opts);
  return bitmap ? registerTexture(bitmap) : null;
}
