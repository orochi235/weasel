import type { InvocationCtx, Point2 } from '@weasel-js/routing';
import type { PointerState } from '../gestures/types';

/** The pointer a behavior is told: `world`, and the client point `ctx` carries, if any. */
export function pointerStateOf(world: Point2, ctx: Pick<InvocationCtx, 'screen'>): PointerState {
  const pointer: PointerState = { worldX: world.x, worldY: world.y };
  if (ctx.screen) {
    pointer.clientX = ctx.screen.x;
    pointer.clientY = ctx.screen.y;
  }
  return pointer;
}
