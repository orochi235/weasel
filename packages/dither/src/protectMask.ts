import type { Rect } from '@weasel-js/geom';
import { checkImageSize } from './shared';

/** A per-pixel protect mask (1 = protected) from rects in pixel space. Rects
 *  round outward to whole pixels and clip to the image. */
export function protectMask(rects: Iterable<Rect>, width: number, height: number): Uint8Array {
  checkImageSize('protectMask', width, height);
  const mask = new Uint8Array(width * height);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(width, Math.ceil(r.x + r.width));
    const y1 = Math.min(height, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + Math.max(x0, x1));
  }
  return mask;
}
