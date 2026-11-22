/**
 * `LayoutFrame` — the plane a diagram lives on, as the diagram reads a pose.
 *
 * Every coordinate diagram computes or stores is in this plane: a layout's
 * places, a port, a waypoint, a route, a `PortAnchor`'s box. Where the plane
 * is the world's own, as it is on a 2D canvas, the frame is the pose
 * descriptor read directly, and that is the default. A host whose descriptor
 * answers in some other space passes a frame of its own: kernel3d's descriptor
 * answers `getBounds` as the screen box a solid covers, so a diagram laid out
 * through it would place, port and route in screen pixels.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  translatePoseViaDescriptor,
  type PoseDescriptor,
  type Vec2,
} from '@weasel-js/core/math';
import type { Aabb, Vec3 } from '@weasel-js/geom/3d';
import { createPart } from '@weasel-js/registry';
import type { Bounds } from './outlines/types';

/** How a diagram reads and moves a pose on its plane. */
export interface LayoutFrame<TPose> {
  /** The box the pose covers on the plane, before its rotation. */
  box(pose: TPose): Bounds;
  /** The pose moved by `(dx, dy)` along the plane. */
  translate(pose: TPose, dx: number, dy: number): TPose;
  /** A pose like `pose` that covers `box` on the plane. */
  fromBox(box: Bounds, pose: TPose): TPose;
  /** The pose's rotation within the plane, in radians, about its box's
   *  center. Absent means none. */
  rotation?(pose: TPose): number;
  /** The box the pose covers in three dimensions, for a host with a third:
   *  `box` is then its face on the plane, x and y the same. Absent, the
   *  diagram is flat. */
  box3?(pose: TPose): Aabb;
  /** The pose moved by `d` in three dimensions. Given with `box3`. */
  translate3?(pose: TPose, d: Vec3): TPose;
}

/** How {@link createSolidFrame} reads and places a solid. */
export interface SolidReader<TPose> {
  /** The box the pose covers in three dimensions. */
  box3(pose: TPose): Aabb;
  /** A pose like `pose` that covers `box`. */
  fromBox3(box: Aabb, pose: TPose): TPose;
}

/**
 * The frame of a diagram of solids, which lies on the plane z = const and
 * reaches into depth: `box` is a solid's face on that plane, and `box3` and
 * `translate3` are the whole of it. A box set on the plane keeps the solid's
 * depth.
 */
export function createSolidFrame<TPose>(read: SolidReader<TPose>): LayoutFrame<TPose> {
  const box = (pose: TPose): Bounds => {
    const { min, max } = read.box3(pose);
    return { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };
  };
  const translate3 = (pose: TPose, d: Vec3): TPose => {
    const { min, max } = read.box3(pose);
    return read.fromBox3({
      min: { x: min.x + d.x, y: min.y + d.y, z: min.z + d.z },
      max: { x: max.x + d.x, y: max.y + d.y, z: max.z + d.z },
    }, pose);
  };
  return {
    box,
    box3: read.box3,
    translate: (pose, dx, dy) => translate3(pose, { x: dx, y: dy, z: 0 }),
    translate3,
    fromBox: (b, pose) => {
      const { min, max } = read.box3(pose);
      return read.fromBox3({
        min: { x: b.x, y: b.y, z: min.z },
        max: { x: b.x + b.width, y: b.y + b.height, z: max.z },
      }, pose);
    },
  };
}

/** Where a reader finds its frame: `frame` when given, else one read off
 *  `poseDescriptor`. */
export interface FrameOptions<TPose> {
  /** Defaults to the kit's `AUTO_POSE_DESCRIPTOR` (a painter's own default
   *  where it says so). Read only to make the default frame. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** The plane the diagram lives on. Defaults to `poseDescriptor`'s own
   *  space; a 3D host passes the projection onto the diagram's plane. */
  frame?: LayoutFrame<TPose>;
}

const frameOf = createPart(
  (d: PoseDescriptor<unknown>): LayoutFrame<unknown> => ({
    box: (pose) => d.getBounds(pose),
    translate: (pose, dx, dy) => translatePoseViaDescriptor(pose, dx, dy, d),
    fromBox: (box, pose) => d.fromBounds(box, pose),
    ...(d.getRotation ? { rotation: (pose: unknown) => d.getRotation!(pose) } : {}),
  }),
);

/** The frame a pose descriptor implies, where the plane is the descriptor's
 *  own space. The same frame for the same descriptor on every call. */
export function layoutFrameOf<TPose>(descriptor: PoseDescriptor<TPose>): LayoutFrame<TPose> {
  return frameOf(descriptor as PoseDescriptor<unknown>) as LayoutFrame<TPose>;
}

/** The frame over the kit's `AUTO_POSE_DESCRIPTOR`: rect and path poses, in world. */
export const AUTO_LAYOUT_FRAME: LayoutFrame<unknown> = layoutFrameOf(AUTO_POSE_DESCRIPTOR as PoseDescriptor<unknown>);

/** The frame `opts` names: its `frame`, else `poseDescriptor`'s, else
 *  `fallback`'s. */
export function frameFor<TPose>(
  opts: FrameOptions<TPose>,
  fallback: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): LayoutFrame<TPose> {
  return opts.frame ?? layoutFrameOf(opts.poseDescriptor ?? fallback);
}

/** The point an end aims at when it names none: the center of its box on the plane. */
export function boxCenter<TPose>(frame: LayoutFrame<TPose>, pose: TPose): Vec2 {
  const b = frame.box(pose);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
