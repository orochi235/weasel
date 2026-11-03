import type { MoveBehavior } from '../../../gestures/types';
import { pageDropOps, pageDrops } from '../commit/pageDrop';
import type { MoveGesture } from '../session';

/**
 * The move behavior that keeps a paged scene's content on its pages: a page's
 * child released on another page moves into it, and one released off every
 * page goes to the top of the tree with the pasteboard on, or stays in its
 * page with part of it still on it with the pasteboard off. With the
 * pasteboard on, a root released on a page moves into it. A move within one
 * page, and one of a node deeper than a page's child, is left to the
 * behaviors after it.
 *
 * Built by the move action for one drag in a paged scene, before
 * reparent-on-drop, whose `reparentOnDrop` param it does not read.
 */
export function pageDrop(move: MoveGesture): MoveBehavior<unknown> {
  return {
    onEnd(_ctx, end) {
      if (end.answered) return;
      const session = move.session();
      const { delta } = move.frame();
      if (delta.dx === 0 && delta.dy === 0) return;
      const drops = pageDrops(session, end.pointer, delta);
      if (drops === null) return;
      if (drops === 'refused') return null;
      return pageDropOps(session, drops, delta);
    },
  };
}
