/**
 * Path constraints in path edit: their marks on the open path, a click
 * selecting one, Delete removing it, and every edit finished so they hold.
 */
import { pathAnchorPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import type { EditAnchorsDep, PathEditExtension, PathEditTarget } from '@weasel-js/core';
import { constraintGlyphs, constraintMarkAt, type ConstraintGlyphStyle } from './constraintGlyphs';
import { conflictsIn, constrainNodeEdit, constraintAxisOf, constraintsOf, solveNodeConstraints } from './pathConstraints';

/** Owner id of the constraint marks, as `EditAnchorsDep.selectedMark` names them. */
export const CONSTRAINTS_EXTENSION_ID = 'constraints';

/** Screen-pixel radius for "this click landed on a constraint mark". */
const MARK_CLICK_PX = 8;

const DEFAULT_STYLE: ConstraintGlyphStyle = { stroke: '#0e9f8e', conflictStroke: '#e5484d' };

/** The edited node's world-space polygon, or null when it has none. */
export function editedPath(dep: EditAnchorsDep): PolygonPath | null {
  const p = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return p?.kind === 'polygon' ? p : null;
}

/**
 * Replace the open path's constraints with `constraints` as one history
 * entry, moving it the least that makes them all hold. When they cannot all
 * hold the path stays as it is and the list is stored all the same, the
 * conflict left for the marks to show. Clears the selected mark, since the
 * list is renumbered. Answers the indices in conflict, as
 * `constraintConflictsOf` names them — empty when every one holds — or null
 * when the dep cannot store.
 */
export function setConstraints(dep: EditAnchorsDep, constraints: readonly PathConstraint[], label: string): number[] | null {
  const node = dep.getNodeShape(dep.editingId);
  const solved = node && dep.store ? solveNodeConstraints(node, constraints) : null;
  if (!solved) return null;
  dep.setSelectedMark?.(null);
  dep.store!(dep.editingId, solved.path, label, { constraints: [...constraints] });
  return solved.conflicts;
}

/** The last answer per constraint list, so a frame that repaints an unchanged path asks for none. */
const conflictCache = new WeakMap<readonly PathConstraint[], { key: string; conflicts: ReadonlySet<number> }>();

/** {@link conflictsIn} for `path`, answered from the cache when the list and its anchors are as last asked. */
function conflictsOf(path: PolygonPath, constraints: readonly PathConstraint[], axisAngle: number): ReadonlySet<number> {
  const key = `${axisAngle};${Array.from(path.commands).join(',')};${Array.from(path.coords).join(',')}`;
  const hit = conflictCache.get(constraints);
  if (hit?.key === key) return hit.conflicts;
  const conflicts = new Set(conflictsIn(path, constraints, axisAngle));
  conflictCache.set(constraints, { key, conflicts });
  return conflicts;
}

/** The constraint selected in path edit, as an index into the open path's list, or null. */
export function selectedConstraintOf(dep: EditAnchorsDep): number | null {
  const mark = dep.selectedMark;
  return mark?.owner === CONSTRAINTS_EXTENSION_ID ? mark.index : null;
}

const screenPoints = (target: PathEditTarget, toScreen: (p: { x: number; y: number }) => { x: number; y: number }) =>
  pathAnchorPoints(target.path).map(toScreen);

/** The constraints extension, its marks drawn in `style`'s colors. */
export function createConstraintsExtension(style: Partial<ConstraintGlyphStyle> = {}): PathEditExtension {
  const colors = { ...DEFAULT_STYLE, ...style };
  return {
    id: CONSTRAINTS_EXTENSION_ID,
    marks(ctx) {
      const constraints = constraintsOf(ctx.node.data);
      if (constraints.length === 0) return [];
      const world = pathAnchorPoints(ctx.path);
      const conflicts = conflictsOf(ctx.path, constraints, constraintAxisOf(ctx.node));
      return constraintGlyphs(world.map(ctx.toScreen), constraints, conflicts, colors, ctx.selected);
    },
    markAt(target, toScreen, screen) {
      const constraints = constraintsOf(target.node.data);
      if (constraints.length === 0) return -1;
      return constraintMarkAt(screenPoints(target, toScreen), constraints, screen, MARK_CLICK_PX);
    },
    deleteMark(target, index, store) {
      const current = constraintsOf(target.node.data);
      if (index >= current.length) return;
      const kept = current.filter((_, i) => i !== index);
      const solved = solveNodeConstraints(target.node, kept);
      if (solved) store(target.id, solved.path, 'Delete constraint', { constraints: kept });
    },
    finishEdit(node, worldPath, origins) {
      const done = constrainNodeEdit(node, worldPath, origins);
      if (!done) return null;
      return done.constraints === constraintsOf(node.data)
        ? { path: done.path }
        : { path: done.path, data: { constraints: done.constraints } };
    },
  };
}
