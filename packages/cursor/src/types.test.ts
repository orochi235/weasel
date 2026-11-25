import { describe, expect, it } from 'vitest';
import { haloFitsInBox, rotationFitsInBox } from './types';
import type { CursorGlyph } from './types';

const glyph = (box: number, d: string): CursorGlyph => ({
  box,
  hotspot: [0, 0],
  paths: [{ role: 'ink', d }],
});

describe('haloFitsInBox', () => {
  it('accepts ink inset by more than half the halo stroke', () => {
    // Half of 2.6 is 1.3; this square sits 2 units off every edge.
    expect(haloFitsInBox(glyph(24, 'M 2 2 L 22 2 L 22 22 L 2 22 Z'))).toBe(true);
  });

  it('rejects ink whose halo would be clipped by the viewBox', () => {
    // Flush with the edge: the outer 1.3 units of halo fall outside the box.
    expect(haloFitsInBox(glyph(24, 'M 0 0 L 24 0 L 24 24 L 0 24 Z'))).toBe(false);
  });

  it('reads an arc by its radii, not by its flags', () => {
    // The naive version scraped every number out of `d`, so the rotation and
    // the two 0/1 flags read as coordinates and every arc failed at once.
    const disc = 'M 12 8.8 A 3.2 3.2 0 1 0 12 15.2 A 3.2 3.2 0 1 0 12 8.8 Z';
    expect(haloFitsInBox(glyph(24, disc))).toBe(true);
  });

  it('bounds an arc by its true extent, not just its endpoints', () => {
    // Endpoints sit at x=21 (inside), but the disc reaches x=24.2.
    const offRight = 'M 21 8.8 A 3.2 3.2 0 1 0 21 15.2 A 3.2 3.2 0 1 0 21 8.8 Z';
    expect(haloFitsInBox(glyph(24, offRight))).toBe(false);
  });

  it('refuses a relative command rather than mismeasuring it', () => {
    expect(() => haloFitsInBox(glyph(24, 'M 5 5 l 6 6 Z'))).toThrow(/relative/);
  });
});

describe('rotationFitsInBox', () => {
  it('measures an arc by its circle, not by the corners of its bounding square', () => {
    // A centered ring of radius 9 reaches 10.3 with its halo, inside the 12 of the inscribed circle at every angle.
    expect(rotationFitsInBox(glyph(24, 'M 12 3 A 9 9 0 1 0 12 21 A 9 9 0 1 0 12 3 Z'))).toBe(true);
    expect(rotationFitsInBox(glyph(24, 'M 12 1 A 11 11 0 1 0 12 23 A 11 11 0 1 0 12 1 Z'))).toBe(false);
  });
});

describe('the fit guards’ reach', () => {
  const stroked = (d: string, width: number): CursorGlyph => ({ box: 24, hotspot: [0, 0], paths: [{ role: 'stroke', d, width }] });

  it("hold a stroke's halo, half its own width past the halo's, inside the box", () => {
    // A 2.8-wide stroke's halo reaches 2.7 past its end, so an end at 1.5 is clipped by 1.2.
    expect(haloFitsInBox(stroked('M 1.5 12 L 12 12', 2.8))).toBe(false);
    expect(haloFitsInBox(stroked('M 2.7 12 L 12 12', 2.8))).toBe(true);
    expect(rotationFitsInBox(stroked('M 2.5 12 L 12 12', 2.8))).toBe(false);
    expect(rotationFitsInBox(stroked('M 2.7 12 L 12 12', 2.8))).toBe(true);
  });

  it('hold a detail, which has no halo, to its own half width', () => {
    const detail: CursorGlyph = { box: 24, hotspot: [0, 0], paths: [{ role: 'detail', d: 'M 0.5 12 L 12 12', width: 1 }] };
    expect(haloFitsInBox(detail)).toBe(true);
  });
});

describe('the fit guards’ dialect', () => {
  it('refuses an absolute command outside M, L, A and Z rather than skipping it', () => {
    // `H 23.5` reaches past the margin; read as pairs it visits no point at all.
    expect(() => haloFitsInBox(glyph(24, 'M 12 12 H 23.5 V 12 Z'))).toThrow(/'H'/);
    expect(() => haloFitsInBox(glyph(24, 'M 2 2 C 4 4 6 6 8 8 Z'))).toThrow(/'C'/);
  });

  it('refuses a command whose numbers are not whole points', () => {
    expect(() => haloFitsInBox(glyph(24, 'M 2 2 L 3 Z'))).toThrow(/whole points/);
  });

  it('refuses an elliptical arc, whose bounds a circle does not give', () => {
    expect(() => haloFitsInBox(glyph(24, 'M 2 12 A 100 0.1 0 0 1 2 14 Z'))).toThrow(/elliptical/);
  });
});
