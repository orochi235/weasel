import { pathLengthTable, pointAtLength, type LengthTable, type Path } from '@weasel-js/geom';
import type { Bounds } from '../core/viewport/fitViewToBounds';
import {
  RECT_POSE_DESCRIPTOR, translatePoseViaDescriptor, type PoseDescriptor,
} from '../core/geometry/poseDescriptor';

/** Options for {@link pathMotion}. */
export interface PathMotionOptions<TPose> {
  /** Reads and writes the pose. Default `RECT_POSE_DESCRIPTOR`. */
  descriptor?: PoseDescriptor<TPose>;
  /** The point of the pose that rides the path, as fractions of its unrotated bounds: `{ x: 0, y: 0 }`
   *  is the top-left corner. It turns with the pose. Default the center, `{ x: 0.5, y: 0.5 }`. */
  anchor?: { x: number; y: number };
  /** Whether the pose turns with the path, its rotation set to the tangent's angle. Needs a descriptor
   *  with `withRotation`. Default false: the rotation is the moving pose's own. */
  orient?: boolean;
  /** Radians added to the tangent's angle when `orient` is on: `Math.PI / 2` points the pose's +y
   *  along the path rather than its +x. Default 0. */
  rotationOffset?: number;
}

/** A pose descriptor whose `lerp` carries a pose along a path, and the placement it is built on. */
export interface PathMotion<TPose> extends PoseDescriptor<TPose> {
  /** The path's length table, in two components. */
  readonly table: LengthTable;
  /** `pose` placed at fraction `u` of the path's length, `u` clamped to 0..1: its anchor on the path
   *  and, with `orient`, turned to the tangent. `at(pose, 1)` is the `to` of a move along the path. */
  at(pose: TPose, u: number): TPose;
  /** `a` toward `b` by the descriptor's own lerp, then placed at fraction `t` of the path. */
  lerp(a: TPose, b: TPose, t: number): TPose;
}

/**
 * A descriptor that moves a pose along `path` by length, for `tweenPose`'s `geometry`, a sampled
 * track's `interpolate`, or anything else that takes a lerp. Its other methods are `descriptor`'s.
 *
 * ```ts
 * const motion = pathMotion(path, { orient: true });
 * tweenPose(animator, adapter, { id, to: motion.at(pose, 1), geometry: motion, ms: 2000 });
 * ```
 *
 * Fraction `t` of the move is fraction `t` of the path's length, so easing shapes the speed and a
 * curved segment is traveled at its true arc length. A pose that does not start on the path's start
 * jumps there on the first frame. `path` may be a length table already built, in two components;
 * `@weasel-js/kernel3d`'s `pathMotion3` is the same for a `Pose3` on a three-component one.
 */
export function pathMotion<TPose = Bounds>(path: Path | LengthTable, opts: PathMotionOptions<TPose> = {}): PathMotion<TPose> {
  const base = opts.descriptor ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
  const table = 'kind' in path ? pathLengthTable(path) : path;
  if (table.dim !== 2) {
    throw new Error(`pathMotion: the length table has ${String(table.dim)} components; a 3D path goes to kernel3d's pathMotion3`);
  }
  const withRotation = base.withRotation;
  if (opts.orient && !withRotation) {
    throw new Error('pathMotion: orient needs a descriptor with withRotation');
  }
  const ax = opts.anchor?.x ?? 0.5;
  const ay = opts.anchor?.y ?? 0.5;
  const offset = opts.rotationOffset ?? 0;
  const ox = table.origin?.x ?? 0;
  const oy = table.origin?.y ?? 0;

  const at = (pose: TPose, u: number): TPose => {
    const f = Number.isNaN(u) ? 0 : Math.min(Math.max(u, 0), 1);
    const { point, tangent } = pointAtLength(table, f * table.total);
    let placed = pose;
    let rotation = base.getRotation?.(pose) ?? 0;
    if (withRotation && opts.orient) {
      if (tangent[0] !== 0 || tangent[1] !== 0) rotation = Math.atan2(tangent[1], tangent[0]) + offset;
      placed = withRotation(pose, rotation);
    }
    const b = base.getBounds(placed);
    const dx = (ax - 0.5) * b.width;
    const dy = (ay - 0.5) * b.height;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const anchorX = b.x + b.width / 2 + cos * dx - sin * dy;
    const anchorY = b.y + b.height / 2 + sin * dx + cos * dy;
    return translatePoseViaDescriptor(placed, point[0] + ox - anchorX, point[1] + oy - anchorY, base);
  };

  const baseLerp = base.lerp;
  const { forNode, ...rest } = base;
  return {
    ...rest,
    table,
    at,
    lerp: (a, b, t) => at(baseLerp ? baseLerp(a, b, t) : t < 1 ? a : b, t),
    ...(forNode ? { forNode: (node: unknown) => pathMotion(table, { ...opts, descriptor: forNode(node) }) } : {}),
  };
}
