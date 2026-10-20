import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { BehaviorResult, MoveBehavior } from '../../../gestures/types';
import { layoutDropOps } from '../commit/layoutDrop';
import { layoutReleaseOps } from '../commit/layoutRelease';
import { runDropPass } from '../layout/dropPass';
import { landReleased, releasedPoses, stepGlide, type Released } from '../layout/glide';
import type { DropPass } from '../layout/types';
import type { MoveGesture } from '../session';

/**
 * The move behavior that drops the selection into the layout container under
 * it. Each move it resolves the drop and shows the siblings making room; on
 * release it answers with the container's `commitDrop`, or, outside every
 * container, with what the source layouts' `releaseDrop` and the exits decide.
 *
 * Built by the move action for one drag, after the binding's own behaviors, and
 * only when the `layout` dep is present.
 */
export function layoutDrop(move: MoveGesture): MoveBehavior<unknown> {
  // This frame's pass; reset by every move, a throwing one included.
  let drop: DropPass | null = null;
  const gliding = new Set<NodeId>();
  let released: Map<NodeId, Released> | null = null;
  // Before the commit: where each dragged id is shown as the gesture closes.
  const noteReleased = (): void => {
    const session = move.session();
    if (session.layout?.reflow) released = releasedPoses(session, move.frame().previews);
  };

  return {
    onMove(ctx, proposed): BehaviorResult<unknown> | void {
      drop = null;
      const session = move.session();
      drop = runDropPass(
        session,
        { dx: proposed.dx, dy: proposed.dy },
        { x: ctx.pointer.worldX, y: ctx.pointer.worldY },
      );
      const opaque = drop?.pass?.reflowIds;
      const reflow = session.layout?.reflow;
      if (!reflow) return { poses: drop?.reflow, opaque };
      stepGlide(reflow, gliding, drop?.reflow ?? new Map());
      return { opaque };
    },

    onEnd(_ctx, end): Op[] | null | void {
      noteReleased();
      if (end.answered) return;
      const session = move.session();
      const { delta } = move.frame();
      // No-op if no movement (sub-threshold drag or zero delta).
      if (delta.dx === 0 && delta.dy === 0) return;
      // A drop or a release that claims the selection and writes nothing
      // commits nothing: the translate must not run in its place.
      const orAbort = (ops: Op[]): Op[] | null => (ops.length > 0 ? ops : null);
      // Layout drop commit — takes precedence over reparent-on-drop when a
      // layout container accepted the drag this gesture. One placement per
      // dragged child, replayed in the order the preview resolved them.
      // TODO: geometryProjection for drop-reflow — left pose-only because the
      // reflow distributes per-child poses with no single global delta; not
      // exercised by the geometry contract gate.
      if (drop?.pass) return orAbort(layoutDropOps(session, drop.pass));
      const release = layoutReleaseOps(session, delta, drop?.dropCenter ?? null);
      return release === undefined ? undefined : orAbort(release);
    },

    onCancel: noteReleased,

    onSettled(): void {
      const session = move.session();
      const reflow = session.layout?.reflow;
      // After the commit: each glide settles onto the pose the document now
      // holds, or back home on a cancel — the dragged ids from where they
      // were let go.
      if (reflow) {
        for (const id of gliding) reflow.settle(id as string);
        landReleased(session, reflow, released ?? new Map());
      }
      gliding.clear();
    },
  };
}
