/**
 * Second-pass property tests for the viewport math: the laws between view operations (a zoom and its inverse,
 * per-axis zooms commuting, a pan and a clamp or a fit commuting with a shift of the world, the camera curve run
 * backward) and every operation fed the edges of the double range: non-finite, subnormal, and huge values, and
 * bounds and hosts with no size.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { viewWorldToScreen, ZOOM_FLOOR, type View } from '@weasel-js/geom';
import { close, coord, decades, positive, runs, tally, timeoutFor } from '../pbt.fixture';
import { normalizeView, sameView } from './view';
import { zoomAt } from './zoomAt';
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM } from './zoomBounds';
import { clampView } from './clampView';
import { fitViewToBounds } from './fitViewToBounds';
import { interpolateView } from './interpolateView';
import { computeWheelAction, wheelPan, wheelZoom } from './wheelHandler';
import { viewportWorldRect } from './viewportWorldRect';

const N = 200;
const T = timeoutFor(N, 2);

const signed = (mag: fc.Arbitrary<number>) => fc.tuple(mag, fc.boolean()).map(([m, neg]) => (neg ? -m : m));
const view = (lo = -1, hi = 0.9, limit = 1e5): fc.Arbitrary<View> =>
  fc.record({ x: coord(limit), y: coord(limit), scale: fc.record({ x: signed(decades(lo, hi)), y: signed(decades(lo, hi)) }) });
const point = (limit = 1e4) => fc.record({ x: coord(limit), y: coord(limit) });
/** The doubles a careless caller hands over: non-finite, signed zero, subnormal, and the ends of the range. */
const EDGES = [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE, 1e-310, 1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE];
const edgy = (limit = 1e4) => fc.oneof({ weight: 3, arbitrary: coord(limit) }, fc.constantFrom(...EDGES));
const finite = (v: View) => [v.x, v.y, v.scale.x, v.scale.y].every(Number.isFinite);
const AXES = ['x', 'y'] as const;

describe('zoomAt laws', () => {
  it('a zoom by f and then by 1/f about one anchor returns the view, while neither clamps', () => {
    const t = tally();
    fc.assert(fc.property(view(), point(2000), decades(-0.9, 0.9), fc.boolean(), (v, anchor, f, perAxis) => {
      const factor = perAxis ? { x: f, y: 1 / f } : f;
      const inverse = perAxis ? { x: 1 / f, y: f } : 1 / f;
      const mid = zoomAt(v, anchor, factor);
      const free = AXES.every((a) => {
        const s = Math.abs(v.scale[a]) * (typeof factor === 'number' ? factor : factor[a]);
        return s > DEFAULT_MIN_ZOOM && s < DEFAULT_MAX_ZOOM;
      });
      if (!free) return;
      t.count(perAxis ? 'per axis' : 'uniform');
      const back = zoomAt(mid, anchor, inverse);
      for (const a of AXES) {
        expect(close(back.scale[a], v.scale[a], 1e-12)).toBe(true);
        const tol = 1e-9 * Math.max(1, Math.abs(v[a]), 2000 / Math.abs(mid.scale[a]));
        expect(Math.abs(back[a] - v[a]), `${a}: ${JSON.stringify({ v, back })}`).toBeLessThanOrEqual(tol);
      }
    }), runs(N));
    t.atLeast('uniform', N / 10);
    t.atLeast('per axis', N / 10);
  }, T);

  it('a factor of 1 is the view itself, and zooms on the two axes commute and equal one zoom by both', () => {
    fc.assert(fc.property(view(), point(4000), decades(-1.5, 1.5), decades(-1.5, 1.5), (v, anchor, fx, fy) => {
      expect(sameView(zoomAt(v, anchor, 1), v)).toBe(true);
      const both = zoomAt(v, anchor, { x: fx, y: fy });
      const xThenY = zoomAt(zoomAt(v, anchor, { x: fx, y: 1 }), anchor, { x: 1, y: fy });
      const yThenX = zoomAt(zoomAt(v, anchor, { x: 1, y: fy }), anchor, { x: fx, y: 1 });
      expect(xThenY).toEqual(both);
      expect(yThenX).toEqual(both);
    }), runs(N));
  }, T);

  it('any factor, anchor, and view give a finite view, each axis inside the clamp and turned the way it was', () => {
    const t = tally();
    const factor = fc.oneof(decades(-3, 3), fc.constantFrom(...EDGES, -2, -0.5));
    fc.assert(fc.property(
      fc.record({ x: edgy(1e5), y: edgy(1e5), scale: fc.record({ x: edgy(10), y: edgy(10) }) }),
      fc.record({ x: edgy(4000), y: edgy(4000) }),
      fc.oneof(factor, fc.record({ x: factor, y: factor })),
      (v, anchor, f) => {
        const before = normalizeView(v);
        const next = zoomAt(v, anchor, f);
        expect(finite(next), JSON.stringify({ v, anchor, f, next })).toBe(true);
        for (const a of AXES) {
          expect(Math.abs(next.scale[a])).toBeGreaterThanOrEqual(DEFAULT_MIN_ZOOM);
          expect(Math.abs(next.scale[a])).toBeLessThanOrEqual(DEFAULT_MAX_ZOOM);
          expect(Math.sign(next.scale[a]), `${a} keeps its direction`).toBe(Math.sign(before.scale[a]));
          const fa = typeof f === 'number' ? f : f[a];
          // A factor that is no zoom at all leaves the axis as it was.
          if (Number.isNaN(fa) || fa < 0) {
            t.count('no factor');
            const held = Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, Math.abs(before.scale[a])));
            expect(Math.abs(next.scale[a])).toBe(held);
          }
        }
        if (![anchor.x, anchor.y].every(Number.isFinite)) t.count('wild anchor');
      }), runs(N * 2));
    t.atLeast('no factor', N / 10);
    t.atLeast('wild anchor', N / 10);
  }, T * 2);
});

