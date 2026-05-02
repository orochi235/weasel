/**
 * AABB union over a heterogeneous set of `Path` poses. Returns the
 * envelope as a `RectPath`, or `null` for empty input — analog of
 * `unionBounds` for the rect-only model.
 */

import { boundsOfPath } from './bounds';
import type { Path, RectPath } from './types';

export function unionBoundsPath(paths: Iterable<Path>): RectPath | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const p of paths) {
    any = true;
    const b = boundsOfPath(p);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  if (!any) return null;
  return { kind: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
