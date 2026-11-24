import type { TilePatternOptions } from './';

/** Draw one tile, `size` rounded to whole pixels, and hand back its pixels, or `null` where no
 *  `OffscreenCanvas` 2D context can be had or `size` holds no whole pixel. Nothing is drawn then. */
export function rasterizeTile(opts: TilePatternOptions): ImageBitmap | null {
  if (!(opts.size >= 1 && Number.isFinite(opts.size))) return null;
  if (typeof OffscreenCanvas === 'undefined') return null;
  const size = Math.round(opts.size);
  let off: OffscreenCanvas;
  try {
    off = new OffscreenCanvas(size, size);
  } catch {
    return null;
  }
  const oc = off.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!oc) return null;
  opts.draw(oc as unknown as CanvasRenderingContext2D, size);
  return off.transferToImageBitmap();
}
