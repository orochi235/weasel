import type { GestureContext } from '@weasel-js/core/engine';
import type { MoveSession } from './session';

const sessions = new WeakMap<GestureContext<unknown>, MoveSession>();

/** Tie a move's gesture context to its session, once the session exists. */
export function holdSession(ctx: GestureContext<unknown>, session: MoveSession): void {
  sessions.set(ctx, session);
}

/** The move a behavior's gesture context belongs to: undefined in `onStart`, which runs before the session
 *  exists, and for a context no move built, such as a clone's. */
export function moveSessionOf(ctx: GestureContext<unknown>): MoveSession | undefined {
  return sessions.get(ctx);
}

const armedSwaps = new WeakMap<GestureContext<unknown>, Set<object>>();

/** Record whether the swap behavior `owner` is armed on this drag. */
export function holdSwap(ctx: GestureContext<unknown>, owner: object, armed: boolean): void {
  let held = armedSwaps.get(ctx);
  if (!held) armedSwaps.set(ctx, (held = new Set()));
  if (armed) held.add(owner);
  else held.delete(owner);
}

/** Whether a swap is armed on this drag: it preempts the drops at release, so they show nothing while it is. */
export function swapArmed(ctx: GestureContext<unknown>): boolean {
  return (armedSwaps.get(ctx)?.size ?? 0) > 0;
}
