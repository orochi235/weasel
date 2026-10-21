import type { Vec2 } from '@weasel-js/core/math';
import { describe, expect, it } from 'vitest';
import { entersBox, rectShape } from './avoidFixture';
import { nudge, type NudgeRoute } from './nudge';
import { ObstacleIndex } from './obstacles';
import type { AvoidObstacle } from './types';

const route = (...points: [number, number][]): NudgeRoute => ({ points: points.map(([x, y]) => ({ x, y })), waypoints: [] });

/** How many times two of `routes` cross at right angles. */
function crossings(routes: readonly (readonly Vec2[])[]): number {
  let n = 0;
  const segs = routes.map((r) => r.slice(1).map((p, i) => [r[i]!, p] as const));
  for (let a = 0; a < segs.length; a++) {
    for (let b = a + 1; b < segs.length; b++) {
      for (const [p, q] of segs[a]!) {
        for (const [r, s] of segs[b]!) {
          const h = p.y === q.y ? [p, q] : r.y === s.y ? [r, s] : null;
          const v = p.x === q.x ? [p, q] : r.x === s.x ? [r, s] : null;
          if (h === null || v === null || h[0] === v[0]) continue;
          const [hx0, hx1] = [Math.min(h[0]!.x, h[1]!.x), Math.max(h[0]!.x, h[1]!.x)];
          const [vy0, vy1] = [Math.min(v[0]!.y, v[1]!.y), Math.max(v[0]!.y, v[1]!.y)];
          if (v[0]!.x > hx0 && v[0]!.x < hx1 && h[0]!.y > vy0 && h[0]!.y < vy1) n++;
        }
      }
    }
  }
  return n;
}

const open = new ObstacleIndex([], 10);

describe('nudge', () => {
  it('spreads two runs sharing a channel apart, in an order that does not cross', () => {
    const routes = new Map([
      ['r1', route([50, 0], [50, 100], [300, 100], [300, 200])],
      ['r2', route([100, 0], [100, 100], [350, 100], [350, 200])],
    ]);
    const out = nudge(routes, 8, open);
    expect(out.get('r1')![1]!.y).toBe(104);
    expect(out.get('r2')![1]!.y).toBe(96);
    expect(crossings([...out.values()])).toBe(0);
  });

  it('orders three runs so none crosses another', () => {
    const routes = new Map([
      ['r1', route([50, 0], [50, 100], [300, 100], [300, 200])],
      ['r2', route([100, 0], [100, 100], [350, 100], [350, 200])],
      ['r3', route([150, 300], [150, 100], [250, 100], [250, 300])],
    ]);
    const out = nudge(routes, 8, open);
    const ys = [...out.values()].map((r) => r[1]!.y).sort((a, b) => a - b);
    expect(ys).toEqual([92, 100, 108]);
    expect(crossings([...out.values()])).toBe(0);
  });

  it('never spreads a run into an obstacle', () => {
    const roof = rectShape('roof', 150, 50, 100, 48);
    const routes = new Map([
      ['r1', route([50, 0], [50, 100], [300, 100], [300, 200])],
      ['r2', route([100, 0], [100, 100], [350, 100], [350, 200])],
    ]);
    const out = nudge(routes, 8, new ObstacleIndex([roof], 10));
    for (const points of out.values()) {
      points.slice(1).forEach((p, i) => expect(entersBox(points[i]!, p, roof.box)).toBe(false));
    }
    expect(out.get('r1')![1]!.y - out.get('r2')![1]!.y).toBe(8);
  });

  it('spreads a bundle past its own connectors’ labels, but not into another’s', () => {
    const labelOf = (edge: string): AvoidObstacle =>
      ({ id: `${edge}/label`, kind: 'label', edge, box: { x: 150, y: 103, width: 40, height: 14 } });
    const routes = () => new Map([
      ['r1', route([50, 0], [50, 100], [300, 100], [300, 200])],
      ['r2', route([100, 0], [100, 100], [350, 100], [350, 200])],
    ]);
    const own = nudge(routes(), 8, new ObstacleIndex([labelOf('r1')], 10, 4));
    expect(own.get('r1')![1]!.y).toBe(104);
    const other = nudge(routes(), 8, new ObstacleIndex([labelOf('r9')], 10, 4));
    expect(other.get('r1')![1]!.y).toBeLessThanOrEqual(102);
  });

  it('leaves a run meeting a port, or a waypoint, where it is', () => {
    const atPort = route([0, 100], [300, 100], [300, 200]);
    const pinned: NudgeRoute = { ...route([60, 0], [60, 100], [280, 100], [280, 200]), waypoints: [{ x: 60, y: 100 }] };
    const routes = new Map([['port', atPort], ['pinned', pinned], ['free', route([50, 0], [50, 100], [320, 100], [320, 200])]]);
    const out = nudge(routes, 8, open);
    expect(out.get('port')).toEqual(atPort.points);
    expect(out.get('pinned')).toEqual(pinned.points);
    expect(out.get('free')).toEqual(routes.get('free')!.points);
  });
});
