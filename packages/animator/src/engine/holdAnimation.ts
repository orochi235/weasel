import { stateOf } from '../target';
import type { HoldHandle, HoldOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { openHold } from './holds';

const isFn = (x: unknown): x is () => unknown => typeof x === 'function';

/** A hold as a row on the animator's table: it stays until canceled or released. */
export function startHold<T>(ctx: AnimationContext, o: HoldOptions<T>): HoldHandle {
  const target = stateOf(o.target);
  const id = ctx.nextId();
  const { value, weight = 1 } = o;
  const seed = {
    id, kind: 'hold', cancelKey: o.cancelKey, label: o.label, target,
    keepExisting: o.interrupt === false,
    // A hold of plain values changes only when told to, so it asks for no frames of its own.
    idle: !isFn(value) && !isFn(weight),
  } as AnimationSeed;
  // Ahead of opening: an interrupted hold commits what it showed, which this one then stands in for.
  if (o.cancelKey != null && o.interrupt !== false) ctx.interrupt(o.cancelKey, seed);
  const held = openHold(ctx, {
    target,
    value: isFn(value) ? (value as () => T) : () => value,
    weight: isFn(weight) ? weight : () => weight,
    axes: o.axes,
  });
  seed.onCancel = () => held.leave(true);
  seed.tick = () => {
    if (!ctx.tripwire()) return false;
    held.leave(true);
    return true;
  };
  const base = ctx.register(seed);
  return {
    ...base,
    touch: held.touch,
    release(r) {
      if (!ctx.has(id)) return;
      held.leave(r?.commit !== false);
      ctx.finish(id);
    },
  };
}
