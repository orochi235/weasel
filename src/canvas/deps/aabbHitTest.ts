/**
 * Shared AABB hit-test used by both `areaSelect` and `lassoSelect` dep sources.
 *
 * Iterates `scene.renderOrder()` and returns ids whose pose AABB intersects the
 * given bounds. Non-rectangular poses are skipped (the default pose schema only
 * exposes x/y/width/height — consumers with richer poses should supply their
 * own hit-tester via the dep registry).
 */
import type { Scene, NodeId } from 'core/scene/types';

export interface AABBBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hitTestAABB(
  scene: Scene<unknown, string, unknown>,
  bounds: AABBBounds,
): NodeId[] {
  const hits: NodeId[] = [];
  for (const id of scene.renderOrder()) {
    const node = scene.get(id);
    if (!node || node.kind === 'container') continue;
    const p = node.pose as unknown as Partial<{
      x: number; y: number; width: number; height: number;
    }>;
    if (
      typeof p.x === 'number' && typeof p.y === 'number' &&
      typeof p.width === 'number' && typeof p.height === 'number'
    ) {
      if (
        p.x < bounds.x + bounds.width &&
        p.x + p.width > bounds.x &&
        p.y < bounds.y + bounds.height &&
        p.y + p.height > bounds.y
      ) {
        hits.push(id);
      }
    }
  }
  return hits;
}
