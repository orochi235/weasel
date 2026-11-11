import { describe, expect, it } from 'vitest';
import type { ForceBody } from './force';
import { separateGroups } from './forceGroups';

const point = (id: string): ForceBody => ({ id, x: 0, y: 0, hw: 0, hh: 0, vx: 0, vy: 0 });

describe('separateGroups, shrunk', () => {
  it('pushes an outsider inside a group\'s box past its far edge, padding and all', () => {
    const e = point('e');
    const o = point('o');
    separateGroups([{ id: 'H', members: ['e'], inset: { top: 1, right: 0, bottom: 1, left: 0 } }], [o], new Map([['e', e], ['o', o]]), 1)(1);
    // H's box is the segment x = 0, y -1 to 1, with o at its middle: 1 across clears it by the padding, where
    // pushing by the overlap along y left o on its edge.
    expect([o.vx! - e.vx!, o.vy! - e.vy!]).toEqual([1, 0]);
  });
});
