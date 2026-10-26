import type { MoveBehavior } from '../../../gestures/types';
import { reparentOps, resolveDrop } from '../commit/reparent';
import { refusalOverlays } from '../refusal';
import type { MoveGesture } from '../session';

/**
 * The move behavior that reparents the selection under the node the pointer is
 * released over, when the binding's `reparentOnDrop` param asks for it. While
 * the pointer is over a container that refuses the drop with a reason, it draws
 * the refusal, and a release there moves nothing.
 *
 * Built by the move action for one drag and run last, so a binding's behavior
 * or a layout drop that claims the commit preempts it.
 */
export function reparentOnDrop(move: MoveGesture): MoveBehavior<unknown> {
  const dropAt = (at: { x: number; y: number }) => {
    const session = move.session();
    return session.reparentOnDrop() === 'off' ? null : resolveDrop(session, at);
  };
  return {
    onMove(ctx) {
      const at = { x: ctx.pointer.worldX, y: ctx.pointer.worldY };
      const drop = dropAt(at);
      return drop !== null && 'refused' in drop ? { overlays: refusalOverlays(drop.refused, at) } : undefined;
    },
    onEnd(_ctx, end) {
      if (end.answered) return;
      const session = move.session();
      const { delta } = move.frame();
      // No-op if no movement (sub-threshold drag or zero delta).
      if (delta.dx === 0 && delta.dy === 0) return;
      // Resolves the drop target via the `nodeAtPoint` dep (sourced by
      // `<SceneCanvas>`) and reparents each moved root under it, then
      // writes the translated pose in the new parent's frame so the
      // visual position is preserved across the parent swap.
      // An end with no drag carries no pointer: the dispatcher's `cancelAll`
      // reports the world origin.
      const drop = dropAt(end.pointer);
      if (drop === null) return undefined;
      if ('refused' in drop) return null;
      return reparentOps(session, drop, session.reparentOnDrop(), delta);
    },
  };
}
