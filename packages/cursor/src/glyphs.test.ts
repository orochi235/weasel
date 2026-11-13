import { describe, expect, it } from 'vitest';
import { GLYPHS, MARKS } from './glyphs';
import { cursorGlyph } from './registry';
import { haloFitsInBox, rotationFitsInBox } from './types';

const NAMES = ['pencil', 'pen', 'eyedropper', 'brush', 'crosshair', 'resize', 'rotate'] as const;

/** Glyphs with a filled silhouette. `brush` is a bare ring and `crosshair` four arms: both measure or point rather
 *  than depict, so neither has a fill to assert. */
const SILHOUETTE = ['pencil', 'pen', 'eyedropper', 'resize', 'rotate'] as const;

/** Every glyph with a slot, with every mark: what a tool can ask for. */
const MARKED = (Object.keys(GLYPHS) as (keyof typeof GLYPHS)[])
  .filter((g) => 'mark' in GLYPHS[g])
  .flatMap((g) => (Object.keys(MARKS) as (keyof typeof MARKS)[]).map((m) => [g, m] as const));

/** The glyphs the affordance layer bakes at an angle. */
const ROTATABLE = ['resize', 'rotate'] as const;

describe('GLYPHS', () => {
  it('ships the arc 1 to arc 4 sets', () => {
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

  it.each(SILHOUETTE)('%s has at least one ink path', (name) => {
    expect(GLYPHS[name].paths.some((p) => p.role === 'ink')).toBe(true);
  });

  it('gives brush a radius, so a world-sized ring measures what it claims', () => {
    // Without it the painter falls back to the inscribed radius and every
    // brush cursor is drawn 21% too big, consistently enough to look correct.
    expect(GLYPHS.brush.radius).toBe(9.9);
  });

  it.each(ROTATABLE)('%s survives every rotation inside its viewBox', (name) => {
    // Bake rotates about the box centre without growing the viewBox, so a
    // glyph that only clears `haloFitsInBox` loses its corners at some angles
    // and not others.
    expect(rotationFitsInBox(GLYPHS[name])).toBe(true);
  });

  it.each(ROTATABLE)('%s hotspots at the box centre, so rotation cannot move it', (name) => {
    const g = GLYPHS[name];
    expect(g.hotspot).toEqual([g.box / 2, g.box / 2]);
  });

  it('gives the crosshair and the pen a mark slot', () => {
    expect(MARKED.map(([g]) => g)).toEqual(expect.arrayContaining(['crosshair', 'pen']));
  });

  it.each(MARKED)('%s with %s keeps its halo inside the viewBox', (glyph, mark) => {
    expect(haloFitsInBox(cursorGlyph(glyph, { mark }))).toBe(true);
  });

  it.each(MARKED)('%s with %s moves its hotspot with the glyph', (glyph, mark) => {
    const g = GLYPHS[glyph];
    const [sx, sy] = 'mark' in g ? g.mark.shift : [0, 0];
    expect(cursorGlyph(glyph, { mark }).hotspot).toEqual([g.hotspot[0] + sx, g.hotspot[1] + sy]);
  });

  it('refuses a mark on a glyph with no slot', () => {
    expect(() => cursorGlyph('pencil', { mark: 'add' })).toThrow(/no slot/);
  });
});
