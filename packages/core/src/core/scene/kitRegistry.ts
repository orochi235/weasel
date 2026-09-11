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
import type { RectPose, SceneRegistry } from './types';

/** Registry key for {@link unionOfChildren}. */
export const UNION_OF_CHILDREN = 'kit:unionOfChildren';

/**
 * A container's pose as the envelope of what it holds — `unionAABB`, so a
 * rotated member contributes the extent of its ink rather than its unrotated
 * box. Paired with `dependsOn: 'children'`, this is what makes a group's
 * bounds track its members instead of freezing at the moment it was made.
 *
 * Returns `null` for an emptied container, which falls back to its authored
 * pose — the group stays where the last member left it rather than collapsing
 * to a zero box at the origin.
 *
 * Reads members as rect poses. A scene whose poses are shaped otherwise
 * registers `unionOfChildrenVia(itsDescriptor)` under {@link UNION_OF_CHILDREN};
 * the scene layer holds no descriptor of its own.
 */
export function unionOfChildren<TPose>(
  _node: unknown,
  deps: readonly ({ pose: TPose } | undefined)[],
): TPose | null {
  const poses: RectPose[] = [];
  for (const d of deps) {
    if (d !== undefined) poses.push(d.pose as unknown as RectPose);
  }
  if (poses.length === 0) return null;
  return unionAABB(poses) as unknown as TPose;
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
