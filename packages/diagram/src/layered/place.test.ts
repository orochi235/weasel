import { describe, expect, it } from 'vitest';
import type { GraphNode } from '../graph';
import { placeAcross } from './place';
import { PLACEHOLDER, type Hop, type Rows } from './types';

const GAP = 10;
const box = (id: string, width: number): GraphNode => ({ id, bounds: { x: 0, y: 0, width, height: 20 }, pinned: false });
const dummy = (id: string): GraphNode => box(PLACEHOLDER + id, GAP / 2);
const hop = (from: string, to: string): Hop => ({ from, to, edge: `${from}->${to}` });

function centerOf(rows: Rows, low: Map<string, number>, id: string): number {
  const node = rows.flat().find((n) => n.id === id)!;
  return low.get(id)! + node.bounds.width / 2;
}

function expectOrderAndGaps(rows: Rows, low: Map<string, number>): void {
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1]!;
      const b = row[i]!;
      const gap = low.get(b.id)! - (low.get(a.id)! + a.bounds.width);
      expect(gap).toBeGreaterThanOrEqual(GAP - 1e-6);
    }
  }
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function generated(seed: number): { rows: Rows; hops: Hop[] } {
  const rand = lcg(seed);
  const pick = (n: number) => Math.floor(rand() * n);
  const rows: Rows = [];
  const depth = 2 + pick(5);
  for (let r = 0; r < depth; r++) {
    const row: GraphNode[] = [];
    const count = 1 + pick(6);
    for (let i = 0; i < count; i++) row.push(rand() < 0.3 ? dummy(`${r}.${i}`) : box(`n${r}.${i}`, 4 + pick(80)));
    rows.push(row);
  }
  const hops: Hop[] = [];
  for (let r = 0; r + 1 < depth; r++) {
    const edges = 1 + pick(8);
    for (let e = 0; e < edges; e++) hops.push(hop(rows[r]![pick(rows[r]!.length)]!.id, rows[r + 1]![pick(rows[r + 1]!.length)]!.id));
  }
  return { rows, hops };
}

describe('placeAcross', () => {
  it('lines a straight chain of equal widths up exactly', () => {
    const rows: Rows = [[box('a', 40)], [box('b', 40)], [box('c', 40)]];
    const low = placeAcross(rows, [hop('a', 'b'), hop('b', 'c')], 'x', GAP);
    expect(low.get('a')).toBe(0);
    expect(low.get('b')).toBe(0);
    expect(low.get('c')).toBe(0);
  });

  it('lines a chain through placeholders up between two wide nodes', () => {
    const p1 = PLACEHOLDER + 'p1';
    const p2 = PLACEHOLDER + 'p2';
    const rows: Rows = [
      [box('side', 30), box('a', 120)],
      [box('x', 50), dummy('p1')],
      [dummy('p2'), box('y', 70)],
      [box('b', 120)],
    ];
    const hops = [hop('a', p1), hop(p1, p2), hop(p2, 'b'), hop('side', 'x'), hop('x', 'y')];
    const low = placeAcross(rows, hops, 'x', GAP);
    const c = centerOf(rows, low, 'a');
    expect(centerOf(rows, low, p1)).toBeCloseTo(c, 9);
    expect(centerOf(rows, low, p2)).toBeCloseTo(c, 9);
    expect(centerOf(rows, low, 'b')).toBeCloseTo(c, 9);
    expectOrderAndGaps(rows, low);
  });

  it('keeps every rank in order and apart on generated graphs', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { rows, hops } = generated(seed);
      const low = placeAcross(rows, hops, 'x', GAP);
      expect(low.size).toBe(rows.flat().length);
      expectOrderAndGaps(rows, low);
    }
  });

  it('puts a parent over the middle of three children', () => {
    const rows: Rows = [[box('p', 30)], [box('a', 40), box('b', 40), box('c', 40)]];
    const low = placeAcross(rows, [hop('p', 'a'), hop('p', 'b'), hop('p', 'c')], 'x', GAP);
    expect(centerOf(rows, low, 'p')).toBeCloseTo(centerOf(rows, low, 'b'), 9);
  });

  it('keeps an inner segment straight when another hop crosses it', () => {
    const d1 = PLACEHOLDER + 'd1';
    const d2 = PLACEHOLDER + 'd2';
    const rows: Rows = [
      [box('s', 40), box('t', 40)],
      [dummy('d1'), box('x', 40)],
      [box('y', 40), dummy('d2')],
      [box('u', 40), box('e', 40)],
    ];
    const hops = [hop('s', d1), hop(d1, d2), hop(d2, 'e'), hop('t', 'x'), hop('x', 'y'), hop('y', 'u')];
    const low = placeAcross(rows, hops, 'x', GAP);
    expect(centerOf(rows, low, d1)).toBeCloseTo(centerOf(rows, low, d2), 9);
    expectOrderAndGaps(rows, low);
  });

  it('starts at 0 and gives equal output for equal input', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { rows, hops } = generated(seed);
      const low = placeAcross(rows, hops, 'x', GAP);
      expect(Math.min(...low.values())).toBe(0);
      const again = generated(seed);
      expect([...placeAcross(again.rows, again.hops, 'x', GAP)]).toEqual([...low]);
    }
  });

  it('measures extents along the axis it is given', () => {
    const rows: Rows = [[{ id: 'a', bounds: { x: 0, y: 0, width: 5, height: 50 }, pinned: false }, box('b', 5)]];
    const low = placeAcross(rows, [], 'y', GAP);
    expect(low.get('b')! - low.get('a')!).toBe(50 + GAP);
  });
});
