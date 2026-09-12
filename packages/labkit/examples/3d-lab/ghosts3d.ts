/**
 * What the lab paints for a gesture that has not committed yet.
 *
 * `moveAction` writes nothing to the scene while a drag runs — it keeps the
 * interim pose on its handle and commits one op at the end. So the solid the
 * painter already draws from `node.pose` is the one that stays put, and the
 * ghost is the handle's pose read through the same `GesturePreviewSource`
 * contract `<SceneCanvas>`'s ghost layer reads.
 */

import type { GesturePreviewSource, NodeId } from '@weasel-js/core';
import type { Pose3, SolidKind, SolidScene } from './scene3d';

export interface GhostDraw {
  id: NodeId;
  pose: Pose3;
  kind: SolidKind;
  color: string;
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function isPose3(value: unknown): value is Pose3 {
  if (!value || typeof value !== 'object') return false;
  const pose = value as Partial<Pose3>;
  return isVec3(pose.position) && isVec3(pose.scale) && Array.isArray(pose.rotation);
}

/**
 * Ghosts for every in-flight handle, merged first-non-null across sources the
 * way the kit's ghost layer merges them.
 *
 * An id with no node is skipped rather than treated as an error: an insert
 * previews before the node it will create exists.
 */
export function collectGhosts(
  sources: Iterable<GesturePreviewSource>,
  scene: SolidScene,
): GhostDraw[] {
  const seen = new Map<NodeId, Pose3>();

  for (const source of sources) {
    const ids = source.previewIds?.();
    if (!ids) continue;
    for (const raw of ids) {
      const id = raw as NodeId;
      if (seen.has(id)) continue;
      const pose = source.previewPose?.(raw);
      if (!isPose3(pose)) continue;
      seen.set(id, pose);
    }
  }

  const ghosts: GhostDraw[] = [];
  for (const [id, pose] of seen) {
    const node = scene.get(id);
    if (!node) continue;
    ghosts.push({ id, pose, kind: node.data.kind, color: node.data.color });
  }
  return ghosts;
}
