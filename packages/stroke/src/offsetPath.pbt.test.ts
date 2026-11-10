import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cubicPointAt, pathContainsPoint, pathSignedArea, pathToAnchors, resolveCorners, type Path, type PolygonPath } from '@weasel-js/geom';
import { offsetPath } from './offsetPath';
import { strokeToPath } from './strokeToPath';
import { ngon, pathOf, polylineDistance, runs, tally, timeoutFor, type Ngon, type Pt } from './pbt.fixture';

const RUNS = runs(60);
const area = (p: Path): number => Math.abs(pathSignedArea(p));
/** The area of a regular `n`-gon with inradius `r`. */
const ngonArea = (n: number, r: number): number => n * Math.tan(Math.PI / n) * r * r;
const fraction = fc.double({ min: 0.05, max: 0.95, noNaN: true });

/** Points along every subpath `p` draws: its anchors and samples between them. */
function samples(p: PolygonPath): Pt[] {
  const out: Pt[] = [];
  for (const sub of pathToAnchors(resolveCorners(p)).anchors) {
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i]!, b = sub[(i + 1) % sub.length]!;
      for (let k = 0; k < 6; k++) out.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 6));
    }
  }
  return out;
}

describe('offsetPath, property', () => {
  it('grows a regular polygon with mitered corners into the regular polygon its inradius plus the distance makes', () => {
    fc.assert(fc.property(ngon, fc.double({ min: 0.5, max: 50, noNaN: true }), (g, d) => {
      const out = offsetPath(pathOf(g.pts, true), d);
      const want = ngonArea(g.n, g.inradius + d);
      expect(Math.abs(area(out) - want)).toBeLessThanOrEqual(1e-4 * want);
      expect(pathToAnchors(out).anchors.map((s) => s.length)).toEqual([g.n]);
    }), RUNS);
  }, timeoutFor(60, 60));

  it('shrinks a regular polygon by its inradius less the distance, and leaves nothing past its middle', () => {
    fc.assert(fc.property(ngon, fc.double({ min: 0.02, max: 1.5, noNaN: true }), (g, f) => {
      const d = g.inradius * f;
      const out = offsetPath(pathOf(g.pts, true), -d);
      if (f >= 1.001) {
        expect(out.commands.length).toBe(0);
        return;
      }
      if (f > 0.98) return;
      const want = ngonArea(g.n, g.inradius - d);
      expect(Math.abs(area(out) - want)).toBeLessThanOrEqual(1e-4 * g.area);
    }), RUNS);
  }, timeoutFor(60, 60));

  it('grows a convex polygon with round joins by its perimeter times the distance and the disc, everywhere at the distance', () => {
    const checked = tally();
    fc.assert(fc.property(ngon, fc.double({ min: 0.5, max: 30, noNaN: true }), (g, d) => {
      const tolerance = 0.01;
      const out = offsetPath(pathOf(g.pts, true), d, { join: 'round', tolerance });
      const want = g.area + g.perimeter * d + Math.PI * d * d;
      // The ribbon fans its round joins in 10° steps.
      expect(Math.abs(area(out) - want)).toBeLessThanOrEqual(0.02 * d * d + tolerance * (g.perimeter + 2 * Math.PI * d));
      for (const p of samples(out)) {
        expect(Math.abs(polylineDistance(p, g.pts, true) - d)).toBeLessThanOrEqual(0.005 * d + 2 * tolerance);
        checked.hit();
      }
    }), RUNS);
    checked.atLeast(1, RUNS.numRuns);
  }, timeoutFor(60, 100));

  it('comes back to a convex polygon offset out by a distance and in by the same', () => {
    fc.assert(fc.property(ngon, fc.double({ min: 0.5, max: 30, noNaN: true }), fc.boolean(), (g, d, outFirst) => {
      const source = pathOf(g.pts, true);
      const dd = outFirst ? d : Math.min(d, g.inradius * 0.9);
      const back = offsetPath(offsetPath(source, outFirst ? dd : -dd), outFirst ? -dd : dd);
      expect(Math.abs(area(back) - g.area)).toBeLessThanOrEqual(1e-4 * g.area);
      const anchors = pathToAnchors(back).anchors;
      expect(anchors.map((s) => s.length)).toEqual([g.n]);
      for (const a of anchors[0]!) {
        expect(Math.min(...g.pts.map((p) => Math.hypot(p.x - a.x, p.y - a.y)))).toBeLessThanOrEqual(1e-3 * (1 + g.inradius));
      }
    }), RUNS);
  }, timeoutFor(60, 120));
});

describe('strokeToPath aligned, property', () => {
  it('inks a closed regular polygon outside it, or inside it, by the width', () => {
    const align = fc.constantFrom('inner', 'outer') as fc.Arbitrary<'inner' | 'outer'>;
    fc.assert(fc.property(ngon, fraction, align, (g: Ngon, f, side) => {
      const w = g.inradius * f;
      const out = strokeToPath(pathOf(g.pts, true), { paint: { color: '#000' }, width: w, align: side });
      const want = side === 'outer'
        ? ngonArea(g.n, g.inradius + w) - g.area
        : g.area - ngonArea(g.n, g.inradius - w);
      expect(Math.abs(area(out) - want)).toBeLessThanOrEqual(1e-4 * (g.area + want));
      const cx = g.pts.reduce((s, p) => s + p.x, 0) / g.n, cy = g.pts.reduce((s, p) => s + p.y, 0) / g.n;
      expect(pathContainsPoint(out, cx, cy)).toBe(false);
    }), RUNS);
  }, timeoutFor(60, 60));
});
