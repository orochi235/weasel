import { createEmitter } from '@weasel-js/registry';
import type { RedrawSource } from '@weasel-js/core';
import type { ParallaxOptions } from '@weasel-js/core';

/** Parallax opts that can change after a layer is built. `get` is read on
 *  every draw, and a notification repaints whatever draws through it. */
export interface ParallaxSource extends RedrawSource {
  get(): ParallaxOptions;
}

/** A {@link ParallaxSource} you write to — what an animator's `onTick` drives
 *  to tween a plane's `pan`, `zoom` or `anchor`. */
export interface ParallaxPlane extends ParallaxSource {
  /** Merge `patch` over the current opts and notify, unless that changes nothing. */
  set(patch: Partial<ParallaxOptions>): void;
}

/** A {@link ParallaxPlane} starting at `initial`. Pass it as a parallax
 *  layer's `parallax` and write to it to move the plane. */
export function createParallaxPlane(initial: ParallaxOptions): ParallaxPlane {
  let current: ParallaxOptions = copyOpts(initial);
  const listeners = createEmitter();
  return {
    get: () => current,
    set(patch) {
      const next = copyOpts({ ...current, ...patch });
      if (sameOpts(current, next)) return;
      current = next;
      listeners.emit();
    },
    subscribe: listeners.subscribe,
  };
}

type XY = { x: number; y: number };
const copyXY = <T extends number | XY | undefined>(v: T): T => (typeof v === 'object' ? { x: v.x, y: v.y } : v) as T;
const sameXY = (a: number | XY | undefined, b: number | XY | undefined): boolean =>
  typeof a === 'object' && typeof b === 'object' ? Object.is(a.x, b.x) && Object.is(a.y, b.y) : Object.is(a, b);

/** `o` with its own copy of every pair, so a caller's later edit to one is not a change nobody heard. */
function copyOpts(o: ParallaxOptions): ParallaxOptions {
  const out = { ...o, pan: copyXY(o.pan) };
  if ('zoom' in o) out.zoom = copyXY(o.zoom);
  if ('anchor' in o) out.anchor = copyXY(o.anchor);
  return out;
}

function sameOpts(a: ParallaxOptions, b: ParallaxOptions): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ParallaxOptions>;
  return [...keys].every((k) => k in a === k in b && sameXY(a[k], b[k]));
}

/** Whether `p` is a live source rather than a fixed set of opts. */
export function isParallaxSource(p: ParallaxOptions | ParallaxSource): p is ParallaxSource {
  return typeof (p as ParallaxSource).get === 'function';
}
