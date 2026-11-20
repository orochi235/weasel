import { describe, expect, it } from 'vitest';
import { bezier, bezierFor, straight, type PointComponents, type RouteRequest } from './routers';
import type { Port } from './types';

type V3 = readonly [number, number, number];
const V3_COMPONENTS: PointComponents<V3> = { of: (p) => p, point: ([x, y, z]) => [x!, y!, z!] };
const bezier3 = bezierFor(V3_COMPONENTS);

const end = <P>(point: P, normal: P | null): Port<P> => ({ id: 'p', nodeId: 'n', point, normal });

describe('routers over points of any dimension', () => {
  it('straight runs through the stops as it is handed them', () => {
    const req: RouteRequest<V3> = { from: end([0, 0, 0], null), to: end([1, 2, 3], null), waypoints: [[4, 5, 6]] };
    expect(straight(req)).toEqual([[0, 0, 0], [4, 5, 6], [1, 2, 3]]);
  });

  it('bezier in 3D draws the plane\'s curve where every point is on z = 0', () => {
    const flat = bezier({
      from: end({ x: 0, y: 0 }, { x: 1, y: 0 }), to: end({ x: 100, y: 100 }, { x: -1, y: 0 }), waypoints: [{ x: 40, y: 70 }],
    });
    const solid = bezier3({ from: end([0, 0, 0], [1, 0, 0]), to: end([100, 100, 0], [-1, 0, 0]), waypoints: [[40, 70, 0]] });
    expect(solid).toHaveLength(flat.length);
    solid.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(flat[i]!.x, 9);
      expect(p[1]).toBeCloseTo(flat[i]!.y, 9);
      expect(p[2]).toBe(0);
    });
  });

  it('bezier in 3D leaves along the departing normal and arrives against the receiving one', () => {
    const run = bezier3({ from: end([0, 0, 0], [0, 0, 1]), to: end([50, 0, 200], [0, 0, -1]), waypoints: [] });
    expect(run[0]).toEqual([0, 0, 0]);
    expect(run[run.length - 1]![2]).toBeCloseTo(200, 9);
    const [x1, , z1] = run[1]!;
    expect(z1).toBeGreaterThan(Math.abs(x1) * 2);
  });

  it('keeps a run held between two waypoints that differ along one axis only', () => {
    const run = bezier3({
      from: end([0, 0, 0], [0, 1, 0]), to: end([0, 300, 200], [0, -1, 0]), waypoints: [[0, 100, 50], [0, 200, 50]],
    });
    // Each sample between the two waypoints stays at z = 50.
    const between = run.filter((p) => p[1] > 100 && p[1] < 200);
    expect(between.length).toBeGreaterThan(0);
    for (const p of between) expect(p[2]).toBeCloseTo(50, 9);
  });
});
