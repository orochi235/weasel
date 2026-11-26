import { curve, type Easing } from '@msb235/blits';
import { resolveEasing, type EasingFn, type EasingSpec } from '@weasel-js/geom';

/** An easing blits defines as data and `EasingSpec` has no form for: `steps` and `linear`, as CSS's
 *  `steps()` and `linear()` are. Written as blits takes it, and run by blits' `curve`. */
export type BlitsEasing = Exclude<Easing, string | ((u: number) => number) | { readonly bezier: unknown }>;

/** What eases the approach into a key: an `EasingSpec`, or an easing blits defines as data. */
export type KeyEasing = EasingSpec | BlitsEasing;

/** Whether an easing is one of blits' data forms, which `resolveKeyEasing` hands to blits. */
export function isBlitsEasing(spec: KeyEasing | undefined): spec is BlitsEasing {
  return typeof spec === 'object' && spec !== null && !('bezier' in spec);
}

/** The curve an easing stands for, as animation plays it: blits' data forms by blits, and a name, a
 *  bezier or a function as `resolveEasing` makes it; linear with none. Throws, as both do, on one
 *  neither knows. */
export function resolveKeyEasing(spec?: KeyEasing): EasingFn {
  return isBlitsEasing(spec) ? curve(spec) : resolveEasing(spec);
}
