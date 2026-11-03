import { describe, expect, it } from 'vitest';
import { nextOffPageRef, offPageSplits } from './split';

const edge = (id: string, fromPage: string | null, toPage: string | null, offPage?: { ref: string; from: string; to: string }) =>
  ({ id, fromPage, toPage, ...(offPage ? { offPage } : {}) });

describe('nextOffPageRef', () => {
  it('gives the first letter none of `used` holds, then two letters past Z', () => {
    expect(nextOffPageRef(new Set())).toBe('A');
    expect(nextOffPageRef(new Set(['A', 'C']))).toBe('B');
    const all = new Set(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)));
    expect(nextOffPageRef(all)).toBe('AA');
    expect(nextOffPageRef(new Set([...all, 'AA']))).toBe('AB');
  });
});

describe('offPageSplits', () => {
  it('splits an edge whose ends sit on different pages, and leaves one on a single page whole', () => {
    const out = offPageSplits({ edges: [edge('across', 'p1', 'p2'), edge('within', 'p1', 'p1')] });
    expect(out.get('across')).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(out.get('within')).toBeNull();
  });

  it('never splits an edge with an end on no page', () => {
    const out = offPageSplits({ edges: [edge('e', null, 'p2'), edge('f', 'p1', null)] });
    expect(out.get('e')).toBeNull();
    expect(out.get('f')).toBeNull();
  });

  it('keeps a split edge\'s ref while it stays split, even onto another page', () => {
    const out = offPageSplits({ edges: [edge('e', 'p1', 'p3', { ref: 'C', from: 'p1', to: 'p2' })] });
    expect(out.get('e')).toEqual({ ref: 'C', from: 'p1', to: 'p3' });
  });

  it('gives each new split the next ref free of `used` and of the ones it hands out', () => {
    const out = offPageSplits({
      used: ['A'],
      edges: [edge('kept', 'p1', 'p2', { ref: 'B', from: 'p1', to: 'p2' }), edge('new1', 'p1', 'p2'), edge('new2', 'p2', 'p1')],
    });
    expect([...out.values()].map((s) => s?.ref)).toEqual(['B', 'C', 'D']);
    expect(out.get('new2')).toMatchObject({ from: 'p2', to: 'p1' });
  });

  it('gives a second edge holding a taken ref, a pasted copy, a ref of its own', () => {
    const split = { ref: 'A', from: 'p1', to: 'p2' };
    const out = offPageSplits({ edges: [edge('one', 'p1', 'p2', split), edge('copy', 'p1', 'p2', split)] });
    expect(out.get('one')?.ref).toBe('A');
    expect(out.get('copy')?.ref).toBe('B');
  });
});
