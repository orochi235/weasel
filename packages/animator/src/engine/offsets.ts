import { readTarget, type Behind, type RowTable, type TargetAxes, type TargetOwner, type TargetState } from '../target';

const TAU = Math.PI * 2;

/** `value` as the target's axes, refused where it is not the target's shape. */
export function axesFor<T>(axes: TargetAxes<T>, value: T, what: string): number[] {
  const a = axes.to(value);
  if (a.length !== axes.count || !a.every((x) => typeof x === 'number' && !Number.isNaN(x))) {
    throw new Error(`animator: \`${what}\` is not the target's shape`);
  }
  return a;
}

/** The angle `x` as the turn of at most half a circle that reaches it. */
export function shortWay(x: number): number {
  x %= TAU;
  if (x > Math.PI) return x - TAU;
  if (x <= -Math.PI) return x + TAU;
  return x;
}

/** `a - b` per axis, the short way round on an angle axis. */
export function travel<T>(axes: TargetAxes<T>, a: readonly number[], b: readonly number[]): number[] {
  const d = a.map((x, i) => x - b[i]!);
  for (const i of axes.angles ?? []) d[i] = shortWay(d[i]!);
  return d;
}

export const plus = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => x + b[i]!);
export const minus = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => x - b[i]!);
export const norm = (a: readonly number[]): number => Math.hypot(...a);

/** Counts `delta` into what `s` shows until the next frame reads its voices again. */
export function bump(s: TargetState, delta: readonly number[], sign: 1 | -1): void {
  for (let i = 0; i < delta.length; i++) s.adjust[i] = s.adjust[i]! + sign * delta[i]!;
  s.row?.table.mark(s.row.index);
}

/** Adds `delta` into the committed value. */
export function absorb<T>(s: TargetState<T>, delta: readonly number[]): void {
  if (s.discard) return;
  s.set(s.axes.from(plus(s.axes.to(s.get()), delta)));
}

/**
 * How much of an animation's offset is the move its destination made in the committed value,
 * per axis: that move, from `committed` to `to`, over the whole offset, `start`. The rest is a
 * `from` away from the committed value, or a push, which shows on top of a hold.
 */
export function shareBehind<T>(
  axes: TargetAxes<T>, committed: readonly number[], to: readonly number[], start: readonly number[],
): number[] {
  return travel(axes, committed, to).map((m, i) => (start[i] === 0 ? 0 : m / start[i]!));
}

export const times = (a: readonly number[], b: readonly number[]): number[] => a.map((x, i) => x * b[i]!);

/** Puts an animation behind `s`'s holds. `left` answers what is left of its move. */
export function goBehind<T>(s: TargetState<T>, left: () => readonly number[]): Behind {
  const b: Behind = { left, kept: null };
  s.behind.add(b);
  return b;
}

/** Takes `b` out from behind `s`'s holds, and answers how much of `left` was still to show. */
export function comeOut<T>(s: TargetState<T>, b: Behind, left: readonly number[]): number[] {
  s.behind.delete(b);
  if (b.kept) {
    s.dimmed = false;
    for (const other of s.behind) if (other.kept) s.dimmed = true;
  }
  return b.kept ? times(left, b.kept) : left.slice();
}

/** Commits an animation where it stopped: `left` of its move into the committed value, and
 *  the rest of its offset, `own`, where `keep` leaves it. */
export function commitOffset<T>(s: TargetState<T>, own: readonly number[], left: readonly number[], shown: readonly number[]): void {
  const top = minus(own, left);
  if (s.held === 0) { keep(s, plus(shown, top)); return; }
  if (shown.some((x) => x !== 0)) absorb(s, shown);
  if (top.some((x) => x !== 0)) keep(s, top);
}

/** Leaves `delta`, what a stopping animation was showing on top of the committed value's own
 *  move, where the target keeps showing it: in the committed value, or beside it while a hold
 *  stands in front of that. */
export function keep<T>(s: TargetState<T>, delta: readonly number[]): void {
  if (s.discard) return;
  if (s.held === 0) absorb(s, delta);
  else s.beside = s.beside ? plus(s.beside, delta) : delta.slice();
  s.row?.table.mark(s.row.index);
}

/** The committed value's axes as an animation about to commit a destination finds them: with
 *  what `keep` left beside it, which that destination replaces. */
export function takeUp<T>(s: TargetState<T>): number[] {
  const committed = s.axes.to(s.get());
  const beside = s.beside;
  s.beside = null;
  return beside ? plus(committed, beside) : committed;
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
  /** Each table with a row moving, and how many of its rows are. */
  const tables = new Map<RowTable, number>();
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
      if (s.row) {
        tables.set(s.row.table, (tables.get(s.row.table) ?? 0) + 1);
        s.row.table.mark(s.row.index);
      }
    },
    detach(s) {
      s.live -= 1;
      if (s.row) {
        tables.set(s.row.table, tables.get(s.row.table)! - 1);
        s.row.table.mark(s.row.index);
      }
      if (s.live > 0) return;
      s.owner = null;
      s.slot = null;
      s.beside = null;
      s.behind.clear();
      s.dimmed = false;
      s.adjust.fill(0);
      live.delete(s);
      if (s.show) rested.add(s);
    },
    settle() {
      for (const s of live) s.adjust.fill(0);
      for (const t of tables.keys()) t.settle();
    },
    reread(s, queued) {
      for (let i = 0; i < queued.length; i++) s.adjust[i] = queued[i]!;
      s.row?.table.mark(s.row.index);
    },
    show() {
      for (const s of live) if (s.show) shown(s, readTarget(s));
      for (const s of rested) shown(s, s.get());
      rested.clear();
      for (const [t, moving] of tables) {
        t.fill(owner.columns(t));
        if (moving === 0) tables.delete(t);
      }
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
