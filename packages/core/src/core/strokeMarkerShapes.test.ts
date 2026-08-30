import { describe, it, expect } from 'vitest';
import { BUILTIN_MARKERS } from './strokeMarkerShapes';
import type { PolygonPath } from './geometry/path';

const byId = (id: string) => {
  const e = BUILTIN_MARKERS.find((m) => m.id === id);
  if (!e) throw new Error(`no built-in marker ${id}`);
  return e;
};
const ctx = { size: 1, stroke: { paint: { fill: 'solid', color: '#000' } } } as const;

describe('built-in marker geometry', () => {
  it('ships the whole documented vocabulary', () => {
    expect(BUILTIN_MARKERS.map((m) => m.id)).toEqual([
      'arrow', 'arrow-open', 'arrow-concave',
      'diamond', 'diamond-hollow', 'circle', 'square', 'bar',
    ]);
  });

  it('puts every leading edge exactly on the anchor', () => {
    for (const entry of BUILTIN_MARKERS) {
      const path = entry.path(ctx) as PolygonPath;
      let maxX = -Infinity;
      for (let i = 0; i < path.coords.length; i += 2) maxX = Math.max(maxX, path.coords[i]);
      // Geometry trails back along -X from the anchor: it reaches the anchor
      // and never passes it. Note this is not "some vertex sits at (0,0)" --
      // a square's anchor is the midpoint of its leading edge, not a corner.
      expect(maxX, `${entry.id} leading edge is not on the anchor`).toBeCloseTo(0, 6);
    }
  });

  it('gives closed heads an inset and open heads none', () => {
    expect(byId('arrow').inset).toBe(3);
    expect(byId('arrow-concave').inset).toBe(3);
    expect(byId('diamond').inset).toBe(4);
    expect(byId('diamond-hollow').inset).toBe(4);
    expect(byId('circle').inset).toBe(2);
    expect(byId('square').inset).toBe(2);
    expect(byId('arrow-open').inset ?? 0).toBe(0);
    expect(byId('bar').inset ?? 0).toBe(0);
  });

  it('outlines the open and hollow heads, fills the rest', () => {
    expect(byId('arrow-open').fill).toBe('none');
    expect(byId('arrow-open').outline).toMatchObject({ width: 1 });
    expect(byId('bar').fill).toBe('none');
    expect(byId('diamond-hollow').fill).toBe('none');
    expect(byId('diamond-hollow').outline).toMatchObject({ width: 0.5 });
    expect(byId('arrow').fill ?? 'line').toBe('line');
  });

  it('leaves an open head actually open', () => {
    // Each arm is `outline.width` thick, so a V whose back opening is no wider
    // than both arms together closes up and paints as a solid triangle — at
    // every stroke width, since marker units scale with the line. Invisible to
    // every other assertion here: the shape stays anchored, insets correctly
    // and reports the right paints while rendering as the wrong marker.
    const entry = byId('arrow-open');
    const path = entry.path(ctx) as PolygonPath;
    const n = path.coords.length;
    const opening = Math.hypot(
      path.coords[0] - path.coords[n - 2],
      path.coords[1] - path.coords[n - 1],
    );
    const armWidth = (entry.outline as { width: number }).width;
    expect(opening).toBeGreaterThan(armWidth * 2 + 0.5);
  });

  it('scales geometry with ctx.size', () => {
    const small = byId('arrow').path({ ...ctx, size: 1 }) as PolygonPath;
    const large = byId('arrow').path({ ...ctx, size: 4 }) as PolygonPath;
    for (let i = 0; i < small.coords.length; i++) {
      expect(large.coords[i]).toBeCloseTo(small.coords[i] * 4, 5);
    }
  });
});
