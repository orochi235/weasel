import type { Bounds } from 'core/viewport/fitViewToBounds';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import { multiply, poseLinearOf, rotate } from '@weasel-js/geom';
import type { TargetAxes } from '@weasel-js/animator';
import type { PoseComposition } from 'core/scene/composeFrame';

/** `Bounds` with a required rotation angle (radians). Pivot is the AABB
 *  center of the unrotated `{x, y, width, height}`. */
export interface RotatedPose extends Bounds {
  rotation: number;
}

/** One pose before and after a translate, handed to the translate of another
 *  pose in the same move. Both are in the frame the translated pose is stored
 *  in: world for a root, its frame's coordinates for a pose under a container. */
export interface TranslateLead<TPose> {
  readonly from: TPose;
  readonly to: TPose;
}

/** A world `lead` expressed in the frame whose world pose is `frameWorld`, for a
 *  pose stored there; `null` is the root frame, where it is unchanged. */
export function leadUnder<TPose>(
  pc: Pick<PoseComposition<TPose>, 'decompose'>,
  frameWorld: TPose | null,
  lead: TranslateLead<TPose>,
): TranslateLead<TPose> {
  if (frameWorld === null) return lead;
  return { from: pc.decompose(frameWorld, lead.from), to: pc.decompose(frameWorld, lead.to) };
}

/**
 * Bridges arbitrary `TPose` shapes into the kit's bounds-driven math: bounds
 * are read via `getBounds`, and `remapBounds` projects a result back into
 * TPose.
 *
 * `remapBounds(pose, src, dst)` subsumes both "set my own AABB to dst"
 * (single-leaf resize) and "scale me as a leaf inside parent's src→dst rect"
 * (group resize) — they're the same affine map.
 */
export interface PoseDescriptor<TPose, TNode = unknown> {
  getBounds(pose: TPose): Bounds;
  remapBounds(pose: TPose, src: Bounds, dst: Bounds): TPose;
  /** A pose occupying `bounds`, of the same kind as `template`. Unlike
   *  `remapBounds`, the result carries none of the template's shape. */
  fromBounds(bounds: Bounds, template: TPose): TPose;
  /** Translate the pose by (dx, dy). Optional — when omitted, callers fall
   *  back to a translation derived from `remapBounds` (origin shifted, no
   *  scale). Path-shaped poses should provide this for performance.
   *
   *  `lead`, when given, is how another pose in the same move went under this
   *  same (dx, dy). A descriptor for which (dx, dy) is one translation for
   *  every pose ignores it. One that resolves it from where the pose sits, as
   *  under a perspective camera, moves `pose` by the lead's own change, so a
   *  move of several lands each of them by the amount it landed the lead. */
  translate?(pose: TPose, dx: number, dy: number, lead?: TranslateLead<TPose>): TPose;
  /** Interpolate between two poses. Optional — animation helpers fall back to
   *  rect-shape lerp when omitted (which fails for non-rect poses). */
  lerp?(a: TPose, b: TPose, t: number): TPose;
  /** How a pose of `like`'s kind maps to the flat numbers an animation moves, and which of them
   *  are angles. `from` keeps the fields of `like` that are not axes. Null for a pose this
   *  descriptor cannot map; absent, a pose animates by its flat numeric fields. */
  axes?(like: TPose): TargetAxes<TPose> | null;
  /** Read the pose's rotation in radians. Pivot is the AABB center
   *  (`getBounds(pose)` center). Default 0 when omitted. */
  getRotation?(pose: TPose): number;
  /** True iff this pose shape can carry a rotation; the rotation affordance
   *  hides when it is `false`. When omitted, the kit assumes `true`, so a
   *  descriptor whose poses cannot rotate (e.g. polygon Paths) should
   *  return `false`. */
  supportsRotation?(pose: TPose): boolean;
  /** Write a rotation (radians) into the pose, bounds unchanged. Absent means
   *  the pose cannot carry one, and the rotate action leaves it alone. */
  withRotation?(pose: TPose, rotation: number): TPose;
  /**
   * A descriptor specialized to one node. Every other method here sees only
   * the pose, so shapes sharing a pose type are indistinguishable to them.
   * Implement this to read `node.data` once and hand back a descriptor that
   * knows which shape it is describing. Callers reach it through
   * {@link poseDescriptorForNode}; sites with only an id keep using the
   * unspecialized descriptor.
   */
  forNode?(node: TNode): PoseDescriptor<TPose, TNode>;
}

