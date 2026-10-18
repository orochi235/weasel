import type { HoldStore } from './holdStore';
import type { Reader } from './lanes';
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
  stale(s);
  s.row?.table.mark(s.row.index);
}

/** Counts `delta` into what `b`, an animation with a destination on `s`, shows until the next
 *  frame reads its voices again. */
export function bumpBehind(s: TargetState, b: Behind, delta: readonly number[], sign: 1 | -1): void {
  const adjust = (b.adjust ??= new Array<number>(delta.length).fill(0));
  for (let i = 0; i < delta.length; i++) adjust[i] = adjust[i]! + sign * delta[i]!;
  stale(s);
  s.row?.table.mark(s.row.index);
}

/** Points `holder`, `s` or one of its `behind`, at `slot`, its voices' subject now. One whose
 *  last voice left since the frame is still in what it shows until the next, so that goes into
 *  its `adjust`. */
export function seat(s: TargetState, holder: { slot: Reader | null; adjust: number[] | null }, slot: Reader): void {
  const was = holder.slot;
  if (was && was !== slot && was.refs === 0) {
    const n = s.axes.count;
    const adjust = (holder.adjust ??= new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) adjust[i] = adjust[i]! + was.cols[was.at + i]!;
    stale(s);
  }
  holder.slot = slot;
}

/** Says what waits beside `s`'s holds. */
export function setBeside(s: TargetState, beside: number[] | null): void {
  s.beside = beside;
  s.row?.table.beside(s.row.index, beside);
}

function stale(s: TargetState): void {
  if (s.stale || !s.owner) return;
  s.stale = true;
  s.owner.adjusted(s);
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

/** Puts an animation with a destination on `s`. `own` answers its voices' sum, `left` what is
 *  left of its move, and `share` how much of its voices' each axis that move is. */
export function goBehind<T>(
  s: TargetState<T>, own: () => readonly number[], left: () => readonly number[], share: readonly number[],
): Behind {
  const b: Behind = {
    own, left, share, kept: null, slot: null, adjust: null,
    move: s.row ? s.row.table.move(s.row.index, share) : null,
  };
  s.behind.push(b);
  return b;
}

/** Where an animation with a destination runs its voices, and counts what they add between
 *  frames: on a subject of its own for a table's row, which the table's pass shows apart, and
 *  among its target's for any other. */
export const runsOn = (s: TargetState, b: Behind): TargetState | Behind => (b.move ? b : s);

/** Counts `delta` into what the voices of `b`, an animation with a destination on `s`, show
 *  until the next frame reads them. */
export function bumpOn(s: TargetState, b: Behind, delta: readonly number[], sign: 1 | -1): void {
  if (b.move) bumpBehind(s, b, delta, sign);
  else bump(s, delta, sign);
}

/** Takes `b` out from behind `s`'s holds, and answers how much of `left` was still to show. */
export function comeOut<T>(s: TargetState<T>, b: Behind, left: readonly number[]): number[] {
  const at = s.behind.indexOf(b);
  if (at >= 0) s.behind.splice(at, 1);
  b.move?.leave();
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
  else setBeside(s as never, s.beside ? plus(s.beside, delta) : delta.slice());
  s.row?.table.mark(s.row.index);
}

/** The committed value's axes as an animation about to commit a destination finds them: with
 *  what `keep` left beside it, which that destination replaces. */
export function takeUp<T>(s: TargetState<T>): number[] {
  const committed = s.axes.to(s.get());
  const beside = s.beside;
  if (beside) setBeside(s as never, null);
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
  /** Counts `by` more holds folded in `store`, which each frame asks while it has any. */
  holding(store: HoldStore, by: 1 | -1): void;
  /** Hands each moving target, and each that came to rest since the last call, to its `show`. */
  show(): void;
  /** Shows `s` now, where an animation just started on it or was redirected. */
  showNow(s: TargetState): void;
  /** Whether a target came to rest since the last `show`. */
  readonly resting: boolean;
}

export function createTargetBook(owner: Omit<TargetOwner, 'adjusted'>): TargetBook {
  /** The targets whose `adjust` holds something. A frame walks these and not every moving target. */
  const adjusted: TargetState[] = [];
  const token: TargetOwner = { ...owner, adjusted: (s) => { adjusted.push(s); } };
  /** The moving targets with a `show`: the ones a frame has to call. */
  const showing = new Set<TargetState>();
  const rested = new Set<TargetState>();
  const publishes = new Set<() => void>();
  /** Each table with a row moving, and how many of its rows are. */
  const tables = new Map<RowTable, number>();
  /** Each store holds are folded in, and how many. */
  const stores = new Map<HoldStore, number>();
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
      if (s.show) showing.add(s);
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
      if (s.beside) setBeside(s, null);
      for (const b of s.behind) b.move?.leave();
      s.behind.length = 0;
      s.dimmed = false;
      s.adjust.fill(0);
      s.stale = false;
      if (s.show && showing.delete(s)) rested.add(s);
    },
    settle() {
      for (const s of adjusted) {
        // One that came to rest since is cleared already, and may be another animator's now.
        if (!s.stale || s.owner !== token) continue;
        s.adjust.fill(0);
        for (const b of s.behind) b.adjust = null;
        s.stale = false;
      }
      adjusted.length = 0;
      for (const store of stores.keys()) store.frame();
      for (const t of tables.keys()) t.settle();
    },
    holding(store, by) {
      const count = (stores.get(store) ?? 0) + by;
      if (count > 0) stores.set(store, count);
      else stores.delete(store);
    },
    show() {
      for (const s of showing) shown(s, readTarget(s));
      for (const s of rested) shown(s, s.get());
      rested.clear();
      for (const [t, moving] of tables) {
        t.fill(owner.columns);
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
