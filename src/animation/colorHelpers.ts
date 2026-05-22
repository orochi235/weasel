import type {
  AnimationHandle,
  Animator,
  EasingFn,
  SpringPresetName,
} from './types';
import type { VertexColorChannel } from './colorRegistry';
import { lerpColorArray, type ColorSpace } from './colorSpaces';

export type ColorInterpolate = (
  from: readonly number[],
  to: readonly number[],
  t: number,
) => number[];

export interface TweenVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  ms: number;
  easing?: EasingFn;
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

function resolveInterpolator(
  opts: { interpolation?: ColorSpace; interpolate?: ColorInterpolate },
): ColorInterpolate {
  if (opts.interpolate) return opts.interpolate;
  const space: ColorSpace = opts.interpolation ?? 'rgb';
  return (a, b, t) => lerpColorArray(a, b, t, space);
}

const cancelKeyFor = (id: string, channel: VertexColorChannel): string =>
  `colors:${id}:${channel}`;

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

export interface SpringVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

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
