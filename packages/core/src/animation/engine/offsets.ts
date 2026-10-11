import { readTarget, type TargetAxes, type TargetState } from '../target';

const TAU = Math.PI * 2;

/** `value` as the target's axes, refused where it is not the target's shape. */
export function axesFor<T>(axes: TargetAxes<T>, value: T, what: string): number[] {
  const a = axes.to(value);
  if (a.length !== axes.count || !a.every((x) => typeof x === 'number' && !Number.isNaN(x))) {
    throw new Error(`animator: \`${what}\` is not the target's shape`);
  }
  return a;
}

/** `a - b` per axis, the short way round on an angle axis. */
export function travel<T>(axes: TargetAxes<T>, a: readonly number[], b: readonly number[]): number[] {
  const d = a.map((x, i) => x - b[i]!);
  for (const i of axes.angles ?? []) {
    let x = d[i]! % TAU;
    if (x > Math.PI) x -= TAU;
    if (x <= -Math.PI) x += TAU;
    d[i] = x;
  }
  return d;
}

export const plus = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => x + b[i]!);
export const minus = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => x - b[i]!);
export const norm = (a: readonly number[]): number => Math.hypot(...a);

/** Counts `delta` into what `s` shows until the next frame reads its voices again. */
export function bump(s: TargetState, delta: readonly number[], sign: 1 | -1): void {
  for (let i = 0; i < delta.length; i++) s.adjust[i] = s.adjust[i]! + sign * delta[i]!;
}

/** Adds `delta` into the committed value. */
export function absorb<T>(s: TargetState<T>, delta: readonly number[]): void {
  s.set(s.axes.from(plus(s.axes.to(s.get()), delta)));
}

/** The targets one animator is moving. */
export interface TargetBook {
  /** Counts one more animation on `s`. Throws where another animator is moving it. */
  attach(s: TargetState): void;
  /** Counts one fewer. */
  detach(s: TargetState): void;
  /** Called once the frame's voices are read: what `adjust` held is in that reading now. */
  settle(): void;
  /** Hands each moving target, and each that came to rest since the last call, to its `show`. */
  show(): void;
}

export function createTargetBook(): TargetBook {
  const token = {};
  const live = new Set<TargetState>();
  const rested = new Set<TargetState>();
  return {
    attach(s) {
      if (s.owner && s.owner !== token) {
        throw new Error('animator: this target is being moved by another animator');
      }
      s.owner = token;
      s.live += 1;
      live.add(s);
      rested.delete(s);
    },
    detach(s) {
      s.live -= 1;
      if (s.live > 0) return;
      s.owner = null;
      s.slot = null;
      s.adjust.fill(0);
      live.delete(s);
      if (s.show) rested.add(s);
    },
    settle() {
      for (const s of live) s.adjust.fill(0);
    },
    show() {
      for (const s of live) s.show?.(readTarget(s));
      for (const s of rested) s.show!(s.get());
      rested.clear();
    },
  };
}
