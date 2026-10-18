/**
 * Which constraints conflict: not merely the ones a failed solve leaves
 * unsatisfied, but a smallest set that cannot all hold together, found by a
 * deletion filter — drop each member in turn, and keep it out when what is
 * left still fails. Every member of the answer is needed for the conflict.
 */

import { constraintApplies, type ConstraintPoint } from './points';
import { solveConstraints } from './solve';
import { constraintAnchors, type PathConstraint } from './types';

/** Options for {@link conflictingConstraints}. */
export interface ConflictingConstraintsOptions {
  /** Radians the frame `horizontal` and `vertical` read is turned from the world's axes. Default 0. */
  axisAngle?: number;
  /** Where each anchor belongs for a `fixed` constraint. Default: where it is now. */
  reference?: readonly (ConstraintPoint | undefined)[];
}

/** Constraints sharing an anchor, directly or through others, as lists of indices into `constraints`. */
function componentsOf(constraints: readonly PathConstraint[], indices: readonly number[]): number[][] {
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  for (const i of indices) {
    const [first, ...rest] = constraintAnchors(constraints[i]);
    for (const a of rest) parent.set(find(a), find(first));
  }
  const groups = new Map<number, number[]>();
  for (const i of indices) {
    const root = find(constraintAnchors(constraints[i])[0]);
    let g = groups.get(root);
    if (!g) groups.set(root, (g = []));
    g.push(i);
  }
  return [...groups.values()];
}

/**
 * The constraints of `constraints` that conflict over `points`: for every
 * group of them sharing anchors that cannot all hold, a smallest subset that
 * still cannot — each member needed, the later ones in the list kept in
 * preference to the earlier — and every constraint that cannot apply at all.
 * Sorted; empty when every constraint can hold at once.
 */
export function conflictingConstraints(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: ConflictingConstraintsOptions = {},
): number[] {
  const all = constraints.map((_, i) => i);
  const applies = all.filter((i) => constraintApplies(constraints[i], points));
  const out = all.filter((i) => !applies.includes(i));
  const holds = (subset: readonly number[]) => {
    const keep = new Set(subset);
    const skip = all.filter((i) => !keep.has(i));
    return solveConstraints(points, constraints, { ...opts, skip }).converged;
  };
  if (holds(applies)) return out;
  for (const group of componentsOf(constraints, applies)) {
    if (holds(group)) continue;
    const set = [...group];
    for (const i of group) {
      const without = set.filter((j) => j !== i);
      if (!holds(without)) set.splice(set.indexOf(i), 1);
    }
    out.push(...set);
  }
  return out.sort((a, b) => a - b);
}
