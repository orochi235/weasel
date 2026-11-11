import { describe, expect, it } from 'vitest';
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
