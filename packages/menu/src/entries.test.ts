import { describe, expect, it } from 'vitest';
import { entriesAt, isRow, type MenuEntry } from './entries';

const run = () => {};
const root: MenuEntry[] = [
  { kind: 'item', key: 'a', label: 'A', run },
  { kind: 'separator', key: 's' },
  { kind: 'submenu', key: 'b', label: 'B', entries: [{ kind: 'item', key: 'b1', label: 'B1', run }] },
];

describe('entries', () => {
  it('tells rows from separators', () => {
    expect(root.map(isRow)).toEqual([true, false, true]);
  });
  it('walks the stack to a level', () => {
    expect(entriesAt(root, [2, null], 0)).toBe(root);
    expect(entriesAt(root, [2, null], 1).map((e) => e.key)).toEqual(['b1']);
  });
  it('returns nothing for a level whose parent is not a submenu', () => {
    expect(entriesAt(root, [0, null], 1)).toEqual([]);
  });
});
