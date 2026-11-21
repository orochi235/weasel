import { describe, expect, it } from 'vitest';
import { sortedRows } from './rowSort';

interface Row { id: string; v: string | number | null }
const rows = (vs: readonly (string | number | null)[]): Row[] => vs.map((v, i) => ({ id: `r${i}`, v }));
const order = (vs: readonly (string | number | null)[], direction: 'asc' | 'desc' = 'asc') =>
  sortedRows(rows(vs), [{ id: 'v', header: 'V' }], { columnId: 'v', direction }).map((r) => r.v);

describe('sortedRows', () => {
  it('sorts text the way a reader does: by letter regardless of case, and digit runs as numbers', () => {
    expect(order(['cherry', 'Banana', 'apple'])).toEqual(['apple', 'Banana', 'cherry']);
    expect(order(['item10', 'item2'])).toEqual(['item2', 'item10']);
    expect(order(['zebra', 'été'])).toEqual(['été', 'zebra']);
  });

  it('puts numbers before text, whatever order the rows come in', () => {
    expect(order([5, '—', 3, null, 1])).toEqual([1, 3, 5, '—', null]);
    expect(order(['—', 1, 5, 3])).toEqual([1, 3, 5, '—']);
    expect(order([3, '—', 1], 'desc')).toEqual(['—', 3, 1]);
  });
});
