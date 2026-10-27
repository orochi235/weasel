import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';
import { composeChildFrame, composeWorldPose, rebaseLocalPose, type PoseAdapter } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { LayoutChild, LayoutContainer } from '../../../../layout/types';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import { groupBySourceContainer } from '../layout/dropPass';
import { resolveLayoutExits } from '../layout/exits';
import type { MoveSession } from '../session';
import { translateOps, unreleasedIds } from '../translate';
import { rebaseTransformOp } from './rebase';

function releaseFrom(
  session: MoveSession,
  delta: { dx: number; dy: number },
  srcId: string,
  leaving: Set<NodeId>,
  commitAdapter: PoseAdapter<unknown>,
): { ops: Op[]; released: NodeId[] } {
  const { dx, dy } = delta;
  const pc = session.pc;
  const released: NodeId[] = [];
  const releasedOps: Op[] = [];
  // Released children keep their parent, so both ends of a transform
  // rebase under the same frame.
  const rebaseReleased = (op: Op): Op => {
    const id = (op.args as { id?: string } | undefined)?.id;
    if (id === undefined) return op;
    const parent = session.scene.get(asNodeId(id))?.parent ?? null;
    return rebaseTransformOp(op, commitAdapter, pc, parent, parent);
  };
  const srcLayout = session.layout?.getLayout(srcId);
  if (!srcLayout?.releaseDrop) return { ops: releasedOps, released };
  const srcContainer: LayoutContainer = {
    id: srcId,
    bounds: session.projection.getBounds(composeChildFrame(commitAdapter, srcId, pc.compose)),
  };
  // What the container is left holding — grown back as each
  // release puts one of its own home again.
  let srcChildren: LayoutChild<unknown>[] =
    session.scene.childrenOf(asNodeId(srcId))
      .filter((cid) => !leaving.has(cid))
      .map((cid) => ({
        id: cid as string,
        pose: composeWorldPose(commitAdapter, cid as string, pc.compose),
      }));
  for (const id of leaving) {
    const startWorld = composeWorldPose(
      grabbedPoseAdapter(session, commitAdapter), id as string, pc.compose,
    );
    const ops = srcLayout.releaseDrop!(srcContainer, srcChildren, {
      id: id as string,
      originPose: startWorld,
      pose: draggedWorldPose(session, grabbedPoseAdapter(session, commitAdapter), id, { dx, dy }),
      sourceContainerId: srcId,
    });
    if (ops === null) continue;
    released.push(id);
    let landed: unknown = startWorld;
    for (const op of ops) {
      const a = op.args as { id?: string; to?: unknown };
      if (op.name === 'transform' && a.id === (id as string)) landed = a.to;
      releasedOps.push(rebaseReleased(op));
    }
    srcChildren = [...srcChildren, { id: id as string, pose: landed }];
  }
  return { ops: releasedOps, released };
}

/** What the source layouts and the exits decide for a drop no container took.
 *  `undefined` when none of them claims any dragged id. */
export function layoutReleaseOps(
  session: MoveSession,
  delta: { dx: number; dy: number },
  dropCenter: { x: number; y: number } | null,
): Op[] | undefined {
  const { dx, dy } = delta;
  // No container accepted the drop. Each source layout gets a say
  // over its own children before they are left wherever the pointer
  // stopped; the rest of the selection falls through to the translate.
  const released = new Set<NodeId>();
  const releasedOps: Op[] = [];
  let exits = new Map<NodeId, NodeId | null>();
  const exitOps: Op[] = [];
  if (session.layout) {
    const pc = session.pc;
    const commitAdapter = sceneViewPoseAdapter(session.scene);
    const sources = groupBySourceContainer(
      session.ids.map((id) => ({
        id,
        sourceContainerId: (session.scene.get(id)?.parent ?? null) as string | null,
      })),
      null,
    );
    for (const [srcId, leaving] of sources) {
      const from = releaseFrom(session, delta, srcId, leaving, commitAdapter);
      for (const id of from.released) released.add(id);
      releasedOps.push(...from.ops);
    }
    // A child its container let go of outside that container leaves it,
    // keeping the world pose it was dropped at.
    exits = resolveLayoutExits(session, dropCenter, session.ids.filter((id) => !released.has(id)));
    for (const [id, toParent] of exits) {
      const node = session.scene.get(id)!;
      const world = draggedWorldPose(session, grabbedPoseAdapter(session, commitAdapter), id, { dx, dy });
      exitOps.push(createReparentOp({
        id: id as string,
        fromParentId: node.parent as string | null,
        toParentId: toParent as string | null,
        label: 'Reparent',
      }));
      exitOps.push(createTransformOp<unknown>({
        id: id as string,
        from: node.pose,
        to: rebaseLocalPose(commitAdapter, world, toParent as string | null, pc.compose, pc.decompose),
        label: session.lifecycle.label,
      }));
    }
  }
  if (released.size === 0 && exits.size === 0) return undefined;
  return [
    ...releasedOps,
    ...exitOps,
    ...translateOps(
      session,
      unreleasedIds(session, released).filter((id) => !exits.has(id)),
      { dx, dy },
    ),
  ];
}
