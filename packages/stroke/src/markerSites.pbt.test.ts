import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { markerSites, type MarkerSite } from './markerSites';
import { pathOf, polyline, runs, tally, timeoutFor, type Pt } from './pbt.fixture';

const RUNS = runs(300);
const ALL = { start: true, mid: true, end: true };
const closed = fc.boolean();
const shape = closed.chain((c) => polyline({ closed: c, maxLength: 7, minGap: 0.5 }).map((pts) => ({ pts, closed: c })));

const dir = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};
const sameAngle = (a: number, b: number): boolean => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-9;
const at = (s: MarkerSite, p: Pt): boolean => Math.hypot(s.x - p.x, s.y - p.y) < 1e-9 * (1 + Math.abs(p.x) + Math.abs(p.y));

describe('markerSites, property', () => {
  it('seats a head on each end pointing out, and a mid marker on each inner anchor along its bisector', () => {
    fc.assert(fc.property(shape, ({ pts, closed: c }) => {
      const [pl] = extractPolylines(pathOf(pts, c));
      const sites = markerSites(pl!, ALL);
      const n = pts.length;
      const mids = sites.filter((s) => s.role === 'mid');
      expect(sites.filter((s) => s.role !== 'mid')).toHaveLength(c ? 0 : 2);
      expect(mids).toHaveLength(c ? n - 1 : n - 2);
      mids.forEach((s, k) => {
        const i = k + 1;
        expect(at(s, pts[i]!)).toBe(true);
        const din = dir(pts[i - 1]!, pts[i]!), dout = dir(pts[i]!, pts[(i + 1) % n]!);
        const bx = din.x + dout.x, by = din.y + dout.y;
        // A turn straight back has no bisector, and points the way the line arrived.
        if (Math.hypot(bx, by) < 1e-6) return;
        expect(sameAngle(s.angle, Math.atan2(by, bx)) || Math.hypot(bx, by) < 1e-3).toBe(true);
      });
      if (c) return;
      const [start] = sites, end = sites[sites.length - 1]!;
      expect(start!.role).toBe('start');
      expect(at(start!, pts[0]!)).toBe(true);
      const d0 = dir(pts[0]!, pts[1]!);
      expect(sameAngle(start!.angle, Math.atan2(-d0.y, -d0.x))).toBe(true);
      expect(at(end, pts[n - 1]!)).toBe(true);
      const d1 = dir(pts[n - 2]!, pts[n - 1]!);
      expect(sameAngle(end.angle, Math.atan2(d1.y, d1.x))).toBe(true);
    }), RUNS);
  }, timeoutFor(300, 2));

  it('turns its sites with the line, a quarter turn adding a quarter to every angle', () => {
    fc.assert(fc.property(shape, ({ pts, closed: c }) => {
      const turned = pts.map((p) => ({ x: -p.y, y: p.x }));
      const a = markerSites(extractPolylines(pathOf(pts, c))[0]!, ALL);
      const b = markerSites(extractPolylines(pathOf(turned, c))[0]!, ALL);
      expect(b.map((s) => s.role)).toEqual(a.map((s) => s.role));
      a.forEach((s, i) => {
        expect(at(b[i]!, { x: -s.y, y: s.x })).toBe(true);
        expect(sameAngle(b[i]!.angle, s.angle + Math.PI / 2)).toBe(true);
      });
    }), RUNS);
  }, timeoutFor(300, 2));

  it('keeps a head on the line end when the end segment is longer than its inset, and when the inset eats the line', () => {
    const seated = tally();
    fc.assert(fc.property(polyline({ minGap: 0.5 }), fc.double({ min: 0, max: 1.5, noNaN: true }), fc.boolean(), (pts, f, fromStart) => {
      const pl = extractPolylines(pathOf(pts))[0]!;
      const n = pts.length;
      const [a, b] = fromStart ? [pts[0]!, pts[1]!] : [pts[n - 1]!, pts[n - 2]!];
      let total = 0;
      for (let i = 1; i < n; i++) total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
      const last = Math.hypot(b.x - a.x, b.y - a.y);
      const inset = f * last;
      const want = fromStart ? { start: true, mid: false, end: false } : { start: false, mid: false, end: true };
      const [site] = markerSites(pl, want, false, fromStart ? { start: inset } : { end: inset });
      const plain = markerSites(pl, want)[0]!;
      if (inset < last * (1 - 1e-9) || inset >= total) {
        expect(Math.hypot(site!.x - a.x, site!.y - a.y)).toBeLessThanOrEqual(1e-9 * (1 + total + Math.abs(a.x) + Math.abs(a.y)));
        expect(sameAngle(site!.angle, plain.angle)).toBe(true);
        if (inset > 0 && inset < last) seated.hit();
      }
    }), RUNS);
    seated.atLeast(0.3, RUNS.numRuns);
  }, timeoutFor(300, 2));
});
