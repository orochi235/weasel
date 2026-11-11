import { describe, expect, it } from 'vitest';
import { placeCursorPath } from './mark';
import { haloFitsInBox, rotationFitsInBox, type CursorGlyph } from './types';

const ink = (box: number, d: string): CursorGlyph => ({ box, hotspot: [0, 0], paths: [{ role: 'ink', d }] });

describe('the fit guards, shrunk', () => {
  it('read a number with an exponent, where its `e` read as a relative command and threw', () => {
    expect(haloFitsInBox(ink(8, 'M 24e-1 2.4 Z'))).toBe(true);
    expect(rotationFitsInBox(ink(8, 'M 40e-1 40e-1 Z'))).toBe(true);
  });

  it('read `.5` as a half, where it read as 5 and passed a point on the edge', () => {
    expect(haloFitsInBox(ink(24, 'M .5 .5 L 12 12 Z'))).toBe(false);
  });
});

describe('placeCursorPath, shrunk', () => {
  it('refuses a NaN move with a RangeError, where it wrote `M NaN 0`', () => {
    expect(() => placeCursorPath('M 1 2 L 3 4 Z', 0, Number.NaN, 0)).toThrow(RangeError);
  });

  it('writes a coordinate past 1e306 as itself, where its hundredths overflowed to `Infinity`', () => {
    const out = placeCursorPath('M 1 2', 1e307, 0, 0);
    expect(out).toBe('M 1e+307 2e+307');
    expect(placeCursorPath(out, 1, 0, 0)).toBe(out);
  });
});
