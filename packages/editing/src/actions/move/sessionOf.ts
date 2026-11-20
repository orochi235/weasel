import type { GestureContext } from '@weasel-js/core/engine';
import type { MoveSession } from './session';
import { createPart } from '@weasel-js/registry';

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

/** The swap behaviors armed on each drag. */
const armedSwapsOf = createPart((_ctx: GestureContext<unknown>) => new Set<object>());

/** Record whether the swap behavior `owner` is armed on this drag. */
export function holdSwap(ctx: GestureContext<unknown>, owner: object, armed: boolean): void {
  if (armed) armedSwapsOf(ctx).add(owner);
  else armedSwapsOf(ctx).delete(owner);
}

/** Whether a swap is armed on this drag: it preempts the drops at release, so they show nothing while it is. */
export function swapArmed(ctx: GestureContext<unknown>): boolean {
  return armedSwapsOf(ctx).size > 0;
}
