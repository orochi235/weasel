import { boxToBox, type Affine } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import type { NodeId } from 'core/scene/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { geometryDataOp, type GeometryProjection } from '../geometryProjection';
import { commitGestureOps, reduceBehaviorEnd } from '../gestureLifecycle';
import type { PoseDescriptor } from './geometry';
import type { ResizeFrame, ResizeSession } from './session';

/** The op mapping a leaf's data-held geometry by the box→box affine its pose
 *  underwent, and the pose to commit beside it. Null when the projection
 *  leaves this node's data alone. */
function projectedGeometry(
  projection: GeometryProjection,
  g: PoseDescriptor<unknown>,
  node: { id: string; data: unknown },
  from: unknown,
  next: unknown,
  label: string,
): { dataOp: Op; pose: unknown } | null {
  const sb = g.getBounds(from);
  const db = g.getBounds(next);
  const m: Affine = boxToBox(
    sb.x, sb.y, sb.width, sb.height,
    db.x, db.y, db.width, db.height,
  );
  const dataOp = geometryDataOp(projection, { id: node.id, data: node.data, pose: from }, m, label);
  if (!dataOp) return null;
  // The data absorbed the affine — including any mirror from a
  // drag past the opposite edge — so the pose must commit as a
  // normalized AABB. Leaving signed extents on the pose makes
  // the node unhittable (hit-testing assumes normalized boxes).
  // Without the seam the signed pose is kept: a bare-AABB pose
  // is the only carrier of the flip there.
  if (!(db.width < 0 || db.height < 0)) return { dataOp, pose: next };
  const nb = {
    ...db,
    x: db.width < 0 ? db.x + db.width : db.x,
    y: db.height < 0 ? db.y + db.height : db.y,
    width: Math.abs(db.width),
    height: Math.abs(db.height),
  };
  return { dataOp, pose: g.remapBounds(next, db, nb) };
}

/** One transform op per write id, `from` the pose stored at press and `to`
 *  its preview, each preceded by its data op when the geometry projection
 *  answers for the node. */
export function resizeOps(
  leaves: Pick<ResizeSession, 'scene' | 'writeIds' | 'startPoses' | 'geometryOf' | 'geometryProjection'>,
  previews: ReadonlyMap<NodeId, unknown>,
  label: string,
): Op[] {
  const ops: Op[] = [];
  for (const id of leaves.writeIds) {
    const next = previews.get(id);
    if (next === undefined) continue;
    const from = leaves.startPoses.get(id);
    if (from === undefined) continue;
    let to: unknown = next;
    const node = leaves.geometryProjection ? leaves.scene.get(id) : undefined;
    if (leaves.geometryProjection && node) {
      const projected = projectedGeometry(
        leaves.geometryProjection, leaves.geometryOf(id), { id: id as string, data: node.data }, from, next, label,
      );
      if (projected) {
        ops.push(projected.dataOp);
        to = projected.pose;
      }
    }
    ops.push(createTransformOp<unknown>({ id: id as string, from, to, label }));
  }
  return ops;
}

/** Commit the drag as one batch, so one undo entry. Returns whether anything
 *  reached the document. */
export function commitResize(session: ResizeSession, frame: ResizeFrame): boolean {
  const { lifecycle } = session;
  const target = {
    scene: session.scene,
    applyOps: session.applyOps,
    finish: session.finish,
    adapter: defaultCommitAdapter(session.scene, session.selectionMethods),
  };
  const r = reduceBehaviorEnd(session.constraints, session.gestureCtx);
  if (r === null) return false;
  if (r !== undefined) return commitGestureOps(target, lifecycle, r);

  if (frame.previews.size === 0) return false;
  const ops = resizeOps(session, frame.previews, lifecycle.label);
  if (ops.length === 0) return false;
  return commitGestureOps(target, lifecycle, ops);
}
