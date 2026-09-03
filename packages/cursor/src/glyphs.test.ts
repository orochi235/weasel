import { describe, expect, it } from 'vitest';
import { GLYPHS } from './glyphs';
import { haloFitsInBox } from './types';

const NAMES = ['pencil', 'pen', 'eyedropper'] as const;

describe('GLYPHS', () => {
  it('ships the arc 1 set', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s keeps its halo inside the viewBox', (name) => {
    expect(haloFitsInBox(GLYPHS[name])).toBe(true);
  });

  it.each(NAMES)('%s puts its hotspot on the glyph, not at the origin', (name) => {
    // A forgotten hotspot defaults to (0,0) and the cursor points a full glyph
    // away from where it acts — the failure is obvious in use and invisible here
    // unless asserted.
    const [x, y] = GLYPHS[name].hotspot;
    expect(x + y).toBeGreaterThan(0);
    expect(x).toBeLessThanOrEqual(GLYPHS[name].box);
    expect(y).toBeLessThanOrEqual(GLYPHS[name].box);
  });

  it.each(NAMES)('%s has at least one ink path', (name) => {
    expect(GLYPHS[name].paths.some((p) => p.role === 'ink')).toBe(true);
  });
});
