import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment, distance, distance2, lerp, pointSegmentDist, pointSegmentDist2, segmentT,
} from './points';
import {
  distance as distance2D, distance2 as distance2D2, lerpPoint, pointSegmentDist as pointSegmentDist2D,
  pointSegmentDist2 as pointSegmentDist2D2, segmentT as segmentT2D,
} from './points2';
import { nearestOnLine } from './nearest';
import { closestPointOnSegment as closestPointOnSegment3, distance as distance3, lerp as lerp3 } from './3d';

describe('the nearest point of a segment', () => {
  it('projects onto the segment and clamps to its ends', () => {
    const a = [0, 0, 0], b = [10, 0, 0];
    expect(segmentT([4, 3, 1], a, b)).toBe(0.4);
    expect(closestPointOnSegment([4, 3, 1], a, b)).toEqual([4, 0, 0]);
    expect(segmentT([-5, 1, 0], a, b)).toBe(0);
    expect(closestPointOnSegment([-5, 1, 0], a, b)).toEqual(a);
    expect(segmentT([15, 1, 0], a, b)).toBe(1);
    expect(closestPointOnSegment([15, 1, 0], a, b)).toEqual(b);
    expect(pointSegmentDist([4, 3, 4], a, b)).toBe(5);
    expect(pointSegmentDist2([13, 4, 0], a, b)).toBe(25);
  });

  it('answers the start, t = 0, for a zero-length segment', () => {
    const a = [2, 3];
    expect(segmentT([5, 7], a, a)).toBe(0);
    expect(closestPointOnSegment([5, 7], a, a)).toEqual(a);
    expect(pointSegmentDist([5, 7], a, a)).toBe(5);
    expect(segmentT2D(5, 7, 2, 3, 2, 3)).toBe(0);
    expect(pointSegmentDist2D(5, 7, 2, 3, 2, 3)).toBe(5);
    expect(closestPointOnSegment3({ x: 5, y: 7, z: 1 }, { x: 2, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }))
      .toEqual({ x: 2, y: 3, z: 0 });
  });

  it('lands on the far end exactly, not one rounding off it', () => {
    const a = [0.1, 0.2], b = [0.7, 0.30000000000000004];
    expect(closestPointOnSegment([5, 5], a, b)).toEqual(b);
    const hit = nearestOnLine(5, 5, 0.1, 0.2, 0.7, 0.30000000000000004);
    expect([hit.x, hit.y]).toEqual(b);
  });

  it('gives the same numbers in 2D, 3D and any dimension', () => {
    // Odd coordinates so any reordering of the arithmetic shows up in the bits.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 20 - 10;
    for (let i = 0; i < 200; i++) {
      const p = [rnd(), rnd()], a = [rnd(), rnd()], b = i % 10 === 0 ? a.slice() : [rnd(), rnd()];
      const [px, py] = p as [number, number], [ax, ay] = a as [number, number], [bx, by] = b as [number, number];

      const t = segmentT(p, a, b);
      expect(segmentT2D(px, py, ax, ay, bx, by)).toBe(t);
      expect(pointSegmentDist2D2(px, py, ax, ay, bx, by)).toBe(pointSegmentDist2(p, a, b));
      expect(pointSegmentDist2D(px, py, ax, ay, bx, by)).toBe(pointSegmentDist(p, a, b));

      const near = nearestOnLine(px, py, ax, ay, bx, by);
      const c = closestPointOnSegment(p, a, b);
      expect([near.x, near.y, near.t, near.dist]).toEqual([c[0], c[1], t, pointSegmentDist(p, a, b)]);

      // On the plane z = 0 the 3D wrapper answers the same as the planar rule.
      const c3 = closestPointOnSegment3({ x: px, y: py, z: 0 }, { x: ax, y: ay, z: 0 }, { x: bx, y: by, z: 0 });
      expect(c3).toEqual({ x: c[0], y: c[1], z: 0 });
    }
  });
});

describe('point distance and lerp', () => {
  it('agree across the tiers', () => {
    const a = [1.5, -2.25, 0], b = [-3.75, 4.125, 0];
    const pa = { x: 1.5, y: -2.25 }, pb = { x: -3.75, y: 4.125 };
    expect(distance2D2(pa, pb)).toBe(distance2(a, b));
    expect(distance2D(pa, pb)).toBe(distance(a, b));
    expect(distance3({ x: 1.5, y: -2.25, z: 0 }, { x: -3.75, y: 4.125, z: 0 })).toBe(distance(a, b));
    for (const t of [0, 0.3, 1, 1.7]) {
      const l = lerp(a, b, t);
      expect(lerpPoint(pa, pb, t)).toEqual({ x: l[0], y: l[1] });
      expect(lerp3({ x: 1.5, y: -2.25, z: 0 }, { x: -3.75, y: 4.125, z: 0 }, t)).toEqual({ x: l[0], y: l[1], z: l[2] });
    }
  });

  it('measures a 3-4-5 triangle', () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
    expect(distance2([0, 0, 0], [1, 2, 2])).toBe(9);
  });
});
