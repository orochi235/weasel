import { describe, it, expect } from 'vitest';
import { expandClusterEdges, insetOf } from './cluster';
import { layered } from './layered';
import { tree } from './tree';
import { boxOf, graphOf, overlaps, placed } from './clusterFixture';

// Two pipelines whose stages share ranks: a0 → a1 → a2 and b0 → b1 → b2, each
// feeding the other's next stage, so unclustered they interleave in every rank.
const IDS = ['a0', 'b0', 'a1', 'b1', 'a2', 'b2', 'x'];
const EDGES = [
  ['a0', 'a1'], ['a1', 'a2'], ['b0', 'b1'], ['b1', 'b2'],
  ['a0', 'b1'], ['b0', 'a1'], ['a1', 'b2'], ['x', 'a2'],
] as const;
const CLUSTERS = { A: ['a0', 'a1', 'a2'], B: ['b0', 'b1', 'b2'] };

describe.each([
  ['layered', layered],
  ['tree', tree],
] as const)('%s with clusters', (_, fn) => {
  for (const direction of ['down', 'right', 'up', 'left'] as const) {
    it(`keeps each cluster's box clear of the other cluster and of outsiders (${direction})`, () => {
      const graph = graphOf(IDS, EDGES, CLUSTERS);
      const at = placed(graph, fn, { direction });
      const a = boxOf(at, CLUSTERS.A, 12);
      const b = boxOf(at, CLUSTERS.B, 12);
      expect(overlaps(a, b), `A ${JSON.stringify(a)} B ${JSON.stringify(b)}`).toBe(false);
      expect(overlaps(a, at.get('x')!)).toBe(false);
      expect(overlaps(b, at.get('x')!)).toBe(false);
    });
  }

  it('moves nothing on a second run', () => {
    const graph = graphOf(IDS, EDGES, CLUSTERS);
    const at = placed(graph, fn);
    const again = graphOf(IDS, EDGES, CLUSTERS);
    for (const n of again.nodes) n.bounds = at.get(n.id)!;
    expect(fn(again).size).toBe(0);
  });

  it('moves nothing on a second run after pushing an outsider out of a column', () => {
    // `mid` starts between the cluster's two members and has to leave, which
    // changes the order the second run reads.
    const make = () => graphOf(
      ['in', 'a0', 'mid', 'a1', 'z'],
      [['in', 'a0'], ['in', 'mid'], ['in', 'a1'], ['a0', 'z'], ['mid', 'z'], ['a1', 'z']],
      { A: ['a0', 'a1'] },
    );
    const at = placed(make(), fn);
    expect(overlaps(boxOf(at, ['a0', 'a1'], 12), at.get('mid')!)).toBe(false);
    const again = make();
    for (const n of again.nodes) n.bounds = at.get(n.id)!;
    expect(fn(again).size).toBe(0);
  });

  it('widens a rank gap too narrow for two stacked boxes', () => {
    const graph = graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']], { P: ['a', 'b'], Q: ['c', 'd'] });
    const moved = fn(graph, { rankGap: 10 });
    const at = new Map(graph.nodes.map((n) => [n.id, { ...n.bounds, ...(moved.get(n.id) ?? {}) }]));
    expect(overlaps(boxOf(at, ['a', 'b'], 12), boxOf(at, ['c', 'd'], 12))).toBe(false);
  });

  it('leaves an outsider out of a box even in a rank holding none of its members', () => {
    // A's members sit in ranks 0 and 2; y lands in rank 1, between them.
    const graph = graphOf(['a0', 'a2', 'm', 'y'], [['a0', 'm'], ['m', 'a2'], ['a0', 'y']], { A: ['a0', 'a2'] });
    const at = placed(graph, fn);
    expect(overlaps(boxOf(at, ['a0', 'a2'], 12), at.get('y')!)).toBe(false);
  });
});

describe('clusters in the graph', () => {
  it('lists a cluster with its members, and marks each member', () => {
    const graph = graphOf(['a', 'b', 'c'], [], { G: ['a', 'b'] });
    expect(graph.clusters).toEqual([{ id: 'G', members: ['a', 'b'], inset: insetOf(12) }]);
    expect(graph.node('a')?.cluster).toBe('G');
    expect(graph.node('c')?.cluster).toBeUndefined();
  });

  it('is not a participant itself', () => {
    expect(graphOf(['a'], [], { G: ['a'] }).node('G')).toBeUndefined();
  });

  it('keeps a node two clusters name in the first one', () => {
    const graph = graphOf(['a', 'b'], [], { G: ['a'], H: ['a', 'b'] });
    expect(graph.clusters?.map((g) => g.members)).toEqual([['a'], ['b']]);
  });
});

describe('expandClusterEdges', () => {
  const clusters = [{ id: 'G', members: ['g0', 'g1', 'g2'], inset: insetOf(0) }];
  const inner = [{ id: 'i0', from: 'g0', to: 'g1' }, { id: 'i1', from: 'g1', to: 'g2' }];

  it('ranks an edge into a cluster against the members nothing inside points at', () => {
    const out = expandClusterEdges([...inner, { id: 'e', from: 'x', to: 'G' }], clusters);
    expect(out.filter((e) => e.id.startsWith('e#')).map((e) => e.to)).toEqual(['g0']);
  });

  it('ranks an edge out of a cluster from the members that point nowhere inside', () => {
    const out = expandClusterEdges([...inner, { id: 'e', from: 'G', to: 'y' }], clusters);
    expect(out.filter((e) => e.id.startsWith('e#')).map((e) => e.from)).toEqual(['g2']);
  });

  it('drops an edge between a cluster and its own member', () => {
    expect(expandClusterEdges([{ id: 'e', from: 'G', to: 'g1' }], clusters)).toEqual([]);
  });
});
