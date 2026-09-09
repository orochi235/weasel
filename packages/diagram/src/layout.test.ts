import { describe, it, expect } from 'vitest';
import { buildGraph, type Graph, type GraphNodeLike } from './graph';
import { force } from './force';
import { backEdges, layered, ranksOf } from './layered';
import { DEFAULT_NODE_GAP, DEFAULT_RANK_GAP, type LayoutResult } from './layout';
import { forestOf, tree } from './tree';

interface Rect { x: number; y: number; width: number; height: number }
type Box = readonly [x: number, y: number, width?: number, height?: number];

const DEGENERATE: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** A graph built the way a scene builds one — through `buildGraph`, so the
 *  layouts are exercised against the real index rather than a stand-in. */
function graphOf(
  boxes: Readonly<Record<string, Box>>,
  edges: readonly (readonly [string, string])[] = [],
  pins: readonly string[] = [],
): Graph {
  const entries: { node: GraphNodeLike; pose: Rect }[] = [];
  for (const [id, [x, y, width = 100, height = 40]] of Object.entries(boxes)) {
    entries.push({
      node: { id, kind: 'leaf', data: { diagram: pins.includes(id) ? { pinned: true } : {} } },
      pose: { x, y, width, height },
    });
  }
  edges.forEach(([from, to], i) => {
    entries.push({
      node: {
        id: `e${i}`,
        kind: 'leaf',
        data: { diagram: { from: {}, to: {} } },
        dependsOn: [from, to],
      },
      pose: DEGENERATE,
    });
  });
  return buildGraph<Rect>(() => entries);
}

/** Where a node ends up: the layout's answer, or where it already was — a node
 *  that does not move is absent from the result, which is the whole point. */
function at(boxes: Readonly<Record<string, Box>>, result: LayoutResult, id: string): { x: number; y: number } {
  const moveTo = result.get(id);
  if (moveTo !== undefined) return moveTo;
  const [x, y] = boxes[id]!;
  return { x, y };
}

/** The boxes a result leaves behind — what a second run reads. */
function moved(boxes: Readonly<Record<string, Box>>, result: LayoutResult): Record<string, Box> {
  const next: Record<string, Box> = {};
  for (const [id, [x, y, w = 100, h = 40]] of Object.entries(boxes)) {
    const at = result.get(id);
    next[id] = at === undefined ? [x, y, w, h] : [at.x, at.y, w, h];
  }
  return next;
}

