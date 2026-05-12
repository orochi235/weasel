import { describe, it, expect } from 'vitest';
import { schneiderFit } from './schneiderFit';
import { PATH_C, PATH_M, type PolygonPath } from './types';

describe('schneiderFit — degenerate inputs', () => {
  it('returns an empty polygon path when samples is empty', () => {
    const out = schneiderFit([], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(out.commands.length).toBe(0);
    expect(out.coords.length).toBe(0);
  });

  it('returns a single-anchor path when samples has one point', () => {
    const out = schneiderFit([{ x: 5, y: 5 }], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(Array.from(out.commands)).toEqual([PATH_M]);
    expect(Array.from(out.coords)).toEqual([5, 5]);
  });

  it('returns a degenerate cubic when samples has exactly two points', () => {
    const out = schneiderFit([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    // M (0,0) + C (cp1, cp2, end)
    expect(Array.from(out.commands)).toEqual([PATH_M, PATH_C]);
    expect(out.coords[0]).toBe(0);
    expect(out.coords[1]).toBe(0);
    // end of cubic is the last sample
    expect(out.coords[6]).toBe(10);
    expect(out.coords[7]).toBe(0);
  });
});
