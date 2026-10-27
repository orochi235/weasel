import type { NodeId } from 'core/scene/types';
import { poseDescriptorForNode, translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import { toPlane, type PlaneMap } from 'core/viewport/parallax';
import { composeWorldPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { LayoutDragged } from '../../../../layout/types';
import { carryPose, invertPlane, planeOf } from '../../planeInput';
import { grabbedPoseAdapter, planeDelta } from '../delta';
import type { MoveSession } from '../session';

export interface DraggedChild {
  id: NodeId;
  arg: LayoutDragged<unknown>;
  center: { x: number; y: number };
}

/** Each dragged root in world, in the edited plane. */
export function gatherDragged(session: MoveSession, delta: { dx: number; dy: number }): DraggedChild[] {
  const scene = session.scene;
  const pc = session.pc;
  const poseAdapter = sceneViewPoseAdapter(scene);
  const { dx, dy } = delta;
  // Each dragged preview in WORLD: compose the committed start pose up the
  // parent chain, then add the world drag delta (same math as `applyReparent`).
  // The LayoutStrategy contract is world-framed, so every pose handed to it
  // below is composed to world; reflow results are rebased back to local.
  // A selection spanning planes is gathered in the edited plane, and handed
  // to each container carried into the plane that container is stored in.
  const d = session.projection;
  const grabAdapter = grabbedPoseAdapter(session, poseAdapter);
  const dragged: DraggedChild[] = [];
  for (const id of session.ids) {
    const node = scene.get(id);
    if (!node) continue;
    const startWorld = composeWorldPose(grabAdapter, id as string, pc.compose);
    const g = poseDescriptorForNode(d, node);
    const own = planeDelta(session, id, dx, dy);
    const toEdited = invertPlane(planeOf(session.view, node.layer));
    const world = carryPose(g, translatePoseViaDescriptor(startWorld, own.dx, own.dy, g), toEdited);
    const b = g.getBounds(world);
    dragged.push({
      id,
      arg: {
        id: id as string,
        originPose: carryPose(g, startWorld, toEdited),
        pose: world,
        sourceContainerId: (node.parent ?? null) as string | null,
      },
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    });
  }
  return dragged;
}

/** `c` carried into the plane `m` maps to; `c` itself when `m` is null. */
export function carryDragged(session: MoveSession, c: DraggedChild, m: PlaneMap | null): DraggedChild {
  const { scene, projection: d } = session;
  if (m === null) return c;
  const g = poseDescriptorForNode(d, scene.get(c.id)!);
  return {
    id: c.id,
    arg: { ...c.arg, originPose: carryPose(g, c.arg.originPose, m), pose: carryPose(g, c.arg.pose, m) },
    center: toPlane(m, c.center),
  };
}

/** Center of the bounds of everything dragged. */
export function selectionCenter(session: MoveSession, dragged: readonly DraggedChild[]): { x: number; y: number } {
  const d = session.projection;
  // The selection lands as a unit, so one point decides the container: the
  // center of the whole dragged group. Hit-testing each child on its own
  // would scatter a selection straddling two containers.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of dragged) {
    const b = d.getBounds(c.arg.pose);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
