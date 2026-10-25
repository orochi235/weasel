import { describe, expect, it } from 'vitest';
import { DEFAULT_RANK_GAP } from './layout';
import { at, graphOf, moved, type Box } from './layoutFixture';
import { radial } from './radial';

type Boxes = Readonly<Record<string, Box>>;
type Edges = readonly (readonly [string, string])[];

/** Every node's box after `radial` runs. */
function laidOut(boxes: Boxes, edges: Edges = []) {
  const result = radial(graphOf(boxes, edges));
  return Object.fromEntries(Object.entries(boxes).map(([id, [, , w = 100, h = 40]]) => {
    const p = at(boxes, result, id);
    return [id, { x: p.x, y: p.y, width: w, height: h }];
  }));
}

const centerX = (b: { x: number; width: number }): number => b.x + b.width / 2;

function overlaps(boxes: ReturnType<typeof laidOut>): string[] {
  const ids = Object.keys(boxes);
  const out: string[] = [];
  for (const [i, a] of ids.entries()) {
    for (const b of ids.slice(i + 1)) {
      const p = boxes[a]!;
      const q = boxes[b]!;
      if (p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height) out.push(`${a}/${b}`);
    }
  }
  return out;
}

/** A central topic with four main topics, the first carrying three subtopics. */
const MAP: Boxes = {
  root: [0, 0, 160, 80], a: [0, 0], b: [0, 0], c: [0, 0], d: [0, 0], a1: [0, 0], a2: [0, 0], a3: [0, 0],
};
const MAP_EDGES: Edges = [['root', 'a'], ['root', 'b'], ['root', 'c'], ['root', 'd'], ['a', 'a1'], ['a', 'a2'], ['a', 'a3']];

describe('radial', () => {
  it("splits the root's branches between its right and its left, balanced by subtree size", () => {
    const boxes = laidOut(MAP, MAP_EDGES);
    const root = centerX(boxes.root!);
    const right = ['a', 'b', 'c', 'd'].filter((id) => centerX(boxes[id]!) > root);
    const left = ['a', 'b', 'c', 'd'].filter((id) => centerX(boxes[id]!) < root);
    // a's subtree weighs four, so it takes the right alone and the three single topics go left.
    expect(right).toEqual(['a']);
    expect(left.sort()).toEqual(['b', 'c', 'd']);
    for (const id of ['a1', 'a2', 'a3']) expect(boxes[id]!.x).toBeGreaterThan(boxes.a!.x + 100);
  });

  it('puts the first rank one rank gap out from the root on either side', () => {
    const boxes = laidOut(MAP, MAP_EDGES);
    expect(boxes.a!.x - (boxes.root!.x + 160)).toBe(DEFAULT_RANK_GAP);
    expect(boxes.root!.x - (boxes.b!.x + 100)).toBe(DEFAULT_RANK_GAP);
  });

  it('centers the root on each side of its branches', () => {
    const boxes = laidOut(MAP, MAP_EDGES);
    const mid = (ids: string[]) => {
      const lo = Math.min(...ids.map((id) => boxes[id]!.y));
      const hi = Math.max(...ids.map((id) => boxes[id]!.y + 40));
      return (lo + hi) / 2;
    };
    expect(mid(['b', 'c', 'd'])).toBeCloseTo(boxes.root!.y + 40);
    expect(mid(['a1', 'a2', 'a3'])).toBeCloseTo(boxes.root!.y + 40);
  });

  it('never overlaps two nodes, and keeps each subtree a block of its own', () => {
    const boxes = laidOut(
      { ...MAP, b1: [0, 0], b2: [0, 0, 100, 120], c1: [0, 0] },
      [...MAP_EDGES, ['b', 'b1'], ['b', 'b2'], ['c', 'c1']],
    );
    expect(overlaps(boxes)).toEqual([]);
    const span = (ids: string[]) => [Math.min(...ids.map((id) => boxes[id]!.y)), Math.max(...ids.map((id) => boxes[id]!.y + boxes[id]!.height))];
    const [, bBottom] = span(['b', 'b1', 'b2']);
    const [cTop] = span(['c', 'c1']);
    const [bTop] = span(['b', 'b1', 'b2']);
    const [, cBottom] = span(['c', 'c1']);
    expect(bBottom <= cTop || cBottom <= bTop).toBe(true);
  });

  it('is deterministic, and a second run moves nothing', () => {
    const first = radial(graphOf(MAP, MAP_EDGES));
    expect(radial(graphOf(MAP, MAP_EDGES))).toEqual(first);
    expect(radial(graphOf(moved(MAP, first), MAP_EDGES)).size).toBe(0);
  });

  it('leaves a single node where it is', () => {
    expect(radial(graphOf({ only: [40, 70] })).size).toBe(0);
  });

  it('stacks the trees after the first below it', () => {
    const boxes = laidOut(
      { root: [0, 0], a: [0, 0], b: [0, 0], other: [0, 300], o1: [0, 300] },
      [['root', 'a'], ['root', 'b'], ['other', 'o1']],
    );
    expect(overlaps(boxes)).toEqual([]);
    const firstBottom = Math.max(...['root', 'a', 'b'].map((id) => boxes[id]!.y + 40));
    expect(Math.min(boxes.other!.y, boxes.o1!.y)).toBeGreaterThan(firstBottom);
    expect(centerX(boxes.other!)).toBe(centerX(boxes.root!));
  });

  it('lays out a graph with a cycle as the forest its walk finds', () => {
    const boxes = laidOut({ a: [0, 0], b: [0, 0], c: [0, 0] }, [['a', 'b'], ['b', 'c'], ['c', 'a']]);
    expect(overlaps(boxes)).toEqual([]);
    expect(centerX(boxes.b!)).toBeGreaterThan(centerX(boxes.a!));
    expect(centerX(boxes.c!)).toBeGreaterThan(centerX(boxes.b!));
  });
});
