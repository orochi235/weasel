/**
 * Limited-memory BFGS directions (Nocedal, 1980): the last few steps and the
 * change in gradient each made, turned into a direction that bends the
 * preconditioned gradient by the curvature they saw.
 */

/** The most steps remembered. */
const DEPTH = 6;

/** The steps a descent has remembered, in a ring, and what it needs to remember the next. */
export interface StepMemory {
  steps: Float64Array[];
  turns: Float64Array[];
  rho: Float64Array;
  /** How many are held, and where the newest is. */
  count: number;
  newest: number;
  /** The gradient where the last step started, and that step; null after a reset. */
  lastGrad: Float64Array | null;
  lastStep: Float64Array | null;
}

export function stepMemory(): StepMemory {
  return { steps: [], turns: [], rho: new Float64Array(DEPTH), count: 0, newest: -1, lastGrad: null, lastStep: null };
}

export function forget(m: StepMemory): void {
  m.count = 0; m.newest = -1;
  m.lastGrad = null; m.lastStep = null;
}

export function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Fold in the step that ended where gradient `g` was read; a step that saw no positive curvature is dropped. */
function remember(m: StepMemory, g: Float64Array): void {
  const { lastGrad, lastStep } = m;
  if (!lastGrad || !lastStep) return;
  const slot = (m.newest + 1) % DEPTH;
  if (m.steps.length <= slot || m.steps[slot].length !== g.length) {
    m.steps[slot] = new Float64Array(g.length);
    m.turns[slot] = new Float64Array(g.length);
  }
  const s = m.steps[slot], y = m.turns[slot];
  let sy = 0;
  for (let i = 0; i < g.length; i++) {
    s[i] = lastStep[i];
    y[i] = g[i] - lastGrad[i];
    sy += y[i] * s[i];
  }
  if (!(sy > 1e-12)) return;
  m.rho[slot] = 1 / sy;
  m.newest = slot;
  m.count = Math.min(DEPTH, m.count + 1);
}

/**
 * The descent direction at gradient `g`: `precondition` (an approximate
 * inverse Hessian, applied to a copy it may keep) carried through the
 * remembered steps by the two-loop recursion. Folds the step that led here in
 * first.
 */
export function descent(m: StepMemory, g: Float64Array, precondition: (q: Float64Array) => Float64Array): Float64Array {
  remember(m, g);
  const q = Float64Array.from(g);
  const n = q.length;
  const alpha = new Float64Array(m.count);
  for (let k = 0; k < m.count; k++) {
    const slot = (m.newest - k + DEPTH) % DEPTH;
    const s = m.steps[slot], y = m.turns[slot];
    const a = (alpha[k] = m.rho[slot] * dot(s, q));
    for (let j = 0; j < n; j++) q[j] -= a * y[j];
  }
  const r = precondition(q);
  for (let k = m.count - 1; k >= 0; k--) {
    const slot = (m.newest - k + DEPTH) % DEPTH;
    const s = m.steps[slot], y = m.turns[slot];
    const c = alpha[k] - m.rho[slot] * dot(y, r);
    for (let j = 0; j < n; j++) r[j] += c * s[j];
  }
  for (let j = 0; j < n; j++) r[j] = -r[j];
  return r;
}
