/**
 * Bend segment on a spiro curve: a press on the curve between two points
 * inserts a smooth point there and drags it, the curve solved again through
 * it on every move. A spiro curve has no handles to bend, so this is what
 * pulling on its outline means.
 */
import type { ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import {
  cubicPointAt, flatAnchorIndex, nearestSegmentT, pathToAnchors, spiroControlPath, withinPxRadius,
  type PolygonPath, type SpiroContour,
} from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { spiroContours, spiroOf } from 'features/paths/spiroShape';
import { pathEditPreview } from '../edit-anchors/preview';

/** Screen-px reach of the curve, as the segment affordance's. */
const CURVE_HIT_PX = 8;

/** Where a press on the edited spiro curve adds a point: before `slot` in
 *  contour `sub` of `contours`, the curve's points as the press found them. */
export interface SpiroInsertAt {
  dep: EditAnchorsDep;
  contours: SpiroContour[];
  sub: number;
  slot: number;
}

/** Whether the path in edit is a spiro curve. */
export function editsSpiro(deps: ActionDeps | undefined): boolean {
  const dep = deps?.editAnchors;
  return !!dep?.editingId && spiroOf(dep.getNodeShape(dep.editingId)?.data) !== null;
}

/** The spiro curve in path edit, and where a press at `(x, y)` on it inserts
 *  a point. Null when no spiro curve is edited or the press misses it. */
export function spiroInsertAt(deps: ActionDeps | undefined, x: number, y: number): SpiroInsertAt | null {
  const dep = deps?.editAnchors;
  const spiro = dep?.editingId ? spiroOf(dep.getNodeShape(dep.editingId)?.data) : null;
  const curve = spiro ? (dep!.getOutlinePath?.(dep!.editingId) as PolygonPath | null | undefined) : null;
  if (!dep || !spiro || !curve) return null;
  const contours = spiroContours(curve, spiro);
  if (!contours) return null;
  const set = pathToAnchors(curve);
  const hit = nearestSegmentT(set.anchors, x, y, set.closed);
  if (!hit) return null;
  const scale = deps?.view?.get().scale ?? { x: 1, y: 1 };
  const on = set.anchors[hit.sub];
  const a = on[hit.segIdx];
  const b = on[(hit.segIdx + 1) % on.length];
  const p = cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, hit.t);
  if (!withinPxRadius(p.x - x, p.y - y, CURVE_HIT_PX, scale)) return null;
  const points = contours[hit.sub].points;
  if (points.some((q) => withinPxRadius(q.x - x, q.y - y, CURVE_HIT_PX, scale))) return null;
  // The point the hit segment's spiro segment starts from: the last at or before it.
  const flat = flatAnchorIndex(set, hit.sub, hit.segIdx);
  const first = contours.slice(0, hit.sub).reduce((n, c) => n + c.points.length, 0);
  const at = spiro.at.slice(first, first + points.length);
  let from = 0;
  while (from + 1 < at.length && at[from + 1] <= flat) from++;
  return { dep, contours, sub: hit.sub, slot: from + 1 };
}

/** The drag that inserts a smooth point at the press and moves it. */
export function spiroInsertDrag(insert: SpiroInsertAt): OngoingHandle {
  const { dep, contours, sub, slot } = insert;
  const id = dep.editingId;
  const flat = contours.slice(0, sub).reduce((n, c) => n + c.points.length, 0) + slot;
  const control = (x: number, y: number): PolygonPath => spiroControlPath(contours.map((c, s) => (s !== sub ? c : {
    closed: c.closed,
    points: [...c.points.slice(0, slot), { x, y, kind: 'smooth' }, ...c.points.slice(slot)],
  })));
  let current: PolygonPath | null = null;
  const preview = pathEditPreview(dep, id, () => current);
  if (!preview) return {};
  dep.setSelectedAnchors([flat]);
  return {
    kind: 'spiro-insert-point',
    onMove(moveCtx: InvocationCtx): void {
      current = control(moveCtx.world.x, moveCtx.world.y);
    },
    onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
      current = null;
      if (reason === 'cancel') {
        dep.setSelectedAnchors([]);
        return;
      }
      dep.applyEdit(id, control(endCtx.world.x, endCtx.world.y), 'Add spiro point');
    },
    previewIds: preview.previewIds,
    previewPose: preview.previewPose,
    previewData: preview.previewData,
  };
}
