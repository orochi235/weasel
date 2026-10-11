import { SceneArrivalRefused } from 'core/scene/arrivals';
import type { Op } from 'core/ops/types';
import { commitGestureOps, reduceBehaviorEnd } from '../../gestureLifecycle';
import { translatePoseViaDescriptor } from '../../resize/geometry';
import { planeDelta } from '../delta';
import { landedDescendantOps } from '../landedDescendants';
import type { LayoutPass } from '../layout/types';
import type { MoveSession, ReparentOnDrop } from '../session';
import { translateOps } from '../translate';
import { layoutDropOps } from './layoutDrop';
import { layoutReleaseOps } from './layoutRelease';
import { reparentOps, resolveDropTarget, type DropTarget } from './reparent';

export interface CommitInput {
  session: MoveSession;
  delta: { dx: number; dy: number };
  pass: LayoutPass | null;
  dropCenter: { x: number; y: number } | null;
  /** Where the pointer was let go; null when the end carried none and no move was seen. */
  at: { x: number; y: number } | null;
}

function behaviorCommit(
  session: MoveSession,
  delta: { dx: number; dy: number },
  commitOps: (ops: Op[]) => void,
): boolean | undefined {
  const { dx, dy } = delta;
  // Behavior pipeline owns the commit if any behavior returns non-undefined.
  if (session.behaviors.length > 0) {
    const gctx = session.gestureCtx;
    for (const [id, ori] of session.startPoses) {
      const own = planeDelta(session, id, dx, dy);
      gctx.current.set(id as string, translatePoseViaDescriptor(ori, own.dx, own.dy, session.descriptorOf(id)));
    }
    const r = reduceBehaviorEnd(session.behaviors, gctx);
    if (r === null) return false;           // abort (e.g. snap-back)
    if (r !== undefined) {
      commitOps(r);
      return true;
    }
  }
  return undefined;
}

function reparentCommit(
  session: MoveSession,
  dropTarget: DropTarget,
  mode: ReparentOnDrop,
  delta: { dx: number; dy: number },
  commitOps: (ops: Op[]) => void,
): boolean {
  const { dx, dy } = delta;
  const ops = reparentOps(session, dropTarget, mode, { dx, dy });
  const before = rootPlacements(session);
  try {
    commitOps(ops);
  } catch (err) {
    // The transient path lets a refused arrival out; the recorded one reverts it inside the scene.
    if (!(err instanceof SceneArrivalRefused)) throw err;
  }
  // A consumer's `applyOps` may keep the document elsewhere, so it is taken at its word.
  if (session.applyOps !== undefined && !session.lifecycle.transient) return true;
  // Either way a refusal leaves every root where it was.
  return rootPlacements(session) !== before;
}

/** Where each dragged root sits: its parent, its layer, and its stored position. */
function rootPlacements(session: MoveSession): string {
  return session.ids.map((id) => {
    const node = session.scene.get(id);
    if (!node) return '';
    const b = session.descriptorOf(id).getBounds(node.pose);
    return `${node.parent}:${node.layer}:${b.x},${b.y}`;
  }).join('|');
}

/** Commit the drag. Returns whether anything reached the document. */
export function commitMove(input: CommitInput): boolean {
  const { session, pass, dropCenter, at } = input;
  // Apply the final delta as a single batch → one undo entry.
  const { dx, dy } = input.delta;
  let committed = false;
  const commitOps = (ops: Op[]): void => {
    const followers = landedDescendantOps(
      {
        scene: session.scene,
        projection: session.projection,
        startPoses: session.startPoses,
        carried: session.carried,
        roots: session.ids,
        label: session.lifecycle.label,
      },
      ops,
    );
    commitGestureOps(session, session.lifecycle, [...ops, ...followers]);
    committed = true;
  };

  const owned = behaviorCommit(session, { dx, dy }, commitOps);
  if (owned !== undefined) return owned;

  // No-op if no movement (sub-threshold drag or zero delta).
  if (dx === 0 && dy === 0) return false;

  // Layout drop commit — takes precedence over reparent-on-drop when a
  // layout container accepted the drag this gesture. One placement per
  // dragged child, replayed in the order the preview resolved them.
  // TODO: geometryProjection for drop-reflow — left pose-only because the
  // reflow distributes per-child poses with no single global delta; not
  // exercised by the geometry contract gate.
  if (session.layout && pass) {
    const ops = layoutDropOps(session, pass);
    if (ops.length > 0) commitOps(ops);
    return committed;
  }
  const release = session.layout ? layoutReleaseOps(session, { dx, dy }, dropCenter) : undefined;
  if (release !== undefined) {
    if (release.length > 0) commitOps(release);
    return committed;
  }

  // Reparent-on-drop, when opted in via `opts.params.reparentOnDrop`.
  // Resolves the drop target via the `nodeAtPoint` dep (sourced by
  // `<SceneCanvas>`) and reparents each moved root under it, then
  // writes the translated pose in the new parent's frame so the
  // visual position is preserved across the parent swap.
  // An end with no drag carries no pointer: the dispatcher's `cancelAll`
  // reports the world origin.
  const mode = session.reparentOnDrop();
  const dropTarget = mode !== 'off'
    ? resolveDropTarget(session, at)
    : null;
  if (dropTarget) {
    committed = reparentCommit(session, dropTarget, mode, { dx, dy }, commitOps);
  } else {
    // No reparent — translate-only commit, emitted as transform ops so
    // it routes through the consumer `applyOps` hook (consumer history)
    // when present, else the scene's own history. Under scene v1's
    // absolute-pose semantics every node stores world coords
    // independently, so a container drag must explicitly re-stamp every
    // cascaded descendant by the same dx/dy — otherwise children stay at
    // their old absolute positions (visually they snap to the
    // container's former location).
    // Translate the data-held geometry by the same (dx,dy). Opt-in via
    // the geometryProjection seam; a no-op when the dep is absent.
    const ops = translateOps(session, [...session.ids, ...session.cascadeIds], { dx, dy });
    if (ops.length > 0) commitOps(ops);
  }
  return committed;
}
