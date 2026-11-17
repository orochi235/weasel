/**
 * How the kit's path effects read a source node: its outline from its
 * painter's silhouette, its paint as `kit:path` resolves it.
 */
import { pathThroughPoseFrame, poseLinearOf } from '@weasel-js/geom';
import type { Fill, Stroke } from '@weasel-js/paint';
import { findNodeShape, nodeShapesOf, type NodeShapeEntry, type NodeShapes } from 'canvas/NodeShape';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { noteOutsideRead } from 'core/scene/outsideReads';
import type { EffectSource } from 'core/scene/pathEffects/source';
import type { DerivedDep } from 'core/scene/types';
import { pathPaintOf } from 'canvas/nodeShapes/nodePaint';
import { withInheritedPaint } from 'core/scene/inheritedPaint';

/** `dep` as a path effect's source, or `null` when it has no outline. A
 *  source whose painter lays it out as items (`effectItems`) carries them,
 *  laid from its data with an `'inherit'` fill or stroke resolved, as it draws. */
export function readEffectSource(dep: DerivedDep<unknown>): EffectSource | null {
  const shapes = dep.scene ? nodeShapesOf(dep.scene) : undefined;
  const entry = findNodeShape(dep.node, shapes) as NodeShapeEntry<unknown, unknown> | undefined;
  // An outline that moves with no edit — a text node's, laid out in a face that may not have
  // landed — is an outside read: without it, an effect that found no outline while the face
  // loads would never look again.
  if (entry?.geometryGeneration) noteOutsideRead();
  const source = readShape(dep, entry, shapes);
  const items = entry?.effectItems;
  if (source === null || !items) return source;
  return { ...source, items: () => items(withInheritedData(dep), dep.pose) };
}

function withInheritedData(dep: DerivedDep<unknown>): DerivedDep<unknown>['node'] {
  const data = dep.node.data as { fill?: unknown; stroke?: unknown } | null | undefined;
  if (data == null) return dep.node;
  const shown = withInheritedPaint(data, dep.inherited);
  return shown === data ? dep.node : { ...dep.node, data: shown };
}

function readShape(
  dep: DerivedDep<unknown>, entry: NodeShapeEntry<unknown, unknown> | undefined, shapes: NodeShapes | undefined,
): EffectSource | null {
  const data = (dep.node.data ?? {}) as { fill?: Fill | null; stroke?: Stroke | null };
  const { fill, stroke } = pathPaintOf(data, dep.inherited);
  const paint = { fill, stroke: stroke ?? null };
  const shown = dep.path;
  if (shown !== null) return { world: shown, ...paint };
  const local = entry?.silhouette?.(dep.node, dep.pose, shapes ? { shapes } : undefined) ?? null;
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
