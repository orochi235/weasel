import type { TargetState } from '../target';
import type { AnimationContext } from './context';
import { absorb, axesFor, shortWay } from './offsets';

/** What {@link openHold} takes. */
export interface HoldSource<T> {
  target: TargetState<T>;
  /** The value to show in place of the committed one, read whenever the target is. */
  value(): T;
  /** Its share among the target's holds, read as `value` is. */
  weight(): number;
  /** Indexes of the axes it holds. Default: all of them. */
  axes?: readonly number[];
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
  /** Its value's axes. */
  value(): number[];
  weight(): number;
  /** Nonzero at each axis it holds; null where it holds them all. */
  covers: Uint8Array | null;
}

/** A target's holds, which reach it as one voice. */
interface Group {
  members: Set<Member>;
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
function fold(group: Group, committed: readonly number[], skip?: Member): Folded {
  const n = committed.length;
  const delta = new Array<number>(n).fill(0);
  const total = new Array<number>(n).fill(0);
  const live: { v: number[]; w: number; covers: Uint8Array | null }[] = [];
  for (const m of group.members) {
    if (m === skip) continue;
    const w = m.weight();
    if (w > 0) live.push({ v: m.value(), w, covers: m.covers });
  }
  for (let a = 0; a < n && live.length > 0; a++) {
    const c = committed[a]!;
    let sum = 0;
    let sin = 0;
    let cos = 0;
    for (const h of live) {
      if (h.covers && !h.covers[a]) continue;
      total[a] = total[a]! + h.w;
      if (!group.angle[a]) sum += h.w * (h.v[a]! - c);
      else {
        sin += h.w * Math.sin(h.v[a]!);
        cos += h.w * Math.cos(h.v[a]!);
      }
    }
    if (total[a] === 0) continue;
    if (group.angle[a]) {
      // Where the directions cancel out there is no way round between them: each from committed.
      const mean = Math.hypot(sin, cos) < 1e-9 ? null : Math.atan2(sin, cos);
      for (const h of live) {
        if (h.covers && !h.covers[a]) continue;
        sum += h.w * (mean === null ? shortWay(h.v[a]! - c) : shortWay(mean - c) + shortWay(h.v[a]! - mean));
      }
    }
    delta[a] = sum / Math.max(1, total[a]!);
  }
  return { delta, total };
}

/** How far the committed value moves as `leaving` goes, so the target shows what it did. */
function settle(group: Group, leaving: Member, committed: readonly number[]): number[] {
  const all = fold(group, committed);
  const rest = fold(group, committed, leaving);
  const own = leaving.value();
  return committed.map((c, a) => {
    if (leaving.covers && !leaving.covers[a]) return 0;
    // Holds that cover the committed value outright leave it nothing to show: it takes this one's.
    if (rest.total[a]! >= 1 - 1e-9) return group.angle[a] ? shortWay(own[a]! - c) : own[a]! - c;
    return (all.delta[a]! - rest.delta[a]!) / (1 - rest.total[a]!);
  });
}

function coverOf(axes: readonly number[] | undefined, count: number): Uint8Array | null {
  if (!axes) return null;
  const covers = new Uint8Array(count);
  for (const a of axes) {
    if (!Number.isInteger(a) || a < 0 || a >= count) {
      throw new Error(`animator: \`axes\` names axis ${a} of a target with ${count}`);
    }
    covers[a] = 1;
  }
  return covers;
}

/** Holds a value on a target: it shows `value` where the committed value would show. */
export function openHold<T>(ctx: AnimationContext, o: HoldSource<T>): OpenHold {
  const s = o.target;
  const ax = s.axes;
  const state = s as unknown as TargetState;
  axesFor(ax, o.value(), 'value');
  let gone = false;
  const member: Member = {
    value: () => ax.to(o.value()),
    weight: () => (gone ? 0 : share(o.weight())),
    covers: coverOf(o.axes, ax.count),
  };

  ctx.targets.attach(state);
  s.held += 1;
  let group = groups.get(state);
  if (!group) {
    const angle = new Uint8Array(ax.count);
    for (const a of ax.angles ?? []) angle[a] = 1;
    const made: Group = { members: new Set(), voice: ctx.nextId(), angle };
    groups.set(state, group = made);
    ctx.seedClock();
    s.slot = ctx.codec.hold({
      id: made.voice,
      on: s,
      axes: ax.count,
      at: () => {
        const committed = ax.to(s.get());
        s.heldAt = committed;
        return fold(made, committed).delta;
      },
    });
  }
  const { members, voice } = group;
  members.add(member);
  ctx.touch(state, true);

  return {
    touch: () => { if (!gone) ctx.touch(state); },
    leave(commit) {
      if (gone) return;
      if (commit) absorb(s, settle(groups.get(state)!, member, ax.to(s.get())));
      gone = true;
      members.delete(member);
      s.held -= 1;
      if (s.held === 0) {
        s.heldAt = null;
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
