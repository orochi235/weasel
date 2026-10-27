import { type Affine } from '@weasel-js/geom';
import { createSetDataOp } from 'core/ops/setData';
import type { Op } from 'core/ops/types';

/** The pose a node is stored with before one pose-transform action, and the
 *  pose the action moved it to. A resize whose data took a mirror commits that
 *  pose with its box normalized. */
export interface PoseChange<TPose = unknown> {
  readonly from: TPose;
  readonly to: TPose;
}

/** Optional consumer seam: given a node and the transform that a pose-transform
 *  action applied to the node's POSE, return updated `data` with the node's
 *  data-held geometry transformed the same way, or `null` if this node has no
 *  data-held geometry (the kit leaves `data` alone).
 *
 *  `m` is that transform as a plane affine, in the node's stored frame and the
 *  coordinates gesture points arrive in: world on a 2D canvas, screen under the
 *  identity `clientToWorld` a camera-bearing host passes. A host whose poses
 *  are not planar reads the transform from `change` instead, which carries the
 *  stored pose before and after in the pose's own terms. For a flip of a pose
 *  that is only a box, `change` holds the same box twice and only `m` says
 *  which way the content mirrored. */
export interface GeometryProjection<TPose = unknown> {
  transform(
    node: { id?: string; data: unknown; pose: TPose },
    m: Affine,
    change: PoseChange<TPose>,
  ): unknown | null;
}

/** Build the `setData` op for a node when a geometryProjection is wired and
 *  returns non-null. Returns `undefined` (no op) otherwise — keeping the data
 *  op strictly opt-in so adapters without `setData` are never invoked. `to` is
 *  the pose the node is stored with once the action lands; `node.pose` is the
 *  one before it. */
export function geometryDataOp(
  projection: GeometryProjection | undefined,
  node: { id: string; data: unknown; pose: unknown } | undefined,
  m: Affine,
  to: unknown,
  label: string,
): Op | undefined {
  if (!projection || !node) return undefined;
  const next = projection.transform(node, m, { from: node.pose, to });
  if (next == null) return undefined;
  return createSetDataOp({ id: node.id, from: node.data, to: next, label, coalesceKey: `setData:${node.id}` });
}
