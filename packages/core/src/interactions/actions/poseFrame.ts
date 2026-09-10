/**
 * World reads and local writes, paired, for the default actions.
 *
 * A container's pose defines a frame, so a node's stored pose is expressed in
 * its parent's. The geometry an action reasons about — a rotate pivot, an
 * alignment edge, a distribute span, a flip axis — is world; every pose it
 * writes back through `setPose` or a pose op is local. An action that reads
 * world and writes world looks right for one gesture and drifts on the next,
 * because the stored pose is then read in the parent's frame again.
 *
 * Under `IDENTITY_POSE_COMPOSITION` — the default, and what every consumer
 * ships today — local and world are the same value and all of this is an
 * identity. `features/groups/frameFixture.ts` is the scene where they differ.
 */
import { effectivePose, type PoseSource } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import {
  composeWorldPose,
  rebaseLocalPose,
  IDENTITY_POSE_COMPOSITION,
  type PoseAdapter,
  type PoseComposition,
} from 'features/groups/composePose';

/** The two directions an action needs, over one composition strategy. */
export interface PoseFrame<TPose> {
  /** The strategy in force. `closure` says what it can express exactly. */
  readonly pc: PoseComposition<TPose>;
  /** `id`'s pose in world coordinates, honoring an in-flight gesture override. */
  world(id: NodeId): TPose;
  /** `id`'s parent's world pose, or `null` when it has no parent. */
  parentWorld(id: NodeId): TPose | null;
  /** `worldPose` expressed in `id`'s own parent frame — what `setPose` stores. */
  local(id: NodeId, worldPose: TPose): TPose;
  /** `worldPose` expressed under `parentId`'s frame. For a node about to be
   *  reparented, whose current parent is not the frame it will be stored in. */
  localUnder(parentId: NodeId | null, worldPose: TPose): TPose;
}

/** Pair the two directions over an arbitrary pose adapter. */
export function poseFrame<TPose>(
  adapter: PoseAdapter<TPose>,
  pc: PoseComposition<TPose>,
): PoseFrame<TPose> {
  return {
    pc,
    world: (id) => composeWorldPose(adapter, id as string, pc.compose),
    parentWorld: (id) => {
      const parent = adapter.getParent(id as string);
      return parent === null ? null : composeWorldPose(adapter, parent, pc.compose);
    },
    local: (id, worldPose) =>
      rebaseLocalPose(adapter, worldPose, adapter.getParent(id as string), pc.compose, pc.decompose),
    localUnder: (parentId, worldPose) =>
      rebaseLocalPose(adapter, worldPose, parentId as string | null, pc.compose, pc.decompose),
  };
}

/** The `poseFrame` a scene-backed action works in. `poseComposition` is the
 *  dep as it arrives — absent means IDENTITY, where every method is a no-op. */
export function scenePoseFrame(
  scene: Scene<unknown, string, unknown>,
  poseComposition: unknown,
): PoseFrame<unknown> {
  const pc =
    (poseComposition as PoseComposition<unknown> | undefined) ?? IDENTITY_POSE_COMPOSITION;
  const source = scene as unknown as PoseSource<unknown>;
  const adapter: PoseAdapter<unknown> = {
    getPose: (id) => {
      const node = scene.get(id as NodeId);
      return node === undefined ? { x: 0, y: 0, width: 0, height: 0 } : effectivePose(source, node);
    },
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
  };
  return poseFrame(adapter, pc);
}
