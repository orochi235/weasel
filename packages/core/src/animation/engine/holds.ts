import type { TargetState } from '../target';
import type { AnimationContext } from './context';
import { absorb, axesFor, shortWay, travel } from './offsets';

/** What {@link openHold} takes. */
export interface HoldSource<T> {
  target: TargetState<T>;
  /** The value to show in place of the committed one, read whenever the target is. */
  value(): T;
  /** Its share among the target's holds, read as `value` is. */
  weight(): number;
}

/** A hold's voice on its target, apart from any row on the animator's table. */
export interface OpenHold {
  /** Says `value` or `weight` changed outside a frame's own reading of them. */
  touch(): void;
  /** Takes the voice off the target. With `commit`, the committed value moves so that what the
   *  target shows stays where it was. */
  leave(commit: boolean): void;
}

interface Member {
  /** Its value's axes. */
  value(): number[];
  /** How far its value is from the committed one, per axis. */
  at(): number[];
  weight(): number;
}

/** The direction the group's values on angle axis `i` average to by weight, or null where they
 *  cancel out. */
function meanAngle(group: Set<Member>, i: number): number | null {
  let sin = 0;
  let cos = 0;
  for (const m of group) {
    const w = m.weight();
    if (!(w > 0)) continue;
    const a = m.value()[i]!;
    sin += w * Math.sin(a);
    cos += w * Math.cos(a);
  }
  return Math.hypot(sin, cos) < 1e-9 ? null : Math.atan2(sin, cos);
}

const groups = new WeakMap<TargetState, Set<Member>>();

const share = (w: number): number => (w > 0 ? Math.min(w, 1) : 0);

/**
 * How far the committed value moves as `leaving` goes, so the target shows what it did. The
 * target's holds fold as blits folds a locus: each weighs `w / max(1, total)`, and what the
 * weights leave short of 1 is the committed value's.
 */
function settle(group: Set<Member>, leaving: Member, axes: number): number[] {
  const own = leaving.weight();
  const out = new Array<number>(axes).fill(0);
  if (!(own > 0)) return out;
  let total = 0;
  for (const m of group) total += m.weight();
  const rest = total - own;
  // Holds that cover the committed value outright leave it nothing to show: it takes this one's.
  if (rest >= 1 - 1e-9) return leaving.at();
  const before = Math.max(1, total);
  for (const m of group) {
    const w = m.weight();
    const lost = m === leaving ? w / before : w / before - w;
    if (lost === 0) continue;
    const d = m.at();
    for (let i = 0; i < axes; i++) out[i] = out[i]! + (lost * d[i]!) / (1 - rest);
  }
  return out;
}

/** Cues an absolute voice on a target: it shows `value` where the committed value would show. */
export function openHold<T>(ctx: AnimationContext, o: HoldSource<T>): OpenHold {
  const s = o.target;
  const ax = s.axes;
  const state = s as unknown as TargetState;
  axesFor(ax, o.value(), 'value');
  const id = ctx.nextId();
  let gone = false;
  const group = groups.get(state) ?? new Set<Member>();
  groups.set(state, group);
  const member: Member = {
    value: () => ax.to(o.value()),
    at: () => {
      const committed = ax.to(s.get());
      s.heldAt = committed;
      const value = ax.to(o.value());
      const d = travel(ax, value, committed);
      if (group.size < 2) return d;
      // Among several holds an angle goes by way of where they meet, so two holds turn the
      // short way toward each other and not each the short way from the committed value.
      for (const i of ax.angles ?? []) {
        const mean = meanAngle(group, i);
        if (mean !== null) d[i] = shortWay(mean - committed[i]!) + shortWay(value[i]! - mean);
      }
      return d;
    },
    weight: () => (gone ? 0 : share(o.weight())),
  };

  ctx.targets.attach(state);
  s.held += 1;
  group.add(member);
  ctx.seedClock();
  s.slot = ctx.codec.hold({ id, on: s, axes: ax.count, at: member.at, weight: member.weight });
  ctx.touch(state, true);

  return {
    touch: () => { if (!gone) ctx.touch(state); },
    leave(commit) {
      if (gone) return;
      if (commit) absorb(s, settle(group, member, ax.count));
      gone = true;
      group.delete(member);
      s.held -= 1;
      if (s.held === 0) {
        s.heldAt = null;
        // Nothing stands in front of the committed value now, so it takes what waited beside it.
        const beside = s.beside;
        s.beside = null;
        if (beside) absorb(s, beside);
      }
      ctx.codec.stop(id);
      ctx.targets.detach(state);
      ctx.touch(state, true);
    },
  };
}
