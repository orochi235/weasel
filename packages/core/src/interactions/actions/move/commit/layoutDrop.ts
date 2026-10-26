import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import { rebaseLocalPose } from 'core/scene/composePose';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import type { LayoutPass } from '../layout/types';
import type { MoveSession } from '../session';
import { rebaseTransformOp } from './rebase';

/** The ops of a drop a layout container accepted: reparents, then each
 *  placement's `commitDrop`, then the source containers' reflow. */
export function layoutDropOps(session: MoveSession, pass: LayoutPass): Op[] {
  const lp = pass;
  const pc = session.pc;
  const commitAdapter = scenePoseAdapter(session.scene);
  const destId = lp.container.id;
  const draggedIds = new Set<string>(session.ids.map((id) => id as string));
  // commitDrop returns world poses (the contract is world in/out).
  // Rebase each transform op to local: a dragged id lands under the
  // destination container; any other id keeps its current parent.
  // `from` rebases under the node's PRE-commit parent.
  const rebaseOpToLocal = (op: Op): Op => {
    const id = (op.args as { id?: string } | undefined)?.id;
    if (id === undefined) return op;
    const curParent = session.scene.get(asNodeId(id))?.parent ?? null;
    const toParent = draggedIds.has(id) ? destId : curParent;
    return rebaseTransformOp(op, commitAdapter, pc, curParent, toParent);
  };
  // Cross-container drop: reparent each dragged node under the
  // destination container, then pose it in that container's frame.
  // Every reparent precedes every drop.
  const reparentOps: Op[] = [];
  const dropOps: Op[] = [];
  for (const placement of lp.placements) {
    if (placement.dragged.sourceContainerId !== destId) {
      reparentOps.push(createReparentOp({
        id: placement.dragged.id,
        fromParentId: placement.dragged.sourceContainerId,
        toParentId: destId,
        label: 'Reparent',
      }));
    }
    const ops = lp.layout.commitDrop(
      lp.container,
      placement.children,
      placement.dragged,
      placement.target,
    );
    for (const op of ops) dropOps.push(rebaseOpToLocal(op));
  }
  const reflowOps: Op[] = [];
  for (const [cid, worldPose] of lp.sourceReflow) {
    const parent = session.scene.get(asNodeId(cid))?.parent ?? null;
    // Source-reflow siblings keep their parent, so `from` is already
    // the live local pose (no rebase); only `to` (a world pose stored
    // in `lp.sourceReflow`) is rebased to local. This is the
    // intentional counterpart to the dropOps rebaser above, where
    // `from` comes from a world `commitDrop` op and so does rebase.
    reflowOps.push(createTransformOp<unknown>({
      id: cid,
      from: session.scene.get(asNodeId(cid))!.pose,
      to: rebaseLocalPose(commitAdapter, worldPose, parent, pc.compose, pc.decompose),
      label: 'Source reflow',
    }));
  }
  return [...reparentOps, ...dropOps, ...reflowOps];
}
