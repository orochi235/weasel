import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { anchorIndexUnder } from './anchorUnder';

describe('anchorIndexUnder', () => {
  const path = pathFromD('M0 0 L100 0 L100 100 Z');

  it('measures its reach on screen when the view scales its axes apart', () => {
    // x at 1 px per unit, y at 4: 3 world units up is 12 px on screen, past a 10 px reach.
    expect(anchorIndexUnder(path, { x: 0, y: 3 }, 10, { x: 1, y: 4 })).toBe(-1);
    expect(anchorIndexUnder(path, { x: 0, y: 2 }, 10, { x: 1, y: 4 })).toBe(0);
    expect(anchorIndexUnder(path, { x: 9, y: 0 }, 10, { x: 1, y: 4 })).toBe(0);
  });

  it('counts a world unit as a pixel with no scale', () => {
    expect(anchorIndexUnder(path, { x: 100, y: 7 }, 10)).toBe(1);
    expect(anchorIndexUnder(path, { x: 100, y: 11 }, 10)).toBe(-1);
  });
});
