import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import type { NodeId } from 'core/scene/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { commitGestureOps, reduceBehaviorEnd } from '../gestureLifecycle';
import { syncGestureCurrent } from './frame';
import type { RotateFrame, RotateSession } from './session';

/** One transform op per rotated node: `from` the pose stored at press, `to`
 *  its preview. */
export function rotateOps(
  ids: readonly NodeId[],
  originPoses: ReadonlyMap<NodeId, unknown>,
  previews: ReadonlyMap<NodeId, unknown>,
  label: string,
): Op[] {
  const ops: Op[] = [];
  for (const id of ids) {
    const next = previews.get(id);
    if (next === undefined) continue;
    const from = originPoses.get(id);
    if (from === undefined) continue;
    ops.push(createTransformOp<unknown>({ id: id as string, from, to: next, label }));
  }
  return ops;
}

/** Commit the drag as one batch, so one undo entry. Returns whether anything
 *  reached the document. */
export function commitRotate(session: RotateSession, frame: RotateFrame): boolean {
  const { lifecycle } = session;
  const target = {
    scene: session.scene,
    applyOps: session.applyOps,
    finish: session.finish,
    adapter: defaultCommitAdapter(session.scene, session.selectionMethods),
  };
  if (session.behaviors.length > 0) {
    syncGestureCurrent(session.gestureCtx, session.turn, frame.delta);
    const r = reduceBehaviorEnd(session.behaviors, session.gestureCtx);
    if (r === null) return false;
    if (r !== undefined) return commitGestureOps(target, lifecycle, r);
  }
  if (frame.delta === 0) return false;
  const ops = rotateOps(session.ids, session.originPoses, frame.previews, lifecycle.label);
  if (ops.length === 0) return false;
  return commitGestureOps(target, lifecycle, ops);
}
