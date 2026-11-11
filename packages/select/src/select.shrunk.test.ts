import { describe, expect, it } from 'vitest';
import { rangeOf, select, type Selection } from './select';

describe('select, shrunk', () => {
  it('hands back the state when pressing a NaN id it already holds alone', () => {
    const s: Selection<number> = { ids: [NaN], anchor: NaN };
    expect(select(s, NaN, 'replace')).toBe(s);
  });

  it('toggles a NaN id off', () => {
    expect(select({ ids: [NaN, 1], anchor: 1 }, NaN, 'toggle').ids).toEqual([1]);
  });

  it('finds a NaN end in the order a range walks', () => {
    expect(rangeOf([NaN, 1, 2], NaN, 2)).toEqual([NaN, 1, 2]);
  });
});
