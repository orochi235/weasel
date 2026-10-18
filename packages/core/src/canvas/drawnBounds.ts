/**
 * The box of a node as drawn — its pose box with the stroke included — which
 * is what selection chrome, resize, rotate, and alignment sit on. Places that
 * store geometry (a group's derived pose, booleans, export) keep reading the
 * pose box through `framedBounds`.
 */
import { framedBounds, poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import {
  inkExtentsBetween,
  NO_INK_EXTENTS,
  outsetBox,
  type InkExtents,
} from 'core/geometry/inkExtents';
import { targetCorners, targetTransformOf, worldToLocal } from 'core/geometry/targetFrame';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import type { Node, NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { meanScale, type Scale2 } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { findNodeShape, type NodeInkCtx } from './NodeShape';

/** The scene reads {@link drawnBoundsOf} makes. `childrenOf` absent: every
 *  node is a leaf. */
export interface DrawnBoundsScene {
  get(id: NodeId): Node<unknown, string, unknown> | undefined;
  childrenOf?(id: NodeId): readonly NodeId[];
}

/** How {@link drawnBoundsOf} reads a node. */
export interface DrawnBoundsOptions {
  /** How poses are read. Default `AUTO_POSE_DESCRIPTOR`. */
  descriptor?: PoseDescriptor<unknown>;
  /** A member's world pose, for boxing a container around its members.
   *  Default: its pose as stored, which is world unless containers compose. */
  worldPoseOf?: (id: NodeId) => unknown;
  /** `false` answers the pose box alone. Default `true`. */
  includeStroke?: boolean;
  /** View scale, which a screen-pixel stroke width is resolved at. Default 1. */
  scale?: number | Scale2;
}

/**
 * The box of `id` drawn at `pose`, stroke included, in the frame the pose is
 * drawn in: a turned node's box comes back turned with it. A node with no
 * stroke, a painter that declares no {@link NodeShapeEntry.drawnBounds}, or
 * `includeStroke: false` answers `framedBounds` unchanged. A container's box
 * reaches as far as its members' boxes do.
 */
export function drawnBoundsOf(
  scene: DrawnBoundsScene,
  id: NodeId,
  pose: unknown,
  opts: DrawnBoundsOptions = {},
): Bounds {
  return outsetBox(framedBounds(pose, descriptorFor(scene, id, opts)), inkExtentsOf(scene, id, pose, opts));
}

/** How far `id`'s ink at `pose` reaches past its pose box on each side, in
 *  the box's own frame: what {@link drawnBoundsOf} grows the pose box by. */
export function inkExtentsOf(
  scene: DrawnBoundsScene,
  id: NodeId,
  pose: unknown,
  opts: DrawnBoundsOptions = {},
): InkExtents {
  if (opts.includeStroke === false) return NO_INK_EXTENTS;
  const node = scene.get(id);
  if (!node) return NO_INK_EXTENTS;
  const own = framedBounds(pose, descriptorFor(scene, id, opts));
  const unframed = { x: own.x, y: own.y, width: own.width, height: own.height };
  const members = node.kind === 'container' ? scene.childrenOf?.(id) ?? [] : [];
  if (members.length > 0) return membersExtents(scene, members, own, opts);
  const drawn = findShapeDrawnBounds(node, pose, inkCtx(opts.scale, own));
  return drawn === null ? NO_INK_EXTENTS : inkExtentsBetween(normalized(unframed), drawn);
}

/** A container's extents: its members' drawn boxes, taken into its own frame,
 *  past its own box. */
function membersExtents(
  scene: DrawnBoundsScene,
  members: readonly NodeId[],
  own: Bounds,
  opts: DrawnBoundsOptions,
): InkExtents {
  const xf = targetTransformOf(own);
  const worldPoseOf = opts.worldPoseOf ?? ((m: NodeId) => scene.get(m)?.pose);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of members) {
    const box = drawnBoundsOf(scene, m, worldPoseOf(m), opts);
    for (const c of targetCorners(box, targetTransformOf(box))) {
      const p = worldToLocal(xf, c.x, c.y);
      if (!p) continue;
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  }
  if (x0 === Infinity) return NO_INK_EXTENTS;
  return inkExtentsBetween(normalized(own), { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}

/** {@link drawnBoundsOf} as an axis-aligned box: what a turned node covers. */
export function drawnAABBOf(
  scene: DrawnBoundsScene,
  id: NodeId,
  pose: unknown,
  opts: DrawnBoundsOptions = {},
): Bounds {
  return axisAlignedBounds(drawnBoundsOf(scene, id, pose, opts));
}

/** The painter's {@link NodeShapeEntry.drawnBounds} for `node`, or `null`
 *  when no painter matches or the one that does declares none. */
export function findShapeDrawnBounds<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeInkCtx,
): Bounds | null {
  return findNodeShape(node)?.drawnBounds?.(node, pose, ctx) ?? null;
}

function descriptorFor(scene: DrawnBoundsScene, id: NodeId, opts: DrawnBoundsOptions): PoseDescriptor<unknown> {
  const d = opts.descriptor ?? AUTO_POSE_DESCRIPTOR;
  const node = scene.get(id);
  return node ? poseDescriptorForNode(d, node) : d;
}

/** A per-axis view scale also carries the map from `own`'s frame to screen,
 *  so a `{ px }` stroke is measured there rather than at the mean. */
function inkCtx(scale: number | Scale2 | undefined, own: Bounds): NodeInkCtx | undefined {
  if (scale === undefined) return undefined;
  if (typeof scale === 'number') return { scale };
  const xf = targetTransformOf(own);
  const [a, b, c, d] = xf.identity ? [1, 0, 0, 1] : xf.toWorld;
  return { scale: meanScale(scale), screen: [scale.x * a, scale.y * b, scale.x * c, scale.y * d] };
}

function normalized(b: Bounds): Bounds {
  return {
    x: Math.min(b.x, b.x + b.width),
    y: Math.min(b.y, b.y + b.height),
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };
}
