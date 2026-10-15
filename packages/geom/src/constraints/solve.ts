/**
 * A damped Gauss-Newton solve for anchor constraints: from the state an edit
 * left, the smallest weighted move of the anchors that makes every residual
 * zero. Each step is the minimum-norm solution of the linearized system,
 * `Δ = -M Jᵀ (J M Jᵀ + λI)⁻¹ r`, where `M` weighs how freely each anchor may
 * move; λ grows when a step makes things worse and shrinks when it helps,
 * which is the Levenberg-Marquardt schedule run on the constraint side.
 */

import { solveDense } from './linear';
import { frameAt, residualRows, writeResiduals, type ConstraintFrame } from './residuals';
import { constraintAnchors, constraintFits, type PathConstraint } from './types';

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
  /** Coordinates the constraint reads that may move. */
  vars: number[];
}

interface System {
  rows: Row[];
  m: number;
  n: number;
  mobility: Float64Array;
  frame: ConstraintFrame;
}

function residualsOf(sys: System, x: Float64Array): Float64Array {
  const r = new Float64Array(sys.m);
  for (const row of sys.rows) writeResiduals(row.c, x, sys.frame, r, row.at);
  return r;
}

/** Central differences, one constraint at a time over only the coordinates it reads. */
function jacobianOf(sys: System, x: Float64Array): Float64Array {
  const j = new Float64Array(sys.m * sys.n);
  const plus = new Float64Array(2);
  const minus = new Float64Array(2);
  for (const row of sys.rows) {
    const rows = residualRows(row.c);
    for (const v of row.vars) {
      const h = 1e-6 * (1 + Math.abs(x[v]));
      const keep = x[v];
      x[v] = keep + h;
      writeResiduals(row.c, x, sys.frame, plus, 0);
      x[v] = keep - h;
      writeResiduals(row.c, x, sys.frame, minus, 0);
      x[v] = keep;
      for (let k = 0; k < rows; k++) j[(row.at + k) * sys.n + v] = (plus[k] - minus[k]) / (2 * h);
    }
  }
  return j;
}

/** The damped minimum-norm step for residuals `r` and Jacobian `j`, or null when it cannot be taken. */
function stepOf(sys: System, j: Float64Array, r: Float64Array, lambda: number): Float64Array | null {
  const { m, n, mobility } = sys;
  const a = new Float64Array(m * m);
  for (let p = 0; p < m; p++) {
    for (let q = p; q < m; q++) {
      let s = 0;
      for (let v = 0; v < n; v++) s += j[p * n + v] * mobility[v] * j[q * n + v];
      a[p * m + q] = s;
      a[q * m + p] = s;
    }
    a[p * m + p] += lambda;
  }
  const y = solveDense(a, Float64Array.from(r), m);
  if (!y) return null;
  const delta = new Float64Array(n);
  for (let v = 0; v < n; v++) {
    if (mobility[v] === 0) continue;
    let s = 0;
    for (let p = 0; p < m; p++) s += j[p * n + v] * y[p];
    delta[v] = -mobility[v] * s;
  }
  return delta;
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
  let m = 0;
  for (const c of active) {
    const height = residualRows(c);
    if (height === 0) continue;
    const vars = [...new Set(constraintAnchors(c).flatMap((i) => [2 * i, 2 * i + 1]))]
      .filter((v) => mobility[v] > 0);
    rows.push({ c, at: m, vars });
    m += height;
  }
  return { rows, m, n: 2 * count, mobility, frame: frameAt(opts.axisAngle), pinned };
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
    const j = jacobianOf(sys, x);
    const before = sumSq(r);
    for (; lambda < 1e12; lambda *= 10) {
      const delta = stepOf(sys, j, r, lambda);
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
  const unsatisfied = unsatisfiedConstraints(out, constraints, { axisAngle: opts.axisAngle, reference: opts.reference });
  const skipped = new Set(opts.skip ?? []);
  return {
    points: out,
    converged: maxAbs(r) <= Math.max(tolerance, CONSTRAINT_TOLERANCE) && unsatisfied.every((i) => skipped.has(i)),
    iterations,
    unsatisfied,
  };
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
