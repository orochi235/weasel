import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { rehomedFollowers } from 'core/pages/pagePlacement';
import { composeWorldPose, rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId, Scene } from 'core/scene/types';

type AnyScene = Scene<unknown, string, unknown>;

/** A node following others moved into `into`, from `parent`, its stored pose `from` becoming `to` so it keeps
 *  the world place it has. */
export interface FollowerMove {
  readonly id: NodeId;
  readonly parent: NodeId | null;
  readonly into: NodeId | null;
  readonly from: unknown;
  readonly to: unknown;
}

/** Follower `id` moved into `into` at the world place it has. */
export function followerMove(scene: AnyScene, id: NodeId, into: NodeId | null): FollowerMove {
  const node = scene.get(id)!;
  const adapter = sceneViewPoseAdapter(scene);
  const pc = scene.composition;
  const world = composeWorldPose(adapter, id as string, pc.compose);
  return { id, parent: node.parent, into, from: node.pose, to: rebaseLocalPose(adapter, world, into as string | null, pc.compose, pc.decompose) };
}

/** The followers an edit landing `landed` moves to another page or into the run (`rehomedFollowers`). Read
 *  before the edit is applied. */
export function followerMoves(scene: AnyScene, landed: ReadonlyMap<string, string | null>): FollowerMove[] {
  return [...rehomedFollowers(scene, landed)].map(([id, into]) => followerMove(scene, id, into));
}

/** `moves` as ops. */
export function followerMoveOps(moves: readonly FollowerMove[], label: string | undefined): Op[] {
  return moves.flatMap((m) => [
    createReparentOp({ id: m.id as string, fromParentId: m.parent, toParentId: m.into as string | null, label }),
    createTransformOp<unknown>({ id: m.id as string, from: m.from, to: m.to, label }),
  ]);
}
