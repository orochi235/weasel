import { asNodeId, type NodeId } from 'core/scene/types';
import { toPlane } from 'core/viewport/parallax';
import { composeWorldPose, rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import { carriedDescendants, sceneCarrySource } from 'core/scene/carryDescendants';
import { poseDescriptorForNode, translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import type { LayoutChild, LayoutContainer } from '../../../../layout/types';
import type { MoveSession } from '../session';
import { pickContainer, type Candidate } from './container';
import { carryDragged, gatherDragged, selectionCenter, type DraggedChild } from './dragged';
import type { DropPass, LayoutPlacement } from './types';
import { boxOf, containerView, draggedInView, pointInView } from './view';

/** Dragged ids grouped by the container they are leaving, skipping any that
 *  stay put (`exclude` is the destination) or that had no container. */
export function groupBySourceContainer(
  dragged: ReadonlyArray<{ id: NodeId; sourceContainerId: string | null }>,
  exclude: string | null,
): Map<string, Set<NodeId>> {
  const out = new Map<string, Set<NodeId>>();
  for (const d of dragged) {
    const src = d.sourceContainerId;
    if (!src || src === exclude) continue;
    let set = out.get(src);
    if (!set) { set = new Set<NodeId>(); out.set(src, set); }
    set.add(d.id);
  }
  return out;
}

/** Place each dragged child in `dest` in turn. Null when the snap rejects
 *  any of them: a container that cannot take every member takes none. */
function placeAll(
  session: MoveSession,
  dest: Candidate,
  container: LayoutContainer,
  dragged: readonly DraggedChild[],
  probeOffset: { x: number; y: number },
): { placements: LayoutPlacement[]; destReflow: Map<NodeId, unknown> } | null {
  const { scene, pc } = session;
  const poseAdapter = sceneViewPoseAdapter(scene);
  const draggedIds = new Set<NodeId>(dragged.map((c) => c.id));
  const { layout, view } = dest;
  // The container state the placements run against, advanced by each one,
  // in the strategy's space.
  const working: LayoutChild<unknown>[] = scene.childrenOf(dest.id).map((cid) => ({
    id: cid as string,
    pose: view.toStrategy(composeWorldPose(poseAdapter, cid as string, pc.compose)),
  }));
  const setWorking = (id: string, pose: unknown): void => {
    const at = working.findIndex((c) => c.id === id);
    if (at >= 0) working[at] = { id, pose };
    else working.push({ id, pose });
  };

  const placements: LayoutPlacement[] = [];
  const destReflow = new Map<NodeId, unknown>();
  const destPlane = dest.plane;
  for (const edited of dragged) {
    const dc = carryDragged(session, edited, destPlane);
    const arg = draggedInView(view, dc.arg);
    const children = working.map((c) => ({ ...c }));
    const targets = layout.getDropTargets(container, children, arg);
    const probe = { x: edited.center.x + probeOffset.x, y: edited.center.y + probeOffset.y };
    const g = poseDescriptorForNode(session.projection, scene.get(edited.id)!);
    const at = pointInView(view, g, dc.arg.pose, destPlane ? toPlane(destPlane, probe) : probe);
    const target = layout.snap.pickTarget(targets, at);
    // All-or-nothing: a container that cannot take every member takes none
    // rather than splitting the selection between two homes.
    if (!target) return null;
    placements.push({ dragged: arg, children, target });
    const poses = layout.reflowPoses(container, children, arg, target);
    for (const [cid, pose] of poses) {
      setWorking(cid, pose);
      if (!draggedIds.has(asNodeId(cid))) destReflow.set(asNodeId(cid), view.toWorld(pose));
    }
    setWorking(arg.id, poses.get(arg.id) ?? target.pose);
  }
  return { placements, destReflow };
}

/** World poses of the leftovers that moved in each container the selection left. */
function sourceReflow(
  session: MoveSession, dragged: readonly DraggedChild[], destId: string,
): Map<string, unknown> {
  const { scene, pc, projection: d } = session;
  const poseAdapter = sceneViewPoseAdapter(scene);
  // Source reflow (cross-container) → fold changed leftovers into previews.
  // One pass per container the selection left behind, with everything that
  // left it withdrawn at once.
  const sourceReflow = new Map<string, unknown>();
  const layoutDep = session.layout;
  if (!layoutDep) return sourceReflow;
  for (const [srcId, leaving] of groupBySourceContainer(dragged.map((c) => ({
    id: c.id,
    sourceContainerId: c.arg.sourceContainerId,
  })), destId)) {
    const srcLayout = layoutDep.getLayout(srcId);
    const srcNode = scene.get(asNodeId(srcId));
    if (!srcLayout || !srcNode) continue;
    const g = poseDescriptorForNode(d, srcNode);
    const view = containerView(pc, g, composeWorldPose(poseAdapter, srcId, pc.compose));
    const srcContainer: LayoutContainer = { id: srcId, bounds: boxOf(g, view.upright) };
    const srcChildren: LayoutChild<unknown>[] = scene.childrenOf(asNodeId(srcId))
      .filter((cid) => !leaving.has(cid))
      .map((cid) => ({
        id: cid as string,
        pose: view.toStrategy(composeWorldPose(poseAdapter, cid as string, pc.compose)),
      }));
    for (const [cid, placed] of srcLayout.childPoses(srcContainer, srcChildren)) {
      const pose = view.toWorld(placed);
      const cur = d.getBounds(composeWorldPose(poseAdapter, cid, pc.compose));
      const next = d.getBounds(pose);
      const same = cur.x === next.x && cur.y === next.y
        && cur.width === next.width && cur.height === next.height;
      if (same) continue;
      sourceReflow.set(cid, pose); // WORLD — rebased at each consumption point
    }
  }
  return sourceReflow;
}

/** The stored poses that bring `id`'s descendants along to `world`, where a reflow shows it. */
function reflowCarry(
  session: MoveSession, id: NodeId, world: unknown, moving: (id: NodeId) => boolean,
): Map<NodeId, unknown> {
  const { scene, pc, projection: d } = session;
  const a = d.getBounds(composeWorldPose(sceneViewPoseAdapter(scene), id as string, pc.compose));
  const b = d.getBounds(world);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return new Map();
  return carriedDescendants(sceneCarrySource(scene), id, (pose) => translatePoseViaDescriptor(pose, dx, dy, d), moving);
}

/** One frame's layout result, or null with no layout dep or nothing dragged. */
export function runDropPass(
  session: MoveSession,
  delta: { dx: number; dy: number },
  pointer: { x: number; y: number },
): DropPass | null {
  if (!session.layout) return null;
  const { scene, pc } = session;
  const poseAdapter = sceneViewPoseAdapter(scene);
  const dragged = gatherDragged(session, delta);
  if (dragged.length === 0) return null;
  const dropCenter = selectionCenter(session, dragged);
  // Each child is snapped at its own position, displaced by however far the
  // pointer sits from that center — the group keeps its shape, and a lone
  // child is still probed at the pointer itself.
  const probeOffset = {
    x: pointer.x - dropCenter.x,
    y: pointer.y - dropCenter.y,
  };

  const dest = pickContainer(session, dragged, dropCenter);
  if (!dest) return { dropCenter, pass: null, reflow: new Map() };
  if (dest.refused !== undefined) {
    return { dropCenter, pass: null, reflow: new Map(), refused: { id: dest.id, bounds: dest.bounds, reason: dest.refused } };
  }

  const container: LayoutContainer = { id: dest.id as string, bounds: dest.content };
  const placed = placeAll(session, dest, container, dragged, probeOffset);
  if (!placed) return { dropCenter, pass: null, reflow: new Map() };

  // Destination reflow → fold into previews (the dragged children keep their
  // pointer-following ghosts). `reflowPoses` returns world; previews are
  // local, so rebase to the child's current parent frame first.
  const reflow = new Map<NodeId, unknown>();
  const reflowIds = new Set<NodeId>();
  for (const [cid, pose] of placed.destReflow) {
    const parent = scene.get(cid)?.parent ?? null;
    reflow.set(cid, rebaseLocalPose(poseAdapter, pose, parent, pc.compose, pc.decompose));
    reflowIds.add(cid);
  }

  const leftovers = sourceReflow(session, dragged, container.id);
  for (const [cid, pose] of leftovers) {
    const parent = scene.get(asNodeId(cid))?.parent ?? null;
    reflow.set(asNodeId(cid), rebaseLocalPose(poseAdapter, pose, parent, pc.compose, pc.decompose));
    reflowIds.add(asNodeId(cid));
  }
  const draggedIds = new Set<NodeId>(dragged.map((c) => c.id));
  for (const [cid, pose] of [...placed.destReflow, ...leftovers] as [string, unknown][]) {
    for (const [id, carried] of reflowCarry(session, asNodeId(cid), pose, (d) => reflow.has(d) || draggedIds.has(d))) {
      reflow.set(id, carried);
      reflowIds.add(id);
    }
  }

  return {
    dropCenter,
    pass: {
      layout: dest.layout, container, view: dest.view, placements: placed.placements, sourceReflow: leftovers, reflowIds,
    },
    reflow,
  };
}
