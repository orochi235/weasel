/**
 * Property tests of the lens geometry: a point in the lens maps to the same host point through the inner view the
 * lens draws with as through `loupeSourcePoint`, and back; the backing-store pixel a lens shows under a point is
 * the one `canvasPixelSource` samples there, at any zoom and any stretch of the canvas; and `placeBand` keeps the
 * lens on the host, showing the band whole, with every number finite.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { loupeInnerView, loupeSourcePoint, placeBand } from './geometry';
import { sourceRegion } from './canvasSource';
import { canvasPixelSource } from './sampler';
import type { CanvasSource } from './canvasSource';
import { ZOOM_FLOOR } from '@weasel-js/geom';
import { coord, factor, lensRect, near, point, runs, tally, timeoutFor, view } from './pbt.fixture';

const RUNS = 400;

describe('loupeInnerView and loupeSourcePoint', () => {
  it('agree on where a point in the lens looks, at any outer view and factor', () => {
    fc.assert(fc.property(point, view, lensRect, factor, point, (target, outer, rect, f, at) => {
      const p = { x: rect.x + ((at.x / 1e4 + 1) / 2) * rect.w, y: rect.y + ((at.y / 1e4 + 1) / 2) * rect.h };
      const inner = loupeInnerView(target, outer, rect, f);
      const world = { x: inner.x + (p.x - rect.x) / inner.scale.x, y: inner.y + (p.y - rect.y) / inner.scale.y };
      const viaView = { x: (world.x - outer.x) * outer.scale.x, y: (world.y - outer.y) * outer.scale.y };
      const aim = { x: (target.x - outer.x) * outer.scale.x, y: (target.y - outer.y) * outer.scale.y };
      const direct = loupeSourcePoint(p, rect, aim, f);
      const mx = (Math.abs(p.x) + Math.abs(rect.x) + rect.w) / f + (Math.abs(target.x) + Math.abs(outer.x) + rect.w / f) * Math.abs(outer.scale.x);
      const my = (Math.abs(p.y) + Math.abs(rect.y) + rect.h) / f + (Math.abs(target.y) + Math.abs(outer.y) + rect.h / f) * Math.abs(outer.scale.y);
      expect(near(viaView.x, direct.x, mx, 1e-12)).toBe(true);
      expect(near(viaView.y, direct.y, my, 1e-12)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('shows the aim at the lens center exactly, and a point maps back into the lens where it was', () => {
    fc.assert(fc.property(lensRect, point, factor, point, (rect, aim, f, src) => {
      const c = loupeSourcePoint({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, rect, aim, f);
      expect([c.x + 0, c.y + 0]).toEqual([aim.x + 0, aim.y + 0]);
      const inLens = { x: rect.x + rect.w / 2 + (src.x - aim.x) * f, y: rect.y + rect.h / 2 + (src.y - aim.y) * f };
      const back = loupeSourcePoint(inLens, rect, aim, f);
      const m = (Math.abs(rect.x) + rect.w + Math.abs(src.x - aim.x) * f) / f + Math.abs(aim.x) + Math.abs(src.x);
      expect(near(back.x, src.x, m, 1e-12)).toBe(true);
      expect(near(back.y, src.y, (Math.abs(rect.y) + rect.h + Math.abs(src.y - aim.y) * f) / f + Math.abs(aim.y) + Math.abs(src.y), 1e-12)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

describe('sourceRegion', () => {
  const box = fc.record({
    x: coord(2000), y: coord(2000),
    width: fc.double({ min: 1, max: 4000, noNaN: true }), height: fc.double({ min: 1, max: 4000, noNaN: true }),
  });
  const backing = fc.record({ width: fc.integer({ min: 1, max: 8000 }), height: fc.integer({ min: 1, max: 8000 }) });
  it('shows under each lens point the backing pixel a sample there reads', () => {
    const seen = tally();
    fc.assert(fc.property(point, factor, fc.integer({ min: 8, max: 600 }), box, backing, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      (aim, f, size, b, back, u, v) => {
        const r = sourceRegion(aim, f, size, b, back);
        const rect = { x: 0, y: 0, w: size, h: size };
        const p = { x: u * size, y: v * size };
        // drawImage stretches [sx, sx + sw] over the lens.
        const shown = { x: r.sx + (p.x / size) * r.sw, y: r.sy + (p.y / size) * r.sh };
        let read: { x: number; y: number } | null = null;
        const source = { canvas: back, pixel: (q: { x: number; y: number }) => { read = q; return null; } } as unknown as CanvasSource;
        canvasPixelSource(source, () => b).pixel(loupeSourcePoint(p, rect, aim, f));
        const got = read as unknown as { x: number; y: number };
        const kx = back.width / b.width;
        const ky = back.height / b.height;
        const mx = (Math.abs(aim.x) + Math.abs(b.x) + size / f) * kx;
        const my = (Math.abs(aim.y) + Math.abs(b.y) + size / f) * ky;
        expect(near(got.x, shown.x, mx, 1e-12)).toBe(true);
        expect(near(got.y, shown.y, my, 1e-12)).toBe(true);
        // Away from a pixel edge, both name the same pixel.
        const clear = (a: number, m: number) => Math.abs(a - Math.round(a)) > 1e-9 * Math.max(1, m);
        if (clear(shown.x, mx) && clear(shown.y, my)) {
          seen.count('pixel');
          expect([Math.floor(got.x), Math.floor(got.y)]).toEqual([Math.floor(shown.x), Math.floor(shown.y)]);
        }
      }), runs(RUNS));
    seen.atLeast('pixel', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});

describe('placeBand', () => {
  const band = fc.record({
    x: coord(), y: coord(),
    w: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 5000, noNaN: true })),
    h: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 5000, noNaN: true })),
  });
  const extent = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 4000, noNaN: true }));
  it('fits the band whole on the host, magnified no more than asked, with a lens that can be read', () => {
    const seen = tally();
    fc.assert(fc.property(band, factor, extent, fc.option(extent, { nil: undefined }), (b, f, maxWidth, maxHeight) => {
      const got = placeBand({ band: b, factor: f, maxWidth, ...(maxHeight !== undefined ? { maxHeight } : {}) });
      expect(Object.values(got).flatMap((v) => (typeof v === 'number' ? [v] : [v.x, v.y])).every(Number.isFinite)).toBe(true);
      expect(got.factor).toBeGreaterThan(0);
      expect(got.factor).toBeLessThanOrEqual(Math.max(f, ZOOM_FLOOR));
      expect(got.shows).toEqual({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      expect(got.width).toBe(Math.min(b.w * got.factor, maxWidth));
      expect(got.height).toBe(maxHeight === undefined ? b.h * got.factor : Math.min(b.h * got.factor, maxHeight));
      seen.count(got.factor < f ? 'shrunk' : 'full');
      const ulp = (n: number) => Math.max(n * 1e-15, 1e-320);
      expect(got.width).toBeLessThanOrEqual(maxWidth);
      if (maxHeight !== undefined) expect(got.height).toBeLessThanOrEqual(maxHeight);
      // Shrunk only as far as the host needs: the lens touches it on the axis that held it.
      if (got.factor < f && got.factor > ZOOM_FLOOR) {
        const touches = (b.w > 0 && Math.abs(b.w * got.factor - maxWidth) <= ulp(maxWidth) * 4)
          || (maxHeight !== undefined && b.h > 0 && Math.abs(b.h * got.factor - maxHeight) <= ulp(maxHeight) * 4);
        expect(touches).toBe(true);
      }
      {
        seen.count('on host');
        expect(got.center.x - got.width / 2).toBeGreaterThanOrEqual(-ulp(maxWidth + Math.abs(got.center.x)));
        expect(got.center.x + got.width / 2).toBeLessThanOrEqual(maxWidth + ulp(maxWidth + Math.abs(got.center.x)));
      }
      // Whatever the lens is drawn at, a point in it maps back finitely.
      const rect = { x: got.center.x - got.width / 2, y: got.center.y - got.height / 2, w: got.width, h: got.height };
      const q = loupeSourcePoint({ x: rect.x, y: rect.y }, rect, got.shows, got.factor);
      expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
    }), runs(RUNS));
    seen.atLeast('shrunk', RUNS / 5);
    seen.atLeast('full', RUNS / 10);
    seen.atLeast('on host', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});
