/**
 * The `SceneRegistry` entries the kit owns.
 *
 * A registry-keyed function has to be resolvable by key in whatever scene
 * loads a snapshot, so a function the *kit* attaches to a node cannot live in
 * the consumer's registry alone — a document saved with a grouped container
 * would come back with a dead key. `createScene` merges these under the
 * consumer's, which stays the winner on a key collision.
 */
import { unionAABB } from '../geometry/unionBounds';
import type { SceneRegistry } from './types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { visualBoundsViaDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

/** Registry key for {@link unionOfChildren}. */
export const UNION_OF_CHILDREN = 'kit:unionOfChildren';

type DerivePose<TPose> = (
  node: { pose: TPose },
  deps: readonly ({ pose: TPose } | undefined)[],
) => TPose | null;

/**
 * A container's pose as the envelope of what it holds, read through
 * `descriptor` — a rotated member contributes the extent of its ink. Paired
 * with `dependsOn: 'children'`, this is what makes a group's bounds track its
 * members instead of freezing at the moment it was made.
 *
 * Returns `null` for an emptied container, which falls back to its authored
 * pose — the group stays where the last member left it rather than collapsing
 * to a zero box at the origin.
 */
export function unionOfChildrenVia<TPose>(descriptor: PoseDescriptor<TPose>): DerivePose<TPose> {
  return (node, deps) => {
    const boxes = [];
    for (const d of deps) {
      if (d !== undefined) boxes.push(visualBoundsViaDescriptor(d.pose, descriptor));
    }
    const u = unionAABB(boxes);
    return u === null ? null : descriptor.fromBounds(u, node.pose);
  };
}

const autoUnion = unionOfChildrenVia<unknown>(AUTO_POSE_DESCRIPTOR);

/** The kit's union, over `AUTO_POSE_DESCRIPTOR` (rect and `Path` poses). A
 *  scene with another pose kind registers its own under `UNION_OF_CHILDREN`.
 *  One function instance: the registry serializes it by identity. */
export function unionOfChildren<TPose>(
  node: { pose: TPose },
  deps: readonly ({ pose: TPose } | undefined)[],
): TPose | null {
  return autoUnion(node, deps) as TPose | null;
}

/** Merge the kit's own entries under a consumer registry. */
export function withKitRegistry<TPose>(registry: SceneRegistry<TPose>): SceneRegistry<TPose> {
  return {
    ...registry,
    derivePose: {
      [UNION_OF_CHILDREN]: unionOfChildren as NonNullable<
        SceneRegistry<TPose>['derivePose']
      >[string],
      ...registry.derivePose,
    },
  };
}
