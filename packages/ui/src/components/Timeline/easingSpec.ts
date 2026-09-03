import { EASINGS, resolveEasing, type EasingName, type EasingSpec } from '@weasel-js/core';

function bezierOf(spec: EasingSpec): readonly [number, number, number, number] | null {
  if (typeof spec === 'object' && spec !== null && 'bezier' in spec) return spec.bezier;
  return null;
}

/** Control points, for the graph view's draggable handles. `null` means this
 *  spec has no handles to drag — the view offers to convert it to a bezier. */
export function easingBezier(spec?: EasingSpec): readonly [number, number, number, number] | null {
  if (spec === undefined) return null;
  return bezierOf(spec);
}

/** What the picker shows for a spec.
 *
 *  A function is matched against the built-ins by reference so a consumer that
 *  passed `easeOutBack` directly still reads back as `'easeOutBack'`. A wrapped
 *  or hand-written function cannot be named and reads as `'custom'` — which is
 *  why an editor writes names and control points rather than functions. */
export function easingLabel(spec?: EasingSpec): string {
  if (spec === undefined) return 'linear';
  if (typeof spec === 'string') return spec;
  const b = bezierOf(spec);
  if (b) return `cubic-bezier(${b.join(', ')})`;
  for (const [name, fn] of Object.entries(EASINGS)) {
    if (fn === spec) return name;
  }
  return 'custom';
}

/** `count` evenly spaced samples of the curve over 0..1, for drawing it. */
export function sampleEasing(spec: EasingSpec | undefined, count: number): number[] {
  const fn = resolveEasing(spec);
  const out = new Array<number>(count);
  const last = count - 1;
  for (let i = 0; i < count; i++) out[i] = fn(last === 0 ? 0 : i / last);
  return out;
}

/** Every built-in name, for the picker's list. */
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];
