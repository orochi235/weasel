import type { Op } from 'core/ops/types';
import { commitGestureOps, reduceBehaviorEnd } from '../../gestureLifecycle';
import { draggedStoredPose } from '../delta';
import { landedDescendantOps } from '../landedDescendants';
import type { MoveSession } from '../session';
import { rootTranslateOps, translateOps } from '../translate';

export interface CommitInput {
  session: MoveSession;
  delta: { dx: number; dy: number };
  /** Where the pointer was let go, or the last move's point when the end carried none. */
  at: { x: number; y: number };
}

/** What the behaviors answer for the commit: ops, `null` to abort, or
 *  `undefined` when every one of them leaves it to the default translate. */
function endBehaviors(
  session: MoveSession,
  delta: { dx: number; dy: number },
  at: { x: number; y: number },
): Op[] | null | undefined {
  const { dx, dy } = delta;
  const gctx = session.gestureCtx;
  for (const [id, ori] of session.startPoses) {
    gctx.current.set(id as string, draggedStoredPose(session, id, ori, dx, dy));
  }
  return reduceBehaviorEnd(session.behaviors, gctx, {
    translateOps: (ids) => rootTranslateOps(session, ids, delta),
    pointer: at,
  });
}

/** Commit the drag. Returns whether anything reached the document: false
 *  when there was nothing to write, or a container refused what it was sent. */
export function commitMove(input: CommitInput): boolean {
  const { session, at } = input;
  // Apply the final delta as a single batch → one undo entry.
  const { dx, dy } = input.delta;
  const commitOps = (ops: Op[]): boolean => {
    const followers = landedDescendantOps(
      {
        scene: session.scene,
        projection: session.projection,
        startPoses: session.startPoses,
        label: session.lifecycle.label,
      },
      ops,
    );
    return commitGestureOps(session, session.lifecycle, [...ops, ...followers]);
  };

  // Behavior pipeline owns the commit if any behavior returns non-undefined.
  const answer = endBehaviors(session, { dx, dy }, at);
  if (answer === null) return false;           // abort (e.g. snap-back)
  if (answer !== undefined) return commitOps(answer);

  // No-op if no movement (sub-threshold drag or zero delta).
  if (dx === 0 && dy === 0) return false;

  // No behavior claimed it — translate-only commit, emitted as transform ops
  // so it routes through the consumer `applyOps` hook (consumer history)
  // when present, else the scene's own history. Under scene v1's
  // absolute-pose semantics every node stores world coords
  // independently, so a container drag must explicitly re-stamp every
  // cascaded descendant by the same dx/dy — otherwise children stay at
  // their old absolute positions (visually they snap to the
  // container's former location).
  // Translate the data-held geometry by the same (dx,dy). Opt-in via
  // the geometryProjection seam; a no-op when the dep is absent.
  const ops = translateOps(session, [...session.ids, ...session.cascadeIds], { dx, dy });
  return ops.length > 0 && commitOps(ops);
}
