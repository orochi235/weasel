import { describe, expect, it } from 'vitest';
import type { Graph, GraphGroup, GraphNode } from './graph';
import { grid, type GridOptions } from './grid';
import type { LayoutOptions } from './layout';

type Sizes = Readonly<Record<string, readonly [number, number]>>;

/** A graph of nodes sized as given, on the diagonal in order, each in the group `groupOf` names. */
function graphOf(sizes: Sizes, groups: readonly GraphGroup[] = [], groupOf: Readonly<Record<string, string>> = {}, pinned: readonly string[] = []): Graph {
  const nodes: GraphNode[] = Object.entries(sizes).map(([id, [width, height]], i) => ({
    id, bounds: { x: i, y: i, width, height }, pinned: pinned.includes(id), ...(groupOf[id] !== undefined ? { group: groupOf[id] } : {}),
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { nodes, edges: [], groups, node: (id) => byId.get(id), outgoing: () => [], incoming: () => [] };
}

const inset = { top: 30, right: 10, bottom: 10, left: 10 };

/** Each node's top-left after `grid` runs, from the first node's. */
function laid(graph: Graph, opts: LayoutOptions = {}): Record<string, { x: number; y: number }> {
  const moves = grid(graph, { nodeGap: 10, ...opts });
  const at = (n: GraphNode) => moves.get(n.id) ?? { x: n.bounds.x, y: n.bounds.y };
  const origin = at(graph.nodes[0]!);
  return Object.fromEntries(graph.nodes.map((n) => [n.id, { x: at(n).x - origin.x, y: at(n).y - origin.y }]));
}

const of = (columns: number, more: Omit<GridOptions, 'columns'> = {}): LayoutOptions => ({ grid: { columns, ...more } });

describe('grid', () => {
  it('fills rows of the given columns in graph order, each column as wide as the widest item', () => {
    const at = laid(graphOf({ a: [40, 20], b: [60, 20], c: [40, 20], d: [40, 30] }), of(3));
    expect(at).toEqual({ a: { x: 0, y: 0 }, b: { x: 60, y: 0 }, c: { x: 140, y: 0 }, d: { x: 0, y: 30 } });
  });

  it('puts everything in one row when no columns are given', () => {
    const at = laid(graphOf({ a: [40, 20], b: [40, 20], c: [40, 20] }));
    expect(new Set(Object.values(at).map((p) => p.y))).toEqual(new Set([0]));
    expect(at.c!.x - at.b!.x).toBe(50);
  });

  it('spans an item over several columns, centered across them, and skips empty cells', () => {
    const at = laid(graphOf({ a: [40, 20], b: [40, 20], c: [40, 20], d: [40, 20] }), of(3, { spans: { a: 2 }, skips: { c: 1 } }));
    expect(at.b).toEqual({ x: 75, y: 0 });
    expect(at.c).toEqual({ x: 25, y: 30 });
    expect(at.d).toEqual({ x: 75, y: 30 });
  });

  it('wraps an item that does not fit in what is left of its row', () => {
    const at = laid(graphOf({ a: [40, 20], b: [40, 20], c: [40, 20] }), of(3, { spans: { c: 2 } }));
    expect(at.c).toEqual({ x: 25, y: 30 });
  });

  it('lays a group out as a grid of its own in its cell, its inset kept around it', () => {
    const g: GraphGroup = { id: 'g', members: ['b', 'c'], inset };
    const at = laid(graphOf({ a: [40, 20], b: [40, 20], c: [40, 20], d: [40, 20] }, [g], { b: 'g', c: 'g' }), of(3, { groupColumns: { g: 1 } }));
    // The group is 60 wide and 90 tall, so every column is 60 wide and the row 90 tall, a and d centered in theirs.
    expect(at.b).toEqual({ x: 70, y: -5 });
    expect(at.c).toEqual({ x: 70, y: 25 });
    expect(at.d).toEqual({ x: 140, y: 0 });
  });

  it('nests a group inside another', () => {
    const outer: GraphGroup = { id: 'o', members: ['a', 'b', 'c'], inset };
    const inner: GraphGroup = { id: 'i', members: ['b', 'c'], inset, parent: 'o' };
    const at = laid(graphOf({ a: [40, 20], b: [40, 20], c: [40, 20] }, [outer, inner], { a: 'o', b: 'i', c: 'i' }), of(1, { groupColumns: { o: 1, i: 2 } }));
    expect(at.b!.y).toBe(at.c!.y);
    expect(at.b!.y).toBeGreaterThanOrEqual(20 + 10 + inset.top);
    expect(at.c!.x - at.b!.x).toBe(50);
  });

  it('moves nothing on a second run, and keeps a pinned node where it is', () => {
    const sizes: Sizes = { a: [40, 20], b: [60, 20], c: [40, 20] };
    const graph = graphOf(sizes);
    const moves = grid(graph, { nodeGap: 10, ...of(2) });
    const settled: Graph = { ...graph, nodes: graph.nodes.map((n) => ({ ...n, bounds: { ...n.bounds, ...moves.get(n.id) } })) };
    const byId = new Map(settled.nodes.map((n) => [n.id, n]));
    expect(grid({ ...settled, node: (id) => byId.get(id) }, { nodeGap: 10, ...of(2) }).size).toBe(0);
    const pinned = grid(graphOf(sizes, [], {}, ['b']), { nodeGap: 10, ...of(2) });
    expect(pinned.has('b')).toBe(false);
    expect(pinned.get('a')!.y).toBe(1);
  });
});
