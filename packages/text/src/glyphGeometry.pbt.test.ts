/**
 * Glyph geometry laws: a turn is a unit rotation that composes, a placed glyph is its em outline under the
 * renderer's affine, synthetic italic is a shear about the baseline, and synthetic bold grows an outline by
 * exactly the field shift each side.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ResolveResult } from '@weasel-js/font';
import { syntheticBoldGrowth } from '@weasel-js/font';
import { boundsOfPath, pathFromD, pathSignedArea, pathToCubicContours, pointInPath, type PolygonPath } from '@weasel-js/geom';
import { glyphTurn } from './glyphTurn';
import { glyphOutlineAt } from './glyphOutlines';
import { emboldenGlyph, syntheticBoldOffset } from './syntheticBold';
import { SYNTHETIC_ITALIC_RADIANS } from './syntheticItalic';
import type { PlacedGlyph } from './layout/layoutRuns';
import { registerPropertyFont, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

beforeAll(registerPropertyFont);

const angle = fc.double({ min: -1e4, max: 1e4, noNaN: true });

function resolvedAs(source: ResolveResult['source'], bold: boolean, italic: boolean): ResolveResult {
  return { entry: null, source, resolved: { family: 'inter', weight: 400, style: 'normal' }, synthetic: { bold, italic } };
}

/** An em-space rectangle as outline data, y down from the baseline, on a 1000-unit em's grid as a font's
 *  outlines are. */
