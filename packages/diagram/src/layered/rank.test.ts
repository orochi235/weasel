import { describe, expect, it } from 'vitest';
import type { Graph, GraphEdge, GraphNode } from '../graph';
import { backEdges, ranksOf } from '../layered';
import { ranksByLength } from './rank';

function graphOf(ids: readonly string[], pairs: readonly (readonly [string, string])[]): Graph {
  const nodes: GraphNode[] = ids.map((id) => ({ id, bounds: { x: 0, y: 0, width: 10, height: 10 }, pinned: false }));
  const edges: GraphEdge[] = pairs.map(([from, to], i) => ({ id: `e${i}`, from, to }));
  return {
    nodes,
    edges,
    node: (id) => nodes.find((n) => n.id === id),
    outgoing: (id) => edges.filter((e) => e.from === id),
    incoming: (id) => edges.filter((e) => e.to === id),
  };
}

/** Each edge's length, turned around when it is a back edge; self-loops skipped. */
function lengths(graph: Graph, back: ReadonlySet<string>, ranks: ReadonlyMap<string, number>): number[] {
  return graph.edges
    .filter((e) => e.from !== e.to)
    .map((e) => {
      const [from, to] = back.has(e.id) ? [e.to, e.from] : [e.from, e.to];
      return ranks.get(to)! - ranks.get(from)!;
    });
}

const total = (ls: readonly number[]) => ls.reduce((a, b) => a + b, 0);

const PIPELINE = graphOf(
  ['Source', 'Osc', 'Sun', 'Mask', 'Decide', 'Blur', 'Comp', 'Out'],
  [
    ['Source', 'Decide'],
    ['Decide', 'Blur'],
    ['Decide', 'Comp'],
    ['Osc', 'Blur'],
    ['Blur', 'Comp'],
    ['Sun', 'Comp'],
    ['Mask', 'Comp'],
    ['Comp', 'Out'],
  ],
);

/** A deterministic DAG: every edge runs from a lower index to a higher one. */
function generated(nodeCount: number, edgeCount: number, seed: number): Graph {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const ids = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  const pairs: [string, string][] = [];
  while (pairs.length < edgeCount) {
    const a = Math.floor(next() * nodeCount);
    const b = Math.floor(next() * nodeCount);
    if (a === b) continue;
    pairs.push([ids[Math.min(a, b)]!, ids[Math.max(a, b)]!]);
  }
  return graphOf(ids, pairs);
}

