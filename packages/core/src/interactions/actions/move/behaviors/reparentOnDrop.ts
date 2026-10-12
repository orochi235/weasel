import type { MoveBehavior } from '../../../gestures/types';
import { reparentOps, resolveDropTarget } from '../commit/reparent';
import type { MoveGesture } from '../session';

/**
 * The move behavior that reparents the selection under the node the pointer is
 * released over, when the binding's `reparentOnDrop` param asks for it.
 *
 * Built by the move action for one drag and run last, so a binding's behavior
 * or a layout drop that claims the commit preempts it.
 */
export function reparentOnDrop(move: MoveGesture): MoveBehavior<unknown> {
  return {
    onEnd(_ctx, end) {
      if (end.answered) return;
      const session = move.session();
      const { delta } = move.frame();
      // No-op if no movement (sub-threshold drag or zero delta).
      if (delta.dx === 0 && delta.dy === 0) return;
      // Reparent-on-drop, when opted in via `opts.params.reparentOnDrop`.
      // Resolves the drop target via the `nodeAtPoint` dep (sourced by
      // `<SceneCanvas>`) and reparents each moved root under it, then
      // writes the translated pose in the new parent's frame so the
      // visual position is preserved across the parent swap.
      // An end with no drag carries no pointer: the dispatcher's `cancelAll`
      // reports the world origin.
      const mode = session.reparentOnDrop();
      const target = mode !== 'off' ? resolveDropTarget(session, end.pointer) : null;
      return target ? reparentOps(session, target, mode, delta) : undefined;
    },
  };
}
