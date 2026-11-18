/** What a pen press lands on: an open path's end, the first anchor's close zone, or a snapped point. */
import { snapMods, type ModifierState, type PointSnap } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/routing';
import { nearestPathAnchor, pxExtent, withinPxRadius, type PathAnchorHit, type PolygonPath } from '@weasel-js/geom';

/** Where an anchor lands, and the open subpath end it landed on, if any. */
export interface PenPlacement {
  x: number;
  y: number;
  hit: PathAnchorHit | null;
}

/** Where an anchor pressed at `(x, y)` lands: on an open subpath's end
 *  within `closePx` screen pixels of the press, which `hit` names, else
 *  wherever the snap session about `last` puts it. */
export function placeAt(
  deps: ActionDeps,
  snaps: PointSnap,
  x: number,
  y: number,
  mods: ModifierState,
  closePx: number,
  last: { x: number; y: number } | undefined,
): PenPlacement {
  const hit = openEndNear(deps, x, y, closePx);
  if (hit) return { x: hit.x, y: hit.y, hit };
  return { ...snaps.place(deps.snap, { x, y }, snapMods({ modifiers: mods }), last).point, hit: null };
}

/** Is a world point within `px` screen pixels of `(ax, ay)`? Measured as a
 *  screen-space circle, so the zone stays round under non-uniform zoom. */
export function withinCloseRadius(deps: ActionDeps, ax: number, ay: number, wx: number, wy: number, px: number): boolean {
  return withinPxRadius(ax - wx, ay - wy, px, viewScale(deps));
}

/** The end anchor of an open subpath within `px` screen pixels of `(wx, wy)`,
 *  nearest first; null when there is none. */
export function openEndNear(deps: ActionDeps, wx: number, wy: number, px: number): PathAnchorHit | null {
  return nearestPathAnchor(pathsNear(deps, wx, wy, px), { x: wx, y: wy }, px, viewScale(deps), (h) => h.end !== null);
}

export function viewScale(deps: ActionDeps): { x: number; y: number } {
  return deps.view?.get().scale ?? { x: 1, y: 1 };
}

/** Existing editable paths, world coords, with ink within `px` screen
 *  pixels of `(wx, wy)` — front-to-back, as the area query returns them.
 *  Empty when the host publishes no `areaSelect` or `editAnchors` dep. */
function pathsNear(
  deps: ActionDeps,
  wx: number,
  wy: number,
  px: number,
): Array<{ id: string; path: PolygonPath }> {
  const area = deps.areaSelect;
  const edit = deps.editAnchors;
  if (!area || !edit) return [];
  const view = deps.view;
  const e = pxExtent(px, viewScale(deps));
  const ids = area.hitTestArea({ x: wx - e.x, y: wy - e.y, width: 2 * e.x, height: 2 * e.y }, view);
  const out: Array<{ id: string; path: PolygonPath }> = [];
  for (const id of ids) {
    const path = edit.getEditablePath(id) as PolygonPath | null;
    if (path?.kind === 'polygon') out.push({ id, path });
  }
  return out;
}
