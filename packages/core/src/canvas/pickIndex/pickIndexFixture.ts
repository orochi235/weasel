/**
 * The queries the pick-index tests drive `pickWalk` with: the point query and
 * the region query the scene's picks use, each given the broad box its entry
 * point will set.
 */
import type { LassoHitMode } from 'core/adapters/types';
import type { SelectRegion } from 'core/geometry/regionHit';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { regionPickQuery } from 'canvas/deps/hitTestArea';
import { scenePointQuery } from 'canvas/SceneCanvas/scenePointQuery';
import { broadInPlane, type PickBroad, type PickQuery } from 'canvas/pickWalk';

/** `q` asking the index for `broad`, carried into every plane `q` reaches. */
export function withBroad<TPose>(q: PickQuery<TPose>, broad: PickBroad): PickQuery<TPose> {
  const inPlane = q.inPlane;
  return {
    ...q,
    broad,
    ...(inPlane ? { inPlane: (m) => withBroad(inPlane(m), broadInPlane(broad, m)) } : {}),
  };
}

/** The select tool's point query at `(x, y)` under view scale `s`. */
export function pointPick(
  d: PoseDescriptor<unknown>,
  x: number,
  y: number,
  s: { x: number; y: number },
  tolerancePx = 4,
): PickQuery<unknown> {
  const least = Math.min(Math.abs(s.x), Math.abs(s.y));
  const r = tolerancePx / least;
  const q = scenePointQuery<unknown>(d, true, tolerancePx)(x, y, s);
  return withBroad(q, { box: { x: x - r, y: y - r, width: 2 * r, height: 2 * r }, pxPerWorld: least });
}

/** A marquee's or a lasso's query over `region`. */
export function regionPick(
  region: SelectRegion,
  mode: LassoHitMode,
  d: PoseDescriptor<unknown>,
  includeContainers = false,
): PickQuery<unknown> {
  return withBroad(regionPickQuery(region, mode, d, { includeContainers }), { box: region.bounds });
}
