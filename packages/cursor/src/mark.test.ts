import { describe, expect, it } from 'vitest';
import { markedGlyph, placeCursorPath } from './mark';
import { cursorPaintOps } from './paint';
import { CURSOR_HALO, CURSOR_INK } from './types';
import type { CursorGlyph, CursorMark } from './types';

const BASE: CursorGlyph = {
  box: 24,
  hotspot: [12, 12],
  mark: { x: 18, y: 18, size: 6, shift: [-2, -1] },
  paths: [{ role: 'ink', d: 'M 4 4 L 12 4 L 12 12 Z' }],
};
const DOT: CursorMark = { box: 10, paths: [{ role: 'stroke', d: 'M 5 2 L 5 8', width: 2 }] };

describe('placeCursorPath', () => {
  it('scales and moves lines and arcs, radii by the scale alone', () => {
    expect(placeCursorPath('M 1 2 L 3 4 Z', 2, 10, 20)).toBe('M 12 24 L 16 28 Z');
    expect(placeCursorPath('M 0 0 A 3 3 0 1 0 6 0', 2, 1, 1)).toBe('M 1 1 A 6 6 0 1 0 13 1');
  });

  it('refuses a command it would misplace', () => {
    expect(() => placeCursorPath('M 0 0 l 1 1', 1, 0, 0)).toThrow(/'l'/);
  });

  it('reads numbers written without a leading digit or with an exponent', () => {
    expect(placeCursorPath('M.5 1.5.5 2L1e1 -2', 2, 0, 0)).toBe('M 1 3 1 4 L 20 -4');
  });

  it('refuses numbers it cannot read as whole points, rather than drop or merge one', () => {
    expect(() => placeCursorPath('M 1 2 3', 1, 0, 0)).toThrow(/3 numbers/);
    expect(() => placeCursorPath('M 0 0 A 5 5 0 0 1 5', 1, 0, 0)).toThrow(/'A'/);
  });

  it("reads an arc's flags as SVG does, each one digit needing no separator", () => {
    expect(placeCursorPath('M 0 0 A 5 5 0 015 5', 1, 0, 0)).toBe('M 0 0 A 5 5 0 0 1 5 5');
  });
});

describe('markedGlyph', () => {
  it('moves the glyph and its hotspot by the shift, and scales the mark into the slot', () => {
    const g = markedGlyph(BASE, DOT);
    expect(g.hotspot).toEqual([10, 11]);
    expect(g.paths[0]!.d).toBe('M 2 3 L 10 3 L 10 11 Z');
    // A 10 box into a slot of 6 centered at (18, 18): (5, 2)..(5, 8) lands at (18, 16.2)..(18, 19.8).
    expect(g.over).toEqual([{ role: 'stroke', d: 'M 18 16.2 L 18 19.8', width: 1.2 }]);
    expect(g.mark).toBeUndefined();
  });

  it('draws the mark after the glyph, its halo over the glyph\'s ink', () => {
    const ops = cursorPaintOps(markedGlyph(BASE, DOT));
    expect(ops.map((o) => o.fill ?? o.stroke?.color)).toEqual([CURSOR_HALO, CURSOR_INK, CURSOR_HALO, CURSOR_INK]);
  });
});
