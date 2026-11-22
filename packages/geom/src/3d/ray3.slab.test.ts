import { describe, expect, it } from 'vitest';
import { createBvh } from '../bvh/bvh';
import { intersectRayAabb } from './ray3';

const UNIT = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };

describe('intersectRayAabb with a non-finite ray', () => {
  it('misses a box an infinite direction points away from', () => {
    const ray = { origin: { x: 5, y: 0.5, z: 0.5 }, direction: { x: Infinity, y: 0, z: 0 } };
    expect(intersectRayAabb(ray, UNIT)).toBeNull();
    expect(intersectRayAabb({ ...ray, direction: { x: -Infinity, y: 0, z: 0 } }, UNIT)).toBeNull();
  });

  it('hits at 0 when an infinite direction starts inside the box', () => {
    const ray = { origin: { x: 0.5, y: 0.5, z: 0.5 }, direction: { x: Infinity, y: 1, z: 0 } };
    expect(intersectRayAabb(ray, UNIT)).toBe(0);
  });

  it('misses from an infinite origin', () => {
    const ray = { origin: { x: -Infinity, y: 0.5, z: 0.5 }, direction: { x: 1, y: 0, z: 0 } };
    expect(intersectRayAabb(ray, UNIT)).toBeNull();
  });

  it('the BVH raycast answers the same', () => {
    const tree = createBvh<string>(3, [['a', [0, 0, 0, 1, 1, 1]]]);
    const hits: string[] = [];
    tree.raycast([5, 0.5, 0.5], [Infinity, 0, 0], (k) => { hits.push(k); });
    tree.raycast([-Infinity, 0.5, 0.5], [1, 0, 0], (k) => { hits.push(k); });
    expect(hits).toEqual([]);
    tree.raycast([0.5, 0.5, 0.5], [Infinity, 0, 0], (k, t) => { hits.push(`${k}${t}`); });
    expect(hits).toEqual(['a0']);
  });
});
