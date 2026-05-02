import { describe, expect, it } from 'vitest';
import { composePath, decomposePath } from './compose';
import { polygonFromPoints, rectPath } from './builder';

describe('composePath', () => {
  it('translates a child rect by the parent rect origin', () => {
    const parent = rectPath(100, 200, 50, 50);
    const child = rectPath(10, 20, 5, 5);
    expect(composePath(parent, child)).toEqual({
      kind: 'rect', x: 110, y: 220, width: 5, height: 5,
    });
  });

  it('uses the polygon AABB top-left as the parent origin', () => {
    const parent = polygonFromPoints([{ x: 30, y: 40 }, { x: 80, y: 40 }, { x: 55, y: 90 }]);
    const child = rectPath(0, 0, 10, 10);
    expect(composePath(parent, child)).toEqual({
      kind: 'rect', x: 30, y: 40, width: 10, height: 10,
    });
  });

  it('round-trips with decomposePath', () => {
    const parent = rectPath(100, 200, 50, 50);
    const child = rectPath(10, 20, 5, 5);
    const world = composePath(parent, child);
    const back = decomposePath(parent, world);
    expect(back).toEqual(child);
  });

  it('round-trips a polygon child through a polygon parent', () => {
    const parent = polygonFromPoints([{ x: 5, y: 7 }, { x: 15, y: 7 }, { x: 10, y: 17 }]);
    const child = polygonFromPoints([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 4 }]);
    const world = composePath(parent, child);
    if (world.kind !== 'polygon') throw new Error('expected polygon');
    expect(Array.from(world.coords)).toEqual([5, 7, 9, 7, 7, 11]);
    const back = decomposePath(parent, world);
    if (back.kind !== 'polygon') throw new Error('expected polygon');
    expect(Array.from(back.coords)).toEqual([0, 0, 4, 0, 2, 4]);
  });
});
