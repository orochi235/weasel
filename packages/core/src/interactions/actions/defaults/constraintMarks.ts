/** Finding the constraint mark a click in path edit landed on. */

import type { ActionDeps } from '@weasel-js/routing';
import { pathAnchorPoints, type PolygonPath } from '@weasel-js/geom';
import { constraintMarkAt } from 'features/paths/constraintGlyphs';
import { constraintsOf } from 'features/paths/pathConstraints';
import type { EditAnchorsDep } from '../depSchema';

/** Screen-pixel radius for "this click landed on a constraint mark". */
const MARK_CLICK_PX = 8;

/** The edited node's world-space polygon, or null when it has none. */
export function editedPath(dep: EditAnchorsDep): PolygonPath | null {
  const p = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return p?.kind === 'polygon' ? p : null;
}

/**
 * The index of the edited node's constraint whose mark is under the world
 * point `(wx, wy)`, or -1. The marks are laid out in screen pixels, so the
 * anchors go through the view first.
 */
export function constraintMarkUnder(dep: EditAnchorsDep, deps: ActionDeps | undefined, wx: number, wy: number): number {
  const constraints = constraintsOf(dep.getNodeShape(dep.editingId)?.data);
  const path = constraints.length > 0 ? editedPath(dep) : null;
  if (!path) return -1;
  const view = deps?.view?.get() ?? { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const toScreen = (p: { x: number; y: number }) => ({ x: (p.x - view.x) * view.scale.x, y: (p.y - view.y) * view.scale.y });
  return constraintMarkAt(pathAnchorPoints(path).map(toScreen), constraints, toScreen({ x: wx, y: wy }), MARK_CLICK_PX);
}
