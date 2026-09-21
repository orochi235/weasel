/**
 * What a memoized derivation was derived *from*, so a hit can re-check it.
 *
 * A derivation keyed on the deriving node's own authored pose only notices a
 * change someone pushed. A dependency that moved with nothing pushed behind
 * it — an ancestor's frame moving, a removal, a dependency appearing — is
 * invisible to that key. Recording each dependency's node identity and a copy
 * of the pose it resolved to, and comparing both on the hit path, is what
 * notices it without a trigger.
 */
import { samePoseValue, snapshotPose } from './poseSnapshot';
import type { DerivedDep, NodeId } from './types';

/** Each dependency's node — an identity, so a restored clone is a different
 *  one — and a copy of the pose it resolved to. */
export interface DepRecord<TPose> {
  nodes: (object | undefined)[];
  poses: (TPose | undefined)[];
}

/** Record what `deps` resolved to, in place. Mutating the record is what
 *  updates the memo slot, which holds this object. */
export function recordDeps<TPose>(
  into: DepRecord<TPose>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
): void {
  into.nodes.length = 0;
  into.poses.length = 0;
  for (const dep of deps) {
    into.nodes.push(dep?.node);
    into.poses.push(dep === undefined ? undefined : snapshotPose(dep.pose));
  }
}

/** Whether the dependencies still resolve to the same nodes at the same poses
 *  the record was taken from. Resolves them one at a time rather than taking
 *  an array: this is the hit path, and it walks every derived node's every
 *  dependency on every frame. */
export function sameDeps<TPose>(
  record: DepRecord<TPose>,
  ids: readonly NodeId[],
  depOf: (id: NodeId) => DerivedDep<TPose> | undefined,
): boolean {
  if (record.nodes.length !== ids.length) return false;
  for (let i = 0; i < ids.length; i++) {
    const dep = depOf(ids[i]);
    if (record.nodes[i] !== (dep === undefined ? undefined : dep.node)) return false;
    if (dep !== undefined && !samePoseValue(record.poses[i], dep.pose)) return false;
  }
  return true;
}