describe('wheel', () => {
  it('a wheel zoom and the same distance back return to the view; a pan and its opposite too', () => {
    fc.assert(fc.property(view(-0.5, 0.5), point(2000), fc.double({ min: -60, max: 60, noNaN: true }), point(500), (v, at, dy, pan) => {
      const there = wheelZoom(v, at, dy);
      const free = AXES.every((a) => Math.abs(v.scale[a]) * 1.1 ** (Math.abs(dy) / 100) < DEFAULT_MAX_ZOOM && Math.abs(v.scale[a]) / 1.1 ** (Math.abs(dy) / 100) > DEFAULT_MIN_ZOOM);
      if (free) {
        const back = wheelZoom(there, at, -dy);
        for (const a of AXES) {
          expect(close(back.scale[a], v.scale[a], 1e-12)).toBe(true);
          expect(Math.abs(back[a] - v[a])).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(v[a]), 2000 / Math.abs(v.scale[a])));
        }
      }
      const panned = wheelPan(wheelPan(v, { deltaX: pan.x, deltaY: pan.y }), { deltaX: -pan.x, deltaY: -pan.y });
      for (const a of AXES) expect(close(panned[a], v[a], 1e-9)).toBe(true);
    }), runs(N));
  }, T);

  it('any wheel sample leaves a finite view inside the invariant', () => {
    const t = tally();
    fc.assert(fc.property(view(), fc.record({ deltaX: edgy(500), deltaY: edgy(500), x: edgy(2000), y: edgy(2000), shiftKey: fc.boolean(), ctrlKey: fc.boolean() }),
      fc.constantFrom('both', 'x', 'y'), (v, input, axis) => {
        const next = computeWheelAction(v, input, undefined, { axis: axis as 'both' | 'x' | 'y' });
        expect(finite(next), JSON.stringify({ v, input, next })).toBe(true);
        expect(normalizeView(next)).toBe(next);
        if (![input.deltaX, input.deltaY].every(Number.isFinite)) t.count(input.ctrlKey ? 'wild zoom' : 'wild pan');
      }), runs(N * 2));
    t.atLeast('wild zoom', N / 20);
    t.atLeast('wild pan', N / 20);
  }, T * 2);
});

