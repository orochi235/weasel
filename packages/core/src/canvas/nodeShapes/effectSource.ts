/**
 * How a path effect reads a source node: its outline from its painter's
 * silhouette, its paint as `kit:path` resolves it. Installed into the scene's
 * path effects by `NodeShape.ts` as it loads.
 */
import { pathThroughPoseFrame, poseLinearOf } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import { findNodeShape } from 'canvas/NodeShape';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import type { EffectSource } from 'core/scene/pathEffects/source';
import type { DerivedDep } from 'core/scene/types';
import { pathPaintOf } from './nodePaint';

/** `dep` as a path effect's source, or `null` when it has no outline. */
export function readEffectSource(dep: DerivedDep<unknown>): EffectSource | null {
  const data = (dep.node.data ?? {}) as { fill?: Fill | null; stroke?: Stroke | null };
  const { fill, stroke } = pathPaintOf(data);
  const paint = { fill, stroke: stroke ?? null };
  const shown = dep.path;
  if (shown !== null) return { world: shown, ...paint };
  const local = findNodeShape(dep.node)?.silhouette?.(dep.node, dep.pose) ?? null;
  if (local === null) return null;
  const world = pathThroughPoseFrame(local, dep.pose);
  const pose = dep.pose;
  if (!isRectPose(pose) || poseLinearOf(pose) !== null) return { world, ...paint };
  return {
    world,
    framed: { path: local, cx: pose.x + pose.width / 2, cy: pose.y + pose.height / 2, rotation: pose.rotation ?? 0 },
    ...paint,
  };
}
