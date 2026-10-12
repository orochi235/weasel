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

/** Under a thousandth of full scale from `to`, and slower than that a second, a color spring is done. */
const COLOR_REST = 0.001;

/** What the from-to helpers share: the node's color target, moved by a path through `colorsAt`. */
function tweenColors(
  animator: Animator,
  opts: { id: string; channel: VertexColorChannel; from: readonly number[]; to: readonly number[]; onDone?: () => void },
  ms: number,
  easing: EasingSpec | undefined,
  colorsAt: (t: number) => number[],
): AnimationHandle {
  const { id, channel } = opts;
  const registry = animator.colorOverrides;
  return animator.tween<number[]>({
    target: registry.target(id, channel, opts.from.length),
    from: opts.from.slice(),
    to: opts.to.slice(),
    ms,
    easing,
    cancelKey: cancelKeyFor(id, channel),
    interrupt: false,
    interpolate: (_from, _to, t) => colorsAt(t),
    onDone: () => {
      registry.release(id, channel);
      opts.onDone?.();
    },
  });
}

/**
 * Animate one node's per-anchor colors from `from` to `to` over `ms`.
 *
 * It moves the node's color target (`animator.colorOverrides.target`) rather
 * than writing the scene, so nothing is recorded in history and the node's own
 * data is untouched. Another tween or stagger on the same node and channel adds
 * to this one; a spring interrupts it. What it painted is dropped when the last
 * animation on the node and channel finishes, and held where it was if canceled
 * until `animator.colorOverrides.clear`.
 */
export function tweenVertexColors(
  animator: Animator,
  opts: TweenVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  return tweenColors(animator, opts, opts.ms, opts.easing, (t) => interp(opts.from, opts.to, t));
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
  onDone?: () => void;
}

/**
 * `tweenVertexColors` driven by a spring instead of a duration. Each number
 * springs on its own, so an underdamped spring overshoots `to` and the path is
 * a straight line in RGB.
 *
 * It interrupts whatever is animating the node and channel, and starts at the
 * velocity of the one it interrupts, so retargeting mid-flight does not stall.
 */
export function springVertexColors(
  animator: Animator,
  opts: SpringVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const { id, channel } = opts;
  const registry = animator.colorOverrides;
  return animator.spring<number[]>({
    target: registry.target(id, channel, opts.from.length),
    from: opts.from.slice(),
    to: opts.to.slice(),
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    restThreshold: COLOR_REST,
    cancelKey: cancelKeyFor(id, channel),
    onDone: () => {
      registry.release(id, channel);
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
 *  starting later than the one before it. It moves the same target as
 *  `tweenVertexColors`, and adds to other animations the same way. */
export function staggerVertexColors(
  animator: Animator,
  opts: StaggerVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { from, to, anchorMs, perAnchorDelay } = opts;
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

  return tweenColors(animator, opts, totalMs, linear, (t) => colorsAt(t * totalMs));
}
