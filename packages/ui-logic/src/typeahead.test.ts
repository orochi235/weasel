import { describe, expect, it } from 'vitest';
import { EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS, typeaheadMatch, typeaheadStep } from './typeahead';

const names = ['Copy', 'Cut', '—', 'Clear'];
const shape = { label: (s: string) => s, canStop: (s: string) => s !== '—' };

describe('typeaheadMatch', () => {
  it('finds the next item starting with one letter, after the highlight, with wrap', () => {
    expect(typeaheadMatch(names, 0, 'c', shape)).toBe(1);
    expect(typeaheadMatch(names, 1, 'c', shape)).toBe(3);
    expect(typeaheadMatch(names, 3, 'c', shape)).toBe(0);
  });
  it('matches a longer query from the highlight itself', () => {
    expect(typeaheadMatch(names, 1, 'cu', shape)).toBe(1);
  });
  it('never lands on an item that is not a stop', () => {
    expect(typeaheadMatch(names, null, '—', shape)).toBeNull();
    expect(typeaheadMatch(names, null, '—', { label: (s: string) => s })).toBe(2);
  });
});

describe('typeaheadStep', () => {
  it('builds a prefix while keys come quickly, and starts over after a pause', () => {
    const a = typeaheadStep(names, null, EMPTY_TYPEAHEAD, 'c', 0, shape);
    const b = typeaheadStep(names, a.hit, a.buffer, 'l', 100, shape);
    expect(b).toEqual({ buffer: { text: 'cl', at: 100 }, hit: 3 });
    const c = typeaheadStep(names, b.hit, b.buffer, 'c', 100 + TYPEAHEAD_RESET_MS, shape);
    expect(c.buffer.text).toBe('c');
  });
  it('cycles on a repeated letter', () => {
    const a = typeaheadStep(names, 0, EMPTY_TYPEAHEAD, 'c', 0, shape);
    const b = typeaheadStep(names, a.hit, a.buffer, 'c', 10, shape);
    expect([a.hit, b.hit, b.buffer.text]).toEqual([1, 3, 'c']);
  });
  it('takes its own reset window', () => {
    const a = typeaheadStep(names, null, EMPTY_TYPEAHEAD, 'c', 0, shape, 2000);
    expect(typeaheadStep(names, a.hit, a.buffer, 'l', 1000, shape, 2000).buffer.text).toBe('cl');
  });
});