const unit = (min: number, max: number) => fc.oneof(
  { weight: 1, arbitrary: fc.integer({ min, max }) },
  // A coarse grid, so contours often share an edge or a corner.
  { weight: 3, arbitrary: fc.integer({ min: Math.ceil(min / 100), max: Math.floor(max / 100) }).map((k) => k * 100) },
).map((u) => u / 1000);
const rect = fc.record({ x: unit(-200, 600), y: unit(-900, 200), w: unit(20, 600), h: unit(20, 900) });
const rectD = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`;

function points(p: PolygonPath): [number, number][] {
  const out: [number, number][] = [];
  const ox = p.origin?.x ?? 0;
  const oy = p.origin?.y ?? 0;
  for (let k = 0; k + 1 < p.coords.length; k += 2) out.push([p.coords[k]! + ox, p.coords[k + 1]! + oy]);
  return out;
}

function placed(over: Partial<PlacedGlyph> & { resolved: ResolveResult }): PlacedGlyph {
  return { run: 0, cell: 0, cp: 65, fontSize: 40, x: 12, baselineY: 30, advance: 20, step: 20, metrics: {} as PlacedGlyph['metrics'],
    font: null, glyph: null, ...over } as PlacedGlyph;
}

/** Edges of `p` with fill on both sides, probed `e` either side of each one's middle: a stroke would trace them. */
function edgesInsideFill(p: PolygonPath, e: number): number {
  let n = 0;
  for (const { segs } of pathToCubicContours(p)) {
    for (const { c } of segs) {
      const x = (c[0] + 3 * c[2] + 3 * c[4] + c[6]) / 8;
      const y = (c[1] + 3 * c[3] + 3 * c[5] + c[7]) / 8;
      const dx = c[6] + c[4] - c[2] - c[0];
      const dy = c[7] + c[5] - c[3] - c[1];
      const l = Math.hypot(dx, dy);
      if (l < 1e-9) continue;
      const inside = (u: number, v: number) => pointInPath(p, u, v, { tolerance: 1e-9 });
      if (inside(x + (dy / l) * e, y - (dx / l) * e) && inside(x - (dy / l) * e, y + (dx / l) * e)) n++;
    }
  }
  return n;
}

/** Float32 coordinates: compare to a few parts in ten million of the largest. */
const near = (a: number, b: number, scale: number) => Math.abs(a - b) <= 2e-6 * Math.max(1, scale);

describe('glyph geometry, property', () => {
  it('turns by a unit rotation that repeats every full turn and composes', () => {
    fc.assert(fc.property(angle, angle, (a, b) => {
      const [c, s] = glyphTurn(a);
      expect(Number.isFinite(c) && Number.isFinite(s)).toBe(true);
      expect(c * c + s * s).toBeCloseTo(1, 12);
      const [c2, s2] = glyphTurn(a + 360);
      expect(c2).toBeCloseTo(c, 9);
      expect(s2).toBeCloseTo(s, 9);
      const [cb, sb] = glyphTurn(b);
      const [cab, sab] = glyphTurn(a + b);
      expect(c * cb - s * sb).toBeCloseTo(cab, 9);
      expect(s * cb + c * sb).toBeCloseTo(sab, 9);
    }), runs(RUNS));
    expect(glyphTurn(0)).toEqual([1, 0]);
    expect(glyphTurn(undefined)).toEqual([1, 0]);
  });

  it('sets a glyph as its em outline scaled from the pen, an italic sheared about the baseline, then turned', () => {
    const t = tally();
    fc.assert(fc.property(rect, fc.boolean(), fc.option(angle, { nil: undefined }), fc.double({ min: 1, max: 400, noNaN: true }),
      fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true }), (r, italic, rotate, size, x, baselineY) => {
        const d = rectD(r);
        const g = placed({ resolved: resolvedAs('outline', false, italic), fontSize: size, x, baselineY, ...(rotate === undefined ? {} : { rotate }) });
        const got = points(glyphOutlineAt(d, g, 3, -4));
        const em = points(pathFromD(d));
        expect(got.length).toBe(em.length);
        const shear = italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;
        const [cos, sin] = glyphTurn(rotate);
        const scale = Math.abs(x) + Math.abs(baselineY) + size * 2;
        // The outline winds positive whichever way the data runs, so match each point to the model's set.
        const want = em.map(([ex, ey]) => {
          const sx = (ex - ey * shear) * size;
          const sy = ey * size;
          return [x + 3 + cos * sx - sin * sy, baselineY - 4 + sin * sx + cos * sy] as const;
        });
        for (const [px, py] of got) {
          expect(Number.isFinite(px) && Number.isFinite(py)).toBe(true);
          expect(want.some(([wx, wy]) => near(px, wx, scale) && near(py, wy, scale)), `${px},${py}`).toBe(true);
        }
        if (italic && rotate !== undefined) t.count('both');
      }), runs(RUNS));
    t.atLeast('both', 20);
  });

  it('winds every placed outline positive, whichever way its data runs', () => {
    fc.assert(fc.property(rect, fc.boolean(), fc.boolean(), (r, reversed, italic) => {
      const d = reversed
        ? `M${r.x} ${r.y}L${r.x} ${r.y + r.h}L${r.x + r.w} ${r.y + r.h}L${r.x + r.w} ${r.y}Z`
        : rectD(r);
      const out = glyphOutlineAt(d, placed({ resolved: resolvedAs('outline', false, italic) }), 0, 0);
      expect(pathSignedArea(out)).toBeGreaterThan(0);
      // A shear keeps area: the outline covers the rectangle's area at the glyph's size.
      expect(pathSignedArea(out)).toBeCloseTo(r.w * r.h * 40 * 40, 1);
    }), runs(RUNS));
  });

  it('grows a synthetic bold outline by the field shift on every side, corners mitered on the atlas and rounded on a bake', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(rect, { minLength: 1, maxLength: 3 }), fc.constantFrom('atlas' as const, 'canvas' as const), (rs, source) => {
      const d = rs.map(rectD).join('');
      const em = pathFromD(d);
      const resolved = resolvedAs(source, true, false);
      const offset = syntheticBoldOffset(resolved);
      expect(offset).not.toBeNull();
      const growth = syntheticBoldGrowth(source, 'inter', 400, 'normal')!;
      expect(offset!.growth).toBe(growth);
      expect(offset!.join).toBe(source === 'atlas' ? 'miter' : 'round');
      const grown = emboldenGlyph(em, d, resolved);
      const before = boundsOfPath(em);
      const after = boundsOfPath(grown);
      for (const [a, b] of [[after.x, before.x - growth], [after.y, before.y - growth],
        [after.x + after.width, before.x + before.width + growth], [after.y + after.height, before.y + before.height + growth]] as const) {
        expect(Math.abs(a - b), `${source} ${d}`).toBeLessThan(2e-4 + 1e-6);
      }
      // Grown outlines on the grid lie a multiple of 0.001 em apart, or touch: round joins cross nearly tangent.
      expect(edgesInsideFill(grown, 2e-4), `${source} ${d}`).toBe(0);
      if (rs.length > 1) t.count('overlapping');
      const sides = (r: (typeof rs)[number]) => [r.x, r.x + r.w, r.y + 10, r.y + r.h + 10];
      if (rs.some((a, i) => rs.slice(i + 1).some((b) => sides(a).some((v) => sides(b).includes(v))))) t.count('shared');
      if (rs.length === 1) {
        const { w, h } = rs[0]!;
        const corners = source === 'atlas' ? 4 * growth * growth : Math.PI * growth * growth;
        expect(Math.abs(pathSignedArea(grown) - (w * h + 2 * growth * (w + h) + corners))).toBeLessThan(2e-4);
        t.count(source);
      }
      expect(emboldenGlyph(em, d, resolvedAs(source, false, false))).toBe(em);
    }), runs(RUNS));
    t.atLeast('atlas', 15);
    t.atLeast('canvas', 15);
    t.atLeast('overlapping', 40);
    t.atLeast('shared', 20);
  }, timeoutFor(RUNS, 10));
});
