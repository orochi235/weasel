import { asNodeId, type NodeId, followerOpsFor, keepOnPage, pasteboardOn, placedPage } from '@weasel-js/core';
import { composeWorldPose, rebaseLocalPose, type PoseAdapter, sceneViewPoseAdapter, poseDescriptorForNode, pageIdOf } from '@weasel-js/core/engine';
import type { Op } from '@weasel-js/core';
import type { LayoutChild, LayoutContainer } from '@weasel-js/core/engine';
import { draggedWorldPose, grabbedPoseAdapter } from '../delta';
import { groupBySourceContainer } from '../layout/dropPass';
import { resolveLayoutExits } from '../layout/exits';
import type { MoveSession } from '../session';
import { translateOps, unreleasedIds } from '../translate';
import { rebaseTransformOp } from './rebase';
import { belowRoots } from './pageDrop';
import { landedCascadeOps } from './reparent';
import { containerView, contentBoxOf, draggedInView, opInWorld } from '../layout/view';
import * as coreOps from '@weasel-js/core/ops';

function releaseFrom(
  session: MoveSession,
  delta: { dx: number; dy: number },
  srcId: string,
  leaving: Set<NodeId>,
  commitAdapter: PoseAdapter<unknown>,
): { ops: Op[]; released: NodeId[] } | null {
  const { dx, dy } = delta;
  const pc = session.pc;
  const released: NodeId[] = [];
  const releasedOps: Op[] = [];
  const srcLayout = session.layout?.getLayout(srcId);
  const srcNode = session.scene.get(asNodeId(srcId));
  if (!srcLayout?.releaseDrop || !srcNode) return { ops: releasedOps, released };
  const g = poseDescriptorForNode(session.projection, srcNode);
  const srcWorld = composeWorldPose(commitAdapter, srcId, pc.compose);
  const view = containerView(pc, g, srcWorld);
  if (view === null) return { ops: releasedOps, released };
  // Released children keep their parent, so both ends of a transform
  // rebase under the same frame.
  const rebaseReleased = (op: Op): Op | null => {
    const id = (op.args as { id?: string } | undefined)?.id;
    if (id === undefined) return op;
    const parent = session.scene.get(asNodeId(id))?.parent ?? null;
    return rebaseTransformOp(opInWorld(view, op), commitAdapter, pc, parent, parent);
  };
  const srcContainer: LayoutContainer = {
    id: srcId,
    bounds: contentBoxOf(g, view, commitAdapter, srcId, srcWorld),
    node: srcNode,
  };
  // What the container is left holding — grown back as each
  // release puts one of its own home again.
  let srcChildren: LayoutChild<unknown>[] =
    session.scene.childrenOf(asNodeId(srcId))
      .filter((cid) => !leaving.has(cid))
      .map((cid) => ({
        id: cid as string,
        pose: view.toStrategy(composeWorldPose(commitAdapter, cid as string, pc.compose)),
        node: session.scene.get(cid),
      }));
  for (const id of leaving) {
    const startWorld = composeWorldPose(
      grabbedPoseAdapter(session, commitAdapter), id as string, pc.compose,
    );
    const dragged = draggedInView(view, {
      id: id as string,
      originPose: startWorld,
      pose: draggedWorldPose(session, grabbedPoseAdapter(session, commitAdapter), id, { dx, dy }),
      sourceContainerId: srcId,
    });
    const ops = srcLayout.releaseDrop!(srcContainer, srcChildren, dragged);
    if (ops === null) continue;
    released.push(id);
    let landed: unknown = dragged.originPose;
    for (const op of ops) {
      const a = op.args as { id?: string; to?: unknown };
      if (op.name === 'transform' && a.id === (id as string)) landed = a.to;
      const stored = rebaseReleased(op);
      if (stored === null) return null;
      releasedOps.push(stored);
    }
    srcChildren = [...srcChildren, { id: id as string, pose: landed, node: session.scene.get(id) }];
  }
  return { ops: releasedOps, released };
}

