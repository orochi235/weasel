import { describe, expect, it } from 'vitest';
import { CURSOR_HALO_WIDTH, haloFitsInBox } from './types';
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

  it('exposes the halo width the check is derived from', () => {
    expect(CURSOR_HALO_WIDTH).toBe(2.6);
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
