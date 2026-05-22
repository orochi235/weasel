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

export interface CycleVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  msPerCycle: number;
  direction?: 1 | -1;
  easing?: EasingFn;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
}

export interface CycleHandle {
  cancel(): void;
}

/** Register a function override that phase-rotates the base color array
 *  along the path index. Returns a handle whose `cancel()` removes the
 *  override.
 *
 *  No animator.loop is needed — the renderer calls the function override
 *  on every draw with the current timestamp, and the function derives the
 *  phase from `tMs` directly. Cycles do not appear in `animator.isActive()`
 *  by design (they are passive renderer-driven overrides, not scheduled
 *  animations). */
export function cycleVertexColors(
  animator: Animator,
  opts: CycleVertexColorsOptions,
): CycleHandle {
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  const direction = opts.direction ?? 1;
  const easing = opts.easing ?? ((t: number) => t);

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

  return {
    cancel(): void {
      animator.colorOverrides.clear(id, channel);
    },
  };
}

export interface StaggerVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  anchorMs: number;
  perAnchorDelay: number;
  origin?: 'first' | 'last' | number;
  easing?: EasingFn;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

export function staggerVertexColors(
  animator: Animator,
  opts: StaggerVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel, from, to, anchorMs, perAnchorDelay } = opts;
  const n = from.length / 4;
  const easing = opts.easing ?? ((t: number) => t);

  const originIndex =
    opts.origin === 'last' ? n - 1 :
    typeof opts.origin === 'number' ? Math.max(0, Math.min(n - 1, opts.origin)) :
    0;

  const maxDistance = Math.max(originIndex, n - 1 - originIndex);
  const totalMs = maxDistance * perAnchorDelay + anchorMs;

  const override = (_base: readonly number[], tMs: number): number[] => {
    const out = new Array<number>(from.length);
    for (let i = 0; i < n; i++) {
      const distance = Math.abs(i - originIndex);
      const startMs = distance * perAnchorDelay;
      const localT = Math.max(0, Math.min(1, (tMs - startMs) / anchorMs));
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

  animator.colorOverrides.set(id, channel, override);

  return animator.tween<number>({
    from: 0,
    to: 1,
    ms: totalMs,
    easing: (t) => t,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: () => {},
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}
