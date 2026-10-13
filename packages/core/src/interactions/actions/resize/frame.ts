import { poseRotationOf } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BoundsConstraint, GestureContext, ResizeAnchor, RotatedPose } from '../../gestures/types';
import { carryPose, planeOf } from '../planeInput';
import { rotatePoint } from '../rotate/geometry';
import { fixedCornerOf } from './cornerHandles';
import { remapRotatedLeaf, translatePoseViaDescriptor, type PoseDescriptor } from './geometry';
import { snapPose } from './pointSnap';
import { boundsForRules } from './ruleBounds';
import type { ResizeBox, ResizeFrame, ResizeSession } from './session';

/** `ob` with the edges `anchor` leaves free moved by the drag delta, which is
 *  turned into the box's own axes first when it is rotated. */
function computeProposedBounds(
  ob: Bounds,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
  rotation: number,
): Bounds {
  if (rotation !== 0) {
    const cs = Math.cos(-rotation);
    const sn = Math.sin(-rotation);
    const dxLocal = cs * dx - sn * dy;
    const dyLocal = sn * dx + cs * dy;
    dx = dxLocal;
    dy = dyLocal;
  }
  let nx = ob.x;
  let ny = ob.y;
  let nw = ob.width;
  let nh = ob.height;
  if (anchor.x === 'min') {
    nw = ob.width + dx;
  } else if (anchor.x === 'max') {
    nx = ob.x + dx;
    nw = ob.width - dx;
  }
  if (anchor.y === 'min') {
    nh = ob.height + dy;
  } else if (anchor.y === 'max') {
    ny = ob.y + dy;
    nh = ob.height - dy;
  }
  return { x: nx, y: ny, width: nw, height: nh };
}

/** `proposed` as the constraints rewrite it, each seeing the one before's. */
function constrain(
  constraints: readonly BoundsConstraint<Bounds>[],
  gctx: GestureContext<Bounds>,
  anchor: ResizeAnchor,
  proposed: Bounds,
): Bounds {
  let bounds = proposed;
  for (const b of constraints) {
    const r = b.onMove?.(gctx, { pose: bounds, anchor });
    if (!r) continue;
    if (r.pose !== undefined) {
      bounds = { x: r.pose.x, y: r.pose.y, width: r.pose.width, height: r.pose.height };
    }
  }
  return bounds;
}

/** One write id's world pose with the box taken from `src` to `dst`.
 *
 *  A rotated leaf resized with others needs its own frame: `src`/`dst`
 *  are world-frame there, unlike the lone path where the drag delta
 *  was already projected into the leaf's frame, so the naive affine
 *  scales the wrong pair of extents. See `remapRotatedLeaf`. */
function leafPose(
  g: PoseDescriptor<unknown>,
  start: unknown,
  src: Bounds,
  dst: Bounds,
  sharedBox: boolean,
): unknown {
  if (sharedBox && poseRotationOf(start) !== null) {
    return remapRotatedLeaf(start as RotatedPose, src, dst);
  }
  return g.remapBounds(start, src, dst);
}

/** `pose` shifted so the corner opposite the dragged one stays where the
 *  press found it, which resizing a rotated box about its center moves. */
function pinFixedCorner(
  g: PoseDescriptor<unknown>,
  pose: unknown,
  box: Pick<ResizeBox, 'anchor' | 'rotation' | 'fixedWorld'>,
  proposed: Bounds,
): unknown {
  if (box.rotation === 0) return pose;
  const newFixedLocal = fixedCornerOf(proposed, box.anchor);
  const newFixedWorld = rotatePoint(
    newFixedLocal.x, newFixedLocal.y,
    proposed.x + proposed.width / 2,
    proposed.y + proposed.height / 2,
    box.rotation,
  );
  return translatePoseViaDescriptor(
    pose,
    box.fixedWorld.x - newFixedWorld.x,
    box.fixedWorld.y - newFixedWorld.y,
    g,
  );
}

/** A world result for `id`, as stored. */
function storedPose(
  place: Pick<ResizeSession, 'scene' | 'poseFrame' | 'view' | 'geometryOf'>,
  id: NodeId,
  world: unknown,
): unknown {
  const layer = place.scene.get(id)?.layer;
  return place.poseFrame.local(
    id,
    carryPose(place.geometryOf(id), world, layer === undefined ? null : planeOf(place.view, layer)),
  );
}

/** One move's previews: the box as the drag and the constraints leave it,
 *  and every write id's stored pose inside it. A lone target also gets the
 *  rotated-resize pin and the point snaps, which a shared box, resized in the
 *  AABB frame, does not. `moveCtx` must carry a drag. */
export function nextFrame(session: ResizeSession, readers: GestureReaders, moveCtx: InvocationCtx): ResizeFrame {
  const at = moveCtx.drag!.current;
  const { box, gestureCtx: gctx } = session;
  gctx.modifiers = { ...moveCtx.modifiers };
  gctx.pointer = pointerStateOf(at, moveCtx);
  gctx.view = readers.view();
  gctx.plane = readers.plane();

  const proposed = constrain(
    session.constraints,
    gctx,
    box.anchor,
    computeProposedBounds(box.bounds, box.anchor, at.x - session.startWorld.x, at.y - session.startWorld.y, box.rotation),
  );

  const previews = new Map<NodeId, unknown>();
  const worldOf = (id: NodeId): unknown => {
    const start = session.startWorlds.get(id);
    if (start === undefined) return undefined;
    return leafPose(session.geometryOf(id), start, box.bounds, proposed, session.sharedBox);
  };

  if (session.sharedBox) {
    for (const id of session.writeIds) {
      const next = worldOf(id);
      if (next === undefined) continue;
      previews.set(id, storedPose(session, id, next));
    }
    return { previews };
  }

  const id = session.writeIds[0];
  const g = session.geometryOf(id);
  const remapped = worldOf(id);
  if (remapped === undefined) return { previews };
  const world = snapPose(
    session.pointSnap,
    g,
    pinFixedCorner(g, remapped, box, proposed),
    box.rotation,
    box.anchor,
    gctx.modifiers,
    gctx.plane ?? null,
  );
  previews.set(id, storedPose(session, id, world));
  gctx.current = new Map<string, Bounds>([[id as string, boundsForRules(g, world)]]);
  return { previews };
}
