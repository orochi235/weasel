import type { TilePatternOptions } from './';

/** Draw one tile, `size` rounded to whole pixels, and hand back its pixels, or `null` where no
 *  `OffscreenCanvas` 2D context can be had or `size` holds no whole pixel. */
export function rasterizeTile(opts: TilePatternOptions): ImageBitmap | null {
  if (!(opts.size >= 1 && Number.isFinite(opts.size))) return null;
  const size = Math.round(opts.size);
  // Prefer OffscreenCanvas; fall back to <canvas> for environments without it.
  let off: OffscreenCanvas | HTMLCanvasElement;
  try {
    off = new OffscreenCanvas(size, size);
  } catch {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    off = c;
  }
  const oc = off.getContext('2d') as CanvasRenderingContext2D | null;
  if (!oc) return null;
  opts.draw(oc, size);

  // Only an OffscreenCanvas can hand over a bitmap synchronously.
  if (typeof (off as OffscreenCanvas).transferToImageBitmap !== 'function') return null;
  return (off as OffscreenCanvas).transferToImageBitmap();
}
