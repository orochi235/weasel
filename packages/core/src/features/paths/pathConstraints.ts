/**
 * A node's path constraints: kept as `data.constraints`, numbered by the
 * anchors of its editable polygon, and solved in the frame that polygon is
 * drawn in, so `horizontal` on a rotated `data.path` node turns with it.
 */
import {
  constrainPathEdit,
  pathAnchorPoints,
  solvePathConstraints,
  unsatisfiedConstraints,
  type PathConstraint,
  type PointOrigin,
  type PolygonPath,
} from '@weasel-js/geom';
import { classifyPathStorage, resolveEditablePathOf, type EditableShape } from './editablePath';

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
 * indices of those that do not hold in the path it answers. When they cannot
 * all hold the path is the node's own, unmoved.
 */
export function solveNodeConstraints(
  node: EditableShape | null | undefined,
  constraints: readonly PathConstraint[],
): { path: PolygonPath; unsatisfied: number[] } | null {
  const path = resolveEditablePathOf(node);
  if (!path) return null;
  const axisAngle = constraintAxisOf(node);
  const solved = solvePathConstraints(path, constraints, { axisAngle });
  if (solved.converged) return { path: solved.path, unsatisfied: [] };
  return { path, unsatisfied: unsatisfiedConstraints(pathAnchorPoints(path), constraints, { axisAngle }) };
}
