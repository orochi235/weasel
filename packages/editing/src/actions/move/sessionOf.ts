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