/** The descriptor `node` should be read through: its own specialization when
 *  it declares one, and otherwise the descriptor unchanged. */
export function poseDescriptorForNode<TPose, TNode>(
  descriptor: PoseDescriptor<TPose, TNode>,
  node: TNode,
): PoseDescriptor<TPose, TNode> {
  return descriptor.forNode?.(node) ?? descriptor;
}

/** Identity geometry for `TPose extends Bounds`. Treats the pose as its
 *  own bounds and remaps via affine scale against `src`/`dst`. */
export const RECT_POSE_DESCRIPTOR: PoseDescriptor<Bounds> = {
  getBounds: (p) => p,
  remapBounds: (p, src, dst) => {
    const sx = src.width === 0 ? 1 : dst.width / src.width;
    const sy = src.height === 0 ? 1 : dst.height / src.height;
    return {
      ...p,
      x: dst.x + (p.x - src.x) * sx,
      y: dst.y + (p.y - src.y) * sy,
      width: p.width * sx,
      height: p.height * sy,
    };
  },
  fromBounds: (b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  lerp: (a, b, t) => ({
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  }),
  axes: (like) => {
    const flat = [like.x, like.y, like.width, like.height];
    if (!flat.every((n) => typeof n === 'number')) return null;
    return {
      count: 5,
      names: ['x', 'y', 'width', 'height', 'rotation'],
      angles: [4],
      to: (p) => [p.x, p.y, p.width, p.height, p.rotation ?? 0],
      from: (a) => {
        const pose = { ...like, x: a[0]!, y: a[1]!, width: a[2]!, height: a[3]! };
        if (like.rotation !== undefined || a[4] !== 0) pose.rotation = a[4]!;
        return pose;
      },
      add: (p, d) => {
        const pose = { ...p, x: p.x + d[0]!, y: p.y + d[1]!, width: p.width + d[2]!, height: p.height + d[3]! };
        const rotation = (p.rotation ?? 0) + d[4]!;
        if (p.rotation !== undefined || rotation !== 0) pose.rotation = rotation;
        return pose;
      },
      write: (p, out, at) => {
        out[at] = p.x;
        out[at + 1] = p.y;
        out[at + 2] = p.width;
        out[at + 3] = p.height;
        out[at + 4] = p.rotation ?? 0;
      },
    };
  },
  // `withRotation` writes into `Bounds`' optional `rotation`, so this reads
  // the same channel, or a pose reports itself unrotated while painting rotated.
  getRotation: (p) => p.rotation ?? 0,
  withRotation: (p, rotation) => ({ ...p, rotation }),
};

/** Identity geometry for `RotatedPose`: `RECT_POSE_DESCRIPTOR`'s projection,
 *  with a required `rotation`. */
export const ROTATED_POSE_DESCRIPTOR: PoseDescriptor<RotatedPose> = {
  getBounds: RECT_POSE_DESCRIPTOR.getBounds as PoseDescriptor<RotatedPose>['getBounds'],
  remapBounds: RECT_POSE_DESCRIPTOR.remapBounds as PoseDescriptor<RotatedPose>['remapBounds'],
  translate: RECT_POSE_DESCRIPTOR.translate as PoseDescriptor<RotatedPose>['translate'],
  lerp: RECT_POSE_DESCRIPTOR.lerp as PoseDescriptor<RotatedPose>['lerp'],
  axes: RECT_POSE_DESCRIPTOR.axes as PoseDescriptor<RotatedPose>['axes'],
  fromBounds: (b) => ({ x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 }),
  getRotation: (p) => p.rotation,
  withRotation: (p, rotation) => ({ ...p, rotation }),
};

/**
 * Remap a leaf drawn in a frame of its own, turned or skewed, inside a group
 * resize.
 *
 * The naive `remapBounds` scales a leaf's axis-aligned `width`/`height` by the
 * group's per-axis factors and carries `rotation` through untouched. That is
 * right when `src`/`dst` are expressed in the leaf's own frame. In a group
 * resize they are world-frame: at 90° a horizontal stretch should grow the
 * leaf's `height`, and the naive map grows its `width`.
 *
 * What this computes is the group affine applied to the leaf's frame. The
 * center moves exactly; each box axis takes the length of its own image under
 * the turn; the rotation follows the image of the box's x-axis; and the
 * parallelogram a non-uniform scale makes of a turned box, which those cannot
 * hold, is written to the leaf's `transform`.
 */
export function remapRotatedLeaf<TPose extends RotatedPose>(
  pose: TPose,
  src: Bounds,
  dst: Bounds,
): TPose {
  const sx = src.width === 0 ? 1 : dst.width / src.width;
  const sy = src.height === 0 ? 1 : dst.height / src.height;
  const theta = pose.rotation ?? 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // Images of the leaf's local unit axes under the group's diagonal scale.
  const ux = sx * cos, uy = sy * sin;
  const vx = -sx * sin, vy = sy * cos;
  const kx = Math.hypot(ux, uy);
  const ky = Math.hypot(vx, vy);

  const width = pose.width * kx;
  const height = pose.height * ky;
  const rotation = Math.atan2(uy, ux);

  // The center is a point, so it takes the group affine directly.
  const cxNew = dst.x + (pose.x + pose.width / 2 - src.x) * sx;
  const cyNew = dst.y + (pose.y + pose.height / 2 - src.y) * sy;

  const next: RotatedPose = { ...pose, x: cxNew - width / 2, y: cyNew - height / 2, width, height, rotation };
  // A collapsed axis leaves no frame to solve for; the leaf keeps the transform it had.
  if (kx === 0 || ky === 0) return next as TPose;
  const [ta, tb, tc, td] = poseLinearOf(pose) ?? [1, 0, 0, 1];
  // The linear part the leaf must draw with, less what the new box and rotation already hold.
  const [a, b, c, d] = multiply(
    multiply(rotate(-rotation), [ux, uy, vx, vy, 0, 0]),
    [ta / kx, tb / kx, tc / ky, td / ky, 0, 0],
  );
  if (Math.abs(a - 1) < 1e-12 && Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 && Math.abs(d - 1) < 1e-12) {
    delete next.transform;
  } else {
    next.transform = [a, b, c, d];
  }
  return next as TPose;
}

/** The pose's visual bounds: its box expanded to cover the box as drawn
 *  under its rotation and `transform`, so a turned or skewed shape reports
 *  the extent of its ink. */
export function visualBoundsViaDescriptor<TPose>(
  pose: TPose,
  geometry: PoseDescriptor<TPose>,
): Bounds {
  return axisAlignedBounds(framedBounds(pose, geometry));
}

/** The pose's box with the rotation and `transform` it is drawn in: what
 *  `poseFrameOf` reads, for a pose only its descriptor can read. */
export function framedBounds<TPose>(pose: TPose, geometry: PoseDescriptor<TPose>): Bounds {
  const b = geometry.getBounds(pose);
  const rotation = geometry.getRotation?.(pose) ?? b.rotation ?? 0;
  const transform = poseLinearOf(pose) ?? poseLinearOf(b);
  if (!rotation && !transform) return b;
  return { ...b, ...(rotation ? { rotation } : {}), ...(transform ? { transform } : {}) };
}

/** Translate through `geometry.translate`, or via `remapBounds` onto a shifted
 *  copy of the pose's own bounds when the descriptor has none. */
export function translatePoseViaDescriptor<TPose>(
  pose: TPose,
  dx: number,
  dy: number,
  geometry: PoseDescriptor<TPose>,
  lead?: TranslateLead<TPose>,
): TPose {
  if (geometry.translate) return lead ? geometry.translate(pose, dx, dy, lead) : geometry.translate(pose, dx, dy);
  const src = geometry.getBounds(pose);
  const dst = { x: src.x + dx, y: src.y + dy, width: src.width, height: src.height };
  return geometry.remapBounds(pose, src, dst);
}
