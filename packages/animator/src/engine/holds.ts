import { axisIndexes } from '../axisNames';
import { committedInto, type TargetState } from '../target';
import type { AnimationContext } from './context';
import { createHoldStore, type HoldLayer, type HoldSources, type HoldStore } from './holdStore';
import { absorb, axesFor, setBeside, shortWay } from './offsets';

/** What {@link openHold} takes. */
export interface HoldSource<T> {
  target: TargetState<T>;
  /** The value to show in place of the committed one, read whenever the target is. */
  value(): T;
  /** Its share among the target's holds, read as `value` is. */
  weight(): number;
  /** The axes it holds, by index or by the target's names for them. Default: all of them. */
  axes?: readonly (number | string)[];
  /** True where `value` and `weight` answer the same until `touch` says otherwise. A target
   *  whose holds are all so is read again only when touched, or when its committed value moves. */
  fixed?: boolean;
}

/** A hold on its target, apart from any row on the animator's table. */
export interface OpenHold {
  /** Says `value` or `weight` changed outside a frame's own reading of them. */
  touch(): void;
  /** Takes the hold off the target. With `commit`, the committed value moves so that what the
   *  target shows stays where it was. */
  leave(commit: boolean): void;
}

/** Where `s`'s holds are folded: its table's store, for a row of one, or a store of its own. */
export function holdsOf(s: TargetState): { readonly store: HoldStore; readonly row: number } {
  if (s.holds) return s.holds;
  if (s.row) return (s.holds = { store: s.row.table.holds(), row: s.row.index });
  const store = createHoldStore(s.axes.count, 1, (_, out, at) => committedInto(s, out, at), s.axes.angles);
  return (s.holds = { store, row: 0 });
}

/** Where the holds on `s` are folded, what they show against `committed`, with and without
 *  the hold `skip`. */
function both(s: TargetState, skip: HoldLayer, committed: readonly number[]) {
  const { store, row } = s.holds!;
  const n = committed.length;
  const all = { delta: new Array<number>(n), total: new Array<number>(n) };
  const rest = { delta: new Array<number>(n), total: new Array<number>(n) };
  store.fold(row, committed, 0, null, all.delta, all.total);
  store.fold(row, committed, 0, skip, rest.delta, rest.total);
  return { all, rest, own: store.valueOf(skip, row) };
}

/** How far the committed value moves as `leaving` goes, so the target shows what it did. */
function settle(
  s: TargetState, f: ReturnType<typeof both>, covers: Uint8Array | null, committed: readonly number[],
): number[] {
  const { all, rest, own } = f;
  const angles = s.axes.angles ?? [];
  return committed.map((c, a) => {
    if (covers && !covers[a]) return 0;
    // Holds that cover the committed value outright leave it nothing to show: it takes this one's.
    if (rest.total[a]! >= 1 - 1e-9) return angles.includes(a) ? shortWay(own[a]! - c) : own[a]! - c;
    return (all.delta[a]! - rest.delta[a]!) / (1 - rest.total[a]!);
  });
}

/**
 * Keeps what shows of each move behind `s`'s holds as their weights go from `before` to
 * `after` on a release that commits: a hold that covered a share of a move takes that share
 * with it, so the move goes on as far as it was showing and no further.
 */
function dim(s: TargetState, before: readonly number[], after: readonly number[]): void {
  for (const b of s.behind) {
    for (let a = 0; a < before.length; a++) {
      const open = 1 - Math.min(after[a]!, 1);
      const was = 1 - Math.min(before[a]!, 1);
      if (open < 1e-9 || open === was) continue;
      b.kept ??= new Array<number>(before.length).fill(1);
      b.kept[a] = (b.kept[a]! * was) / open;
      s.dimmed = true;
    }
    if (b.kept) b.move?.kept(b.kept);
  }
}

export function coverOf(wanted: readonly (number | string)[] | undefined, axes: TargetState['axes']): Uint8Array | null {
  if (!wanted) return null;
  const covers = new Uint8Array(axes.count);
  for (const a of axisIndexes(axes, wanted)) covers[a] = 1;
  return covers;
}

/** Puts a hold on `s` in `layer` of the store its holds fold in. The caller folds it in. */
export function enterHold(
  ctx: AnimationContext, s: TargetState, layer: (store: HoldStore, row: number) => HoldLayer, sources: HoldSources,
): { store: HoldStore; row: number; layer: HoldLayer } {
  ctx.targets.attach(s);
  s.held += 1;
  const { store, row } = holdsOf(s);
  const l = layer(store, row);
  store.join(l, row, sources);
  ctx.targets.holding(store, 1);
  return { store, row, layer: l };
}

/** Takes `s`'s hold in `layer` off it. With `commit`, the committed value moves so that what
 *  `s` shows stays where it was. The caller shows what is left. */
export function leaveHold(ctx: AnimationContext, s: TargetState, layer: HoldLayer, covers: Uint8Array | null, commit: boolean): void {
  const { store, row } = s.holds!;
  if (commit && !s.discard) {
    store.refold(row);
    const committed = s.axes.to(s.get());
    const f = both(s, layer, committed);
    absorb(s, settle(s, f, covers, committed));
    dim(s, f.all.total, f.rest.total);
  }
  store.part(layer, row);
  ctx.targets.holding(store, -1);
  s.held -= 1;
  if (s.held === 0) {
    s.holds = null;
    // Nothing stands in front of the committed value now, so it takes what waited beside it.
    const beside = s.beside;
    if (beside) {
      setBeside(s, null);
      absorb(s, beside);
    }
  }
  ctx.targets.detach(s);
}

/** Holds a value on a target: it shows `value` where the committed value would show. */
export function openHold<T>(ctx: AnimationContext, o: HoldSource<T>): OpenHold {
  const s = o.target;
  const ax = s.axes;
  const state = s as unknown as TargetState;
  axesFor(ax, o.value(), 'value');
  let gone = false;
  const covers = coverOf(o.axes, ax);
  const { layer } = enterHold(ctx, state, (store, row) => store.free(row), {
    value: ax.write
      ? (out, at) => ax.write!(o.value(), out, at)
      : (out, at) => out.set(ax.to(o.value()), at),
    weight: o.weight,
    covers,
    fixed: o.fixed === true,
  });
  ctx.touch(state, true);

  return {
    touch: () => { if (!gone) ctx.touch(state); },
    leave(commit) {
      if (gone) return;
      gone = true;
      leaveHold(ctx, state, layer, covers, commit);
      ctx.touch(state, true);
    },
  };
}
