import type { ActionDeps } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../editAnchorsDep';
import { pathToAnchors, segmentAt, type AnchorSet, type PolygonPath, type SegmentHit } from '@weasel-js/geom';

/** Screen-px reach of a segment, and the radius around each anchor that
 *  stays the anchor's. Matches the path-anchor affordance's default hit
 *  radius, so the two regions meet without a gap. */
export const SEGMENT_HIT_PX = 8;

/** @experimental The segment of the path being edited under world point
 *  `(x, y)`, or null off every segment, on an anchor, or with no path in edit
 *  mode. Its reach is the `targets.segmentHitPx` kit setting. */
export function segmentUnder(
  deps: ActionDeps | undefined,
  x: number,
  y: number,
): { dep: EditAnchorsDep; path: PolygonPath; hit: SegmentHit } | null {
  const dep = deps?.editAnchors;
  if (!dep?.editingId) return null;
  const path = dep.getEditablePath(dep.editingId) as PolygonPath | null | undefined;
  if (!path || path.kind !== 'polygon') return null;
  const scale = deps?.view?.get().scale;
  const hit = segmentAt(pathToAnchors(path) as AnchorSet, x, y, {
    tolerancePx: deps?.kitSettings?.get('targets.segmentHitPx') ?? SEGMENT_HIT_PX,
    ...(scale ? { scale } : {}),
  });
  return hit ? { dep, path, hit } : null;
}
