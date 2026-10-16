import { describe, expect, it } from 'vitest';
import { expandGroupEdges, insetOf } from '../cluster';
import type { Graph, GraphEdge, GraphGroup, GraphNode } from '../graph';
import { axesFor } from '../layout';
import { expand } from './expand';
import { isPlaceholder } from './types';

const AXES = axesFor('down');

function graphOf(ids: string[], pairs: [string, string][], groups: GraphGroup[] = []): Graph {
  const nodes: GraphNode[] = ids.map((id, i) => ({ id, bounds: { x: i * 100, y: 0, width: 40, height: 20 }, pinned: false }));
  for (const g of groups) {
    for (const m of g.members) {
      const n = nodes.find((x) => x.id === m);
      if (n !== undefined && n.group === undefined) n.group = g.id;
    }
  }
  const edges = expandGroupEdges(pairs.map(([from, to], i) => ({ id: `e${i}`, from, to })), groups);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = (id: string) => edges.filter((e: GraphEdge) => e.from === id);
  const inc = (id: string) => edges.filter((e: GraphEdge) => e.to === id);
  return { nodes, edges, groups, node: (id) => byId.get(id), outgoing: out, incoming: inc };
}

const ranks = (r: Record<string, number>) => new Map(Object.entries(r));

describe('expand', () => {
  it('adds one placeholder per rank an edge skips, and joins them with hops', () => {
    const g = graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']]);
    const { rows, hops, chains } = expand(g, ranks({ a: 0, b: 1, c: 2, d: 3 }), new Set(), { axes: AXES, nodeGap: 40 });
    expect(rows.map((r) => r.filter((n) => isPlaceholder(n.id)).length)).toEqual([0, 1, 1, 0]);
    const chain = chains.get('e3')!;
    expect(chain.ids).toHaveLength(2);
    expect(chain.back).toBe(false);
    expect(hops.filter((h) => h.edge === 'e3').map((h) => [h.from, h.to])).toEqual([
      ['a', chain.ids[0]], [chain.ids[0], chain.ids[1]], [chain.ids[1], 'd'],
    ]);
  });

  it('gives a labeled edge a row of its own between its ends, with room for the label beside its wire', () => {
    const g = graphOf(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
    const labeled: Graph = { ...g, edges: g.edges.map((e) => (e.id === 'e0' ? { ...e, label: { width: 30, height: 10, offset: 5 } } : e)) };
    const out = expand(labeled, ranks({ a: 0, b: 1, c: 2 }), new Set(), { axes: AXES, nodeGap: 40 });
    expect(out.rows.map((r) => r.map((n) => (isPlaceholder(n.id) ? '·' : n.id)))).toEqual([['a'], ['·'], ['b'], ['c']]);
    expect([...out.labelRows]).toEqual([1]);
    const room = out.rows[1]![0]!;
    expect(out.labels.get('e0')).toBe(room.id);
    // A quarter gap, the offset, then the label: across, its width; along, its height.
    expect([room.bounds.width, room.bounds.height]).toEqual([10 + 5 + 30, 10]);
    // Running down, left of travel is +x, so the wire runs on the low side.
    expect(out.wires.get(room.id)).toBe(10);
  });

  it('puts the label of an edge spanning ranks in the gap nearest its middle, and every edge crossing that gap through it', () => {
    const g = graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']]);
    const labeled: Graph = { ...g, edges: g.edges.map((e) => (e.id === 'e3' ? { ...e, label: { width: 30, height: 10 } } : e)) };
    const out = expand(labeled, ranks({ a: 0, b: 1, c: 2, d: 3 }), new Set(), { axes: AXES, nodeGap: 40 });
    expect(out.rows.map((r) => r.filter((n) => isPlaceholder(n.id)).length)).toEqual([0, 1, 2, 1, 0]);
    expect([...out.labelRows]).toEqual([2]);
    expect(out.chains.get('e1')!.ids).toHaveLength(1);
  });

  it('starts a placeholder where its edge\'s route crosses the rank now', () => {
    const g = graphOf(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a', 'c']]);
    const across = (waypoints?: { x: number; y: number }[]) => {
      const edges = g.edges.map((e) => (e.id === 'e2' && waypoints ? { ...e, waypoints } : e));
      const { rows } = expand({ ...g, edges }, ranks({ a: 0, b: 1, c: 2 }), new Set(), { axes: AXES, nodeGap: 40 });
      return rows[1]!.map((n) => (isPlaceholder(n.id) ? 'e2' : n.id));
    };
    // Between its ends, the placeholder ties with `b` and a node wins a tie.
    expect(across()).toEqual(['b', 'e2']);
    expect(across([{ x: -300, y: 40 }, { x: -300, y: 60 }])).toEqual(['e2', 'b']);
    // A route with some other number of waypoints says nothing about this one.
    expect(across([{ x: -300, y: 40 }])).toEqual(['b', 'e2']);
  });

  it('lists a turned-around edge\'s placeholders from its own from end', () => {
    const g = graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]);
    const { chains, hops } = expand(g, ranks({ a: 0, b: 1, c: 2, d: 3 }), new Set(['e3']), { axes: AXES, nodeGap: 40 });
    const chain = chains.get('e3')!;
    expect(chain.back).toBe(true);
    // From `d` (rank 3) back to `a` (rank 0): rank 2 first.
    expect(chain.ids.map((id) => id.slice(-1))).toEqual(['2', '1']);
    // Hops still run down the ranks.
    expect(hops.filter((h) => h.edge === 'e3')[0]!.from).toBe('a');
  });

  it('puts an edge to a group between the group\'s span and the other end', () => {
    const G: GraphGroup = { id: 'G', members: ['m1', 'm2'], inset: insetOf(12) };
    const g = graphOf(['a', 'm1', 'm2', 'z'], [['m1', 'm2'], ['G', 'z'], ['a', 'm1']], [G]);
    const { chains, hops } = expand(g, ranks({ a: 0, m1: 1, m2: 2, z: 4 }), new Set(), { axes: AXES, nodeGap: 40 });
    expect(chains.get('e1')!.ids).toHaveLength(1);
    expect(hops.filter((h) => h.edge === 'e1')[0]!.from).toBe('m2');
  });

  it('puts a placeholder in a group only when both ends are inside it', () => {
    const G: GraphGroup = { id: 'G', members: ['p', 'q', 'r'], inset: insetOf(12) };
    const g = graphOf(['p', 'q', 'r', 'o'], [['p', 'q'], ['q', 'r'], ['p', 'r'], ['p', 'o']], [G]);
    const { rows } = expand(g, ranks({ p: 0, q: 1, r: 2, o: 2 }), new Set(), { axes: AXES, nodeGap: 40 });
    const placeholders = rows.flat().filter((n) => isPlaceholder(n.id));
    expect(placeholders.find((n) => n.id.includes('e2'))!.group).toBe('G');
    expect(placeholders.find((n) => n.id.includes('e3'))!.group).toBeUndefined();
  });
});
