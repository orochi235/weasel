import { describe, expect, it } from 'vitest';
import {
  bendsOf, edgeBetween, entersBox, isOrthogonal, randomEdges, randomShapes, rectShape, routeContext, seeded,
} from './avoidFixture';
import { routeEdge } from './edgeRoute';
import { blocks, inflate, type AvoidObstacle } from './types';

const a = rectShape('a', 0, 0);
const b = rectShape('b', 400, 0);

describe('routeEdge', () => {
  it('runs straight when nothing is in the way', () => {
    const route = routeEdge(edgeBetween('e', a, b, 'e', 'w'), routeContext([a, b]));
    expect(route).toEqual([{ x: 100, y: 30 }, { x: 400, y: 30 }]);
  });

  it('picks the facing sides itself when the ends are glued to the shapes', () => {
    const route = routeEdge(edgeBetween('e', a, b), routeContext([a, b]));
    expect(route).toEqual([{ x: 100, y: 30 }, { x: 400, y: 30 }]);
  });

  it('goes around a box in the way, keeping its clearance', () => {
    const wall = rectShape('wall', 200, -100, 60, 260);
    const route = routeEdge(edgeBetween('e', a, b, 'e', 'w'), routeContext([a, b, wall]))!;
    expect(isOrthogonal(route)).toBe(true);
    const grown = inflate(wall.box, 10);
    route.slice(1).forEach((p, i) => expect(entersBox(route[i]!, p, grown)).toBe(false));
    expect(route[0]).toEqual({ x: 100, y: 30 });
    expect(route[route.length - 1]).toEqual({ x: 400, y: 30 });
  });

  it('takes the route with fewer bends when the lengths are near equal', () => {
    const c = rectShape('c', 400, 300);
    const route = routeEdge(edgeBetween('e', a, c, 'e', 'n'), routeContext([a, c]))!;
    expect(bendsOf(route)).toBe(1);
    expect(route[1]).toEqual({ x: 450, y: 30 });
  });

  it('arrives against the port’s facing', () => {
    const c = rectShape('c', 400, 300);
    const route = routeEdge(edgeBetween('e', a, c, 'e', 'w'), routeContext([a, c]))!;
    const [p, q] = route.slice(-2);
    expect(q!.x - p!.x).toBeGreaterThan(0);
    expect(q!.y).toBe(p!.y);
  });

  it('leaves along the port’s facing even when the target is behind it', () => {
    const route = routeEdge(edgeBetween('e', a, b, 'w', 'w'), routeContext([a, b]))!;
    expect(route[1]!.x).toBeLessThan(0);
    expect(route[1]!.y).toBe(30);
    expect(isOrthogonal(route)).toBe(true);
  });

  it('passes the waypoints in order, each as a vertex', () => {
    const waypoints = [{ x: 200, y: 200 }, { x: 300, y: -150 }];
    const route = routeEdge(edgeBetween('e', a, b, 'e', 'w', waypoints), routeContext([a, b]))!;
    const at = waypoints.map((w) => route.findIndex((p) => p.x === w.x && p.y === w.y));
    expect(at[0]).toBeGreaterThan(0);
    expect(at[1]).toBeGreaterThan(at[0]!);
    expect(isOrthogonal(route)).toBe(true);
  });

  it('crosses a container holding one of its ends, and goes around one holding neither', () => {
    const inner = rectShape('inner', 300, 300, 80, 40);
    const outside = rectShape('outside', -400, 300, 80, 40);
    const pool: AvoidObstacle = { id: 'pool', kind: 'region', box: { x: 200, y: 200, width: 300, height: 300 }, members: new Set(['inner']) };
    const into = routeEdge(edgeBetween('e', outside, inner, 'e', 'w'), routeContext([inner, outside, pool]))!;
    expect(into).toEqual([{ x: -320, y: 320 }, { x: 300, y: 320 }]);
    const far = rectShape('far', 800, 300, 80, 40);
    const past = routeEdge(edgeBetween('e', outside, far, 'e', 'w'), routeContext([inner, outside, far, pool]))!;
    past.slice(1).forEach((p, i) => expect(entersBox(past[i]!, p, pool.box)).toBe(false));
  });

  it('answers null when no window holds a path', () => {
    const boxed = rectShape('boxed', 1000, 1000, 40, 40);
    const walls = [
      rectShape('top', 900, 900, 240, 20), rectShape('bottom', 900, 1120, 240, 20),
      rectShape('left', 900, 900, 20, 240), rectShape('right', 1120, 900, 20, 240),
    ];
    expect(routeEdge(edgeBetween('e', a, boxed), routeContext([a, boxed, ...walls]))).toBeNull();
  });

  it('never runs a segment through an obstacle it should avoid, over random layouts', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rand = seeded(seed);
      const shapes = randomShapes(rand, 16);
      const ctx = routeContext(shapes);
      for (const edge of randomEdges(rand, shapes, 10)) {
        const route = routeEdge(edge, ctx);
        expect(route, `seed ${seed} ${edge.id}`).not.toBeNull();
        expect(isOrthogonal(route!)).toBe(true);
        for (const shape of shapes) {
          if (!blocks(shape, edge.from.node, edge.to.node)) continue;
          const grown = inflate(shape.box, 10);
          route!.slice(1).forEach((p, i) => {
            expect(entersBox(route![i]!, p, shape.box), `seed ${seed} ${edge.id} through ${shape.id}`).toBe(false);
            const stub = i === 0 || i === route!.length - 2;
            if (!stub) expect(entersBox(route![i]!, p, grown), `seed ${seed} ${edge.id} near ${shape.id}`).toBe(false);
          });
        }
      }
    }
  });
});
