/**
 * Pose-shape helpers shared by `<SceneCanvas>` internals. Every bounds read goes through a
 * `PoseDescriptor`, defaulting to `AUTO_POSE_DESCRIPTOR`, so a consumer-supplied descriptor
 * reaches hit-test, marquee, and bounds extraction alike.
 */
import type { Bounds } from 'tools/builtin/select';
import { applyToPoint, pointInPath, strokeHitTest, type Mat3 } from '@weasel-js/geom';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR, isPathLike } from 'core/geometry/autoPoseDescriptor';
import { poseFrameInverseOf, poseFrameOf, poseLinearOf } from '@weasel-js/geom';
import { hasSlop, slopForStrokeHit, type ScreenSlop } from 'core/viewport/screenSlop';

export { isPathLike };

export function aabbOfPose<TPose>(
  pose: TPose,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): Bounds {
  return descriptor.getBounds(pose);
}

/** Default slop for the stroke-distance hit-test on paths, in world units. Independent of
 *  the stroke's rendered width, which the hit-test layer doesn't know. */
const DEFAULT_PATH_STROKE_SLOP = 4;

/** A containment slop: `reach` world units the caller knows the ink extends
 *  past the pose (a stroke's outward half-width), then `px`/`scale` of screen
 *  slop measured from there. */
export interface PoseSlop extends ScreenSlop {
  reach?: number;
}

/**
 * @param tolerance - Grab slop. A number is **world** units and grows the
 *   AABB test and the path stroke-distance test alike; a {@link PoseSlop}
 *   is measured on screen, from `reach` world units out. Defaults to
 *   {@link DEFAULT_PATH_STROKE_SLOP} for path-like poses and to `0` for rect poses.
 */
export function poseContains<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number | PoseSlop,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  return containsInFrame(pose, wx, wy, tolerance, descriptor, null, false);
}

/**
 * Containment for `<SceneCanvas>`'s default `pickEvery`. When the pose has a
 * frame (`poseFrameOf`: a rotation, a `transform`, or both), takes the query
 * point back through it and tests in the pose's own box frame, mirroring the
 * renderer's wrap so the click target matches the drawn shape. A pose with no
 * frame tests directly, and one whose `transform` is singular draws nothing and
 * contains nothing.
 *
 * Rotation comes from the descriptor when one is supplied, and otherwise from
 * `pose.rotation`, the convention the renderer reads. A `tolerance` is a
 * distance in world or on screen whatever the frame; only a `PoseSlop`'s
 * `reach` is in the pose's own frame, where the stroke it stands for is drawn.
 */
export function poseContainsRotated<TPose>(
  pose: TPose,
  wx: number,
  wy: number,
  tolerance?: number | PoseSlop,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): boolean {
  const framed = descriptor === AUTO_POSE_DESCRIPTOR ? pose : framedBounds(pose, descriptor);
  const frame = poseFrameOf(framed);
  if (!frame) return containsInFrame(pose, wx, wy, tolerance, descriptor, null, false);
  const back = poseFrameInverseOf(framed);
  if (!back) return false;
  const [lx, ly] = applyToPoint(back, wx, wy);
  return containsInFrame(pose, lx, ly, tolerance, descriptor, frame, poseLinearOf(framed) !== null);
}

const WORLD_SCALE = { x: 1, y: 1 };

/** `(x, y)` is in the pose's own frame, which reaches world by `frame`.
 *  `stretched` is whether that frame changes lengths: it carries a `transform`. */
function containsInFrame<TPose>(
  pose: TPose,
  x: number,
  y: number,
  tolerance: number | PoseSlop | undefined,
  descriptor: PoseDescriptor<unknown>,
  frame: Mat3 | null,
  stretched: boolean,
): boolean {
  const pathLike = isPathLike(pose);
  const world = typeof tolerance === 'object' ? undefined
    : tolerance ?? (pathLike ? DEFAULT_PATH_STROKE_SLOP : 0);
  // A world distance is not one in a stretched frame, so it is tested through
  // the frame, as a screen slop is: at a scale of one.
  const throughFrame = stretched && world !== undefined && world > 0;
  const reach = throughFrame ? 0 : world ?? (tolerance as PoseSlop).reach ?? 0;
  const screen = throughFrame ? { px: world, scale: WORLD_SCALE }
    : typeof tolerance === 'object' ? tolerance : undefined;
  const { opts } = slopForStrokeHit(screen, frame);
  if (pathLike) {
    // Inside the filled region, or within stroke slop.
    if (pointInPath(pose, x, y)) return true;
    return strokeHitTest(pose, x, y, reach, opts);
  }
  const b = aabbOfPose(pose, descriptor);
  // `reach` is the caller's budget for being at least as generous as whatever
  // refinement follows: the stroke's outward reach, which this function
  // cannot see. Grown square, so it contains the round band the refinement
  // tests.
  const grown = {
    kind: 'rect' as const,
    x: b.x - reach, y: b.y - reach, width: b.width + 2 * reach, height: b.height + 2 * reach,
  };
  if (pointInPath(grown, x, y)) return true;
  return hasSlop(screen) && strokeHitTest(grown, x, y, 0, opts);
}

/** The box, rotation, and `transform` a descriptor-read pose is drawn in. */
function framedBounds<TPose>(pose: TPose, descriptor: PoseDescriptor<unknown>): unknown {
  const b = descriptor.getBounds(pose);
  return {
    x: b.x, y: b.y, width: b.width, height: b.height,
    rotation: descriptor.getRotation?.(pose) ?? 0,
    transform: poseLinearOf(pose) ?? undefined,
  };
}
