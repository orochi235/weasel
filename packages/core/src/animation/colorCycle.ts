import { resolveEasing } from '@weasel-js/geom';
import type { ColorSpace } from '@weasel-js/paint';
import type { Animator, EasingSpec } from './types';
import type { VertexColorChannel } from './colorRegistry';
import { resolveInterpolator, type ColorInterpolate } from './colorInterpolate';

/** Options for `cycleVertexColors`. */
export interface CycleVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  msPerCycle: number;
  direction?: 1 | -1;
  easing?: EasingSpec;
  interpolation?: ColorSpace;
  /** Custom interpolator. Receives two RGBA arrays in 0..1 floats and a
   *  progress `t` in 0..1; returns the blended array in 0..1 floats. */
  interpolate?: ColorInterpolate;
}

/** Removes an installed color cycle. Unlike the other color helpers this is
 *  not an `AnimationHandle`, because a cycle has no progress to pause or
 *  scale — it only ends. */
export interface CycleHandle {
  cancel(): void;
}

/** Register a function override that phase-rotates the base color array
 *  along the path index. Returns a handle whose `cancel()` removes the
 *  override.
 *
 *  The override computes its value purely from `performance.now()`, so
 *  there's no per-frame progress to register with the animator's tick
 *  loop. To keep the loop alive (so `<SceneCanvas animator>`'s onTick
 *  subscription continues firing redraws while the cycle is installed),
 *  cycleVertexColors holds an `animator.keepAlive()` entry for the
 *  lifetime of the cycle; `cancel()` releases it. */
export function cycleVertexColors(
  animator: Animator,
  opts: CycleVertexColorsOptions,
): CycleHandle {
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  const direction = opts.direction ?? 1;
  const easing = resolveEasing(opts.easing);

  const override = (base: readonly number[], tMs: number): number[] => {
    const n = base.length / 4;
    if (n === 0) return base.slice();
    const raw = (tMs / opts.msPerCycle) * n * direction;
    const cycles = raw / n;
    const cycleFrac = cycles - Math.floor(cycles);
    const easedFrac = easing(cycleFrac);
    const easedRaw = (Math.floor(cycles) + easedFrac) * n;
    const phase = ((easedRaw % n) + n) % n;
    const phaseInt = Math.floor(phase);
    const phaseFrac = phase - phaseInt;

    const out = new Array<number>(base.length);
    for (let i = 0; i < n; i++) {
      const aIdx = ((i + phaseInt) % n) * 4;
      const bIdx = ((i + phaseInt + 1) % n) * 4;
      const a = [base[aIdx], base[aIdx + 1], base[aIdx + 2], base[aIdx + 3]];
      const b = [base[bIdx], base[bIdx + 1], base[bIdx + 2], base[bIdx + 3]];
      const blended = interp(a, b, phaseFrac);
      const k = i * 4;
      out[k] = blended[0];
      out[k + 1] = blended[1];
      out[k + 2] = blended[2];
      out[k + 3] = blended[3];
    }
    return out;
  };

  animator.colorOverrides.set(id, channel, override);
  // Cycle's "value" is a function of wall-clock time, not a tween-style
  // progress. We don't register a per-frame ticking animation, so without
  // an explicit keep-alive entry the animator's RAF loop would idle and
  // SceneCanvas's onTick redraw subscription would never fire. Keep the
  // loop running until cancel().
  const releaseKeepAlive = animator.keepAlive();

  return {
    cancel(): void {
      animator.colorOverrides.clear(id, channel);
      releaseKeepAlive();
    },
  };
}
