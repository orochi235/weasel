import { curve, penner, type LinearPoint } from '@msb235/blits';
import { getOwn } from '@weasel-js/registry';
import { EASINGS, type EasingFn, type EasingName } from './easings';
import { clamp } from './scalar';

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

/** A named curve as data: cubic-bezier control points, or CSS `linear()` points as blits'
 *  `LinearPoint`s, for a curve no single cubic fits. */
export type EasingData = BezierEasing | { readonly linear: readonly LinearPoint[] };

/** Memoized so two equal specs resolve to one function, not a fresh curve per call. */
const bezierCache = new Map<string, EasingFn>();
const BEZIER_CACHE_LIMIT = 256;

function isBezier(spec: EasingSpec): spec is BezierEasing {
  return typeof spec === 'object' && spec !== null && 'bezier' in spec;
}

/** Resolve a spec to the function that shapes progress. `undefined` is linear. A name resolves to blits'
 *  curve of that name; control points to blits' cubic-bezier, with `x1`/`x2` clamped to [0,1] as CSS
 *  requires and `y1`/`y2` left free, since an overshoot needs them outside 0..1. */
export function resolveEasing(spec?: EasingSpec): EasingFn {
  if (spec === undefined) return EASINGS.linear;
  if (typeof spec === 'function') return spec;
  if (typeof spec === 'string') {
    const fn = getOwn(EASINGS, spec);
    if (!fn) throw new Error(`resolveEasing: unknown easing name "${spec}"`);
    return fn;
  }
  if (isBezier(spec)) {
    const [x1, y1, x2, y2] = spec.bezier;
    const key = `${x1},${y1},${x2},${y2}`;
    let fn = bezierCache.get(key);
    if (!fn) {
      fn = curve({ bezier: [clamp(x1, 0, 1), y1, clamp(x2, 0, 1), y2] });
      // A handle being dragged resolves a new curve every pointer move.
      if (bezierCache.size >= BEZIER_CACHE_LIMIT) bezierCache.delete(bezierCache.keys().next().value!);
      bezierCache.set(key, fn);
    }
    return fn;
  }
  throw new Error('resolveEasing: unrecognized easing spec');
}

/** A spec's control points, for an editor's draggable handles; `null` for a spec that has none. */
export function easingBezier(spec?: EasingSpec): readonly [number, number, number, number] | null {
  return spec !== undefined && isBezier(spec) ? spec.bezier : null;
}

const LINEAR_DATA: EasingData = { bezier: [0, 0, 1, 1] };

/** The data a named curve is stored as in blits, for writing it out as CSS, SMIL or Lottie or converting it to
 *  control points: a cubic-bezier within 0.003 of Penner's function where one fits, otherwise `linear()` points
 *  within 0.001. `linear` is the straight bezier. */
export function easingDataOf(name: EasingName): EasingData {
  if (name === 'linear') return LINEAR_DATA;
  const data = getOwn(penner, name);
  if (!data) throw new Error(`easingDataOf: unknown easing name "${name}"`);
  return data;
}

/** What an editor shows for a spec.
 *
 *  A function is matched against the built-ins by reference so a consumer that
 *  passed `easeOutBack` directly still reads back as `'easeOutBack'`. A wrapped
 *  or hand-written function cannot be named and reads as `'custom'` — which is
 *  why an editor writes names and control points rather than functions. */
export function easingLabel(spec?: EasingSpec): string {
  if (spec === undefined) return 'linear';
  if (typeof spec === 'string') return spec;
  if (isBezier(spec)) return `cubic-bezier(${spec.bezier.join(', ')})`;
  for (const [name, fn] of Object.entries(EASINGS)) {
    if (fn === spec) return name;
  }
  return 'custom';
}

/** `count` evenly spaced samples of the curve over 0..1, for drawing it: the whole count below a fraction, and none
 *  for a negative or non-finite one. */
export function sampleEasing(spec: EasingSpec | undefined, count: number): number[] {
  const fn = resolveEasing(spec);
  count = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const out = new Array<number>(count);
  const last = count - 1;
  for (let i = 0; i < count; i++) out[i] = fn(last === 0 ? 0 : i / last);
  return out;
}

/** Every built-in name, for a picker's list. */
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];
