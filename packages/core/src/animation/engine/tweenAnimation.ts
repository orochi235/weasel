import { easeOut, resolveEasing } from '@weasel-js/geom';
import type { AnimationHandle, TweenOptions } from '../types';
import { axesOf } from './axes';
import type { AnimationContext } from './context';

/** A tween that hands each frame's value to the caller's `onTick`. */
export function startTween<T>(ctx: AnimationContext, o: TweenOptions<T>): AnimationHandle {
  const { codec } = ctx;
  // blits blends in a straight line, which a caller's own function may not do.
  const fromAxes = o.interpolate || o.interpolator ? null : axesOf(o.from);
  const toAxes = fromAxes && axesOf(o.to);
  const axes = fromAxes && toAxes && toAxes.shape === fromAxes.shape ? fromAxes : null;
  // Refused here rather than on a tick, where a throw would stop every other animation.
  if (!axes && !o.interpolate && !o.interpolator) {
    throw new Error('tween: interpolate or interpolator is required for non-numeric T');
  }
  const id = ctx.nextId();
  const easing = resolveEasing(o.easing ?? easeOut);
  // Precedence: factory > per-tick. Factory is built once at tween start so
  // expensive setup (color space conversion etc.) doesn't repeat per frame.
  const factoryFn = o.interpolator ? o.interpolator(o.from, o.to) : null;
  let lastValueEmitted = false;
  ctx.seedClock();
  // Started ahead of `register`, whose `start` listeners may already cancel it.
  const reader = codec.tween({
    id, ms: Math.max(o.ms, 1), ease: easing,
    from: axes ? axes.to(o.from) : [0],
    to: axes ? axes.to(o.to) : [1],
  });
  return ctx.register({
    id,
    kind: 'tween',
    cancelKey: o.cancelKey,
    label: o.label,
    progress: (virtualNow) => (o.ms <= 0 ? 1 : Math.min(1, virtualNow / o.ms)),
    // `nowMs` is the call's own virtual time, so it still decides when the tween ends; the codec
    // supplies only the value in between.
    tick(nowMs) {
      if (ctx.tripwire()) { codec.stop(id); return true; }
      const t = o.ms <= 0 ? 1 : Math.min(1, nowMs / o.ms);
      let value: T;
      if (axes) {
        value = t >= 1 ? o.to : axes.from(reader.cols, reader.at);
      } else {
        const eased = t >= 1 ? easing(1) : reader.cols[reader.at]!;
        value = factoryFn ? factoryFn(eased) : o.interpolate!(o.from, o.to, eased);
      }
      o.onTick(value);
      if (t >= 1 && !lastValueEmitted) {
        lastValueEmitted = true;
        codec.stop(id);
        // That last onTick may have canceled us — deregistering the id.
        // A canceled tween never completes, whenever the cancel landed.
        if (ctx.has(id)) {
          ctx.reportEnd(id);
          o.onDone?.();
        }
        return true;
      }
      return false;
    },
  });
}
