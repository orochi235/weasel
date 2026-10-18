import { poseFrameOf } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import { localToWorld, worldDeltaToLocal, type TargetTransform } from 'core/geometry/targetFrame';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BoundsConstraint, GestureContext, ResizeAnchor, RotatedPose } from '../../gestures/types';
import { carryPose, planeOf } from '../planeInput';
import { fixedCornerOf } from './cornerHandles';
import { remapRotatedLeaf, translatePoseViaDescriptor, type PoseDescriptor } from './geometry';
import { snapPose } from './pointSnap';
import { boundsForRules } from './ruleBounds';
import { boxFrame } from './boxFrame';
import { insetBox, outsetBox } from 'core/geometry/inkExtents';
import type { ResizeBox, ResizeFrame, ResizeSession } from './session';
import { clampToMinSize } from './behaviors/clampMinSize';

/** `ob` with the edges `anchor` leaves free moved by the drag delta, which is
 *  taken into the axes of the frame the box is drawn in first. A frame nothing
 *  maps back through moves no edge. */
function computeProposedBounds(
  ob: Bounds,
  anchor: ResizeAnchor,
  worldDx: number,
  worldDy: number,
  frame: TargetTransform,
): Bounds {
  const { x: dx, y: dy } = worldDeltaToLocal(frame, worldDx, worldDy) ?? { x: 0, y: 0 };
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
 *  A turned or skewed leaf resized with others needs its own frame: `src`/`dst`
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
  if (sharedBox && poseFrameOf(start) !== null) {
    return remapRotatedLeaf(start as RotatedPose, src, dst);
  }
  return g.remapBounds(start, src, dst);
}

/** `pose` shifted so the corner opposite the dragged one stays where the
 *  press found it, which resizing a box whose frame is about its center moves. */
function pinFixedCorner(
  g: PoseDescriptor<unknown>,
  pose: unknown,
  box: Pick<ResizeBox, 'anchor' | 'rotation' | 'transform' | 'fixedWorld'>,
  proposed: Bounds,
): unknown {
  const frame = boxFrame(box, proposed);
  if (frame.identity) return pose;
  const newFixedLocal = fixedCornerOf(proposed, box.anchor);
  const newFixedWorld = localToWorld(frame, newFixedLocal.x, newFixedLocal.y);
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

/** Every write id's stored pose with the box taken from where the press found
 *  it to `asked`, held to the place's minimum. A lone target is also pinned at
 *  the fixed corner and run through `snap`, and comes back with its world
 *  pose. `proposed` is the box they were put in. */
export function posesInBox(
  place: Pick<ResizeSession, 'scene' | 'poseFrame' | 'view' | 'geometryOf' | 'writeIds' | 'startWorlds' | 'box' | 'sharedBox' | 'minimum'>,
  asked: Bounds,
  snap: (g: PoseDescriptor<unknown>, world: unknown) => unknown = (_g, world) => world,
): { previews: Map<NodeId, unknown>; proposed: Bounds; lone?: { id: NodeId; g: PoseDescriptor<unknown>; world: unknown } } {
  const { box } = place;
  const proposed = (place.minimum && clampToMinSize(asked, box.anchor, place.minimum)) ?? asked;
  const previews = new Map<NodeId, unknown>();
  const worldOf = (id: NodeId): unknown => {
    const start = place.startWorlds.get(id);
    if (start === undefined) return undefined;
    return leafPose(place.geometryOf(id), start, box.bounds, proposed, place.sharedBox);
  };

  if (place.sharedBox) {
    for (const id of place.writeIds) {
      const next = worldOf(id);
      if (next === undefined) continue;
      previews.set(id, storedPose(place, id, next));
    }
    return { previews, proposed };
  }

  const id = place.writeIds[0];
  const g = place.geometryOf(id);
  const remapped = worldOf(id);
  if (remapped === undefined) return { previews, proposed };
  const world = snap(g, pinFixedCorner(g, remapped, box, proposed));
  previews.set(id, storedPose(place, id, world));
  return { previews, proposed, lone: { id, g, world } };
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

  // The constraints see the box as drawn; the stroke keeps its width, so the
  // extents come back off what they leave.
  const moved = computeProposedBounds(box.bounds, box.anchor, at.x - session.startWorld.x, at.y - session.startWorld.y, boxFrame(box, box.bounds));
  const constrained = insetBox(constrain(session.constraints, gctx, box.anchor, outsetBox(moved, box.extents)), box.extents);

  const { previews, proposed, lone } = posesInBox(session, constrained, (g, world) => snapPose(
    session.pointSnap, g, world, box, box.anchor, gctx.modifiers, gctx.plane ?? null,
  ));
  if (lone) gctx.current = new Map<string, Bounds>([[lone.id as string, outsetBox(boundsForRules(lone.g, lone.world), box.extents)]]);
  return { previews, proposed };
}
