import type { PoseDescriptor } from '@weasel-js/core/engine';
import {
  cross, dot, len, lerpPoint, normalize, pointAtLength, quatFromBasis, quatMultiply, quatRotate, quatSlerp,
  scale, sub, type LengthTable, type Quat, type Vec3,
} from '@weasel-js/geom/3d';
import type { Pose3 } from './pose3';
import { DEFAULT_UP } from './world';

/** Options for {@link pathMotion3}. */
export interface PathMotion3Options<TNode = unknown> {
  /** Reads the pose for everything but the motion, `createPoseDescriptor(world)` as a rule. */
  descriptor: PoseDescriptor<Pose3, TNode>;
  /** The point of the node that rides the path, in its own space before scale and rotation. Default
   *  its origin, which is `position`. */
  anchor?: Vec3;
  /** Whether the node turns with the path: its local +x along the tangent and its +y toward `up`.
   *  Default false: the rotation goes from one pose's to the other's. */
  orient?: boolean;
  /** Which way is up for `orient`. Default the kernel's, +y. */
  up?: Vec3;
  /** A rotation applied in the node's own frame before `orient`'s: which local axis faces along the
   *  path. Default none. */
  rotationOffset?: Quat;
}

/** A `Pose3` descriptor whose `lerp` carries a pose along a 3D path. */
export interface PathMotion3<TNode = unknown> extends PoseDescriptor<Pose3, TNode> {
  readonly table: LengthTable;
  /** `pose` placed at fraction `u` of the path's length, `u` clamped to 0..1. */
  at(pose: Pose3, u: number): Pose3;
  lerp(a: Pose3, b: Pose3, t: number): Pose3;
}

const lerp = (a: Pose3, b: Pose3, t: number): Pose3 => ({
  position: lerpPoint(a.position, b.position, t),
  rotation: quatSlerp(a.rotation, b.rotation, t),
  scale: lerpPoint(a.scale, b.scale, t),
});

/**
 * `pathMotion` for a `Pose3` on a three-component length table (`lengthTable3` in
 * `@weasel-js/geom/3d`): fraction `t` of a move is fraction `t` of the path's length.
 *
 * A `Pose3` has no axes a pose target can add, so `tweenPose` with this as `geometry` writes the
 * pose each frame rather than showing it through the scene's overrides.
 */
export function pathMotion3<TNode = unknown>(table: LengthTable, opts: PathMotion3Options<TNode>): PathMotion3<TNode> {
  if (table.dim !== 3) {
    throw new Error(`pathMotion3: the length table has ${String(table.dim)} components; a 2D path goes to core's pathMotion`);
  }
  const anchor = opts.anchor ?? { x: 0, y: 0, z: 0 };
  const up = normalize(opts.up ?? DEFAULT_UP);

  const facing = (tangent: Vec3, fallback: Quat): Quat => {
    if (len(tangent) === 0) return fallback;
    const x = normalize(tangent);
    const across = (v: Vec3): Vec3 => sub(v, scale(x, dot(v, x)));
    let y = across(up);
    // Running along `up`, any up across the path will do: keep the one the pose had.
    if (len(y) < 1e-9) y = across(quatRotate(fallback, { x: 0, y: 1, z: 0 }));
    if (len(y) < 1e-9) return fallback;
    y = normalize(y);
    const turn = quatFromBasis(x, y, cross(x, y));
    return opts.rotationOffset ? quatMultiply(turn, opts.rotationOffset) : turn;
  };

  const at = (pose: Pose3, u: number): Pose3 => {
    const f = Number.isNaN(u) ? 0 : Math.min(Math.max(u, 0), 1);
    const { point, tangent } = pointAtLength(table, f * table.total);
    const rotation = opts.orient ? facing(tangent, pose.rotation) : pose.rotation;
    const local = { x: anchor.x * pose.scale.x, y: anchor.y * pose.scale.y, z: anchor.z * pose.scale.z };
    return { ...pose, rotation, position: sub(point, quatRotate(rotation, local)) };
  };

  const { forNode, ...rest } = opts.descriptor;
  return {
    ...rest,
    table,
    at,
    lerp: (a, b, t) => at(lerp(a, b, t), t),
    ...(forNode ? { forNode: (node: TNode) => pathMotion3(table, { ...opts, descriptor: forNode(node) }) } : {}),
  };
}
