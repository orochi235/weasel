/**
 * World reads and local writes, paired, for the default actions.
 *
 * A container's pose defines a frame, so a node's stored pose is expressed in
 * its parent's. The geometry an action reasons about is world; every pose it
 * writes back through `setPose` or a pose op is local. An action that reads
 * world and writes world looks right for one gesture and drifts on the next,
 * because the stored pose is then read in the parent's frame again.
 *
 * Under `IDENTITY_POSE_COMPOSITION` local and world are the same value.
 */
import { boxFrameOf, type Affine } from '@weasel-js/geom';
import { definesFrame, effectivePose, type PoseSource } from 'core/scene/effectivePose';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import {
  composeWorldPose,
  frameAtOrAbove,
  rebaseLocalPose,
  type PoseAdapter,
  type PoseComposition,
} from 'core/scene/composePose';

/** The two directions an action needs, over one composition strategy. */
export interface PoseFrame<TPose> {
  /** The strategy in force. `closure` says what it can express exactly. */
  readonly pc: PoseComposition<TPose>;
  /** `id`'s pose in world coordinates, honoring an in-flight gesture override. */
  world(id: NodeId): TPose;
  /** The node whose frame `id` is stored in, or `null` for the root frame. */
  frame(id: NodeId): NodeId | null;
  /** World pose of the frame `id` is stored in, or `null` for the root frame. */
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
    frame: (id) => {
      const frame = frameAtOrAbove(adapter, adapter.getParent(id as string));
      return frame === null ? null : asNodeId(frame);
    },
    parentWorld: (id) => {
      const frame = frameAtOrAbove(adapter, adapter.getParent(id as string));
      return frame === null ? null : composeWorldPose(adapter, frame, pc.compose);
    },
    local: (id, worldPose) =>
      rebaseLocalPose(adapter, worldPose, adapter.getParent(id as string), pc.compose, pc.decompose),
    localUnder: (parentId, worldPose) =>
      rebaseLocalPose(adapter, worldPose, parentId as string | null, pc.compose, pc.decompose),
  };
}

/** The `poseFrame` a scene-backed action works in, over the scene's own
 *  composition. */
export function scenePoseFrame(scene: Scene<unknown, string, unknown>): PoseFrame<unknown> {
  const pc = scene.composition;
  const source = scene as unknown as PoseSource<unknown>;
  const adapter: PoseAdapter<unknown> = {
    getPose: (id) => {
      const node = scene.get(id as NodeId);
      return node === undefined ? { x: 0, y: 0, width: 0, height: 0 } : effectivePose(source, node);
    },
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => {
      const node = scene.get(id as NodeId);
      return node === undefined || definesFrame(node);
    },
  };
  return poseFrame(adapter, pc);
}

/** Each node's box frame in world, `boxFrameOf` its world pose: where a
 *  container's children are laid out, and its own grid runs. `null` for a
 *  node missing from `scene` or whose pose is not a box. */
export function sceneBoxFrames(scene: Scene<unknown, string, unknown>): (id: string) => Affine | null {
  const frame = scenePoseFrame(scene);
  return (id) => (scene.get(id as NodeId) === undefined ? null : boxFrameOf(frame.world(id as NodeId)));
}
