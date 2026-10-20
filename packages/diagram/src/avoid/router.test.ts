import { describe, expect, it } from 'vitest';
import { edgeBetween, rectShape } from './avoidFixture';
import { createAvoidRouter, type AvoidRoutes } from './router';
import type { AvoidEdge, AvoidInput, AvoidObstacle } from './types';

const shapes = {
  a: rectShape('a', 0, 0),
  b: rectShape('b', 400, 0),
  c: rectShape('c', 0, 600),
  d: rectShape('d', 400, 600),
  far: rectShape('far', 2000, 2000),
};

/** `input` with each edge holding the route `routes` gave it. */
function stored(input: AvoidInput, routes: AvoidRoutes): AvoidInput {
  return {
    obstacles: input.obstacles,
    edges: input.edges.map((e) => {
      const r = routes.get(e.id);
      if (r === undefined) return e;
      const { route: _r, ...rest } = e;
      return r === null ? rest : { ...rest, route: r };
    }),
  };
}

function scene(obstacles: AvoidObstacle[] = Object.values(shapes), edges?: AvoidEdge[]): AvoidInput {
  const byId = new Map(obstacles.map((o) => [o.id, o]));
  return {
    obstacles,
    edges: edges ?? [
      edgeBetween('top', byId.get('a')!, byId.get('b')!, 'e', 'w'),
      edgeBetween('bottom', byId.get('c')!, byId.get('d')!, 'e', 'w'),
    ],
  };
}

/** A router that has routed `input` once, and the input holding its routes. */
function routed(input = scene()) {
  const router = createAvoidRouter();
  return { router, input: stored(input, router.update(input)) };
}

const moved = (o: AvoidObstacle, dx: number, dy: number): AvoidObstacle => ({ ...o, box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } });
const replace = (input: AvoidInput, o: AvoidObstacle): AvoidInput =>
  scene(input.obstacles.map((x) => (x.id === o.id ? o : x)), input.edges.map((e) => edgeBetween(e.id,
    ...([e.from.node, e.to.node].map((id) => (id === o.id ? o : input.obstacles.find((x) => x.id === id)!)) as [AvoidObstacle, AvoidObstacle]),
    'e', 'w')).map((e, i) => ({ ...e, ...(input.edges[i]!.route ? { route: input.edges[i]!.route } : {}) })));

describe('createAvoidRouter', () => {
  it('routes every connector the first time', () => {
    const router = createAvoidRouter();
    const routes = router.update(scene());
    expect([...routes.keys()].sort()).toEqual(['bottom', 'top']);
    expect(routes.get('top')).toEqual([]);
  });

  it('reroutes nothing when nothing changed', () => {
    const { router, input } = routed();
    expect(router.update(input).size).toBe(0);
  });

  it('routes nothing a seeded scene already holds', () => {
    const { input } = routed();
    const router = createAvoidRouter();
    router.seed(input);
    expect(router.update(input).size).toBe(0);
  });

  it('reroutes only the connectors attached to a moved shape', () => {
    const { router, input } = routed();
    const routes = router.update(replace(input, moved(shapes.a, 0, -40)));
    expect([...routes.keys()]).toEqual(['top']);
  });

  it('reroutes a connector whose route a moved obstacle lands on, and no other', () => {
    const { router, input } = routed();
    const routes = router.update(replace(input, { ...shapes.far, box: { x: 200, y: -20, width: 60, height: 120 } }));
    expect([...routes.keys()]).toEqual(['top']);
    expect(routes.get('top')!.length).toBeGreaterThan(0);
  });

  it('reroutes a connector whose waypoints changed', () => {
    const { router, input } = routed();
    const edges = input.edges.map((e) => (e.id === 'bottom' ? { ...e, waypoints: [{ x: 250, y: 800 }] } : e));
    const routes = router.update({ ...input, edges });
    expect([...routes.keys()]).toEqual(['bottom']);
  });

  it('previews against the committed obstacles without committing', () => {
    const { router, input } = routed();
    const frame = replace(input, moved(shapes.a, 0, -40));
    expect([...router.update(frame, { preview: true }).keys()]).toEqual(['top']);
    expect([...router.update(frame, { preview: true }).keys()]).toEqual(['top']);
    expect(router.update(input).size).toBe(0);
  });

  it('keeps last frame’s preview for a connector the budget does not reach', () => {
    const { router, input } = routed();
    const first = router.update(replace(input, moved(shapes.a, 0, -40)), { preview: true }).get('top');
    const second = router.update(replace(input, moved(shapes.a, 0, -80)), { preview: true, budgetMs: -1 });
    expect(second.get('top')).toEqual(first);
  });

  it('spreads two connectors sharing a channel when it commits', () => {
    const left = rectShape('left', 0, 0);
    const right = rectShape('right', 600, 300);
    const left2 = rectShape('left2', 0, 120);
    const right2 = rectShape('right2', 600, 420);
    const input = scene([left, right, left2, right2], [
      edgeBetween('one', left, right, 'e', 'w'),
      edgeBetween('two', left2, right2, 'e', 'w'),
    ]);
    const routes = createAvoidRouter().update(input);
    const runX = (id: string) => routes.get(id)![0]!.x;
    expect(routes.get('one')).toHaveLength(2);
    expect(Math.abs(runX('one') - runX('two'))).toBe(8);
  });
});
