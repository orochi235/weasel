/**
 * `sameGraph` against a plain model of a graph: the same set of nodes, the same edges counted with repeats, and every
 * node in the same box. Ids draw on the characters a string key would join with, so a spelling that confuses two
 * graphs shows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { graphOf, type Graph, type GraphEdge, type GraphNode } from './graph';
import { sameGraph } from './livePlan';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;

const ID = fc.constantFrom('a', 'b', 'c', 'a,b', 'b,c', 'a>b', 'b>c', 'a|b', '|', ',', '>', '');
const BOX = fc.record({ x: fc.integer({ min: 0, max: 2 }), y: fc.constant(0), width: fc.constant(10), height: fc.constant(10) });

const graphArb: fc.Arbitrary<Graph> = fc.uniqueArray(ID, { maxLength: 6 }).chain((ids) => fc.tuple(
  fc.tuple(...ids.map((id) => BOX.map((bounds): GraphNode => ({ id, bounds, pinned: false })))),
  ids.length === 0 ? fc.constant([]) : fc.array(fc.tuple(fc.constantFrom(...ids), fc.constantFrom(...ids)), { maxLength: 4 }),
)).map(([nodes, ends]) => graphOf(nodes, ends.map(([from, to], i): GraphEdge => ({ id: `e${i}`, from, to }))));

function modelSame(a: Graph, b: Graph): boolean {
  if (a.nodes.length !== b.nodes.length) return false;
  for (const n of a.nodes) {
    const m = b.node(n.id);
    if (m === undefined || JSON.stringify(m.bounds) !== JSON.stringify(n.bounds)) return false;
  }
  const ends = (g: Graph) => g.edges.map((e) => JSON.stringify([e.from, e.to])).sort();
  return JSON.stringify(ends(a)) === JSON.stringify(ends(b));
}

/** `g` with its nodes and edges in another order, and the edges renamed. */
const shuffled = (g: Graph, seed: number): Graph => {
  const turn = <T,>(xs: readonly T[]) => xs.map((x, i) => ({ x, k: (i * 7919 + seed) % 101 })).sort((p, q) => p.k - q.k).map(({ x }) => x);
  return graphOf(turn(g.nodes), turn(g.edges).map((e, i) => ({ ...e, id: `f${i}` })));
};

/** Two graphs: drawn apart, or one drawn and the other its nodes with an edge redrawn or a box moved. */
const pairArb: fc.Arbitrary<[Graph, Graph]> = fc.oneof(
  fc.tuple(graphArb, graphArb),
  graphArb.chain((a) => fc.tuple(
    fc.constant(a),
    fc.record({
      edge: a.nodes.length === 0 ? fc.constant(null) : fc.tuple(fc.nat(), fc.constantFrom(...a.nodes.map((n) => n.id)), fc.constantFrom(...a.nodes.map((n) => n.id))),
      move: fc.option(fc.nat(), { nil: null }),
      seed: fc.nat(),
    }).map(({ edge, move, seed }) => {
      const nodes = a.nodes.map((n, i) => (move !== null && i === move % a.nodes.length ? { ...n, bounds: { ...n.bounds, x: n.bounds.x + 1 } } : n));
      const edges = a.edges.map((e, i) => (edge !== null && i === edge[0] % a.edges.length ? { ...e, from: edge[1], to: edge[2] } : e));
      return shuffled(graphOf(nodes, edges), seed);
    }),
  )),
);

describe('sameGraph', () => {
  it('answers whether two graphs hold the same nodes, edges, and boxes', () => {
    const seen = tally();
    fc.assert(fc.property(pairArb, ([a, b]) => {
      const want = modelSame(a, b);
      seen.count(want ? 'same' : 'different');
      expect(sameGraph(a, b)).toBe(want);
    }), runs(RUNS));
    seen.atLeast('same', RUNS / 10);
    seen.atLeast('different', RUNS / 4);
  }, timeoutFor(RUNS, 1));

  it('reads a graph as itself in any order', () => {
    fc.assert(fc.property(graphArb, fc.nat(), (g, seed) => {
      expect(sameGraph(g, shuffled(g, seed))).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