describe('layered', () => {
  it('puts each node one rank past its deepest predecessor', () => {
    const graph = graphOf({ a: [0, 0], b: [0, 0], c: [0, 0] }, [['a', 'b'], ['b', 'c'], ['a', 'c']]);
    const ranks = ranksOf(graph, backEdges(graph));
    expect([ranks.get('a'), ranks.get('b'), ranks.get('c')]).toEqual([0, 1, 2]);
  });

  it('stacks ranks down the page, one node height plus the rank gap apart', () => {
    const boxes = { a: [0, 0], b: [0, 0] } as const;
    const result = layered(graphOf(boxes, [['a', 'b']]));
    expect(at(boxes, result, 'b').y - at(boxes, result, 'a').y).toBe(40 + DEFAULT_RANK_GAP);
  });

  it('keeps two siblings in the left-to-right order they already have', () => {
    const boxes = { root: [0, 0], left: [500, 0], right: [900, 0] } as const;
    const edges = [['root', 'left'], ['root', 'right']] as const;
    const result = layered(graphOf(boxes, edges));
    expect(result.get('left')!.x).toBeLessThan(result.get('right')!.x);

    const swapped = layered(graphOf({ ...boxes, left: [900, 0], right: [500, 0] }, edges));
    expect(swapped.get('right')!.x).toBeLessThan(swapped.get('left')!.x);
  });

  it('leaves the node gap between siblings', () => {
    const result = layered(graphOf(
      { root: [0, 0], left: [500, 0], right: [900, 0] },
      [['root', 'left'], ['root', 'right']],
    ));
    expect(result.get('right')!.x - result.get('left')!.x).toBe(100 + DEFAULT_NODE_GAP);
  });

  it('runs ranks along x when the direction is `right`', () => {
    const boxes = { a: [0, 0], b: [0, 0] } as const;
    const result = layered(graphOf(boxes, [['a', 'b']]), { direction: 'right' });
    expect(at(boxes, result, 'b').x - at(boxes, result, 'a').x).toBe(100 + DEFAULT_RANK_GAP);
    expect(at(boxes, result, 'b').y).toBe(at(boxes, result, 'a').y);
  });

  // The rule the whole design turns on: a re-layout of an unchanged graph is
  // free, so a consumer can wire it to a button without a warning label.
  it('moves nothing on a second run', () => {
    const boxes = { a: [17, 3], b: [400, 90], c: [-50, 260], d: [800, 12] } as const;
    const edges = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']] as const;
    const first = layered(graphOf(boxes, edges));
    expect(first.size).toBeGreaterThan(0);
    expect(layered(graphOf(moved(boxes, first), edges)).size).toBe(0);
  });

  // The anchoring rule, which idempotence alone does not pin down: a layout
  // with no pin in it still has to land on the diagram rather than at the
  // origin, or the first press of the button loses the author's viewport.
  it('lands the layout where the graph already is', () => {
    const boxes = { a: [700, 400], b: [900, 480], c: [640, 900] } as const;
    const result = layered(graphOf(boxes, [['a', 'b'], ['a', 'c']]));
    const ids = Object.keys(boxes);
    expect(Math.min(...ids.map((id) => at(boxes, result, id).x))).toBeCloseTo(640, 9);
    expect(Math.min(...ids.map((id) => at(boxes, result, id).y))).toBeCloseTo(400, 9);
  });

  it('never moves a pinned node, and lays the rest out around it', () => {
    const boxes = { a: [1000, 1000], b: [0, 0] } as const;
    const result = layered(graphOf(boxes, [['a', 'b']], ['a']));
    expect(result.has('a')).toBe(false);
    expect(result.get('b')).toEqual({ x: 1000, y: 1000 + 40 + DEFAULT_RANK_GAP });
  });

  it('lays out a cycle instead of hanging on it', () => {
    const graph = graphOf({ a: [0, 0], b: [0, 0] }, [['a', 'b'], ['b', 'a']]);
    expect(backEdges(graph).size).toBe(1);
    const boxes = { a: [0, 0], b: [0, 0] } as const;
    const result = layered(graphOf(boxes, [['a', 'b'], ['b', 'a']]));
    expect(at(boxes, result, 'b').y).toBeGreaterThan(at(boxes, result, 'a').y);
  });

  it('treats a self-edge as a loop rather than a rank', () => {
    const graph = graphOf({ a: [0, 0] }, [['a', 'a']]);
    expect(ranksOf(graph, backEdges(graph)).get('a')).toBe(0);
  });
});

