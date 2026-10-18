/**
 * A damped Gauss-Newton solve for anchor constraints: from the state an edit
 * left, the smallest weighted move of the anchors that makes every residual
 * zero. Each step is the minimum-norm solution of the linearized system,
 * `Δ = -M Jᵀ (J M Jᵀ + λI)⁻¹ r`, where `M` weighs how freely each anchor may
 * move; λ grows when a step makes things worse and shrinks when it helps,
 * which is the Levenberg-Marquardt schedule run on the constraint side.
 */

import { frameAt, residualRows, writeResiduals, type ConstraintFrame } from './residuals';
import { NormalSystem } from './sparse';
import { constraintAnchors, constraintFits, type AnchorPair, type PathConstraint } from './types';

/** A point the solver reads and writes. */
export interface ConstraintPoint {
  x: number;
  y: number;
}

/** The residual, in the path's units, under which a constraint counts as holding. */
export const CONSTRAINT_TOLERANCE = 1e-3;

/** How freely a held anchor moves, against 1 for any other: it gives way only when nothing else can. */
const HELD_MOBILITY = 1e-3;

/** Options for {@link solveConstraints}. */
export interface SolveConstraintsOptions {
  /** Anchors the edit put where they are — the dragged ones. They move only when no other anchor can satisfy the constraints. */
  held?: Iterable<number>;
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
  /** Every anchor, moved. */
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
  n: number;
  frame: ConstraintFrame;
  normal: NormalSystem;
}

function residualsOf(sys: System, x: Float64Array): Float64Array {
  const r = new Float64Array(sys.m);
  for (const row of sys.rows) writeResiduals(row.c, x, sys.frame, r, row.at);
  return r;
}

/** Load the analytic Jacobian at `x` into the normal system. */
function loadJacobian(sys: System, x: Float64Array): void {
  const { normal, frame } = sys;
  normal.clear();
  const scratch = new Float64Array(2);
  for (const row of sys.rows) {
    writeResiduals(row.c, x, frame, scratch, 0, (k, v, d) => normal.add(row.at + k, v, d));
  }
}

/** The damped minimum-norm step for residuals `r` at the loaded Jacobian, or null when it cannot be taken. */
function stepOf(sys: System, r: Float64Array, lambda: number): Float64Array | null {
  const y = sys.normal.solve(r, lambda);
  return y && sys.normal.step(y);
}

const sumSq = (r: Float64Array) => r.reduce((s, v) => s + v * v, 0);
const maxAbs = (r: Float64Array) => r.reduce((s, v) => Math.max(s, Math.abs(v)), 0);

function buildSystem(
  count: number,
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions,
  heldMobility: number,
): System & { pinned: Set<number> } {
  const skip = new Set(opts.skip ?? []);
  const active = constraints.filter((c, i) => !skip.has(i) && constraintFits(c, count));
  const pinned = new Set(active.flatMap((c) => (c.kind === 'fixed' ? [c.anchor] : [])));
  const mobility = new Float64Array(2 * count).fill(1);
  for (const i of opts.held ?? []) {
    if (i >= 0 && i < count) mobility.fill(heldMobility, 2 * i, 2 * i + 2);
  }
  for (const i of pinned) mobility.fill(0, 2 * i, 2 * i + 2);
  const rows: Row[] = [];
  const rowCols: Int32Array[] = [];
  for (const c of active) {
    const height = residualRows(c);
    if (height === 0) continue;
    rows.push({ c, at: rowCols.length });
    const vars = Int32Array.from(constraintAnchors(c).flatMap((i) => [2 * i, 2 * i + 1]));
    for (let k = 0; k < height; k++) rowCols.push(vars);
  }
  const normal = new NormalSystem(rowCols, mobility);
  return { rows, m: rowCols.length, n: 2 * count, frame: frameAt(opts.axisAngle), normal, pinned };
}

/**
 * Move `points` the least that makes `constraints` hold. Anchors named by a
 * `fixed` constraint go back to `reference` and stay there; `held` anchors
 * stay where they are when the rest can satisfy the constraints, and give way
 * as little as they must when not. When the constraints cannot all hold,
 * `converged` is false and `unsatisfied` names the ones that do not.
 */
