import { describe, expect, it } from 'vitest';
import { cursorFor, GLYPHS } from '@weasel-js/cursor';

const SHAPE_GLYPHS = [
  'crosshairRect', 'crosshairEllipse', 'crosshairLine', 'crosshairStar', 'crosshairPolygon',
] as const;

/**
 * jsdom has no cursor, so nothing here can prove anything rendered. These
 * assert the string the tool hands the host, which is the last thing on this
 * side of the boundary that is ours to get right.
 */
describe('builtin tool cursors', () => {
  it('gives the pencil tool a pencil, falling back to crosshair', () => {
    const css = cursorFor('pencil', { fallback: 'crosshair' });
    expect(css).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(css).toMatch(/, crosshair$/);
  });

  it('keeps a keyword available for the pen tool while it hints a close', () => {
    // usePenTool swaps to 'pointer' when closing the subpath is the next click;
    // that hint is about routing, not about the tool, so it stays a keyword.
    expect(cursorFor('pen', { fallback: 'crosshair' })).not.toBe('pointer');
  });

  it('declares a hotspot on every tool cursor', () => {
    // A cursor with no hotspot silently acts from its top-left corner.
    for (const name of ['pencil', 'pen', 'eyedropper'] as const) {
      expect(cursorFor(name)).toMatch(/"\) \d+ \d+, /);
    }
  });

  it('gives the five shape tools cursors that differ from each other', () => {
    // They were all bare 'crosshair', so the tool you had selected was not
    // readable from the pointer. Distinct strings is the most this side of
    // the boundary can check; the badges are proofed at pixel size instead.
    const css = SHAPE_GLYPHS.map((g) => cursorFor(g, { fallback: 'crosshair' }));
    expect(new Set(css).size).toBe(SHAPE_GLYPHS.length);
    for (const c of css) expect(c).toMatch(/, crosshair$/);
  });

  it('hotspots every shape cursor on the crosshair, not on the badge', () => {
    // The badge names the tool; the cross is what you aim with. A hotspot in
    // the badge would insert shapes offset from the pointer by a third of the
    // glyph, consistently enough to read as a calibration problem.
    for (const g of SHAPE_GLYPHS) {
      expect(GLYPHS[g].hotspot).toEqual([9, 9]);
    }
  });
});