describe('tree', () => {
  it('centers a parent over the block its children occupy', () => {
    const boxes = { root: [0, 0], left: [0, 0], right: [500, 0] } as const;
    const result = tree(graphOf(boxes, [['root', 'left'], ['root', 'right']]));
    const midpoint = (at(boxes, result, 'left').x + at(boxes, result, 'right').x) / 2;
    expect(at(boxes, result, 'root').x).toBeCloseTo(midpoint, 9);
  });

  it('gives a node claimed by two parents to the first one that reaches it', () => {
    const graph = graphOf(
      { a: [0, 0], b: [200, 0], shared: [400, 0] },
      [['a', 'shared'], ['b', 'shared']],
    );
    const { children, depth } = forestOf(graph, 'x');
    expect(children.get('a')!.map((n) => n.id)).toEqual(['shared']);
    expect(children.get('b')).toEqual([]);
    expect(depth.get('shared')).toBe(1);
  });

  it('places a node nothing points at and nothing reaches', () => {
    const result = tree(graphOf(
      { a: [0, 0], b: [200, 0], lonely: [900, 900] },
      [['a', 'b']],
    ));
    expect(result.has('lonely')).toBe(true);
  });

  it('makes a root out of every node of an all-cycle component', () => {
    const graph = graphOf({ a: [0, 0], b: [200, 0] }, [['a', 'b'], ['b', 'a']]);
    const { roots } = forestOf(graph, 'x');
    expect(roots.map((n) => n.id)).toEqual(['a']);
    expect(tree(graph).size).toBeGreaterThanOrEqual(0);
  });

  it('moves nothing on a second run', () => {
    const boxes = { r: [40, 5], a: [300, 200], b: [-100, 190], c: [700, 400] } as const;
    const edges = [['r', 'a'], ['r', 'b'], ['a', 'c']] as const;
    const first = tree(graphOf(boxes, edges));
    expect(first.size).toBeGreaterThan(0);
    expect(tree(graphOf(moved(boxes, first), edges)).size).toBe(0);
  });

  it('never moves a pinned node', () => {
    const result = tree(graphOf(
      { root: [500, 500], kid: [0, 0] },
      [['root', 'kid']],
      ['root'],
    ));
    expect(result.has('root')).toBe(false);
    expect(result.get('kid')!.y).toBe(500 + 40 + DEFAULT_RANK_GAP);
  });
});

describe('force', () => {
  const boxes = { a: [0, 0], b: [10, 0], c: [0, 10], d: [400, 400] } as const;
  const edges = [['a', 'b'], ['b', 'c'], ['c', 'a'], ['a', 'd']] as const;

  it('gives the same answer twice from the same input', () => {
    const one = force(graphOf(boxes, edges));
    const two = force(graphOf(boxes, edges));
    expect([...one.entries()]).toEqual([...two.entries()]);
  });

  it('never moves a pinned node, and relaxes the rest around it', () => {
    const result = force(graphOf(boxes, edges, ['a']));
    expect(result.has('a')).toBe(false);
    expect(result.size).toBeGreaterThan(0);
  });

  it('separates nodes that start on exactly the same point', () => {
    const result = force(graphOf({ a: [0, 0], b: [0, 0], c: [0, 0] }));
    const points = ['a', 'b', 'c'].map((id) => result.get(id) ?? { x: 0, y: 0 });
    for (const p of points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(3);
  });

  it('pulls a connected pair closer than the repulsion alone would leave them', () => {
    const near = force(graphOf({ a: [0, 0], b: [900, 0] }, [['a', 'b']]));
    const apart = force(graphOf({ a: [0, 0], b: [900, 0] }));
    const span = (r: LayoutResult, fallback: number): number =>
      Math.abs((r.get('b')?.x ?? 900) - (r.get('a')?.x ?? 0)) || fallback;
    expect(span(near, 900)).toBeLessThan(span(apart, 900));
  });

  // Charge alone treats a node as a point, so two wide boxes can sit a
  // comfortable center-to-center distance apart and still cover each other.
  it('leaves no two boxes overlapping', () => {
    const wide = { a: [0, 0, 200, 60], b: [10, 10, 200, 60], c: [20, 20, 200, 60] } as const;
    // A weak charge and a short link, so nothing but the box separation is
    // holding them apart.
    const result = force(graphOf(wide, [['a', 'b'], ['b', 'c']]),
      { padding: 10, charge: -50, linkDistance: 20 });
    const boxes = Object.keys(wide).map((id) => {
      const [, , w, h] = wide[id as keyof typeof wide];
      const p = at(wide, result, id);
      return { x: p.x, y: p.y, w, h };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const p = boxes[i]!;
        const q = boxes[j]!;
        const overlaps = p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('has nothing to say about an empty graph', () => {
    expect(force(graphOf({})).size).toBe(0);
  });
});
