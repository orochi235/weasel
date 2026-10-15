import { describe, expect, it } from 'vitest';
import type { GraphGroup, GraphNode } from '../graph';
import { crossings, orderRows } from './order';
import { PLACEHOLDER, type Hop, type Rows } from './types';

const node = (id: string, group?: string): GraphNode => ({
  id, bounds: { x: 0, y: 0, width: 10, height: 10 }, pinned: false, ...(group === undefined ? {} : { group }),
});
const rowsOf = (...ids: string[][]): Rows => ids.map((row) => row.map((id) => node(id)));
const hopsOf = (...pairs: [string, string][]): Hop[] => pairs.map(([from, to], i) => ({ from, to, edge: `e${i}` }));
const inset = { top: 0, right: 0, bottom: 0, left: 0 };
const ids = (rows: Rows) => rows.map((row) => row.map((n) => n.id));

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A random layered graph: 2–6 ranks of 1–7 nodes, random hops between neighbors. */
function generated(seed: number): { rows: Rows; hops: Hop[] } {
  const rnd = lcg(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
  const rows: Rows = Array.from({ length: 2 + Math.floor(rnd() * 5) }, (_, r) =>
    Array.from({ length: 1 + Math.floor(rnd() * 7) }, (_, i) => node(`n${r}.${i}`)));
  const hops: Hop[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    const count = Math.floor(rnd() * rows[r]!.length * 2);
    for (let k = 0; k < count; k++) hops.push({ from: pick(rows[r]!).id, to: pick(rows[r + 1]!).id, edge: `e${hops.length}` });
  }
  return { rows, hops };
}

/** Whether each group's members in every rank sit in one unbroken run. */
function contiguous(rows: Rows, groups: readonly GraphGroup[]): boolean {
  return groups.every((g) => rows.every((row) => {
    const at = row.flatMap((n, i) => (g.members.includes(n.id) ? [i] : []));
    return at.length === 0 || at[at.length - 1]! - at[0]! === at.length - 1;
  }));
}

describe('crossings', () => {
  it('counts none for parallel hops', () => {
    expect(crossings(rowsOf(['a', 'b'], ['x', 'y']), hopsOf(['a', 'x'], ['b', 'y']))).toBe(0);
  });

  it('counts one for an X', () => {
    expect(crossings(rowsOf(['a', 'b'], ['x', 'y']), hopsOf(['a', 'y'], ['b', 'x']))).toBe(1);
  });

  it('does not count hops sharing an end', () => {
    expect(crossings(rowsOf(['a', 'b'], ['x', 'y']), hopsOf(['a', 'x'], ['a', 'y'], ['b', 'y']))).toBe(0);
  });

  it('sums every pair across every rank pair', () => {
    // A full reversal of three is 3 crossings; the second pair adds 1 more.
    const rows = rowsOf(['a', 'b', 'c'], ['x', 'y', 'z'], ['p', 'q']);
    const hops = hopsOf(['a', 'z'], ['b', 'y'], ['c', 'x'], ['x', 'q'], ['y', 'p']);
    expect(crossings(rows, hops)).toBe(4);
  });
});

describe('orderRows', () => {
  it('untangles a seed with crossings', () => {
    const rows = rowsOf(['a', 'b', 'c'], ['x', 'y', 'z'], ['p', 'q', 'r']);
    const hops = hopsOf(['a', 'z'], ['b', 'y'], ['c', 'x'], ['x', 'r'], ['y', 'q'], ['z', 'p']);
    expect(crossings(rows, hops)).toBeGreaterThan(0);
    expect(crossings(orderRows(rows, hops), hops)).toBe(0);
  });

  it('never ends with more crossings than its seed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { rows, hops } = generated(seed);
      expect(crossings(orderRows(rows, hops), hops)).toBeLessThanOrEqual(crossings(rows, hops));
    }
  });

  // A barycenter sweep alone leaves one crossing here; only a swap clears it.
  it('reaches a minimum only transposition finds', () => {
    const rows = rowsOf(['a0', 'a1', 'a2', 'a3'], ['b0', 'b1', 'b2']);
    const hops = hopsOf(['a1', 'b0'], ['a1', 'b2'], ['a0', 'b1'], ['a0', 'b0'], ['a2', 'b0'], ['a3', 'b1']);
    expect(crossings(orderRows(rows, hops), hops)).toBe(0);
  });

  it('keeps every group contiguous in every rank', () => {
    const groups: GraphGroup[] = [
      { id: 'g', members: ['a', 'c', 'y'], inset },
    ];
    const rows: Rows = [
      [node('a', 'g'), node('b'), node('c', 'g')],
      [node('x'), node('y', 'g'), node('z')],
    ];
    // Pulls b between a and c, and y away from them, if groups were ignored.
    const hops = hopsOf(['a', 'x'], ['b', 'y'], ['c', 'z']);
    const out = orderRows(rows, hops, { groups });
    expect(contiguous(out, groups)).toBe(true);
  });

  it('makes a seed that splits a group contiguous', () => {
    const groups: GraphGroup[] = [{ id: 'g', members: ['a', 'c'], inset }];
    const rows: Rows = [[node('a', 'g'), node('b'), node('c', 'g')]];
    expect(ids(orderRows(rows, [], { groups }))).toEqual([['a', 'c', 'b']]);
  });

  it('keeps a nested group contiguous inside its parent', () => {
    const groups: GraphGroup[] = [
      { id: 'outer', members: ['a', 'b', 'c', 'd'], inset },
      { id: 'inner', members: ['b', 'd'], inset, parent: 'outer' },
    ];
    const rows: Rows = [
      [node('p'), node('q'), node('r')],
      [node('a', 'outer'), node('b', 'inner'), node('e'), node('d', 'inner'), node('c', 'outer')],
    ];
    // e's neighbor sits between inner's and the rest of outer's, which would
    // split outer if inner sorted as outer's sibling.
    const hops = hopsOf(['p', 'b'], ['p', 'd'], ['q', 'e'], ['r', 'a'], ['r', 'c']);
    const out = orderRows(rows, hops, { groups });
    expect(contiguous(out, groups)).toBe(true);
  });

  it('keeps a placeholder inside its group’s run', () => {
    const ph = `${PLACEHOLDER}e0:1`;
    const groups: GraphGroup[] = [{ id: 'g', members: ['m'], inset }];
    const rows: Rows = [
      [node('p'), node('q'), node('r')],
      [node('m', 'g'), node('y'), node(ph, 'g')],
    ];
    // Without the group, the seed already has no crossings and y stays between.
    const hops = hopsOf(['p', 'm'], ['q', 'y'], ['r', ph]);
    const out = orderRows(rows, hops, { groups });
    expect(ids(out)[1]).toEqual(['m', ph, 'y']);
  });

  it('gives equal output for equal input and leaves the input alone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { rows, hops } = generated(seed);
      const before = ids(rows);
      const hopsBefore = hops.map((h) => ({ ...h }));
      const first = ids(orderRows(rows, hops));
      expect(ids(orderRows(rows, hops))).toEqual(first);
      expect(ids(rows)).toEqual(before);
      expect(hops).toEqual(hopsBefore);
    }
  });
});
