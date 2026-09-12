import { unionAABB } from 'core/geometry/unionBounds';
import {
  visualBoundsViaDescriptor,
  type PoseDescriptor,
} from 'interactions/actions/resize/geometry';

type DerivePose<TPose> = (
  node: { pose: TPose },
  deps: readonly ({ pose: TPose } | undefined)[],
) => TPose | null;

/**
 * A container's pose as the envelope of what it holds, read through
 * `descriptor` — a rotated member contributes the extent of its ink. Register
 * the result under `UNION_OF_CHILDREN` in `createScene`'s `registry` to teach
 * a scene how to size its groups around a pose shape the kit cannot read.
 *
 * Returns `null` for an emptied container, which falls back to its authored
 * pose rather than collapsing to a zero box at the origin.
 */
export function unionOfChildrenVia<TPose>(
  descriptor: PoseDescriptor<TPose>,
): DerivePose<TPose> {
  return (node, deps) => {
    const boxes = [];
    for (const d of deps) {
      if (d !== undefined) boxes.push(visualBoundsViaDescriptor(d.pose, descriptor));
    }
    const u = unionAABB(boxes);
    return u === null ? null : descriptor.fromBounds(u, node.pose);
  };
}
