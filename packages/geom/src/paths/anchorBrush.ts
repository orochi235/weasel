import type { Scale2 } from '../pxExtent';
import type { AnchorSet } from './anchorEdits';
import type { Point } from './cubicMath';
import { pointSegmentDist2 } from '../points2';

/**
 * Flat indices of every anchor a round brush covers as it moves from `from` to
 * `to`: those within `radiusPx` of that segment, measured on screen. A dab is a
 * segment of zero length. `scale` is the view's, so the brush stays round on
 * screen under non-uniform zoom; omitted, one unit is one pixel.
 */
export function anchorsUnderBrush(
  set: AnchorSet,
  from: Point,
  to: Point,
  opts: { radiusPx: number; scale?: Scale2 },
): number[] {
  const scale = opts.scale ?? { x: 1, y: 1 };
  const ax = from.x * scale.x, ay = from.y * scale.y;
  const bx = to.x * scale.x, by = to.y * scale.y;
  const r2 = opts.radiusPx * opts.radiusPx;
  const hits: number[] = [];
  let flat = 0;
  for (const sub of set.anchors) {
    for (const a of sub) {
      if (pointSegmentDist2(a.x * scale.x, a.y * scale.y, ax, ay, bx, by) <= r2) hits.push(flat);
      flat++;
    }
  }
  return hits;
}
