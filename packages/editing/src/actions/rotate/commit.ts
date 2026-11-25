import type { Op, NodeId } from '@weasel-js/core';
import { defaultCommitAdapter } from '@weasel-js/core/engine';
import { commitRunOps, reduceBehaviorEnd } from '@weasel-js/core';
import { syncGestureCurrent } from './frame';
import type { RotateFrame, RotateSession } from './session';
import * as coreOps from '@weasel-js/core/ops';

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
    ops.push(coreOps.setPose<unknown>({ id: id as string, from, to: next, label }));
  }
  return ops;
}

/** Commit the drag as one batch, so one undo entry. `committed` says whether
 *  anything reached the document, and `own` whether what did was the rotation
 *  itself rather than a behavior's ops. */
export function commitRotate(session: RotateSession, frame: RotateFrame): { committed: boolean; own: boolean } {
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
    if (r === null) return { committed: false, own: false };
    if (r !== undefined) return { committed: commitRunOps(target, lifecycle, r), own: false };
  }
  if (frame.delta === 0) return { committed: false, own: false };
  // A node removed mid-drag is skipped, as the move's commit skips it.
  const ids = session.ids.filter((id) => session.scene.get(id) !== undefined);
  const ops = rotateOps(ids, session.originPoses, frame.previews, lifecycle.label);
  if (ops.length === 0) return { committed: false, own: false };
  const committed = commitRunOps(target, lifecycle, ops);
  return { committed, own: committed };
}
