import { easeOut, resolveEasing } from '@weasel-js/geom';
import { stateOf } from '../target';
import type { AnimationHandle, TargetTweenOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { axesFor, bump, keep, minus, plus, takeUp, travel } from './offsets';

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
  s.slot = path
    ? codec.path({ id, on: s, ms, axes: ax.count, at: (u) => minus(ax.to(path(easing(u))), to) })
    : codec.tween({
      id, on: s, ms, ease: easing,
      from: travel(ax, given ?? base, to),
      to: new Array<number>(ax.count).fill(0),
    });
  bump(s as never, codec.own(id)!.value, 1);

  let left = false;
  /** Takes its voice off the target, committing what it had left to travel when `commit`. */
  const leave = (commit: boolean): void => {
    if (left) return;
    left = true;
    const own = codec.own(id);
    if (own) {
      if (commit) keep(s, own.value);
      bump(s as never, own.value, -1);
    }
    codec.stop(id);
    ctx.targets.detach(s as never);
  };

  seed.progress = (virtualNow) => (o.ms <= 0 ? 1 : Math.min(1, virtualNow / o.ms));
  seed.onCancel = () => leave(true);
  seed.tick = (nowMs) => {
    if (ctx.tripwire()) { leave(true); return true; }
    const t = o.ms <= 0 ? 1 : Math.min(1, nowMs / o.ms);
    if (o.onTick) o.onTick(t >= 1 ? o.to : ax.from(plus(to, codec.own(id)!.value)));
    if (t < 1) return false;
    // That last onTick may have canceled it, which commits where it was and never completes.
    if (!ctx.has(id)) return true;
    leave(false);
    ctx.reportEnd(id);
    o.onDone?.();
    return true;
  };
  return ctx.register(seed);
}
