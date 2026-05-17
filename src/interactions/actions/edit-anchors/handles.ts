import type { PolygonPath } from 'features/paths/types';
import { enumerateAnchors, type PathAnchor } from './geometry';

/** Result of a hit-test against a path's anchors / control handles. */
export interface AnchorHit {
  anchorIndex: number;
  kind: 'anchor' | 'controlIn' | 'controlOut';
  /** Index in `coords` of the hit point's x. */
  coordIndex: number;
}

/** Hit-test anchors and control handles. Controls win over anchors when both
 *  are within `threshold` (controls are smaller and rendered on top). */
export function hitAnchor(
  path: PolygonPath,
  worldX: number,
  worldY: number,
  threshold: number,
): AnchorHit | null {
  const anchors = enumerateAnchors(path);
  let bestControl: { d2: number; hit: AnchorHit } | null = null;
  let bestAnchor: { d2: number; hit: AnchorHit } | null = null;
  const t2 = threshold * threshold;

  for (const a of anchors) {
    if (a.controlIn) {
      const dx = a.controlIn.x - worldX;
      const dy = a.controlIn.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= t2 && (!bestControl || d2 < bestControl.d2)) {
        bestControl = {
          d2,
          hit: { anchorIndex: a.anchorIndex, kind: 'controlIn', coordIndex: a.controlIn.coordIndex },
        };
      }
    }
    if (a.controlOut) {
      const dx = a.controlOut.x - worldX;
      const dy = a.controlOut.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= t2 && (!bestControl || d2 < bestControl.d2)) {
        bestControl = {
          d2,
          hit: { anchorIndex: a.anchorIndex, kind: 'controlOut', coordIndex: a.controlOut.coordIndex },
        };
      }
    }
    const dx = a.x - worldX;
    const dy = a.y - worldY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= t2 && (!bestAnchor || d2 < bestAnchor.d2)) {
      bestAnchor = {
        d2,
        hit: { anchorIndex: a.anchorIndex, kind: 'anchor', coordIndex: a.coordIndex },
      };
    }
  }
  if (bestControl) return bestControl.hit;
  if (bestAnchor) return bestAnchor.hit;
  return null;
}

export type { PathAnchor };
