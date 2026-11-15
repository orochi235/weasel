import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { rehomedFollowers } from 'core/pages/pagePlacement';
import { composeWorldPose, rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId } from 'core/scene/types';
import type { AnyScene } from 'core/scene/anyScene';

/** A node following others moved into `into`, from `parent`, its stored pose `from` becoming `to` so it keeps
 *  the world place it has. */
export interface FollowerMove {
  readonly id: NodeId;
  readonly parent: NodeId | null;
  readonly into: NodeId | null;
  readonly from: unknown;
  readonly to: unknown;
}

/** Follower `id` moved into `into` at the world place it has, or `null` when `into`'s frame is singular and
 *  no stored pose keeps it there. */
export function followerMove(scene: AnyScene, id: NodeId, into: NodeId | null): FollowerMove | null {
  const node = scene.get(id)!;
  const adapter = sceneViewPoseAdapter(scene);
  const pc = scene.composition;
  const world = composeWorldPose(adapter, id as string, pc.compose);
  const to = rebaseLocalPose(adapter, world, into as string | null, pc.compose, pc.decompose);
  return to === null ? null : { id, parent: node.parent, into, from: node.pose, to };
}

/** The followers an edit landing `landed` moves to another page or into the run (`rehomedFollowers`). Read
 *  before the edit is applied. `null` when any of them cannot keep its place, so the edit refuses whole. */
export function followerMoves(scene: AnyScene, landed: ReadonlyMap<string, string | null>): FollowerMove[] | null {
  const moves: FollowerMove[] = [];
  for (const [id, into] of rehomedFollowers(scene, landed)) {
    const move = followerMove(scene, id, into);
    if (move === null) return null;
    moves.push(move);
  }
  return moves;
}

/** The ops moving the followers of an edit landing `landed` (`followerMoves`), or `null` when one cannot
 *  keep its place. */
export function followerOpsFor(scene: AnyScene, landed: ReadonlyMap<string, string | null>, label: string | undefined): Op[] | null {
  const moves = followerMoves(scene, landed);
  return moves === null ? null : followerMoveOps(moves, label);
}

/** `moves` as ops. */
export function followerMoveOps(moves: readonly FollowerMove[], label: string | undefined): Op[] {
  return moves.flatMap((m) => [
    createReparentOp({ id: m.id as string, fromParentId: m.parent, toParentId: m.into as string | null, label }),
    createTransformOp<unknown>({ id: m.id as string, from: m.from, to: m.to, label }),
  ]);
}
