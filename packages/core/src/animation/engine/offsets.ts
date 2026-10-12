import { readTarget, type TargetAxes, type TargetOwner, type TargetState } from '../target';

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
  if (s.discard) return;
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
  /** Called once `s`'s voices are read again mid-frame: all that reading left out is `queued`. */
  reread(s: TargetState, queued: readonly number[]): void;
  /** Hands each moving target, and each that came to rest since the last call, to its `show`. */
  show(): void;
  /** Shows `s` now, where an animation just started on it or was redirected. */
  showNow(s: TargetState): void;
  /** Whether a target came to rest since the last `show`. */
  readonly resting: boolean;
}

export function createTargetBook(owner: TargetOwner): TargetBook {
  const token = owner;
  const live = new Set<TargetState>();
  const rested = new Set<TargetState>();
  const publishes = new Set<() => void>();
  const shown = (s: TargetState, value: unknown): void => {
    s.show!(value);
    if (s.publish) publishes.add(s.publish);
  };
  const publish = (): void => {
    for (const p of publishes) p();
    publishes.clear();
  };
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
    reread(s, queued) {
      for (let i = 0; i < queued.length; i++) s.adjust[i] = queued[i]!;
    },
    show() {
      for (const s of live) if (s.show) shown(s, readTarget(s));
      for (const s of rested) shown(s, s.get());
      rested.clear();
      publish();
    },
    showNow(s) {
      if (!s.show) return;
      shown(s, readTarget(s));
      publish();
    },
    get resting() { return rested.size > 0; },
  };
}
