import { describe, expect, it } from 'vitest';
import type { Graph, GraphEdge, GraphNode } from './graph';
import { layered } from './layered';

function graph(ids: string[], pairs: [string, string][]): Graph {
  const nodes: GraphNode[] = ids.map((id, i) => ({
    id, bounds: { x: i, y: 0, width: 40, height: 20 }, pinned: false,
  }));
  const edges: GraphEdge[] = pairs.map(([from, to], i) => ({ id: `e${i}`, from, to }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes, edges,
    node: (id) => byId.get(id),
    outgoing: (id) => edges.filter((e) => e.from === id),
    incoming: (id) => edges.filter((e) => e.to === id),
  };
}

/** Edge pairs that cross between adjacent ranks, read off the laid-out x. */
function crossings(g: Graph, at: ReadonlyMap<string, { x: number; y: number }>): number {
  const pos = (id: string) => at.get(id) ?? g.node(id)!.bounds;
  let n = 0;
  for (const a of g.edges) for (const b of g.edges) {
    if (a.id >= b.id) continue;
    const [a0, a1, b0, b1] = [pos(a.from), pos(a.to), pos(b.from), pos(b.to)];
    if (a0.y !== b0.y || a1.y !== b1.y) continue;
    if ((a0.x - b0.x) * (a1.x - b1.x) < 0) n++;
  }
  return n;
}

// Sources a, b; sinks listed so the seeded order crosses both edges.
const IDS = ['a', 'b', 'y', 'x'];
const PAIRS: [string, string][] = [['a', 'x'], ['b', 'y']];

describe('layered order', () => {
  it('keeps the seeded order by default, crossings and all', () => {
    const g = graph(IDS, PAIRS);
    expect(crossings(g, layered(g))).toBe(1);
  });

  it('untangles a crossing with order: barycenter', () => {
    const g = graph(IDS, PAIRS);
    expect(crossings(g, layered(g, { order: 'barycenter' }))).toBe(0);
  });

  it('gives the same answer every run', () => {
    const g = graph(IDS, PAIRS);
    const first = [...layered(g, { order: 'barycenter' })];
    expect([...layered(g, { order: 'barycenter' })]).toEqual(first);
  });

  it('lays out a graph with no edges without throwing', () => {
    const g = graph(['only'], []);
    expect(() => layered(g, { order: 'barycenter' })).not.toThrow();
  });
});