describe('clamp and fit commute with a shift of the world', () => {
  const bounds = fc.record({ x: coord(1e4), y: coord(1e4), width: fc.oneof(positive(1, 1e5), fc.constant(0)), height: fc.oneof(positive(1, 1e5), fc.constant(0)) });
  const canvas = fc.record({ width: positive(1, 4000), height: positive(1, 4000) });

  it('clampView of a view and bounds shifted by d is the clamped view shifted by d', () => {
    fc.assert(fc.property(view(), bounds, canvas, point(1e4), (v, b, c, d) => {
      const out = clampView(v, b, c);
      const shifted = clampView({ ...v, x: v.x + d.x, y: v.y + d.y }, { ...b, x: b.x + d.x, y: b.y + d.y }, c);
      for (const a of AXES) {
        const tol = 1e-9 * Math.max(1, Math.abs(out[a]), Math.abs(d[a]), Math.abs(b[a]), 4000 / Math.abs(v.scale[a]));
        expect(Math.abs(shifted[a] - (out[a] + d[a]))).toBeLessThanOrEqual(tol);
      }
    }), runs(N));
  }, T);

  it('fitViewToBounds of bounds shifted by d is the fitted view shifted by d, at the same scale', () => {
    fc.assert(fc.property(bounds, canvas, view(), point(1e4), fc.constantFrom('contain', 'fill', 'stretch'), fc.constantFrom('center', 'start'),
      (b, c, cur, d, mode, anchor) => {
        const opts = { mode: mode as 'contain', anchor: anchor as 'center' };
        const out = fitViewToBounds(b, c, cur, opts);
        const shifted = fitViewToBounds({ ...b, x: b.x + d.x, y: b.y + d.y }, c, cur, opts);
        if (out === null) return void expect(shifted).toBeNull();
        expect(shifted!.scale).toEqual(out.scale);
        for (const a of AXES) {
          const tol = 1e-9 * Math.max(1, Math.abs(out[a]), Math.abs(d[a]), Math.abs(b[a]), b.width, b.height);
          expect(Math.abs(shifted![a] - (out[a] + d[a]))).toBeLessThanOrEqual(tol);
        }
      }), runs(N));
  }, T);

  it('stretch fills the padded viewport on each axis, and fill covers it on both, while the scale is free', () => {
    const t = tally();
    fc.assert(fc.property(fc.record({ x: coord(1e4), y: coord(1e4), width: positive(20, 2000), height: positive(20, 2000) }), canvas, view(), fc.integer({ min: 0, max: 20 }),
      (b, c, cur, padding) => {
        const availW = Math.max(1, c.width - 2 * padding);
        const availH = Math.max(1, c.height - 2 * padding);
        const stretch = fitViewToBounds(b, c, cur, { padding, mode: 'stretch', minScale: 1e-6, maxScale: 1e6 })!;
        expect(close(b.width * Math.abs(stretch.scale.x), availW, 1e-12)).toBe(true);
        expect(close(b.height * Math.abs(stretch.scale.y), availH, 1e-12)).toBe(true);
        const fill = fitViewToBounds(b, c, cur, { padding, mode: 'fill', minScale: 1e-6, maxScale: 1e6 })!;
        expect(b.width * Math.abs(fill.scale.x)).toBeGreaterThanOrEqual(availW * (1 - 1e-12));
        expect(b.height * Math.abs(fill.scale.y)).toBeGreaterThanOrEqual(availH * (1 - 1e-12));
        const start = fitViewToBounds(b, c, cur, { padding, mode: 'fill', anchor: 'start', minScale: 1e-6, maxScale: 1e6 })!;
        // The overflowing axis shows the bounds' leading edge, `padding` in from the viewport's.
        for (const [a, avail, size] of [['x', availW, b.width], ['y', availH, b.height]] as const) {
          if (size * Math.abs(start.scale[a]) <= avail + 1e-6) continue;
          t.count('overflow');
          const r = viewportWorldRect(start, c);
          const edge = viewWorldToScreen(start, { x: start.scale.x < 0 ? b.x + b.width : b.x, y: start.scale.y < 0 ? b.y + b.height : b.y });
          expect(Math.abs(edge[a] - padding), JSON.stringify({ r, edge })).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b[a]) * Math.abs(start.scale[a])));
        }
      }), runs(N));
    t.atLeast('overflow', N / 4);
  }, T);

  it('bounds and hosts at the edges of the range fit to a finite view inside the clamp, or to nothing', () => {
    const t = tally();
    const wild = fc.record({ x: edgy(1e4), y: edgy(1e4), width: edgy(1e4), height: edgy(1e4) });
    fc.assert(fc.property(wild, fc.record({ width: fc.oneof(positive(50, 4000), fc.constantFrom(1e-310, 1e6)), height: positive(50, 4000) }), view(),
      fc.constantFrom('contain', 'fill', 'stretch'), (b, c, cur, mode) => {
        const out = fitViewToBounds(b, c, cur, { mode: mode as 'contain' });
        if (out === null) return void t.count('nothing');
        t.count('fit');
        expect(finite(out), JSON.stringify({ b, c, out })).toBe(true);
        for (const a of AXES) {
          expect(Math.abs(out.scale[a])).toBeGreaterThanOrEqual(DEFAULT_MIN_ZOOM);
          expect(Math.abs(out.scale[a])).toBeLessThanOrEqual(DEFAULT_MAX_ZOOM);
        }
        const clamped = clampView(cur, { x: b.x, y: b.y, width: Math.abs(b.width), height: Math.abs(b.height) }, c);
        expect(finite(clamped), `clampView: ${JSON.stringify({ b, c, clamped })}`).toBe(true);
      }), runs(N * 2));
    t.atLeast('nothing', N / 10);
    t.atLeast('fit', N / 4);
  }, T * 2);
});

