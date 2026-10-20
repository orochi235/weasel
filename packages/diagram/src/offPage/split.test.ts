import { describe, expect, it } from 'vitest';
import { layoutPages } from '@weasel-js/core';
import { nextOffPageRef, offPageSplits } from './split';

// Two 200 by 100 pages side by side, 40 apart: p1 spans x 0..200, p2 x 240..440.
const PAGES = layoutPages([{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }]);
const at = (x: number, y = 20, width = 40, height = 30) => ({ x, y, width, height });

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
    const out = offPageSplits({
      pages: PAGES,
      edges: [{ id: 'across', from: at(20), to: at(300) }, { id: 'within', from: at(20), to: at(120) }],
    });
    expect(out.get('across')).toEqual({ ref: 'A', from: 'p1', to: 'p2' });
    expect(out.get('within')).toBeNull();
  });

  it('puts an end on the page it overlaps most', () => {
    // 30 of its 40 width on p1, 10 in the gap.
    const out = offPageSplits({ pages: PAGES, edges: [{ id: 'e', from: at(170), to: at(300) }] });
    expect(out.get('e')).toMatchObject({ from: 'p1', to: 'p2' });
  });

  it('never splits an edge with an end in the gap between pages', () => {
    const out = offPageSplits({ pages: PAGES, edges: [{ id: 'e', from: at(205, 20, 30), to: at(300) }] });
    expect(out.get('e')).toBeNull();
  });

  it('keeps a split edge\'s ref while it stays split, even onto another page', () => {
    const pages = layoutPages([...PAGES, { id: 'p3', width: 200, height: 100 }]);
    const out = offPageSplits({
      pages,
      edges: [{ id: 'e', from: at(20), to: at(540), offPage: { ref: 'C', from: 'p1', to: 'p2' } }],
    });
    expect(out.get('e')).toEqual({ ref: 'C', from: 'p1', to: 'p3' });
  });

  it('gives each new split the next ref free of `used` and of the ones it hands out', () => {
    const out = offPageSplits({
      pages: PAGES,
      used: ['A'],
      edges: [
        { id: 'kept', from: at(20), to: at(300), offPage: { ref: 'B', from: 'p1', to: 'p2' } },
        { id: 'new1', from: at(20), to: at(300) },
        { id: 'new2', from: at(300), to: at(20) },
      ],
    });
    expect([...out.values()].map((s) => s?.ref)).toEqual(['B', 'C', 'D']);
    expect(out.get('new2')).toMatchObject({ from: 'p2', to: 'p1' });
  });

  it('gives a second edge holding a taken ref, a pasted copy, a ref of its own', () => {
    const split = { ref: 'A', from: 'p1', to: 'p2' };
    const out = offPageSplits({
      pages: PAGES,
      edges: [{ id: 'one', from: at(20), to: at(300), offPage: split }, { id: 'copy', from: at(20), to: at(300), offPage: split }],
    });
    expect(out.get('one')?.ref).toBe('A');
    expect(out.get('copy')?.ref).toBe('B');
  });

  it('splits nothing without pages', () => {
    expect(offPageSplits({ pages: [], edges: [{ id: 'e', from: at(20), to: at(300) }] }).get('e')).toBeNull();
  });
});
