import { describe, expect, it } from 'vitest';
import { avoid, endAims, orthogonal, ROUTERS } from '../edge';
import type { Port } from '../types';

const port = (x: number, y: number, nx: number, ny: number): Port => ({ id: 'p', nodeId: 'n', point: { x, y }, normal: { x: nx, y: ny } });
const from = port(100, 30, 1, 0);
const to = port(400, 330, -1, 0);
const route = [{ x: 250, y: 30 }, { x: 250, y: 330 }];

describe('the avoid router', () => {
  it('is registered beside the others', () => {
    expect(ROUTERS.avoid).toBe(avoid);
  });

  it('draws the stored route while it still fits its ends', () => {
    expect(avoid({ from, to, waypoints: [], route })).toEqual([from.point, ...route, to.point]);
  });

  it('falls back to orthogonal when an end has moved off the route', () => {
    const moved = port(100, 80, 1, 0);
    expect(avoid({ from: moved, to, waypoints: [], route })).toEqual(orthogonal({ from: moved, to, waypoints: [] }));
  });

  it('falls back when the route arrives along the port rather than against it', () => {
    const facingAway = port(400, 330, 1, 0);
    expect(avoid({ from, to: facingAway, waypoints: [], route })).toEqual(orthogonal({ from, to: facingAway, waypoints: [] }));
  });

  it('falls back when the route skips a waypoint, and holds when it passes them in order', () => {
    expect(avoid({ from, to, waypoints: [{ x: 250, y: 100 }], route })).toEqual([from.point, ...route, to.point]);
    const skipped = { from, to, waypoints: [{ x: 300, y: 200 }], route };
    expect(avoid(skipped)).toEqual(orthogonal(skipped));
    const backwards = { from, to, waypoints: [{ x: 250, y: 300 }, { x: 250, y: 100 }], route };
    expect(avoid(backwards)).toEqual(orthogonal(backwards));
  });

  it('falls back to orthogonal with no route at all', () => {
    expect(avoid({ from, to, waypoints: [] })).toEqual(orthogonal({ from, to, waypoints: [] }));
  });
});

describe('endAims', () => {
  it('aims each end at the stored route’s nearest bend before any waypoint', () => {
    const aims = endAims({ x: 0, y: 0 }, { x: 900, y: 900 }, [{ x: 500, y: 500 }], route);
    expect(aims).toEqual({ from: route[0], to: route[1] });
  });
});
