import { pointInPath } from '@weasel-js/geom';
import type { NodeId, Scene } from 'core/scene/types';
import { poseDescriptorForNode } from 'core/geometry/poseDescriptor';
import { toPlane, type PlaneMap } from 'core/viewport/parallax';
import { composeWorldPose } from 'core/scene/composePose';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import type { DropRegion, LayoutContainer, LayoutStrategy } from '../../../../layout/types';
import type { LayoutDep } from '../../depSchema';
import { planeOf } from '../../planeInput';
import type { MoveSession } from '../session';
import { carryDragged, type DraggedChild } from './dragged';
import { refusalOf } from '../../dropVerdict';

export interface Bounds4 { x: number; y: number; width: number; height: number }
export function pointInBounds(b: Bounds4, at: { x: number; y: number }): boolean {
  return at.x >= b.x && at.x < b.x + b.width && at.y >= b.y && at.y < b.y + b.height;
}

type Layout = LayoutStrategy<unknown>;
export interface Candidate {
  id: NodeId;
  bounds: Bounds4;
  layout: LayoutStrategy<unknown>;
  zPath: number[];
  depth: number;
  /** The edited plane into this container's. */
  plane: PlaneMap | null;
  /** The reason it refuses the drop, when it does: it still blocks the containers around it. */
  refused?: string;
}

/** Whether a world point falls in a drop region, which is authored relative to
 *  the top-left of the container's world bounds. */
function regionContains(
  region: DropRegion,
  bounds: { x: number; y: number },
  point: { x: number; y: number },
): boolean {
  const local = { x: point.x - bounds.x, y: point.y - bounds.y };
  return typeof region === 'function'
    ? region(local)
    : pointInPath(region, local.x, local.y);
}

function chooseContainer(
  scene: Scene<unknown, string, unknown>,
  mode: NonNullable<LayoutDep['dropTarget']>,
  candidates: readonly Candidate[],
): Candidate | null {
  let dest: Candidate | null = null;
  if (mode === 'topmost') {
    // Painted last wins, in the scene's own render order — which crosses
    // subtrees and layers, where a sibling-index path cannot.
    const byId = new Map<NodeId, Candidate>(candidates.map((c) => [c.id, c]));
    for (const id of scene.renderOrder()) dest = byId.get(id) ?? dest;
  } else {
    // Deepest wins; sibling-index path breaks ties (higher z = later index).
    for (const c of candidates) {
      if (dest === null) { dest = c; continue; }
      if (c.depth > dest.depth) { dest = c; continue; }
      if (c.depth < dest.depth) continue;
      let cAfter = false;
      for (let i = 0; i < c.zPath.length; i++) {
        if (c.zPath[i] > dest.zPath[i]) { cAfter = true; break; }
        if (c.zPath[i] < dest.zPath[i]) { cAfter = false; break; }
      }
      if (cAfter) dest = c;
    }
  }
  return dest;
}

/** The layout container that takes the drop at `center`, or null. */
export function pickContainer(
  session: MoveSession,
  dragged: readonly DraggedChild[],
  center: { x: number; y: number },
): Candidate | null {
  const layoutDep = session.layout;
  if (!layoutDep) return null;
  const scene = session.scene;
  const pc = session.pc;
  const poseAdapter = scenePoseAdapter(scene);
  const d = session.projection;
  const draggedIds = new Set<NodeId>(dragged.map((c) => c.id));
  const candidates: Candidate[] = [];
  const mode = layoutDep.dropTarget ?? 'innermost';
  const testInside = (
    id: NodeId, cPose: unknown, aabb: Bounds4, layout: Layout, at: { x: number; y: number },
  ): boolean => {
    const region = layout.dropRegion?.({ id: id as string, bounds: aabb }) ?? null;
    if (region) return regionContains(region, aabb, at);
    if (mode === 'region') return false;
    if (layout.contains) return layout.contains(cPose, at);
    return pointInBounds(aabb, at);
  };
  const consider = (id: NodeId, zPath: number[]): void => {
    const layout = layoutDep.getLayout(id as string);
    if (!layout) return;
    const node = scene.get(id);
    if (!node) return;
    const worldPose = composeWorldPose(poseAdapter, id as string, pc.compose);
    const worldAABB = poseDescriptorForNode(d, node).getBounds(worldPose);
    const plane = planeOf(session.view, node.layer);
    const at = plane ? toPlane(plane, center) : center;
    if (!testInside(id, worldPose, worldAABB, layout, at)) return;
    const verdict = session.verdict(id);
    if (verdict === false) return;
    const refused = refusalOf(verdict);
    if (refused === null && layout.acceptsDrop) {
      const arg: LayoutContainer = { id: id as string, bounds: worldAABB };
      for (const c of dragged) if (!layout.acceptsDrop(arg, carryDragged(session, c, plane).arg)) return;
    }
    candidates.push({
      id,
      bounds: worldAABB,
      layout,
      zPath,
      depth: zPath.length,
      plane,
      ...(refused !== null ? { refused } : {}),
    });
  };
  const walk = (parentId: NodeId | null, parentPath: number[]): void => {
    const childIds = parentId === null ? scene.roots : scene.childrenOf(parentId);
    for (let i = 0; i < childIds.length; i++) {
      // A dragged root's subtree goes with it: dropping into one of its own
      // descendants would reparent it under itself.
      if (draggedIds.has(childIds[i])) continue;
      const childPath = [...parentPath, i];
      consider(childIds[i], childPath);
      walk(childIds[i], childPath);
    }
  };
  walk(null, []);

  return chooseContainer(scene, mode, candidates);
}
