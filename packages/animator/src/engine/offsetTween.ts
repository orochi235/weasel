import { easeOut, resolveEasing } from '@weasel-js/geom';
import { stateOf } from '../target';
import type { AnimationHandle, TargetTweenOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { axesFor, bump, bumpOn, comeOut, commitOffset, goBehind, minus, plus, runsOn, seat, shareBehind, takeUp, times, travel } from './offsets';

/** A tween on a target: its destination is committed as it starts, and its voice is what is
 *  left to travel. */
export function startOffsetTween<T>(ctx: AnimationContext, o: TargetTweenOptions<T>): AnimationHandle {
  const { codec } = ctx;
  const s = stateOf(o.target);
  const ax = s.axes;
  const to = axesFor(ax, o.to, 'to');
  const given = o.from === undefined ? null : axesFor(ax, o.from, 'from');
  const id = ctx.nextId();
  const interrupts = o.interrupt !== false;
  const seed = {
    id, kind: 'tween', cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  // Ahead of reading the committed value: an interrupted animation commits where it stopped.
  if (o.cancelKey != null && interrupts) ctx.interrupt(o.cancelKey, seed);
  const committed = ax.to(s.get());
  const base = takeUp(s);
  const from = o.from === undefined ? ax.from(base) : o.from;
  const path = o.interpolator ? o.interpolator(from, o.to)
    : o.interpolate ? (u: number) => o.interpolate!(from, o.to, u)
      : null;
  const easing = resolveEasing(o.easing ?? easeOut);
  const ms = Math.max(o.ms, 1);

  ctx.targets.attach(s as never);
  s.set(o.to);
  ctx.seedClock();
  const offsetAt = (u: number): number[] => minus(ax.to(path!(easing(u))), to);
  /** Its offset at its start, where a run backward ends. */
  const first = path ? offsetAt(0) : travel(ax, given ?? base, to);
  const share = shareBehind(ax, committed, to, travel(ax, given ?? base, to));
  const own = (): number[] => codec.own(id)!.value;
  const behind = goBehind(s, own, () => times(own(), share), share);
  const on = runsOn(s as never, behind);
  seat(s as never, on, path
    ? codec.path({ id, on, ms, axes: ax.count, at: offsetAt })
    : codec.tween({ id, on, ms, ease: easing, from: first, to: new Array<number>(ax.count).fill(0) }));
  bumpOn(s as never, behind, own(), 1);

  let left = false;
  /** Takes its voice off the target, committing what it had left to travel when `commit`, or
   *  given `at`, that offset in its place. */
  const leave = (commit: boolean, at?: readonly number[]): void => {
    if (left) return;
    left = true;
    const own = codec.own(id);
    const value = at ?? own?.value;
    const moved = value ? times(value, share) : [];
    const shown = comeOut(s, behind, moved);
    if (own) {
      if (commit) commitOffset(s, value!, moved, shown);
      // Voices among the target's own are in its `slot` until the next frame reads it.
      if (!behind.move) bump(s as never, own.value, -1);
    }
    codec.stop(id);
    ctx.targets.detach(s as never);
  };
  /** Ends it at its destination, or played backward, at its start. */
  const end = (atStart: boolean): true => {
    o.onTick?.(atStart ? from : o.to);
    // That last onTick may have canceled it, which commits where it was and never completes.
    if (!ctx.has(id)) return true;
    leave(atStart, atStart ? first : undefined);
    ctx.reportEnd(id);
    o.onDone?.();
    return true;
  };

  seed.progress = (virtualNow) => (o.ms <= 0 ? 1 : Math.min(1, Math.max(0, virtualNow / o.ms)));
  // With no `onTick` to call it has nothing to do until it ends.
  if (!o.onTick) seed.due = Math.max(o.ms, 0);
  seed.onCancel = () => leave(true);
  seed.tick = (nowMs, scale) => {
    if (ctx.tripwire()) { leave(true); return true; }
    if (scale < 0 && (nowMs <= 0 || codec.rewound(id))) return end(true);
    if (o.ms <= 0 || nowMs >= o.ms) return end(false);
    o.onTick?.(ax.from(plus(to, codec.own(id)!.value)));
    return false;
  };
  return ctx.register(seed);
}
