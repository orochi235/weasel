import { describe, it, expect } from 'vitest';
import { BUILTIN_MARKERS } from './strokeMarkerShapes';
import { PATH_M, type PolygonPath } from '@weasel-js/geom';

const byId = (id: string) => {
  const e = BUILTIN_MARKERS.find((m) => m.id === id);
  if (!e) throw new Error(`no built-in marker ${id}`);
  return e;
};
const ctx = { size: 1, stroke: { paint: { kind: 'solid', color: '#000' } } } as const;

describe('built-in marker geometry', () => {
  it('ships the whole documented vocabulary', () => {
    expect(BUILTIN_MARKERS.map((m) => m.id)).toEqual([
      'arrow', 'arrow-open', 'arrow-concave', 'triangle-hollow',
      'diamond', 'diamond-hollow', 'circle', 'square', 'bar', 'dot',
      'crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many',
    ]);
  });

  it('puts every terminator\'s leading edge exactly on the anchor', () => {
    for (const entry of BUILTIN_MARKERS.filter((m) => m.id !== 'dot')) {
      const path = entry.path(ctx) as PolygonPath;
      let maxX = -Infinity;
      for (let i = 0; i < path.coords.length; i += 2) maxX = Math.max(maxX, path.coords[i]);
      // Geometry trails back along -X from the anchor: it reaches the anchor
      // and never passes it. Note this is not "some vertex sits at (0,0)" --
      // a square's anchor is the midpoint of its leading edge, not a corner.
      expect(maxX, `${entry.id} leading edge is not on the anchor`).toBeCloseTo(0, 6);
    }
  });

  it('centers the dot on its anchor and runs the line to it', () => {
    const xs = [...(byId('dot').path(ctx) as PolygonPath).coords].filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 6);
    expect(byId('dot').inset ?? 0).toBe(0);
  });

  it('gives closed heads an inset and open heads none', () => {
    expect(byId('arrow').inset).toBe(3);
    expect(byId('arrow-concave').inset).toBe(3);
    expect(byId('diamond').inset).toBe(4);
    expect(byId('diamond-hollow').inset).toBe(4);
    expect(byId('triangle-hollow').inset).toBe(4);
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
    expect(byId('triangle-hollow').fill).toBe('none');
    expect(byId('triangle-hollow').outline).toMatchObject({ width: 0.5 });
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

  describe('crow\'s feet', () => {
    const CROWS = ['crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many'];
    const subpathsOf = (path: PolygonPath) => [...path.commands].filter((c) => c === PATH_M).length;
    const xs = (path: PolygonPath) => [...path.coords].filter((_, i) => i % 2 === 0);

    it('draws open strokes as thick as the line, filling nothing', () => {
      for (const id of CROWS) {
        expect(byId(id).fill, id).toBe('none');
        expect(byId(id).outline, id).toMatchObject({ width: 1 });
      }
    });

    it('builds each from its parts', () => {
      // Bars and prongs are one subpath each; a zero adds its circle and the run to the anchor.
      expect(subpathsOf(byId('crow-one').path(ctx) as PolygonPath)).toBe(3);
      expect(subpathsOf(byId('crow-many').path(ctx) as PolygonPath)).toBe(2);
      expect(subpathsOf(byId('crow-zero-one').path(ctx) as PolygonPath)).toBe(3);
      expect(subpathsOf(byId('crow-one-many').path(ctx) as PolygonPath)).toBe(3);
      expect(subpathsOf(byId('crow-zero-many').path(ctx) as PolygonPath)).toBe(4);
    });

    it('stops the line at a zero\'s back, so the circle stays hollow', () => {
      for (const id of ['crow-zero-one', 'crow-zero-many']) {
        const back = Math.min(...xs(byId(id).path(ctx) as PolygonPath));
        expect(byId(id).inset, id).toBeCloseTo(-back, 3);
      }
    });

    it('leaves the line running through the heads with no zero', () => {
      for (const id of ['crow-one', 'crow-many', 'crow-one-many']) expect(byId(id).inset ?? 0, id).toBe(0);
    });

    it('opens the foot wider at the anchor than both prongs are thick', () => {
      const path = byId('crow-many').path(ctx) as PolygonPath;
      const ys = [...path.coords].filter((_, i) => i % 2 === 1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2 + 0.5);
    });
  });
});
