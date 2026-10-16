import { describe, expect, it } from 'vitest';
import { typeaheadMatch } from './typeahead';
import type { MenuEntry } from './entries';

const run = () => {};
const rows: MenuEntry[] = [
  { kind: 'item', key: 'a', label: 'Copy', run },
  { kind: 'item', key: 'b', label: 'Cut', run },
  { kind: 'separator', key: 's' },
  { kind: 'item', key: 'c', label: 'Clear', run },
];

describe('typeaheadMatch', () => {
  it('finds the next row starting with one letter, after the highlight', () => {
    expect(typeaheadMatch(rows, 0, 'c')).toBe(1);
    expect(typeaheadMatch(rows, 1, 'c')).toBe(3);
  });
  it('wraps', () => {
    expect(typeaheadMatch(rows, 3, 'c')).toBe(0);
  });
  it('matches a longer query from the highlight itself', () => {
    expect(typeaheadMatch(rows, 1, 'cu')).toBe(1);
    expect(typeaheadMatch(rows, 0, 'cl')).toBe(3);
  });
  it('ignores case and returns null on no match', () => {
    expect(typeaheadMatch(rows, null, 'CO')).toBe(0);
    expect(typeaheadMatch(rows, null, 'z')).toBeNull();
  });
});
