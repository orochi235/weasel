/**
 * Path leaves as the kit's own path deps read and write them: geometry in
 * `data.path`, drawn through the box its pose describes.
 */
import type { Path } from '@weasel-js/geom';
import { poseLinearOf, worldEditToStorage, type PathInWorldPose } from '@weasel-js/geom';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Node, Scene } from 'core/scene/types';

/** A path leaf's world pose, and the box, rotation, and transform its path is drawn through. */
export interface DrawnPose {
  world: unknown;
  g: PoseDescriptor<unknown>;
  box: PathInWorldPose;
}

/** How `g` draws a leaf at `world`, or null for a pose it reads no finite box from. */
export function drawnPose(g: PoseDescriptor<unknown>, world: unknown): DrawnPose | null {
  const b = g.getBounds(world);
  if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) return null;
  const rotation = g.getRotation?.(world) ?? 0;
  const transform = poseLinearOf(world) ?? undefined;
  return { world, g, box: { x: b.x, y: b.y, width: b.width, height: b.height, rotation, transform } };
}

/** A world-space piece as a world pose of the source's kind plus the path it draws. */
export function storePiece({ world, g, box }: DrawnPose, piece: Path): { pose: unknown; path: Path } {
  const keepsRotation = !!g.withRotation && g.supportsRotation?.(world) !== false;
  const rotation = box.rotation ?? 0;
  if (rotation !== 0 && !keepsRotation) {
    const baked = worldEditToStorage({ ...box, rotation: 0 }, piece);
    return { pose: g.fromBounds(baked.pose, world), path: baked.path };
  }
  const { pose: b, path } = worldEditToStorage(box, piece);
  const dst = { x: b.x, y: b.y, width: b.width, height: b.height };
  const pose = g.remapBounds(world, g.getBounds(world), dst);
  return { pose: rotation !== 0 ? g.withRotation!(pose, rotation) : pose, path };
}

/** The path a leaf stores, or null for one that is not a free path leaf: a
 *  group, a locked leaf, one whose geometry derives from other nodes. */
export function leafPath(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>): Path | null {
  if (node.kind !== 'mark' || node.derivePath || node.derivePose) return null;
  if (scene.isLocked(node.id)) return null;
  const path = (node.data as { path?: unknown } | null)?.path as Path | undefined;
  return path && (path.kind === 'rect' || path.kind === 'polygon') ? path : null;
}
