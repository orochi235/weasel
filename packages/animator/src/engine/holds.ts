import { axisIndexes } from '../axisNames';
import { committedInto, type TargetState } from '../target';
import type { AnimationContext } from './context';
import { absorb, axesFor, shortWay } from './offsets';

/** What {@link openHold} takes. */
export interface HoldSource<T> {
  target: TargetState<T>;
  /** The value to show in place of the committed one, read whenever the target is. */
  value(): T;
  /** Its share among the target's holds, read as `value` is. */
  weight(): number;
  /** The axes it holds, by index or by the target's names for them. Default: all of them. */
  axes?: readonly (number | string)[];
}

/** A hold on its target, apart from any row on the animator's table. */
export interface OpenHold {
  /** Says `value` or `weight` changed outside a frame's own reading of them. */
  touch(): void;
  /** Takes the hold off the target. With `commit`, the committed value moves so that what the
   *  target shows stays where it was. */
  leave(commit: boolean): void;
}

interface Member {
  /** Its value's axes, in an array of its own that the next call writes over. */
  value(): number[];
  weight(): number;
  /** Nonzero at each axis it holds; null where it holds them all. */
  covers: Uint8Array | null;
  /** Its weight and value as the fold now running read them. */
  w: number;
  v: number[];
}

/** A target's holds, which reach it as one voice. */
interface Group {
  members: Member[];
  /** The voice's id in the codec. */
  voice: number;
  /** Nonzero at each angle axis. */
  angle: Uint8Array;
}

const groups = new WeakMap<TargetState, Group>();

const share = (w: number): number => (w > 0 ? Math.min(w, 1) : 0);

interface Folded {
  /** What the holds add to the committed value. */
  delta: number[];
  /** The weight holding each axis. */
  total: number[];
}

/**
 * A group's holds as one distance from `committed`, without `skip`. On each axis the holds
 * over it are alternatives: one weighs `w / max(1, total)`, and what their weights leave short
 * of 1 is the committed value's. An angle goes by way of the direction the holds average to,
 * so two holds turn the short way toward each other.
 */
function fold(group: Group, committed: readonly number[], skip?: Member, into?: Folded): Folded {
  const n = committed.length;
  const delta = into ? into.delta : new Array<number>(n);
  const total = into ? into.total : new Array<number>(n);
  const { members, angle } = group;
  // Each member is asked once, whatever the axes: its weight and value are the caller's functions.
  for (let h = 0; h < members.length; h++) {
    const m = members[h]!;
    m.w = m === skip ? 0 : m.weight();
    if (m.w > 0) m.v = m.value();
  }
  for (let a = 0; a < n; a++) {
    const c = committed[a]!;
    let held = 0;
    let sum = 0;
    let sin = 0;
    let cos = 0;
    for (let h = 0; h < members.length; h++) {
      const m = members[h]!;
      if (m === skip || !(m.w > 0) || (m.covers && !m.covers[a])) continue;
      held += m.w;
      if (!angle[a]) sum += m.w * (m.v[a]! - c);
      else {
        sin += m.w * Math.sin(m.v[a]!);
        cos += m.w * Math.cos(m.v[a]!);
      }
    }
    total[a] = held;
    if (held > 0 && angle[a]) {
      // Where the directions cancel out there is no way round between them: each from committed.
      const mean = Math.hypot(sin, cos) < 1e-9 ? null : Math.atan2(sin, cos);
      for (let h = 0; h < members.length; h++) {
        const m = members[h]!;
        if (m === skip || !(m.w > 0) || (m.covers && !m.covers[a])) continue;
        sum += m.w * (mean === null ? shortWay(m.v[a]! - c) : shortWay(mean - c) + shortWay(m.v[a]! - mean));
      }
    }
    delta[a] = held > 0 ? sum / Math.max(1, held) : 0;
  }
  return into ?? { delta, total };
}

/** How far the committed value moves as `leaving` goes, so the target shows what it did. */
function settle(group: Group, leaving: Member, committed: readonly number[]): number[] {
  const all = fold(group, committed);
  const rest = fold(group, committed, leaving);
  const own = leaving.value().slice();
  return committed.map((c, a) => {
    if (leaving.covers && !leaving.covers[a]) return 0;
    // Holds that cover the committed value outright leave it nothing to show: it takes this one's.
    if (rest.total[a]! >= 1 - 1e-9) return group.angle[a] ? shortWay(own[a]! - c) : own[a]! - c;
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
  }
}

function coverOf(wanted: readonly (number | string)[] | undefined, axes: TargetState['axes']): Uint8Array | null {
  if (!wanted) return null;
  const covers = new Uint8Array(axes.count);
  for (const a of axisIndexes(axes, wanted)) covers[a] = 1;
  return covers;
}

/** Holds a value on a target: it shows `value` where the committed value would show. */
export function openHold<T>(ctx: AnimationContext, o: HoldSource<T>): OpenHold {
  const s = o.target;
  const ax = s.axes;
  const state = s as unknown as TargetState;
  axesFor(ax, o.value(), 'value');
  let gone = false;
  const buffer = new Array<number>(ax.count).fill(0);
  const member: Member = {
    value: ax.write
      ? () => {
        ax.write!(o.value(), buffer, 0);
        return buffer;
      }
      : () => ax.to(o.value()),
    weight: () => (gone ? 0 : share(o.weight())),
    covers: coverOf(o.axes, ax),
    w: 0,
    v: buffer,
  };

  ctx.targets.attach(state);
  s.held += 1;
  let group = groups.get(state);
  if (!group) {
    const angle = new Uint8Array(ax.count);
    for (const a of ax.angles ?? []) angle[a] = 1;
    const made: Group = { members: [], voice: ctx.nextId(), angle };
    const folded: Folded = { delta: [], total: new Array<number>(ax.count).fill(0) };
    groups.set(state, group = made);
    ctx.seedClock();
    s.slot = ctx.codec.hold({
      id: made.voice,
      on: s,
      axes: ax.count,
      at: () => {
        // One array each for as long as the holds stand: a frame of many holds builds none.
        const committed = (s.heldAt ??= new Array<number>(ax.count).fill(0));
        committedInto(s, committed, 0);
        // The codec keeps what this answers as the voice's own value, so that one is new.
        folded.delta = new Array<number>(ax.count);
        const { delta, total } = fold(made, committed, undefined, folded);
        const cover = (s.cover ??= new Array<number>(ax.count).fill(0));
        for (let a = 0; a < cover.length; a++) cover[a] = Math.min(total[a]!, 1);
        return delta;
      },
    });
  }
  const { members, voice } = group;
  members.push(member);
  ctx.touch(state, true);

  return {
    touch: () => { if (!gone) ctx.touch(state); },
    leave(commit) {
      if (gone) return;
      if (commit && !s.discard) {
        const group = groups.get(state)!;
        const committed = ax.to(s.get());
        absorb(s, settle(group, member, committed));
        dim(state, fold(group, committed).total, fold(group, committed, member).total);
      }
      gone = true;
      members.splice(members.indexOf(member), 1);
      s.held -= 1;
      if (s.held === 0) {
        s.heldAt = null;
        s.cover = null;
        groups.delete(state);
        ctx.codec.stop(voice);
        // Nothing stands in front of the committed value now, so it takes what waited beside it.
        const beside = s.beside;
        s.beside = null;
        if (beside) absorb(s, beside);
      }
      ctx.targets.detach(state);
      ctx.touch(state, true);
    },
  };
}
