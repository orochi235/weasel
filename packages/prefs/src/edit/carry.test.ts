import { describe, expect, it } from 'vitest';
import { carry } from './carry';

const FROM = { name: 'Root', children: { a: { name: 'A', min: 0 }, b: { name: 'B' }, c: { name: 'C' } } };

describe('carrying edits onto a changed source', () => {
  it('takes the source’s changes where the reader made none', () => {
    const to = { name: 'Root', children: { a: { name: 'A', min: 0.2, note: 'new' }, b: { name: 'B' }, c: { name: 'C' }, d: { name: 'D' } } };
    expect(carry(FROM, FROM, to)).toEqual(to);
  });

  it('keeps what the reader changed beside what the source changed, attribute by attribute', () => {
    const mine = { name: 'Root', children: { a: { name: 'Mine', min: 0 }, b: { name: 'B' }, c: { name: 'C' } } };
    const to = { name: 'Root', children: { a: { name: 'A', min: 0.2 }, b: { name: 'B' }, c: { name: 'C' } } };
    expect(carry(mine, FROM, to)).toEqual({ name: 'Root', children: { a: { name: 'Mine', min: 0.2 }, b: { name: 'B' }, c: { name: 'C' } } });
  });

  it('sets what the reader added after the neighbour it followed, among what the source added', () => {
    const mine = { name: 'Root', children: { a: { name: 'A', min: 0 }, mine: { name: 'New' }, b: { name: 'B' }, c: { name: 'C' } } };
    const to = { name: 'Root', children: { a: { name: 'A', min: 0 }, theirs: { name: 'T' }, b: { name: 'B' }, c: { name: 'C' } } };
    const out = carry(mine, FROM, to) as typeof mine;
    expect(Object.keys(out.children)).toEqual(['a', 'mine', 'theirs', 'b', 'c']);
  });

  it('leaves out what the reader removed, and what the source removed untouched by the reader', () => {
    const mine = { name: 'Root', children: { a: { name: 'A', min: 0 }, c: { name: 'C' } } };
    const to = { name: 'Root', children: { a: { name: 'A', min: 0 }, b: { name: 'B' } } };
    expect(carry(mine, FROM, to)).toEqual({ name: 'Root', children: { a: { name: 'A', min: 0 } } });
  });

  it('keeps a node the source removed when the reader had changed it', () => {
    const mine = { name: 'Root', children: { a: { name: 'A', min: 0 }, b: { name: 'Mine' }, c: { name: 'C' } } };
    const to = { name: 'Root', children: { a: { name: 'A', min: 0 }, c: { name: 'C' } } };
    expect(Object.keys((carry(mine, FROM, to) as typeof mine).children)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the reader’s order when the reader reordered, with what the source added at the end', () => {
    const mine = { name: 'Root', children: { c: { name: 'C' }, a: { name: 'A', min: 0 }, b: { name: 'B' } } };
    const to = { name: 'Root', children: { a: { name: 'A', min: 0.2 }, b: { name: 'B' }, c: { name: 'C' }, d: { name: 'D' } } };
    const out = carry(mine, FROM, to) as typeof to;
    expect(Object.keys(out.children)).toEqual(['c', 'a', 'b', 'd']);
    expect(out.children.a.min).toBe(0.2);
  });

  it('takes a list whole from whichever side changed it', () => {
    expect(carry({ o: [1, 2] }, { o: [1, 2] }, { o: [1, 2, 3] })).toEqual({ o: [1, 2, 3] });
    expect(carry({ o: [2, 1] }, { o: [1, 2] }, { o: [1, 2, 3] })).toEqual({ o: [2, 1] });
  });
});
