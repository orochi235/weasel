import { transformPath, type Affine, type Path } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { createInsertOp } from 'core/ops/create';
import type { Op } from 'core/ops/types';
import { flipPoseAboutBounds } from 'interactions/actions/flip/helpers';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { symmetryImages, type SymmetryImage } from './images';
import type { Symmetry } from './types';

/** What {@link mirrorInsertOps} needs from the canvas it builds twins for. */
export interface MirrorInsertsContext {
  /** A fresh node id for each twin. */
  mintId(): string;
  /** How a pose is read and flipped. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<unknown>;
  /** How a node's data-held geometry follows a transform. Without one, a
   *  `data.path` is transformed, the shape the kit's own inserts write. */
  geometryProjection?: GeometryProjection;
}

interface InsertedNode {
  id: string;
  parent?: string | null;
  pose: unknown;
  data: unknown;
}

function mirroredData(node: InsertedNode, m: Affine, projection: GeometryProjection | undefined): unknown {
  if (projection) return projection.transform(node, m) ?? null;
  const path = (node.data as { path?: Path } | null | undefined)?.path;
  return path ? { ...(node.data as object), path: transformPath(path, m) } : null;
}

function twinOf(
  node: InsertedNode,
  image: SymmetryImage,
  symmetry: Symmetry,
  ctx: MirrorInsertsContext,
): InsertedNode | null {
  const data = mirroredData(node, image.m, ctx.geometryProjection);
  if (data === null) return null;
  const geom = ctx.poseDescriptor ?? AUTO_POSE_DESCRIPTOR;
  const pivot = { x: symmetry.center.x, y: symmetry.center.y, width: 0, height: 0 };
  let pose = node.pose;
  for (const axis of image.flips) pose = flipPoseAboutBounds(pose, axis, geom, pivot);
  return { ...node, id: ctx.mintId(), pose, data };
}

/**
 * `ops`, with every node they insert followed by its mirrored twins, one per
 * copy `symmetry` makes, in the same batch: the drawing and its mirror land
 * and undo as one step. Pose and data are mirrored in world space, so only a
 * node inserted at the top of the tree is twinned, and only one whose geometry
 * can be mirrored (see {@link MirrorInsertsContext.geometryProjection}), which
 * leaves text and images single. Every other op passes through in place.
 */
export function mirrorInsertOps(
  ops: readonly Op[],
  symmetry: Symmetry | null,
  ctx: MirrorInsertsContext,
): Op[] {
  if (!symmetry) return [...ops];
  const images = symmetryImages(symmetry);
  const out: Op[] = [];
  for (const op of ops) {
    out.push(op);
    if (op.name !== 'insert') continue;
    const args = op.args as { node?: InsertedNode; cascaded?: unknown };
    const node = args.node;
    if (!node || args.cascaded || (node.parent ?? null) !== null) continue;
    for (const image of images) {
      const twin = twinOf(node, image, symmetry, ctx);
      if (twin) out.push(createInsertOp({ node: twin, label: op.label }));
    }
  }
  return out;
}