export function solveConstraints(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: SolveConstraintsOptions = {},
): SolveConstraintsResult {
  const held = [...(opts.held ?? [])];
  const withHeld = { ...opts, held };
  if (held.length > 0) {
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
  const sys = buildSystem(points.length, constraints, opts, heldMobility);
  const x = new Float64Array(sys.n);
  points.forEach((p, i) => {
    const at = sys.pinned.has(i) ? opts.reference?.[i] ?? p : p;
    x[2 * i] = at.x;
    x[2 * i + 1] = at.y;
  });

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

  const out = points.map((_, i) => ({ x: x[2 * i], y: x[2 * i + 1] }));
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

/** The anchor pairs `c` measures as segments. */
function segmentsOf(c: PathConstraint): AnchorPair[] {
  switch (c.kind) {
    case 'fixed':
    case 'coincident': return [];
    case 'horizontal':
    case 'vertical':
    case 'length': return [c.segment];
    default: return [...c.segments];
  }
}

/**
 * Constraints the solve satisfied only by shrinking a segment they name to a
 * point — horizontal and vertical on one segment both hold once its ends meet.
 * That is a conflict, not a solution. A pair a constraint means to join, by
 * `coincident` or a zero `length`, is exempt.
 */
function collapsedBy(
  from: readonly ConstraintPoint[],
  to: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  skipped: ReadonlySet<number>,
): number[] {
  const key = ([a, b]: AnchorPair) => (a < b ? `${a},${b}` : `${b},${a}`);
  const joined = new Set(constraints.flatMap((c) =>
    c.kind === 'coincident' ? [key(c.anchors)]
      : c.kind === 'length' && c.length <= CONSTRAINT_TOLERANCE ? [key(c.segment)] : []));
  const len = (p: readonly ConstraintPoint[], [a, b]: AnchorPair) => Math.hypot(p[b].x - p[a].x, p[b].y - p[a].y);
  const out: number[] = [];
  constraints.forEach((c, i) => {
    if (skipped.has(i) || !constraintFits(c, from.length)) return;
    const shrunk = segmentsOf(c).some((s) =>
      !joined.has(key(s)) && len(from, s) > 10 * CONSTRAINT_TOLERANCE && len(to, s) <= CONSTRAINT_TOLERANCE);
    if (shrunk) out.push(i);
  });
  return out;
}

/** Options for {@link unsatisfiedConstraints}. */
export interface UnsatisfiedConstraintsOptions {
  axisAngle?: number;
  /** Where a `fixed` anchor belongs. Absent, a `fixed` constraint always holds. */
  reference?: readonly (ConstraintPoint | undefined)[];
  /** Default {@link CONSTRAINT_TOLERANCE}. */
  tolerance?: number;
}

/**
 * Indices of the constraints that do not hold for `points`: a residual past
 * the tolerance, or an anchor index the points do not have.
 */
export function unsatisfiedConstraints(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: UnsatisfiedConstraintsOptions = {},
): number[] {
  const { tolerance = CONSTRAINT_TOLERANCE, reference } = opts;
  const frame = frameAt(opts.axisAngle);
  const x = new Float64Array(2 * points.length);
  points.forEach((p, i) => {
    x[2 * i] = p.x;
    x[2 * i + 1] = p.y;
  });
  const r = new Float64Array(2);
  const out: number[] = [];
  constraints.forEach((c, i) => {
    if (!constraintFits(c, points.length)) {
      out.push(i);
      return;
    }
    if (c.kind === 'fixed') {
      const at = reference?.[c.anchor];
      const p = points[c.anchor];
      if (at && Math.hypot(at.x - p.x, at.y - p.y) > tolerance) out.push(i);
      return;
    }
    writeResiduals(c, x, frame, r, 0);
    for (let k = 0; k < residualRows(c); k++) {
      if (Math.abs(r[k]) > tolerance) {
        out.push(i);
        return;
      }
    }
  });
  return out;
}
