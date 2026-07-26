/**
 * Silhouette-awareness tests for the shared area hit-test used by marquee
 * (`areaSelect`) and lasso (`lassoSelect`) dep sources.
 *
 * A right-triangle polygon pose fills the lower-left half of its AABB
 * [0,0]-[100,100]; the upper-right corner of that AABB is EMPTY (no
 * silhouette). A rect-only AABB test would (wrongly) select the triangle
 * when the marquee only overlaps that empty corner. `hitTestArea` consults
 * the silhouette via the kernel, so it must NOT.
 */
import { describe, it, expect } from 'vitest';
import { PATH_M, PATH_L, PATH_Z } from 'features/paths/types';
import { hitTestArea } from './hitTestArea';
import type { Scene, NodeId } from 'core/scene/types';

/** Right triangle: (0,0) -> (100,0) -> (0,100), closed. AABB = [0,0,100,100].
 *  Hypotenuse from (100,0) to (0,100); the upper-right corner of the AABB
 *  (x+y > 100) is outside the silhouette. */
function triangleScene(): Scene<unknown, string, unknown> {
  const tri = {
    kind: 'polygon' as const,
    commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z),
    coords: Float32Array.of(0, 0, 100, 0, 0, 100),
    fillRule: 'nonzero' as const,
  };
  const nodes = new Map<string, { id: string; kind: 'leaf'; pose: unknown; data: unknown }>();
  nodes.set('t', { id: 't', kind: 'leaf', pose: tri, data: null });
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => ['t'] as NodeId[],
    get: (id: NodeId) => nodes.get(id as string) as never,
  } as unknown as Scene<unknown, string, unknown>;
}

describe('hitTestArea — silhouette awareness', () => {
  it('does NOT select a triangle when the marquee only overlaps its empty AABB corner', () => {
    const scene = triangleScene();
    // Marquee [90,90]-[98,98]: inside the triangle's AABB, but entirely on the
    // empty side of the hypotenuse (x+y > 100). Rect-only AABB would select it.
    expect(hitTestArea(scene, { x: 90, y: 90, width: 8, height: 8 })).toEqual([]);
  });

  it('DOES select a triangle when the marquee actually touches its silhouette', () => {
    const scene = triangleScene();
    // Marquee [0,0]-[8,8]: overlaps the filled near-(0,0) corner of the triangle.
    expect(hitTestArea(scene, { x: 0, y: 0, width: 8, height: 8 })).toEqual(['t']);
  });

  it('skips a pose without finite numeric bounds (historical hitTestAABB behavior)', () => {
    // A custom pose that is neither path-like nor a plain x/y/w/h rect has no
    // resolvable AABB; the old hitTestAABB skipped it rather than selecting it.
    const nodes = new Map<string, { id: string; kind: 'leaf'; pose: unknown; data: unknown }>();
    nodes.set('m', { id: 'm', kind: 'leaf', pose: { label: 'no-bounds' }, data: null });
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['m'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string) as never,
    } as unknown as Scene<unknown, string, unknown>;
    expect(hitTestArea(scene, { x: 0, y: 0, width: 1000, height: 1000 })).toEqual([]);
  });
});
