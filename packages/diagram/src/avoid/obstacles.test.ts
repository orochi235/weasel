import { describe, expect, it } from 'vitest';
import { ObstacleIndex } from './obstacles';
import type { AvoidObstacle } from './types';

const shape = (id: string, x: number, y: number, width = 100, height = 60): AvoidObstacle =>
  ({ id, kind: 'shape', box: { x, y, width, height } });

describe('ObstacleIndex', () => {
  const index = new ObstacleIndex([shape('a', 0, 0), shape('far', 1000, 1000)], 10);
  const view = index.forEdge('x', 'y');

  it('inflates each obstacle by the clearance', () => {
    expect(index.all[0]!.box).toEqual({ x: -10, y: -10, width: 120, height: 80 });
  });

  it('finds a point inside an inflated obstacle, but not one on its edge', () => {
    expect(view.inside(-5, 30)).toBe(true);
    expect(view.inside(-10, 30)).toBe(false);
    expect(view.inside(500, 500)).toBe(false);
  });

  it('blocks a step through an interior and frees one along an edge', () => {
    expect(view.crosses(-50, 30, 200, 30)).toBe(true);
    expect(view.crosses(-50, -10, 200, -10)).toBe(false);
    expect(view.crosses(-50, -20, 200, -20)).toBe(false);
  });

  it('finds obstacles in cells far from the origin', () => {
    expect(view.crosses(1050, 900, 1050, 1200)).toBe(true);
  });

  it('lets a connector through a region holding one of its ends, and no other', () => {
    const region: AvoidObstacle = { id: 'pool', kind: 'region', box: { x: 0, y: 0, width: 400, height: 400 }, members: new Set(['in']) };
    const regions = new ObstacleIndex([region], 10);
    expect(regions.forEdge('in', 'out').crosses(-50, 200, 200, 200)).toBe(false);
    expect(regions.forEdge('a', 'b').crosses(-50, 200, 200, 200)).toBe(true);
    expect(regions.forEdge('pool', 'b').crosses(-50, 200, 200, 200)).toBe(true);
  });
});
