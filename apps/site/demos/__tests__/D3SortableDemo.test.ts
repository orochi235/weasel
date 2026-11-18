import { describe, expect, it } from 'vitest';
import { INITIAL, sortItems } from '../D3SortableDemo';

describe('D3SortableDemo', () => {
  it('keeps the bars in their own order under "index", past bar-9', () => {
    expect(sortItems(INITIAL, 'index').map((d) => d.id)).toEqual(INITIAL.map((d) => d.id));
  });

});