describe('interpolateView run backward', () => {
  it('the curve from b to a at 1 - t is the curve from a to b at t, and a curve between equal views stands still', () => {
    fc.assert(fc.property(view(-2, 1, 1e4), view(-2, 1, 1e4), fc.double({ min: 0, max: 1, noNaN: true }), (a, b, k) => {
      const ab = interpolateView(a, b)(k);
      const ba = interpolateView(b, a)(1 - k);
      for (const axis of AXES) {
        expect(close(ab.scale[axis], ba.scale[axis], 1e-9), `${axis} scale`).toBe(true);
        const tol = 1e-7 * Math.max(1, Math.abs(a[axis]), Math.abs(b[axis]), Math.abs(ab[axis]), 1e4 / Math.min(Math.abs(a.scale[axis]), Math.abs(b.scale[axis])));
        expect(Math.abs(ab[axis] - ba[axis]), `${axis}: ${JSON.stringify({ a, b, k, ab, ba })}`).toBeLessThanOrEqual(tol);
      }
      expect(interpolateView(a, a)(k)).toEqual(a);
    }), runs(N));
  }, T);
});

describe('normalizeView at the bottom of the range', () => {
  it('a subnormal or signed-zero scale lands on the floor, a negative one keeps its sign', () => {
    fc.assert(fc.property(fc.constantFrom(Number.MIN_VALUE, -Number.MIN_VALUE, 1e-310, -1e-310, 0, -0, ZOOM_FLOOR / 2, -ZOOM_FLOOR / 2), (s) => {
      const n = normalizeView({ x: 0, y: 0, scale: { x: s, y: 1 } });
      expect(Math.abs(n.scale.x)).toBe(ZOOM_FLOOR);
      expect(n.scale.x < 0).toBe(s < 0);
    }), runs(20));
  });
});