/** What the source layouts and the exits decide for a drop no container took.
 *  `undefined` when none of them claims any dragged id, `null` when a node they
 *  move would land in a singular frame, so the release refuses whole. */
export function layoutReleaseOps(
  session: MoveSession,
  delta: { dx: number; dy: number },
  dropCenter: { x: number; y: number } | null,
): Op[] | null | undefined {
  const { dx, dy } = delta;
  // No container accepted the drop. Each source layout gets a say
  // over its own children before they are left wherever the pointer
  // stopped; the rest of the selection falls through to the translate.
  const released = new Set<NodeId>();
  const releasedOps: Op[] = [];
  let exits = new Map<NodeId, NodeId | null>();
  const exitOps: Op[] = [];
  const ridden = new Set<NodeId>();
  if (session.layout) {
    const pc = session.pc;
    const commitAdapter = sceneViewPoseAdapter(session.scene);
    const sources = groupBySourceContainer(
      session.outer.map((id) => ({
        id,
        sourceContainerId: (session.scene.get(id)?.parent ?? null) as string | null,
      })),
      null,
    );
    for (const [srcId, leaving] of sources) {
      const from = releaseFrom(session, delta, srcId, leaving, commitAdapter);
      if (from === null) return null;
      for (const id of from.released) released.add(id);
      releasedOps.push(...from.ops);
    }
    // A child its container let go of outside that container leaves it,
    // keeping the world pose it was dropped at.
    exits = resolveLayoutExits(session, dropCenter, session.outer.filter((id) => !released.has(id)));
    const below = belowRoots(session, new Set(exits.keys()));
    const pasteboard = pasteboardOn(session.scene);
    for (const [id, toParent] of exits) {
      const node = session.scene.get(id)!;
      const grabbed = grabbedPoseAdapter(session, commitAdapter);
      // With the pasteboard off, a root landing on a page keeps part of it on that page, as a page drop does.
      const page = pasteboard || toParent === null ? null : pageIdOf(session.scene, toParent);
      const landing = page === null ? null : placedPage(session.scene, page);
      const shift = landing === null ? { dx: 0, dy: 0 }
        : keepOnPage(landing, session.descriptorOf(id).getBounds(draggedWorldPose(session, grabbed, id, { dx, dy })));
      const d = { dx: dx + shift.dx, dy: dy + shift.dy };
      const world = draggedWorldPose(session, grabbed, id, d);
      const to = rebaseLocalPose(commitAdapter, world, toParent as string | null, pc.compose, pc.decompose);
      if (to === null) return null;
      exitOps.push(coreOps.reparent({
        id: id as string,
        fromParentId: node.parent as string | null,
        toParentId: toParent as string | null,
        label: 'Reparent',
      }));
      exitOps.push(coreOps.setPose<unknown>({
        id: id as string,
        from: node.pose,
        to,
        label: session.lifecycle.label,
      }));
      // What rides the root is stored in the frame the root moves into, as on a reparent.
      const riders = (below.get(id) ?? []).filter((r) => !exits.has(r));
      const cascade = landedCascadeOps(session, riders, toParent, d);
      if (cascade === null) return null;
      exitOps.push(...cascade);
      for (const r of riders) ridden.add(r);
    }
  }
  if (released.size === 0 && exits.size === 0) return undefined;
  const { scene } = session;
  const landed = new Map([...exits].map(([id, to]) => [id as string, to === null ? null : pageIdOf(scene, to)]));
  const followers = followerOpsFor(scene, landed, session.lifecycle.label);
  if (followers === null) return null;
  return [
    ...releasedOps,
    ...exitOps,
    ...followers,
    ...translateOps(
      session,
      unreleasedIds(session, released).filter((id) => !exits.has(id) && !ridden.has(id)),
      { dx, dy },
    ),
  ];
}
