import type { RedrawSource } from '../../core/layers/render';
import type { ParallaxOpts } from '../../core/viewport/parallax';

/** Parallax opts that can change after a layer is built. `get` is read on
 *  every draw, and a notification repaints whatever draws through it. */
export interface ParallaxSource extends RedrawSource {
  get(): ParallaxOpts;
}

/** A {@link ParallaxSource} you write to — what an animator's `onTick` drives
 *  to tween a plane's `pan`, `zoom` or `anchor`. */
export interface ParallaxPlane extends ParallaxSource {
  /** Merge `patch` over the current opts and notify. */
  set(patch: Partial<ParallaxOpts>): void;
}

export function createParallaxPlane(initial: ParallaxOpts): ParallaxPlane {
  let current: ParallaxOpts = { ...initial };
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(patch) {
      current = { ...current, ...patch };
      for (const fn of [...listeners]) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}

/** Whether `p` is a live source rather than a fixed set of opts. */
export function isParallaxSource(p: ParallaxOpts | ParallaxSource): p is ParallaxSource {
  return typeof (p as ParallaxSource).get === 'function';
}
