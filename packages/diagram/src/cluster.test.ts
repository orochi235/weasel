import { describe, it, expect } from 'vitest';
import { expandGroupEdges, insetOf } from './cluster';
import { buildGraph, type Graph, type GraphNodeLike } from './graph';
import { layered } from './layered';
import type { LayoutDirection, LayoutFn } from './layout';
import { tree } from './tree';

interface Rect { x: number; y: number; width: number; height: number }

const DEGENERATE: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** Built through `buildGraph`, so groups are read the way a scene's are: a
 *  node whose trait carries `group`, depending on its members. */
function graphOf(
  ids: readonly string[],
  edges: readonly (readonly [string, string])[],
  groups: Readonly<Record<string, readonly string[]>>,
  inset = 12,
): Graph {
  const entries: { node: GraphNodeLike; pose: Rect }[] = [];
  ids.forEach((id, i) => entries.push({
    node: { id, kind: 'leaf', data: { diagram: {} } },
    pose: { x: i, y: i, width: 100, height: 40 },
  }));
  for (const [id, members] of Object.entries(groups)) {
    entries.push({
      node: { id, kind: 'leaf', data: { diagram: { group: { inset } } }, dependsOn: members },
      pose: DEGENERATE,
    });
  }
  edges.forEach(([from, to], i) => entries.push({
    node: { id: `e${i}`, kind: 'leaf', data: { diagram: { from: {}, to: {} } }, dependsOn: [from, to] },
    pose: DEGENERATE,
  }));
  return buildGraph<Rect>(() => entries);
}

/** Every node where the layout put it. */
function placed(graph: Graph, fn: LayoutFn, direction?: LayoutDirection): Map<string, Rect> {
  const moved = fn(graph, direction ? { direction } : {});
  return new Map(graph.nodes.map((n) => [n.id, { ...n.bounds, ...(moved.get(n.id) ?? {}) }]));
}

/** A group's box the way the scene derives it: its members' union, grown by the inset. */
function boxOf(at: Map<string, Rect>, members: readonly string[], inset: number): Rect {
  const rs = members.map((m) => at.get(m)!);
  const x = Math.min(...rs.map((r) => r.x)) - inset;
  const y = Math.min(...rs.map((r) => r.y)) - inset;
  return {
    x,
    y,
    width: Math.max(...rs.map((r) => r.x + r.width)) + inset - x,
    height: Math.max(...rs.map((r) => r.y + r.height)) + inset - y,
  };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Two pipelines whose stages share ranks: a0 → a1 → a2 and b0 → b1 → b2, each
// feeding the other's next stage, so ungrouped they interleave in every rank.
const IDS = ['a0', 'b0', 'a1', 'b1', 'a2', 'b2', 'x'];
const EDGES = [
  ['a0', 'a1'], ['a1', 'a2'], ['b0', 'b1'], ['b1', 'b2'],
  ['a0', 'b1'], ['b0', 'a1'], ['a1', 'b2'], ['x', 'a2'],
] as const;
const GROUPS = { A: ['a0', 'a1', 'a2'], B: ['b0', 'b1', 'b2'] };

describe.each([
  ['layered', layered],
  ['tree', tree],
] as const)('%s with groups', (_, fn) => {
  for (const direction of ['down', 'right', 'up', 'left'] as const) {
    it(`keeps each group's box clear of the other group and of outsiders (${direction})`, () => {
      const graph = graphOf(IDS, EDGES, GROUPS);
      const at = placed(graph, fn, direction);
      const a = boxOf(at, GROUPS.A, 12);
      const b = boxOf(at, GROUPS.B, 12);
      expect(overlaps(a, b), `A ${JSON.stringify(a)} B ${JSON.stringify(b)}`).toBe(false);
      expect(overlaps(a, at.get('x')!)).toBe(false);
      expect(overlaps(b, at.get('x')!)).toBe(false);
    });
  }

  it('moves nothing on a second run', () => {
    const graph = graphOf(IDS, EDGES, GROUPS);
    const at = placed(graph, fn);
    const again = graphOf(IDS, EDGES, GROUPS);
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

describe('groups in the graph', () => {
  it('lists a group with its members, and marks each member', () => {
    const graph = graphOf(['a', 'b', 'c'], [], { G: ['a', 'b'] });
    expect(graph.groups).toEqual([{ id: 'G', members: ['a', 'b'], inset: insetOf(12) }]);
    expect(graph.node('a')?.group).toBe('G');
    expect(graph.node('c')?.group).toBeUndefined();
  });

  it('is not a participant itself', () => {
    expect(graphOf(['a'], [], { G: ['a'] }).node('G')).toBeUndefined();
  });

  it('keeps a node two groups name in the first one', () => {
    const graph = graphOf(['a', 'b'], [], { G: ['a'], H: ['a', 'b'] });
    expect(graph.groups?.map((g) => g.members)).toEqual([['a'], ['b']]);
  });
});

describe('expandGroupEdges', () => {
  const groups = [{ id: 'G', members: ['g0', 'g1', 'g2'], inset: insetOf(0) }];
  const inner = [{ id: 'i0', from: 'g0', to: 'g1' }, { id: 'i1', from: 'g1', to: 'g2' }];

  it('ranks an edge into a group against the members nothing inside points at', () => {
    const out = expandGroupEdges([...inner, { id: 'e', from: 'x', to: 'G' }], groups);
    expect(out.filter((e) => e.id.startsWith('e#')).map((e) => e.to)).toEqual(['g0']);
  });

  it('ranks an edge out of a group from the members that point nowhere inside', () => {
    const out = expandGroupEdges([...inner, { id: 'e', from: 'G', to: 'y' }], groups);
    expect(out.filter((e) => e.id.startsWith('e#')).map((e) => e.from)).toEqual(['g2']);
  });

  it('drops an edge between a group and its own member', () => {
    expect(expandGroupEdges([{ id: 'e', from: 'G', to: 'g1' }], groups)).toEqual([]);
  });
});
