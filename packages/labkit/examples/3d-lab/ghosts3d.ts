/**
 * What the lab paints for a gesture that has not committed yet.
 *
 * `moveAction` writes nothing to the scene while a drag runs — it keeps the
 * interim pose on its handle and commits one op at the end. So the solid the
 * painter already draws from `node.pose` is the one that stays put, and the
 * ghost is what `resolvePreviews` reads off the same handles `<SceneCanvas>`
 * reads: whose pose is in flight, and which of several sources wins.
 */

import {
  flattenPreviews,
  resolvePreviews,
  type GesturePreviewSource,
  type NodeId,
} from '@weasel-js/core';
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
 * A ghost per previewing solid.
 *
 * The kit resolves which ids are in flight and whose preview wins; the pose
 * still arrives as `unknown`, and one from another descriptor would reach the
 * renderer as NaN matrices rather than as an error, so it is checked here.
 */
export function collectGhosts(
  sources: Iterable<GesturePreviewSource>,
  scene: SolidScene,
): GhostDraw[] {
  const ghosts: GhostDraw[] = [];
  for (const entry of flattenPreviews(resolvePreviews(sources, scene))) {
    if (!isPose3(entry.pose)) continue;
    ghosts.push({ id: entry.id, pose: entry.pose, kind: entry.data.kind, color: entry.data.color });
  }
  return ghosts;
}
