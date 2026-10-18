import { describe, expect, it } from 'vitest';
import { chain } from './chain';
import { buildGraph, type GraphNodeLike } from './graph';
import { graphOf, type Rect } from './groupFixture';
import type { LayoutResult } from './layout';

// `graphOf` seeds node i at (i, i), 100 by 40.
const IDS = ['src', 'blur', 'mix', 'out', 'osc', 'mask'] as const;
const EDGES = [['src', 'blur'], ['blur', 'mix'], ['mix', 'out'], ['osc', 'blur'], ['mask', 'mix']] as const;
const graph = graphOf(IDS, EDGES, {});
const at = (result: LayoutResult, id: string) => result.get(id) ?? { x: IDS.indexOf(id as never), y: IDS.indexOf(id as never) };
const OPTS = { direction: 'right', chain: ['src', 'blur', 'mix', 'out'] } as const;

describe('chain', () => {
  it('stands the chain on one line, in order', () => {
    const r = chain(graph, OPTS);
    const line = OPTS.chain.map((id) => at(r, id));
    expect(new Set(line.map((p) => p.y)).size).toBe(1);
    expect(line.map((p) => p.x)).toEqual([...line.map((p) => p.x)].sort((a, b) => a - b));
    expect(new Set(line.map((p) => p.x)).size).toBe(4);
  });

  it('hangs each other node past the line, in its chain node\'s column', () => {
    const r = chain(graph, OPTS);
    expect(at(r, 'osc').y).toBeGreaterThan(at(r, 'blur').y + 40);
    expect(at(r, 'osc').x).toBe(at(r, 'blur').x);
    expect(at(r, 'mask').x).toBe(at(r, 'mix').x);
  });

  it('hangs on the other side when asked', () => {
    const r = chain(graph, { ...OPTS, chainSide: 'before' });
    expect(at(r, 'osc').y + 40).toBeLessThan(at(r, 'blur').y);
  });

  it('starts where the graph did, and moves nothing on a second run', () => {
    const r = chain(graph, OPTS);
    const xs = IDS.map((id) => at(r, id).x);
    const ys = IDS.map((id) => at(r, id).y);
    expect([Math.min(...xs), Math.min(...ys)]).toEqual([0, 0]);
    const settled = graphOf(IDS, EDGES, {});
    settled.nodes.forEach((n) => Object.assign(n.bounds, at(r, n.id)));
    expect(chain(settled, OPTS).size).toBe(0);
  });

  it('takes the longest path as the chain when none is named', () => {
    const r = chain(graph, { direction: 'right' });
    expect(new Set(['src', 'blur', 'mix', 'out'].map((id) => at(r, id).y)).size).toBe(1);
  });

  it('takes the longest path when no id it is given is a node', () => {
    const r = chain(graph, { direction: 'right', chain: ['ghost', 'phantom'] });
    expect(new Set(['src', 'blur', 'mix', 'out'].map((id) => at(r, id).y)).size).toBe(1);
    expect(at(r, 'osc').y).toBeGreaterThan(at(r, 'blur').y + 40);
  });

  it('answers an empty graph with nothing', () => {
    expect(chain(graphOf([], [], {}), OPTS).size).toBe(0);
  });
});

describe('chain side routes', () => {
  // `hub` on the line has three ports along its bottom; `x` feeds the right
  // one, `y` the left one, and `hub` sends to `z` from the middle one.
  const bottom = (id: string, u: number) => ({ id, at: { u, v: 1 } });
  const top = (id: string) => ({ id, at: { u: 0.5, v: 0 } });
  const node = (id: string, ports: object[], i: number) => ({
    node: { id, kind: 'leaf', data: { diagram: { ports } } } as GraphNodeLike,
    pose: { x: i, y: i, width: 100, height: 40 },
  });
  const edge = (i: number, from: [string, string], to: [string, string]) => ({
    node: { id: `e${i}`, kind: 'leaf', data: { diagram: { from: { port: from[1] }, to: { port: to[1] } } }, dependsOn: [from[0], to[0]] } as GraphNodeLike,
    pose: { x: 0, y: 0, width: 0, height: 0 },
  });
  const graph = buildGraph<Rect>(() => [
    node('hub', [bottom('p1', 0.25), bottom('send', 0.5), bottom('p2', 0.75)], 0),
    node('x', [top('out')], 1), node('y', [top('out')], 2), node('z', [top('in')], 3),
    edge(0, ['x', 'out'], ['hub', 'p2']), edge(1, ['y', 'out'], ['hub', 'p1']), edge(2, ['hub', 'send'], ['z', 'in']),
  ]);
  const plan = chain.plan!(graph, { direction: 'right', chain: ['hub'] });
  const x = (id: string) => plan.moves.get(id)?.x ?? graph.node(id)!.bounds.x;

  it('hangs each node under the port it meets, in that port\'s order', () => {
    expect(['y', 'z', 'x'].map(x)).toEqual(['y', 'z', 'x'].map(x).sort((a, b) => a - b));
  });

  it('routes a side edge through a track between the line and the hung row, from its own end', () => {
    const lineBottom = 40;
    const hungTop = (plan.moves.get('x') ?? graph.node('x')!.bounds).y;
    for (const id of ['e0', 'e1', 'e2']) {
      const via = plan.waypoints!.get(id);
      if (via === undefined) continue;
      expect(via).toHaveLength(2);
      expect(via[0]!.y).toBe(via[1]!.y);
      expect(via[0]!.y).toBeGreaterThan(lineBottom);
      expect(via[0]!.y).toBeLessThan(hungTop);
    }
    const [first] = plan.waypoints!.get('e1')!;
    expect(Math.abs(first!.x - x('y'))).toBeLessThan(Math.abs(first!.x - (x('hub') + 25)));
  });
});
