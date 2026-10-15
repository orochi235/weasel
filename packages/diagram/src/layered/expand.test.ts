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
    const { rows, hops, chains } = expand(g, ranks({ a: 0, b: 1, c: 2, d: 3 }), new Set(), { axes: AXES, nodeGap: 40, placeholders: true });
    expect(rows.map((r) => r.filter((n) => isPlaceholder(n.id)).length)).toEqual([0, 1, 1, 0]);
    const chain = chains.get('e3')!;
    expect(chain.ids).toHaveLength(2);
    expect(chain.back).toBe(false);
    expect(hops.filter((h) => h.edge === 'e3').map((h) => [h.from, h.to])).toEqual([
      ['a', chain.ids[0]], [chain.ids[0], chain.ids[1]], [chain.ids[1], 'd'],
    ]);
  });

  it('adds no placeholders, and no hops for a spanning edge, when told not to', () => {
    const g = graphOf(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a', 'c']]);
    const { rows, hops, chains } = expand(g, ranks({ a: 0, b: 1, c: 2 }), new Set(), { axes: AXES, nodeGap: 40, placeholders: false });
    expect(rows.flat().some((n) => isPlaceholder(n.id))).toBe(false);
    expect(hops.map((h) => h.edge)).toEqual(['e0', 'e1']);
    expect(chains.size).toBe(0);
  });

  it('lists a turned-around edge\'s placeholders from its own from end', () => {
    const g = graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]);
    const { chains, hops } = expand(g, ranks({ a: 0, b: 1, c: 2, d: 3 }), new Set(['e3']), { axes: AXES, nodeGap: 40, placeholders: true });
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
    const { chains, hops } = expand(g, ranks({ a: 0, m1: 1, m2: 2, z: 4 }), new Set(), { axes: AXES, nodeGap: 40, placeholders: true });
    expect(chains.get('e1')!.ids).toHaveLength(1);
    expect(hops.filter((h) => h.edge === 'e1')[0]!.from).toBe('m2');
  });

  it('puts a placeholder in a group only when both ends are inside it', () => {
    const G: GraphGroup = { id: 'G', members: ['p', 'q', 'r'], inset: insetOf(12) };
    const g = graphOf(['p', 'q', 'r', 'o'], [['p', 'q'], ['q', 'r'], ['p', 'r'], ['p', 'o']], [G]);
    const { rows } = expand(g, ranks({ p: 0, q: 1, r: 2, o: 2 }), new Set(), { axes: AXES, nodeGap: 40, placeholders: true });
    const placeholders = rows.flat().filter((n) => isPlaceholder(n.id));
    expect(placeholders.find((n) => n.id.includes('e2'))!.group).toBe('G');
    expect(placeholders.find((n) => n.id.includes('e3'))!.group).toBeUndefined();
  });
});
