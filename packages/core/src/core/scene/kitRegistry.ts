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
 * Reads members as rect poses, and only as rect poses: a scene whose poses are
 * shaped otherwise gets `null` here and its container keeps its authored pose,
 * because this entry is registered into every scene and the scene layer holds
 * no descriptor to read another shape with. To make such a container track its
 * members, register `unionOfChildrenVia(itsDescriptor)` under
 * {@link UNION_OF_CHILDREN} — the consumer's entry wins the collision.
 */
export function unionOfChildren<TPose>(
  _node: unknown,
  deps: readonly ({ pose: TPose } | undefined)[],
): TPose | null {
  const poses: RectPose[] = [];
  for (const d of deps) {
    if (d === undefined) continue;
    const rect = asRectPose(d.pose);
    if (rect === null) return null;
    poses.push(rect);
  }
  if (poses.length === 0) return null;
  const union = unionAABB(poses);
  // Sound by the check above: every member read as a rect, so the union is one
  // too, and a scene holding rect poses is a scene whose `TPose` is one.
  return union === null ? null : (union as unknown as TPose);
}

/** `pose` as a rect, or `null` when it is some other shape entirely. */
function asRectPose(pose: unknown): RectPose | null {
  if (pose === null || typeof pose !== 'object') return null;
  const p = pose as Partial<RectPose>;
  const rect = typeof p.x === 'number' && typeof p.y === 'number'
    && typeof p.width === 'number' && typeof p.height === 'number';
  return rect ? (pose as RectPose) : null;
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
