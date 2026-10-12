import type { TilePatternOpts } from './';

/** Draw one tile and hand back its pixels, or `null` where no
 *  `OffscreenCanvas` 2D context can be had. */
export function rasterizeTile(opts: TilePatternOpts): ImageBitmap | null {
  // Prefer OffscreenCanvas; fall back to <canvas> for environments without it.
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

  // Only an OffscreenCanvas can hand over a bitmap synchronously.
  if (typeof (off as OffscreenCanvas).transferToImageBitmap !== 'function') return null;
  return (off as OffscreenCanvas).transferToImageBitmap();
}
