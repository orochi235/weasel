import { EASINGS, type EasingName } from './easings';
import type { EasingFn } from './types';

/** Cubic-bezier control points, CSS `cubic-bezier()` order. The curve's two
 *  endpoints are implicit at (0,0) and (1,1). */
export interface BezierEasing {
  /** `readonly` so an `as const` preset is assignable; nothing ever writes it. */
  bezier: readonly [number, number, number, number];
}

/** An easing curve as a value: a function, the name of a built-in, or control
 *  points. Anything an editor has to name, show or serialize must not be a bare
 *  function, which is why the union exists. */
export type EasingSpec = EasingFn | EasingName | BezierEasing;

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-3;
const SUBDIVISION_EPSILON = 1e-7;
const SUBDIVISION_MAX = 12;

function bezierAt(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function bezierSlope(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}

/** Solve for the bezier parameter that puts the curve at `x`. Newton-Raphson
 *  where the slope allows it, bisection where it does not — the standard
 *  approach, and the one browsers use for `cubic-bezier()`. */
function solveForX(x: number, x1: number, x2: number): number {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const slope = bezierSlope(t, x1, x2);
    if (slope < NEWTON_MIN_SLOPE) break;
    t -= (bezierAt(t, x1, x2) - x) / slope;
  }
  let lo = 0;
  let hi = 1;
  t = Math.min(1, Math.max(0, t));
  for (let i = 0; i < SUBDIVISION_MAX; i++) {
    const err = bezierAt(t, x1, x2) - x;
    if (Math.abs(err) < SUBDIVISION_EPSILON) return t;
    if (err > 0) hi = t; else lo = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/** Build the easing curve for four cubic-bezier control points. `x1`/`x2` are
 *  clamped to [0,1] — CSS `cubic-bezier()`'s constraint for a monotone x(t),
 *  which both `solveForX` root-finders assume. `y1`/`y2` are unclamped: an
 *  overshoot easing (back, elastic) needs them outside 0..1. */
export function cubicBezierEasing(
  x1: number, y1: number, x2: number, y2: number,
): EasingFn {
  const cx1 = Math.min(1, Math.max(0, x1));
  const cx2 = Math.min(1, Math.max(0, x2));
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return bezierAt(solveForX(t, cx1, cx2), y1, y2);
  };
}

/** Memoized so two equal specs resolve to one function, not a fresh solver per call. */
const bezierCache = new Map<string, EasingFn>();

function isBezier(spec: EasingSpec): spec is BezierEasing {
  return typeof spec === 'object' && spec !== null && 'bezier' in spec;
}

/** Resolve a spec to the function that shapes progress. `undefined` is linear. */
export function resolveEasing(spec?: EasingSpec): EasingFn {
  if (spec === undefined) return EASINGS.linear;
  if (typeof spec === 'function') return spec;
  if (typeof spec === 'string') {
    const fn = EASINGS[spec];
    if (!fn) throw new Error(`resolveEasing: unknown easing name "${spec}"`);
    return fn;
  }
  if (isBezier(spec)) {
    const [x1, y1, x2, y2] = spec.bezier;
    const key = `${x1},${y1},${x2},${y2}`;
    let fn = bezierCache.get(key);
    if (!fn) {
      fn = cubicBezierEasing(x1, y1, x2, y2);
      bezierCache.set(key, fn);
    }
    return fn;
  }
  throw new Error('resolveEasing: unrecognized easing spec');
}
