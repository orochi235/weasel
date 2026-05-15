/**
 * Tile-pattern primitive — a small helper for building repeating texture
 * tiles from a draw callback. The result plugs into a `FillStyle` of
 * `{ fill: 'pattern', pattern }` (see `../../core/paint-types.ts`).
 *
 * GL-backed: the tile is rendered to an `OffscreenCanvas` (with a 2D fallback
 * to a regular `<canvas>` for environments without `OffscreenCanvas`),
 * converted to an `ImageBitmap`, and registered with `registerTexture()`.
 * The returned `TextureHandle` is what `FillStyle.pattern` accepts.
 *
 * For ready-to-use named patterns (hatch, crosshatch, dots, chunks),
 * see the `@orochi235/weasel/patterns-builtin` subpath.
 */

import { registerTexture } from '../../renderer/textures/registerTexture';
import type { TextureHandle } from '../../renderer/textures/registerTexture';

/** Options for `createTilePattern`. */
export interface TilePatternOpts {
  /** Edge length (in pixels) of the square offscreen tile. */
  size: number;
  /** FillStyle one tile at integer-pixel coordinates `(0, 0) .. (size, size)`. */
  draw: (oc: CanvasRenderingContext2D, size: number) => void;
}

/**
 * Render a single tile to an offscreen canvas and register it as a GL
 * texture, returning a `TextureHandle` you can wrap in a `FillStyle` of
 * `{ fill: 'pattern', pattern }`. Returns `null` only when an
 * `OffscreenCanvas`/2D context can't be acquired (very rare; same fallback
 * semantics as the prior `CanvasPattern`-based implementation).
 */
export function createTilePattern(opts: TilePatternOpts): TextureHandle | null {
  // Prefer OffscreenCanvas; fall back to <canvas> for environments without it
  // (tests in jsdom may need that fallback — try OffscreenCanvas first).
  let off: OffscreenCanvas | HTMLCanvasElement;
  try {
    off = new OffscreenCanvas(opts.size, opts.size);
  } catch {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = opts.size;
    c.height = opts.size;
    off = c;
  }
  const oc = off.getContext('2d') as CanvasRenderingContext2D | null;
  if (!oc) return null;
  opts.draw(oc, opts.size);

  // Convert to ImageBitmap so registerTexture can store it.
  // OffscreenCanvas.transferToImageBitmap() is the fast path; the
  // synchronous path requires OffscreenCanvas. If we got here without it,
  // the env doesn't support OffscreenCanvas — fail gracefully.
  let bitmap: ImageBitmap;
  if (typeof (off as OffscreenCanvas).transferToImageBitmap === 'function') {
    bitmap = (off as OffscreenCanvas).transferToImageBitmap();
  } else {
    return null;
  }
  return registerTexture(bitmap);
}
