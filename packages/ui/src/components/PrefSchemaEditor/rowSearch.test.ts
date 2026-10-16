import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../Tree';
import { seekRows, soughtRow } from './rowSearch';

const ids = (nodes: readonly TreeNode[]): unknown[] => nodes.map((n) => (n.children ? [n.id, ids(n.children)] : n.id));

const ROWS: readonly TreeNode[] = [
  soughtRow({ id: 'view', label: 'View', children: [
    soughtRow({ id: 'view.grid', label: 'Show grid' }, { text: ['Show grid', 'grid'], tags: ['guides'] }),
    soughtRow({ id: 'view.snap', label: 'Snap' }, { text: ['Snap', 'snap'] }),
  ] }, { text: ['View', 'view'], tags: ['workspace'] }),
];

describe('seekRows', () => {
  it('keeps the rows whose text or tag answers the query, under the branches holding them', () => {
    expect(ids(seekRows(ROWS, 'GUIDE'))).toEqual([['view', ['view.grid']]]);
    expect(ids(seekRows(ROWS, 'snap'))).toEqual([['view', ['view.snap']]]);
  });

  it('keeps a whole branch its own tag answers', () => {
    expect(ids(seekRows(ROWS, 'workspace'))).toEqual([['view', ['view.grid', 'view.snap']]]);
  });

  it('is every row for an empty query, and none for one nothing answers', () => {
    expect(seekRows(ROWS, '  ')).toBe(ROWS);
    expect(seekRows(ROWS, 'zzz')).toEqual([]);
  });

  it('gives a row its search text as its type-ahead text', () => {
    expect(ROWS[0]!.children![0]!.textValue).toBe('Show grid grid');
  });
});
