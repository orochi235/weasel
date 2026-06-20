import { type Mat3 } from '@weasel-js/geom';
import { createSetDataOp } from 'core/ops/setData';
import type { Op } from 'core/ops/types';

/** Optional consumer seam: given a node and the affine `m` that a pose-transform
 *  action applied to the node's POSE, return updated `data` with the node's
 *  data-held geometry transformed by `m`, or `null` if this node has no
 *  data-held geometry (the kit leaves `data` alone). */
export interface GeometryProjection {
  transform(node: { id?: string; data: unknown; pose: unknown }, m: Mat3): unknown | null;
}

/** Build the `setData` op for a node when a geometryProjection is wired and
 *  returns non-null. Returns `undefined` (no op) otherwise — keeping the data
 *  op strictly opt-in so adapters without `setData` are never invoked. */
export function geometryDataOp(
  projection: GeometryProjection | undefined,
  node: { id: string; data: unknown; pose: unknown } | undefined,
  m: Mat3,
  label: string,
): Op | undefined {
  if (!projection || !node) return undefined;
  const next = projection.transform(node, m);
  if (next == null) return undefined;
  return createSetDataOp({ id: node.id, from: node.data, to: next, label, coalesceKey: `setData:${node.id}` });
}
