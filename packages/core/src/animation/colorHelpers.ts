import { linear, resolveEasing } from '@weasel-js/geom';
import type { ColorSpace } from '@weasel-js/paint';
import type {
  AnimationHandle,
  Animator,
  EasingSpec,
  SpringPresetName,
} from './types';
import type { VertexColorChannel } from './colorRegistry';
import { resolveInterpolator, type ColorInterpolate } from './colorInterpolate';

/** Options for `tweenVertexColors`. */
export interface TweenVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  /** Per-anchor RGBA, flat, in 0..1 floats (matches the renderer's
   *  `stroke.vertexColors` / `PathDrawCommand.vertexColors` color space).
   *  Length must equal `from.length`. */
  to: readonly number[];
  /** Per-anchor RGBA, flat, in 0..1 floats. Length must equal `to.length`
   *  and be a positive multiple of 4. */
  from: readonly number[];
  ms: number;
  easing?: EasingSpec;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

function validateLengths(from: readonly number[], to: readonly number[]): void {
  if (from.length !== to.length) {
    throw new Error(
      `vertex colors: length mismatch (from=${from.length}, to=${to.length})`,
    );
  }
  if (from.length === 0 || from.length % 4 !== 0) {
    throw new Error(
      `vertex colors: length ${from.length} must be a positive multiple of 4`,
    );
  }
}

const cancelKeyFor = (id: string, channel: VertexColorChannel): string =>
  `colors:${id}:${channel}`;

/**
 * Animate one node's per-anchor colors from `from` to `to` over `ms`.
 *
 * The colors are published to the animator's `colorOverrides` registry rather
 * than written into the scene, so nothing is recorded in history and the
 * node's own data is untouched; the override is dropped when the animation
 * finishes. Starting another color animation on the same node and channel
 * cancels this one.
 */
export function tweenVertexColors(
  animator: Animator,
  opts: TweenVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  return animator.tween<number>({
    from: 0,
    to: 1,
    ms: opts.ms,
    easing: opts.easing,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (t) => {
      animator.colorOverrides.set(id, channel, interp(opts.from, opts.to, t));
    },
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}

/** Options for `springVertexColors`. */
export interface SpringVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  /** Per-anchor RGBA in 0..1 floats. See `TweenVertexColorsOptions.to`. */
  to: readonly number[];
  /** Per-anchor RGBA in 0..1 floats. See `TweenVertexColorsOptions.from`. */
  from: readonly number[];
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

/** `tweenVertexColors` driven by a spring instead of a duration. Same override
 *  semantics. */
export function springVertexColors(
  animator: Animator,
  opts: SpringVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  return animator.spring<number>({
    from: 0,
    to: 1,
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (t) => {
      const clamped = Math.max(0, Math.min(1, t));
      animator.colorOverrides.set(id, channel, interp(opts.from, opts.to, clamped));
    },
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}

/** Options for `staggerVertexColors`. `origin` picks which anchor the wave
 *  starts from and `perAnchorDelay` how far behind each successive anchor
 *  runs. */
export interface StaggerVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  /** Per-anchor RGBA in 0..1 floats. See `TweenVertexColorsOptions.to`. */
  to: readonly number[];
  /** Per-anchor RGBA in 0..1 floats. See `TweenVertexColorsOptions.from`. */
  from: readonly number[];
  anchorMs: number;
  perAnchorDelay: number;
  origin?: 'first' | 'last' | number;
  easing?: EasingSpec;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

/** Run the same color change across a node's anchors as a wave, each anchor
 *  starting later than the one before it. Same override semantics as
 *  `tweenVertexColors`. */
export function staggerVertexColors(
  animator: Animator,
  opts: StaggerVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel, from, to, anchorMs, perAnchorDelay } = opts;
  const n = from.length / 4;
  const easing = resolveEasing(opts.easing);

  const originIndex =
    opts.origin === 'last' ? n - 1 :
    typeof opts.origin === 'number' ? Math.max(0, Math.min(n - 1, opts.origin)) :
    0;

  const maxDistance = Math.max(originIndex, n - 1 - originIndex);
  const totalMs = maxDistance * perAnchorDelay + anchorMs;

  const colorsAt = (elapsedMs: number): number[] => {
    const out = new Array<number>(from.length);
    for (let i = 0; i < n; i++) {
      const distance = Math.abs(i - originIndex);
      const startMs = distance * perAnchorDelay;
      const localT = Math.max(0, Math.min(1, (elapsedMs - startMs) / anchorMs));
      const eased = easing(localT);
      const k = i * 4;
      const fSlice = [from[k], from[k + 1], from[k + 2], from[k + 3]];
      const tSlice = [to[k], to[k + 1], to[k + 2], to[k + 3]];
      const blended = interp(fSlice, tSlice, eased);
      out[k] = blended[0];
      out[k + 1] = blended[1];
      out[k + 2] = blended[2];
      out[k + 3] = blended[3];
    }
    return out;
  };

  // A plain array, not a function override: painters call those with their
  // own clock (`performance.now()`), not time since this stagger began.
  animator.colorOverrides.set(id, channel, colorsAt(0));

  return animator.tween<number>({
    from: 0,
    to: 1,
    ms: totalMs,
    easing: linear,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (t) => {
      animator.colorOverrides.set(id, channel, colorsAt(t * totalMs));
    },
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}