describe('ranksByLength', () => {
  it('reaches the minimum total length on the EffectChart pipeline', () => {
    const none = new Set<string>();
    const ranks = ranksByLength(PIPELINE, none);
    expect(total(lengths(PIPELINE, none, ranks))).toBe(9);
    expect(total(lengths(PIPELINE, none, ranksOf(PIPELINE, none)))).toBe(14);
    expect(ranks.get('Source')).toBe(0);
    expect(ranks.get('Osc')).toBe(1);
    expect(ranks.get('Sun')).toBe(2);
    expect(ranks.get('Mask')).toBe(2);
    expect(ranks.get('Out')).toBe(4);
  });

  it('keeps every edge at least one rank long, back edges turned around', () => {
    const graphs = [
      PIPELINE,
      graphOf(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'a'], ['c', 'd'], ['d', 'b']]),
      graphOf(['a', 'b'], [['a', 'b'], ['b', 'a'], ['a', 'a'], ['a', 'b']]),
      generated(40, 80, 7),
    ];
    for (const graph of graphs) {
      const back = backEdges(graph);
      const ranks = ranksByLength(graph, back);
      expect(ranks.size).toBe(graph.nodes.length);
      for (const length of lengths(graph, back, ranks)) expect(length).toBeGreaterThanOrEqual(1);
      expect(Math.min(...ranks.values())).toBe(0);
    }
  });

  it('moves a node that is not a source when that balances its edges', () => {
    // Chain A..E holds ranks 0..4. Q takes A and the source P and feeds D and
    // E, so its edges total q + 1 + (3 - q) + (4 - q) = 8 - q, least at the
    // latest rank D allows: 2. Longest path leaves Q at 1, and pulling the
    // source P forward cannot move Q.
    const graph = graphOf(
      ['A', 'B', 'C', 'D', 'E', 'P', 'Q'],
      [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['A', 'Q'], ['P', 'Q'], ['Q', 'D'], ['Q', 'E']],
    );
    const none = new Set<string>();
    const ranks = ranksByLength(graph, none);
    expect(ranks.get('Q')).toBe(2);
    expect(ranks.get('P')).toBe(1);
    expect(total(lengths(graph, none, ranks))).toBe(10);
    expect(total(lengths(graph, none, ranksOf(graph, none)))).toBe(11);
  });

  it('starts each disconnected component at rank 0', () => {
    const graph = graphOf(['a', 'b', 'c', 'x', 'y', 'lone'], [['a', 'b'], ['b', 'c'], ['x', 'y']]);
    const ranks = ranksByLength(graph, new Set());
    expect(Object.fromEntries(ranks)).toEqual({ a: 0, b: 1, c: 2, x: 0, y: 1, lone: 0 });
  });

  it('counts parallel edges and ignores self-loops', () => {
    // R..U hold ranks 0..3. T has one edge in from R and two out to U, so its
    // edges total t + 2(3 - t): least at t = 2. Counted once, any t would tie.
    const graph = graphOf(
      ['R', 'A', 'B', 'U', 'T'],
      [['R', 'A'], ['A', 'B'], ['B', 'U'], ['R', 'T'], ['T', 'T'], ['T', 'U'], ['T', 'U']],
    );
    const ranks = ranksByLength(graph, new Set());
    expect(ranks.get('T')).toBe(2);
    expect(ranks.get('U')).toBe(3);
  });

  it('gives the same ranks every run, and breaks ties by graph order', () => {
    const ids = ['A', 'M', 'N', 'C', 'X', 'Y'];
    const pairs: [string, string][] = [['A', 'M'], ['M', 'N'], ['N', 'C'], ['A', 'X'], ['X', 'C'], ['A', 'Y'], ['Y', 'C']];
    const graph = graphOf(ids, pairs);
    expect(ranksByLength(graph, new Set())).toEqual(ranksByLength(graph, new Set()));

    // X and Y are interchangeable, so each may sit at rank 1 or 2. Swapping
    // their names swaps their answers: position in the graph decides, not name.
    const swap = (id: string) => (id === 'X' ? 'Y' : id === 'Y' ? 'X' : id);
    const swapped = graphOf(ids.map(swap), pairs.map(([a, b]) => [swap(a), swap(b)] as const));
    const first = ranksByLength(graph, new Set());
    const second = ranksByLength(swapped, new Set());
    expect(second.get('Y')).toBe(first.get('X'));
    expect(second.get('X')).toBe(first.get('Y'));
  });

  it('draws a group into one rank when its edges alone would split it', () => {
    // a heads a chain a > T > U > Q; b feeds Q and Q2 from P, so alone it
    // sits at 3, beside them, and a at 1.
    const graph = graphOf(
      ['P', 'a', 'b', 'T', 'U', 'Q', 'Q2'],
      [['P', 'a'], ['P', 'b'], ['a', 'T'], ['T', 'U'], ['U', 'Q'], ['b', 'Q'], ['b', 'Q2'], ['U', 'Q2']],
    );
    expect(ranksByLength(graph, new Set()).get('b')).toBe(3);
    const grouped = { ...graph, groups: [{ id: 'g', members: ['a', 'b'], inset: { top: 0, right: 0, bottom: 0, left: 0 } }] };
    const ranks = ranksByLength(grouped, new Set());
    expect(ranks.get('a')).toBe(1);
    expect(ranks.get('b')).toBe(1);
    expect(ranks.size).toBe(graph.nodes.length);
  });

  it('keeps an edge between two members of a group a rank long', () => {
    const graph = { ...graphOf(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]), groups: [{ id: 'g', members: ['a', 'b', 'c'], inset: { top: 0, right: 0, bottom: 0, left: 0 } }] };
    expect(Object.fromEntries(ranksByLength(graph, new Set()))).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('ranks a generated 150-node graph validly and shorter than longest path', () => {
    const graph = generated(150, 300, 12345);
    const none = new Set<string>();
    const ranks = ranksByLength(graph, none);
    const ls = lengths(graph, none, ranks);
    for (const length of ls) expect(length).toBeGreaterThanOrEqual(1);
    expect(total(ls)).toBeLessThan(total(lengths(graph, none, ranksOf(graph, none))));
  });
});
