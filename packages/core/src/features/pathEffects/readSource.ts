/**
 * How the kit's path effects read a source node: its outline from its
 * painter's silhouette, its paint as `kit:path` resolves it.
 */
import { pathThroughPoseFrame, poseLinearOf, type PathInWorldPose } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import { isTextData, type TextOutlineSource } from '@weasel-js/text';
import { findNodeShape } from 'canvas/NodeShape';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { noteFontRead } from 'core/scene/fontReads';
import type { EffectSource } from 'core/scene/pathEffects/source';
import type { DerivedDep } from 'core/scene/types';
import { pathPaintOf } from 'canvas/nodeShapes/nodePaint';
import { textEffectItems } from './textItems';

/** `dep` as a path effect's source, or `null` when it has no outline. A text
 *  node's source also carries its grapheme clusters as items. */
export function readEffectSource(dep: DerivedDep<unknown>): EffectSource | null {
  const data = dep.node.data;
  const text = isTextData(data);
  // A text node's outline is laid out in its face, which may not have landed: without this read, an effect that found
  // no outline while the face loads would never look again.
  if (text) noteFontRead();
  const source = readShape(dep);
  const pose = dep.pose;
  if (source === null || !text || !isRectPose(pose)) return source;
  return { ...source, items: () => textEffectItems(data as TextOutlineSource, pose as PathInWorldPose) };
}

function readShape(dep: DerivedDep<unknown>): EffectSource | null {
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
