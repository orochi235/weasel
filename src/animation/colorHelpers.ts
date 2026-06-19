import type {
  AnimationHandle,
  Animator,
  EasingFn,
  SpringPresetName,
} from './types';
import type { VertexColorChannel } from './colorRegistry';
import { lerpColorArray, type ColorSpace } from './colorSpaces';
import { hslToRgb } from '../renderer/math/color';

/**
 * Color interpolator: receives two flat RGBA float arrays (values in
 * 0..1, the renderer's color space — same shape as
 * `stroke.vertexColors`) and a normalized progress `t` in 0..1.
 * Returns the same-length blended array, also in 0..1 floats. Override
 * the default per-channel lerp via `TweenVertexColorsOptions.interpolate`
 * when a custom color-space or shaping is needed.
 */
export type ColorInterpolate = (
  from: readonly number[],
  to: readonly number[],
  t: number,
) => number[];

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
  /** Custom interpolator. Receives two RGBA arrays in 0..1 floats and a
   *  progress `t` in 0..1; returns the blended array in 0..1 floats. */
  interpolate?: ColorInterpolate;
}

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

// ─── Color-array constructors ───────────────────────────────────────
//
// Helpers that build the per-anchor RGBA arrays the tween/cycle/stagger
// helpers above (and `stroke.vertexColors` on draw commands) consume.
// Values are in the 0..1 range the renderer expects — emitting bytes
// (0..255) clamps every channel to 1.0 on the GPU and renders white.

/** Build an n-anchor rainbow RGBA array sweeping the hue wheel. The
 *  output is suitable to pass directly into `stroke.vertexColors`,
 *  `tweenVertexColors({ from: rainbowVertexColors(n) })`, or any
 *  other API that wants per-anchor color floats. */
export function rainbowVertexColors(
  n: number,
  opts: { saturation?: number; lightness?: number; alpha?: number } = {},
): number[] {
  const saturation = opts.saturation ?? 0.8;
  const lightness = opts.lightness ?? 0.6;
  const alpha = opts.alpha ?? 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 360) / Math.max(1, n);
    const [r, g, b] = hslToRgbUnit(h, saturation, lightness);
    out.push(r, g, b, alpha);
  }
  return out;
}

/** Build an n-anchor solid RGBA array. Shorthand for
 *  `[r, g, b, a, r, g, b, a, …]` — the array a `tweenVertexColors`
 *  `to`-target typically needs. */
export function solidVertexColors(
  n: number,
  r: number,
  g: number,
  b: number,
  a = 1,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return out;
}

/** HSL → RGB in 0..1 (hue in degrees). Delegates to the single internal
 *  implementation in `renderer/math/color.ts` so there's only one HSL→RGB
 *  formula in the package. Kept local so consumers building hue-cycled
 *  color arrays via `huesweepVertexColors` don't have to roll their own. */
function hslToRgbUnit(h: number, s: number, l: number): [number, number, number] {
  return hslToRgb(h, s, l);
}
