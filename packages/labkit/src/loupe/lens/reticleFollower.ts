import {
  createTransformOp,
  type RectPose,
  type TransformFollower,
  type TransformPreviewNode,
  writtenBy,
} from '@weasel-js/core';
import { lensIdsOf, patchAt } from './lensScene';
import type { LensScene } from './lensTypes';

const centerOf = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
const sameSize = (a: RectPose, b: RectPose) => a.width === b.width && a.height === b.height;

/** Each pinned or Follow reticle whose body `poses` resizes, at the patch the body would then show. `poses` is the
 *  transform's stored pose for every node it writes, a reticle moved alongside its body included. */
function resized<C>(
  scene: LensScene<C>,
  poses: ReadonlyMap<string, unknown>,
): TransformPreviewNode[] {
  const out: TransformPreviewNode[] = [];
  for (const [id, pose] of poses) {
    const body = scene.get(id as never);
    if (body?.data.role !== 'lens-body' || body.data.aim === 'glass') continue;
    const ids = lensIdsOf(scene, id);
    const reticle = ids ? scene.get(ids.reticle) : undefined;
    if (!ids || !reticle) continue;
    const at = (poses.get(ids.reticle) as RectPose | undefined) ?? reticle.pose;
    const next = patchAt(pose as RectPose, body.data.factor, centerOf(at));
    if (!sameSize(next, at)) out.push({ id: ids.reticle, pose: next });
  }
  return out;
}

/**
 * The transform follower that keeps a reticle the size of its lens's patch while a resize changes its body, for the
 * lens canvas's `transformFollowers` dep (`useTransformFollower`). A Glass reticle derives its pose and needs none.
 */
export function reticleFollower<C>(scene: LensScene<C>): TransformFollower {
  return {
    preview: (frame) => resized(scene, frame),
    finish(ops, label) {
      const written = writtenBy(scene as never, ops);
      if (written === null) return [...ops];
      const poses = new Map([...written].map(([id, w]) => [id, w.pose]));
      const follow = resized(scene, poses).map((r) =>
        createTransformOp({
          id: r.id,
          from: poses.get(r.id) ?? scene.get(r.id as never)?.pose,
          to: r.pose,
          label,
        }),
      );
      return [...ops, ...follow];
    },
  };
}
