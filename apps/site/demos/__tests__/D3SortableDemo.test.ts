import { describe, expect, it } from 'vitest';
import { INITIAL, sortItems } from '../D3SortableDemo';

describe('D3SortableDemo', () => {
  it('keeps the bars in their own order under "index", past bar-9', () => {
    expect(sortItems(INITIAL, 'index').map((d) => d.id)).toEqual(INITIAL.map((d) => d.id));
  });

  it('starts out of order, so every order but "index" moves a bar', () => {
    const ids = (key: 'index' | 'asc' | 'desc') => sortItems(INITIAL, key).map((d) => d.id).join();
    expect(ids('asc')).not.toBe(ids('index'));
    expect(ids('desc')).not.toBe(ids('index'));
    expect(sortItems(INITIAL, 'asc').map((d) => d.value)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});
