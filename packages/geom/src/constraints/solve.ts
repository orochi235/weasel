/**
 * A damped Gauss-Newton solve for anchor constraints: from the state an edit
 * left, the smallest weighted move of the anchors and handles that makes
 * every residual zero. Each step is the minimum-norm solution of the
 * linearized system, `Δ = -M Jᵀ (J M Jᵀ + λI)⁻¹ r`, where `M` weighs how
 * freely each coordinate may move; λ grows when a step makes things worse and
 * shrinks when it helps, which is the Levenberg-Marquardt schedule run on the
 * constraint side.
 *
 * A handle is a coordinate of its own only where a `tangent` reads it; any
 * other rides with its anchor, as an offset nothing changes.
 */

import { CONSTRAINT_TOLERANCE, collapsedBy, unsatisfiedConstraints } from './check';
import { constraintApplies, pack, unpack, type ConstraintPoint, type HandleRef } from './points';
import { frameAt, handleAt, residualRows, spaceSize, writeResiduals, type ResidualSpace } from './residuals';
import { NormalSystem } from './sparse';
import { constraintAnchors, type PathConstraint } from './types';

/** How freely a held anchor moves, against 1 for any other: it gives way only when nothing else can. */
const HELD_MOBILITY = 1e-3;

/** Options for {@link solveConstraints}. */
export interface SolveConstraintsOptions {
  /** Anchors the edit put where they are — the dragged ones. They move only when no other anchor can satisfy the constraints. */
  held?: Iterable<number>;
  /** Handles the edit put where they are, held the way `held` holds anchors. */
  heldHandles?: Iterable<HandleRef>;
  /** Where each anchor was before the edit, which is where a `fixed` constraint keeps it. Default: where it is now. */
  reference?: readonly (ConstraintPoint | undefined)[];
  /** Radians the frame `horizontal` and `vertical` read is turned from the world's axes. Default 0. */
  axisAngle?: number;
  /** Indices of constraints to leave out of the solve — ones already known not to hold. */
  skip?: Iterable<number>;
  /** Default 100. */
  maxIterations?: number;
  /** The largest residual the solve stops at. Default 1e-7. */
  tolerance?: number;
}

/** What {@link solveConstraints} answers. */
export interface SolveConstraintsResult {
  /** Every anchor, moved, with its handles. */
  points: ConstraintPoint[];
  /** Whether every constraint the solve took holds within its tolerance. */
  converged: boolean;
  iterations: number;
  /** Indices of the constraints that do not hold in `points`, skipped ones included. */
  unsatisfied: number[];
}

interface Row {
  c: PathConstraint;
  /** First residual row. */
  at: number;
}

interface System {
  rows: Row[];
  m: number;
  space: ResidualSpace;
  normal: NormalSystem;
  pinned: Set<number>;
}

function residualsOf(sys: System, x: Float64Array): Float64Array {
  const r = new Float64Array(sys.m);
  for (const row of sys.rows) writeResiduals(row.c, x, sys.space, r, row.at);
  return r;
}

/** Load the analytic Jacobian at `x` into the normal system. */
function loadJacobian(sys: System, x: Float64Array): void {
  const { normal, space } = sys;
  normal.clear();
  const scratch = new Float64Array(2);
  for (const row of sys.rows) {
    writeResiduals(row.c, x, space, scratch, 0, (k, v, d) => normal.add(row.at + k, v, d));
  }
}

/** The damped minimum-norm step for residuals `r` at the loaded Jacobian, or null when it cannot be taken. */
function stepOf(sys: System, r: Float64Array, lambda: number): Float64Array | null {
  const y = sys.normal.solve(r, lambda);
  return y && sys.normal.step(y);
}

const sumSq = (r: Float64Array) => r.reduce((s, v) => s + v * v, 0);
const maxAbs = (r: Float64Array) => r.reduce((s, v) => Math.max(s, Math.abs(v)), 0);

/** The coordinates `c` reads. */
function coordinatesOf(c: PathConstraint, count: number): number[] {
  if (c.kind === 'tangent') {
    const h = handleAt(count, c.anchor);
    return [h, h + 1, h + 2, h + 3];
  }
  return constraintAnchors(c).flatMap((i) => [2 * i, 2 * i + 1]);
}

