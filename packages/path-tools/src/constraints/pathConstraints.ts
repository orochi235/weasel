/**
 * A node's path constraints: kept as `data.constraints`, numbered by the
 * anchors of its editable polygon, and solved in the frame that polygon is
 * drawn in, so `horizontal` on a rotated `data.path` node turns with it.
 */
import {
  conflictingConstraints,
  constrainPathEdit,
  pathAnchorPoints,
  solvePathConstraints,
  unsatisfiedConstraints,
  type PathConstraint,
  type PointOrigin,
  type PolygonPath,
} from '@weasel-js/geom';
import { classifyPathStorage, resolveEditablePathOf, type EditableShape } from '@weasel-js/core';

const NONE: readonly PathConstraint[] = [];

/** The constraints a node's data holds, or none. */
export function constraintsOf(data: unknown): readonly PathConstraint[] {
  const list = (data as { constraints?: unknown } | null | undefined)?.constraints;
  return Array.isArray(list) ? (list as PathConstraint[]) : NONE;
}

/** Radians the frame `horizontal` and `vertical` read is turned from the world's: a `data.path` node's rotation. */
export function constraintAxisOf(node: EditableShape | null | undefined): number {
  const storage = classifyPathStorage(node);
  return storage?.kind === 'data' ? (storage.pose as { rotation?: number }).rotation ?? 0 : 0;
}

/**
 * Indices of `constraints` in conflict over `path`'s anchors: those that do
 * not hold, and with them every member of a smallest set that cannot all hold
 * together (`conflictingConstraints`). Sorted.
 */
export function conflictsIn(path: PolygonPath, constraints: readonly PathConstraint[], axisAngle: number): number[] {
  const points = pathAnchorPoints(path);
  const failing = unsatisfiedConstraints(points, constraints, { axisAngle });
  if (failing.length === 0) return [];
  const set = new Set([...failing, ...conflictingConstraints(points, constraints, { axisAngle })]);
  return [...set].sort((a, b) => a - b);
}

/**
 * Indices of `node`'s constraints that do not hold in its committed path, and
 * the others each conflict needs: every member of a smallest set that cannot
 * all hold. Edits leave the ones that do not hold out of the solve, and so
 * does a whole-shape transform — resize, rotate, flip — which carries the
 * list unchanged: a constraint the transform breaks, such as a set length
 * under a scale or an equal length under a non-uniform one, is reported here
 * rather than solved back.
 */
export function constraintConflictsOf(node: EditableShape | null | undefined): number[] {
  const constraints = constraintsOf(node?.data);
  const path = constraints.length > 0 ? resolveEditablePathOf(node) : null;
  if (!path) return [];
  return conflictsIn(path, constraints, constraintAxisOf(node));
}

/** What an edit of a constrained node commits: its path, and its constraints renumbered for it. */
export interface ConstrainedNodeEdit {
  path: PolygonPath;
  constraints: readonly PathConstraint[];
}

/**
 * `worldPath`, an edit of `node`'s committed path, finished so the node's
 * constraints hold. Null when they cannot. A node with no constraints gets
 * `worldPath` back as it is.
 */
export function constrainNodeEdit(
  node: EditableShape | null | undefined,
  worldPath: PolygonPath,
  origins?: readonly (PointOrigin | null)[],
): ConstrainedNodeEdit | null {
  const constraints = constraintsOf(node?.data);
  const before = constraints.length > 0 ? resolveEditablePathOf(node) : null;
  if (!before) return { path: worldPath, constraints };
  const edit = constrainPathEdit(before, worldPath, constraints, { origins, axisAngle: constraintAxisOf(node) });
  if (!edit.converged) return null;
  const same = edit.constraints.length === constraints.length
    && edit.constraints.every((c, i) => JSON.stringify(c) === JSON.stringify(constraints[i]));
  return { path: edit.path, constraints: same ? constraints : edit.constraints };
}

/**
 * `node`'s path moved the least that makes `constraints` hold, and the
 * indices of those in conflict in the path it answers, as
 * {@link conflictsIn} reads them. When they cannot all hold the path is the
 * node's own, unmoved.
 */
export function solveNodeConstraints(
  node: EditableShape | null | undefined,
  constraints: readonly PathConstraint[],
): { path: PolygonPath; conflicts: number[] } | null {
  const path = resolveEditablePathOf(node);
  if (!path) return null;
  const axisAngle = constraintAxisOf(node);
  const solved = solvePathConstraints(path, constraints, { axisAngle });
  if (solved.converged) return { path: solved.path, conflicts: [] };
  return { path, conflicts: conflictsIn(path, constraints, axisAngle) };
}
