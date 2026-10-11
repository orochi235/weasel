import type { TargetState } from '../target';
import type { AnimationContext } from './context';
import { absorb, axesFor, travel } from './offsets';

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
  /** How far its value is from the committed one, per axis. */
  at(): number[];
  weight(): number;
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
  const member: Member = {
    at: () => travel(ax, ax.to(o.value()), ax.to(s.get())),
    weight: () => (gone ? 0 : share(o.weight())),
  };

  ctx.targets.attach(state);
  let group = groups.get(state);
  if (!group) groups.set(state, group = new Set());
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
      ctx.codec.stop(id);
      ctx.targets.detach(state);
      ctx.touch(state, true);
    },
  };
}