/** How freely each coordinate moves: anchors and the handles a tangent reads, the held ones at `heldMobility`, pinned ones not at all. */
function mobilityOf(
  points: readonly ConstraintPoint[],
  active: readonly PathConstraint[],
  opts: SolveConstraintsOptions,
  heldMobility: number,
  pinned: ReadonlySet<number>,
): Float64Array {
  const count = points.length;
  const mobility = new Float64Array(spaceSize(count));
  mobility.fill(1, 0, 2 * count);
  for (const i of opts.held ?? []) {
    if (i >= 0 && i < count) mobility.fill(heldMobility, 2 * i, 2 * i + 2);
  }
  for (const i of pinned) mobility.fill(0, 2 * i, 2 * i + 2);
  for (const c of active) {
    if (c.kind === 'tangent') mobility.fill(1, handleAt(count, c.anchor), handleAt(count, c.anchor) + 4);
  }
  for (const { anchor, side } of opts.heldHandles ?? []) {
    if (anchor < 0 || anchor >= count) continue;
    const h = handleAt(count, anchor) + (side === 'out' ? 2 : 0);
    if (mobility[h] > 0) mobility.fill(heldMobility, h, h + 2);
  }
  return mobility;
}

function buildSystem(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions,
  heldMobility: number,
): System {
  const count = points.length;
  const skip = new Set(opts.skip ?? []);
  const active = constraints.filter((c, i) => !skip.has(i) && constraintApplies(c, points));
  const pinned = new Set(active.flatMap((c) => (c.kind === 'fixed' ? [c.anchor] : [])));
  const mobility = mobilityOf(points, active, opts, heldMobility, pinned);
  const rows: Row[] = [];
  const rowCols: Int32Array[] = [];
  for (const c of active) {
    const height = residualRows(c);
    if (height === 0) continue;
    rows.push({ c, at: rowCols.length });
    const vars = Int32Array.from(coordinatesOf(c, count));
    for (let k = 0; k < height; k++) rowCols.push(vars);
  }
  const normal = new NormalSystem(rowCols, mobility);
  return { rows, m: rowCols.length, space: { frame: frameAt(opts.axisAngle), count }, normal, pinned };
}

/**
 * Move `points` the least that makes `constraints` hold. Anchors named by a
 * `fixed` constraint go back to `reference` and stay there; `held` anchors
 * and `heldHandles` stay where they are when the rest can satisfy the
 * constraints, and give way as little as they must when not. When the
 * constraints cannot all hold, `converged` is false and `unsatisfied` names
 * the ones that do not.
 */
export function solveConstraints(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions = {},
): SolveConstraintsResult {
  const held = [...(opts.held ?? [])];
  const heldHandles = [...(opts.heldHandles ?? [])];
  const withHeld = { ...opts, held, heldHandles };
  if (held.length > 0 || heldHandles.length > 0) {
    const still = solveWith(points, constraints, withHeld, 0);
    if (still.converged) return still;
  }
  return solveWith(points, constraints, withHeld, HELD_MOBILITY);
}

function solveWith(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions,
  heldMobility: number,
): SolveConstraintsResult {
  const { maxIterations = 100, tolerance = 1e-7 } = opts;
  const sys = buildSystem(points, constraints, opts, heldMobility);
  const x = pack(points, (i) => (sys.pinned.has(i) ? opts.reference?.[i] ?? points[i] : points[i]));

  let r = residualsOf(sys, x);
  let lambda = 1e-6;
  let iterations = 0;
  while (maxAbs(r) > tolerance && iterations < maxIterations && lambda < 1e12) {
    iterations++;
    loadJacobian(sys, x);
    const before = sumSq(r);
    for (; lambda < 1e12; lambda *= 10) {
      const delta = stepOf(sys, r, lambda);
      if (!delta) continue;
      const next = x.map((v, i) => v + delta[i]);
      const rn = residualsOf(sys, next);
      if (sumSq(rn) < before) {
        x.set(next);
        r = rn;
        lambda = Math.max(lambda / 3, 1e-12);
        break;
      }
    }
  }

  const out = unpack(x, points);
  const skipped = new Set(opts.skip ?? []);
  const collapsed = collapsedBy(points, out, constraints, skipped);
  const unsatisfied = [...new Set([
    ...unsatisfiedConstraints(out, constraints, { axisAngle: opts.axisAngle, reference: opts.reference }),
    ...collapsed,
  ])].sort((a, b) => a - b);
  return {
    points: out,
    converged: maxAbs(r) <= Math.max(tolerance, CONSTRAINT_TOLERANCE) && unsatisfied.every((i) => skipped.has(i)),
    iterations,
    unsatisfied,
  };
}
