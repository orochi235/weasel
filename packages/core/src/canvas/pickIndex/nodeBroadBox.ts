/**
 * One node's box in the pick index: a world box that every query's `hits`
 * accepts only inside of, before that query's own screen-pixel slop.
 *
 * The point query and the region query read a node differently, so the box is
 * the union of both: the region's `regionBoundsOf` through the node's own
 * descriptor, and the frame box the point query's `poseContainsRotated` tests,
 * grown in the pose's own frame by the ink's `outset`. A derived node is read
 * by its path alone, as both queries read it.
 */
import { applyToPoint, boundsOfPath, poseFrameOf, type Path } from '@weasel-js/geom';
import { findShapeInk } from 'canvas/NodeShape';
import { AUTO_POSE_DESCRIPTOR, isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';
import { framedBounds } from 'core/geometry/poseDescriptor';
import { regionBoundsOf } from 'core/geometry/regionHit';
import type { InheritedPaint } from 'core/scene/inheritedPaint';
import { poseDescriptorForNode, type PoseDescriptor } from 'interactions/actions/resize/geometry';

/** `[minX, minY, maxX, maxY]`, the layout `createBvh(2)` takes. */
export type Box2 = [number, number, number, number];

type Rect = { x: number; y: number; width: number; height: number };

function grow(out: Box2, b: Rect, by: number): void {
  const x1 = b.x + b.width, y1 = b.y + b.height;
  out[0] = Math.min(out[0], Math.min(b.x, x1) - by);
  out[1] = Math.min(out[1], Math.min(b.y, y1) - by);
  out[2] = Math.max(out[2], Math.max(b.x, x1) + by);
  out[3] = Math.max(out[3], Math.max(b.y, y1) + by);
}

/** The local box `poseContainsRotated` tests, grown by `by` and carried through
 *  the pose's frame, as that function reads it. */
function framedBox(out: Box2, pose: unknown, d: PoseDescriptor<unknown>, by: number): void {
  const local: Rect = isPathLike(pose) ? boundsOfPath(pose) : d.getBounds(pose);
  const framed = d === AUTO_POSE_DESCRIPTOR ? pose : framedBounds(pose, d);
  const frame = poseFrameOf(framed);
  if (!frame) {
    grow(out, local, by);
    return;
  }
  const x0 = local.x - by, y0 = local.y - by;
  const x1 = local.x + local.width + by, y1 = local.y + local.height + by;
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const) {
    const [wx, wy] = applyToPoint(frame, x, y);
    grow(out, { x: wx, y: wy, width: 0, height: 0 }, 0);
  }
}

/** Float error in a frame's round trip must not put an accepted point just outside. */
function pad(b: Box2): void {
  const e = 1e-9 * (1 + Math.max(Math.abs(b[0]), Math.abs(b[1]), Math.abs(b[2]), Math.abs(b[3])));
  b[0] -= e; b[1] -= e; b[2] += e; b[3] += e;
}

const UNINHERITED = Object.freeze({ scale: 1 });

/** Writes the box into `out` and returns the ink's reach measured on screen,
 *  which no world box can hold. */
export function nodeBroadBox(
  node: object,
  pose: unknown,
  derived: Path | null | undefined,
  inherited: InheritedPaint | undefined,
  descriptor: PoseDescriptor<unknown>,
  out: Box2,
): number {
  const ink = findShapeInk(node as never, pose, inherited === undefined ? UNINHERITED : { scale: 1, inherited });
  const outset = Math.max(0, ink?.outset ?? 0);
  out[0] = out[1] = Infinity;
  out[2] = out[3] = -Infinity;
  if (derived) {
    grow(out, boundsOfPath(derived), outset);
  } else {
    const own = poseDescriptorForNode(descriptor, node);
    if (descriptor === AUTO_POSE_DESCRIPTOR && own === descriptor && isRectPose(pose) && poseFrameOf(pose) === null) {
      // Both reads come to the pose rect itself.
      grow(out, pose, outset);
    } else {
      grow(out, regionBoundsOf(node, pose, own), outset);
      framedBox(out, pose, descriptor, outset);
    }
  }
  pad(out);
  return Math.max(0, ink?.outsetPx ?? 0);
}
