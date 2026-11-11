/**
 * Property tests for the viewport math: a view's screen and world maps, zoom about a point, the clamp, the fit,
 * the camera curve, parallax planes, and pick slop.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { viewScreenToWorld, viewWorldToScreen, ZOOM_FLOOR, type View } from '@weasel-js/geom';
import { close, coord, decades, positive, runs, tally, timeoutFor } from '../pbt.fixture';
import { normalizeView, sameView, viewToTransform } from './view';
import { screenToWorld, worldToScreen } from './viewTransform';
import { zoomAt, axisZoomFactor } from './zoomAt';
import { clampView } from './clampView';
import { viewportWorldRect } from './viewportWorldRect';
import { fitViewToBounds, hasExtent } from './fitViewToBounds';
import { fitToBounds } from './fitToBounds';
import { interpolateView } from './interpolateView';
import { deriveParallaxView, fromPlane, planeMap, planeToPlane, rectToPlane, toPlane } from './parallax';
import { clientToWorld } from './clientToWorld';
import { hasSlop, widenSlop } from './screenSlop';

const N = 200;
const T = timeoutFor(N, 2);

const signed = (mag: fc.Arbitrary<number>) => fc.tuple(mag, fc.boolean()).map(([m, neg]) => (neg ? -m : m));
const view = (lo = -3, hi = 2, limit = 1e5): fc.Arbitrary<View> =>
  fc.record({ x: coord(limit), y: coord(limit), scale: fc.record({ x: signed(decades(lo, hi)), y: signed(decades(lo, hi)) }) });
const point = (limit = 1e4) => fc.record({ x: coord(limit), y: coord(limit) });
const anything = fc.oneof(
  coord(1e6), fc.constantFrom(0, -0, NaN, Infinity, -Infinity, 1e-12, -1e-12, Number.MAX_VALUE, -Number.MAX_VALUE),
);

const finite = (v: View) => [v.x, v.y, v.scale.x, v.scale.y].every(Number.isFinite);

describe('normalizeView', () => {
  it('lands any view inside the invariant, keeps each axis\'s sign, and leaves a valid view as itself', () => {
    const t = tally();
    fc.assert(fc.property(fc.record({ x: anything, y: anything, scale: fc.record({ x: anything, y: anything }) }), (v) => {
      const n = normalizeView(v);
      expect(finite(n)).toBe(true);
      for (const axis of ['x', 'y'] as const) {
        expect(Math.abs(n.scale[axis])).toBeGreaterThanOrEqual(ZOOM_FLOOR);
        if (v.scale[axis] < 0 && v.scale[axis] > -Infinity) expect(n.scale[axis]).toBeLessThan(0);
      }
      expect(normalizeView(n)).toBe(n);
      t.count(n === v ? 'kept' : 'changed');
    }), runs(N));
    t.atLeast('kept', 5);
    t.atLeast('changed', 20);
  }, T);
});

describe('screen and world maps', () => {
  it('world to screen and back is the identity, and the legacy transform agrees with the view', () => {
    fc.assert(fc.property(view(), point(1e4), (v, p) => {
      const s = viewWorldToScreen(v, p);
      const back = viewScreenToWorld(v, s);
      expect(close(back.x, p.x, 1e-9) && close(back.y, p.y, 1e-9), JSON.stringify({ p, back })).toBe(true);
      const [sx, sy] = worldToScreen(p.x, p.y, viewToTransform(v));
      expect(close(sx, s.x, 1e-9) && close(sy, s.y, 1e-9)).toBe(true);
      const [wx, wy] = screenToWorld(s.x, s.y, viewToTransform(v));
      expect(close(wx, p.x, 1e-9) && close(wy, p.y, 1e-9)).toBe(true);
      const [cx, cy] = clientToWorld(s.x + 30, s.y - 7, { left: 30, top: -7 }, v);
      expect(close(cx, p.x, 1e-9) && close(cy, p.y, 1e-9)).toBe(true);
    }), runs(N));
  }, T);

  it('viewportWorldRect has a positive size and holds the world point under every pixel of the host', () => {
    fc.assert(fc.property(view(), positive(1, 4000), positive(1, 4000), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      (v, w, h, u, k) => {
        const r = viewportWorldRect(v, { width: w, height: h });
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
        const p = viewScreenToWorld(v, { x: u * w, y: k * h });
        const slack = 1e-9 * Math.max(1, Math.abs(r.x), Math.abs(r.y), r.width, r.height);
        expect(p.x).toBeGreaterThanOrEqual(r.x - slack);
        expect(p.x).toBeLessThanOrEqual(r.x + r.width + slack);
        expect(p.y).toBeGreaterThanOrEqual(r.y - slack);
        expect(p.y).toBeLessThanOrEqual(r.y + r.height + slack);
      }), runs(N));
  }, T);
});

describe('zoomAt', () => {
  it('keeps the world point under the anchor fixed, stays finite, clamps each axis, and keeps its sign', () => {
    const t = tally();
    fc.assert(fc.property(view(-12, 4, 1e6), point(4000), fc.oneof(decades(-6, 6), fc.record({ x: decades(-6, 6), y: decades(-6, 6) })),
      (v, anchor, factor) => {
        const next = zoomAt(v, anchor, factor);
        expect(finite(next)).toBe(true);
        const before = viewScreenToWorld(normalizeView(v), anchor);
        const after = viewScreenToWorld(next, anchor);
        // The anchor's world point is exact up to rounding in the view's own coordinates.
        const tol = (s: number, x: number) => 1e-9 * Math.max(1, Math.abs(x), Math.abs(4000 / s));
        expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(tol(next.scale.x, before.x) + tol(v.scale.x, before.x));
        expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(tol(next.scale.y, before.y) + tol(v.scale.y, before.y));
        for (const axis of ['x', 'y'] as const) {
          expect(Math.abs(next.scale[axis])).toBeGreaterThanOrEqual(0.1);
          expect(Math.abs(next.scale[axis])).toBeLessThanOrEqual(8);
          expect(Math.sign(next.scale[axis])).toBe(Math.sign(v.scale[axis]));
        }
        const f = typeof factor === 'number' ? factor : factor.x;
        const raw = Math.abs(normalizeView(v).scale.x * f);
        t.count(raw < 0.1 ? 'floor' : raw > 8 ? 'ceiling' : 'free');
      }), runs(N));
    t.atLeast('floor', 10);
    t.atLeast('ceiling', 10);
    t.atLeast('free', 10);
  }, T);

  it('two zooms about one anchor are one zoom by their product while neither clamps', () => {
    const t = tally();
    fc.assert(fc.property(view(-0.5, 0.5, 1e4), point(2000), decades(-0.4, 0.4), decades(-0.4, 0.4), (v, anchor, a, b) => {
      const twice = zoomAt(zoomAt(v, anchor, a), anchor, b);
      const once = zoomAt(v, anchor, a * b);
      const inRange = [Math.abs(v.scale.x) * a, Math.abs(v.scale.x) * a * b, Math.abs(v.scale.y) * a, Math.abs(v.scale.y) * a * b]
        .every((s) => s >= 0.1 && s <= 8);
      if (!inRange) return;
      t.count('composed');
      for (const axis of ['x', 'y'] as const) {
        expect(close(twice.scale[axis], once.scale[axis], 1e-12)).toBe(true);
        expect(close(twice[axis], once[axis], 1e-9)).toBe(true);
      }
    }), runs(N));
    t.atLeast('composed', N / 4);
  }, T);

  it('a one-axis zoom leaves the other axis exactly where it was', () => {
    fc.assert(fc.property(view(-0.5, 0.5), point(), decades(-2, 2), fc.constantFrom('x', 'y'), (v, anchor, f, axis) => {
      const next = zoomAt(v, anchor, axisZoomFactor(f, axis as 'x' | 'y'));
      const other = axis === 'x' ? 'y' : 'x';
      expect(next.scale[other]).toBe(Math.min(8, Math.max(0.1, Math.abs(v.scale[other]))) * Math.sign(v.scale[other]));
      if (Math.abs(v.scale[other]) >= 0.1 && Math.abs(v.scale[other]) <= 8) {
        expect(next[other]).toBe(v[other]);
      }
    }), runs(N));
  }, T);
});

describe('clampView', () => {
  const bounds = fc.record({ x: coord(1e4), y: coord(1e4), width: positive(1, 1e5), height: positive(1, 1e5) });
  const canvas = fc.record({ width: positive(1, 4000), height: positive(1, 4000) });

  it('the visible rect ends inside the bounds, or centered on them when it is the larger, and a second clamp changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(view(-3, 1, 1e5), bounds, canvas, (v, b, c) => {
      const out = clampView(v, b, c);
      const r = viewportWorldRect(out, c);
      const slack = (n: number) => 1e-9 * Math.max(1, Math.abs(b.x), Math.abs(b.y), b.width, b.height, n);
      for (const [lo, size, rl, rs, which] of [[b.x, b.width, r.x, r.width, 'x'], [b.y, b.height, r.y, r.height, 'y']] as const) {
        if (rs >= size) {
          t.count(`centered:${which}`);
          expect(Math.abs((rl + rs / 2) - (lo + size / 2))).toBeLessThanOrEqual(slack(rs));
        } else {
          t.count(`inside:${which}`);
          expect(rl).toBeGreaterThanOrEqual(lo - slack(rs));
          expect(rl + rs).toBeLessThanOrEqual(lo + size + slack(rs));
        }
      }
      expect(out.scale).toBe(v.scale);
      const again = clampView(out, b, c);
      expect(close(again.x, out.x, 1e-12) && close(again.y, out.y, 1e-12)).toBe(true);
      if (sameView(out, v)) {
        t.count('unchanged');
        expect(out).toBe(v);
      }
    }), runs(N));
    for (const k of ['centered:x', 'centered:y', 'inside:x', 'inside:y']) t.atLeast(k, 10);
  }, T);
});

describe('fitViewToBounds', () => {
  const bounds = fc.record({ x: coord(1e5), y: coord(1e5), width: fc.oneof(positive(1e-3, 1e5), fc.constant(0)), height: fc.oneof(positive(1e-3, 1e5), fc.constant(0)) });
  const dims = fc.record({ width: positive(50, 4000), height: positive(50, 4000) });

  it('contain: the bounds sit centered in the viewport, inside the padding unless the zoom floor stops them', () => {
    const t = tally();
    fc.assert(fc.property(bounds, dims, view(), fc.integer({ min: 0, max: 20 }), (b, d, cur, padding) => {
      const out = fitViewToBounds(b, d, cur, { padding });
      if (!hasExtent(b)) {
        t.count('empty');
        expect(out).toBeNull();
        return;
      }
      expect(out).not.toBeNull();
      expect(finite(out!)).toBe(true);
      expect(Math.sign(out!.scale.x)).toBe(Math.sign(cur.scale.x));
      expect(Math.sign(out!.scale.y)).toBe(Math.sign(cur.scale.y));
      expect(Math.abs(out!.scale.x)).toBe(Math.abs(out!.scale.y));
      const a = viewWorldToScreen(out!, { x: b.x, y: b.y });
      const z = viewWorldToScreen(out!, { x: b.x + b.width, y: b.y + b.height });
      const tol = 1e-6 * Math.max(1, Math.abs(b.x), Math.abs(b.y)) * Math.abs(out!.scale.x) + 1e-6;
      expect(Math.abs((a.x + z.x) / 2 - d.width / 2)).toBeLessThanOrEqual(tol);
      expect(Math.abs((a.y + z.y) / 2 - d.height / 2)).toBeLessThanOrEqual(tol);
      const s = Math.abs(out!.scale.x);
      if (s > 0.1 && s < 8) {
        t.count('fits');
        const availW = Math.max(1, d.width - 2 * padding);
        const availH = Math.max(1, d.height - 2 * padding);
        expect(b.width * s).toBeLessThanOrEqual(availW * (1 + 1e-9));
        expect(b.height * s).toBeLessThanOrEqual(availH * (1 + 1e-9));
        expect(close(b.width * s, availW, 1e-9) || close(b.height * s, availH, 1e-9)).toBe(true);
      } else t.count('clamped');
    }), runs(N));
    t.atLeast('empty', 3);
    t.atLeast('fits', 20);
    t.atLeast('clamped', 10);
  }, T);

  it('fitToBounds centers the content at the zoom fitZoom gives, and is null exactly when there is nothing to fit', () => {
    fc.assert(fc.property(positive(1, 4000), positive(1, 4000), fc.oneof(positive(1e-3, 1e5), fc.constant(0), fc.constant(-5)),
      fc.oneof(positive(1e-3, 1e5), fc.constant(0)), fc.integer({ min: 0, max: 30 }), (vw, vh, cw, ch, pad) => {
        const out = fitToBounds(vw, vh, cw, ch, pad);
        if (!(cw > 0 || ch > 0)) return void expect(out).toBeNull();
        expect(out).not.toBeNull();
        const { zoom, panX, panY } = out!;
        expect([zoom, panX, panY].every(Number.isFinite)).toBe(true);
        expect(zoom).toBeGreaterThanOrEqual(ZOOM_FLOOR);
        expect(close(panX + Math.max(0, cw) * zoom / 2, vw / 2, 1e-9)).toBe(true);
        expect(close(panY + Math.max(0, ch) * zoom / 2, vh / 2, 1e-9)).toBe(true);
      }), runs(N));
  }, T);
});

describe('interpolateView', () => {
  it('starts at `from`, ends at `to`, stays finite, and moves each positive scale monotonically', () => {
    const t = tally();
    fc.assert(fc.property(view(-3, 2, 1e5), view(-3, 2, 1e5), fc.boolean(), (from, to, same) => {
      const target = same ? { ...to, scale: from.scale } : to;
      const f = interpolateView(from, target);
      const a = f(0);
      const z = f(1);
      for (const axis of ['x', 'y'] as const) {
        const tol = 1e-9 * Math.max(1, Math.abs(from[axis]), Math.abs(target[axis]));
        expect(Math.abs(a[axis] - from[axis]), `start ${axis}`).toBeLessThanOrEqual(tol);
        expect(Math.abs(z[axis] - target[axis]), `end ${axis}`).toBeLessThanOrEqual(tol);
        expect(close(a.scale[axis], from.scale[axis], 1e-12)).toBe(true);
        expect(close(z.scale[axis], target.scale[axis], 1e-12)).toBe(true);
      }
      let prev = a;
      for (let k = 1; k <= 8; k++) {
        const v = f(k / 8);
        expect(finite(v)).toBe(true);
        for (const axis of ['x', 'y'] as const) {
          if (from.scale[axis] > 0 && target.scale[axis] > 0) {
            const up = target.scale[axis] >= from.scale[axis];
            expect(up ? v.scale[axis] >= prev.scale[axis] * (1 - 1e-12) : v.scale[axis] <= prev.scale[axis] * (1 + 1e-12)).toBe(true);
          }
        }
        prev = v;
      }
      t.count(same ? 'pan' : 'zoom');
    }), runs(N));
    t.atLeast('pan', 20);
    t.atLeast('zoom', 20);
  }, T);

  it('views that differ in scale hold one screen point fixed the whole way', () => {
    const t = tally();
    fc.assert(fc.property(view(-2, 1, 1e4), decades(-2, 2), decades(-2, 2), point(2000), (from, kx, ky, pin) => {
      if (!(from.scale.x > 0 && from.scale.y > 0)) return;
      const to = zoomAt(from, pin, { x: kx, y: ky }, { min: 1e-6, max: 1e6 });
      if (Math.abs(to.scale.x / from.scale.x - 1) < 1e-3 || Math.abs(to.scale.y / from.scale.y - 1) < 1e-3) return;
      t.count('anchored');
      const f = interpolateView(from, to);
      const w = viewScreenToWorld(from, pin);
      for (const k of [0.25, 0.5, 0.75]) {
        const at = viewScreenToWorld(f(k), pin);
        const tol = 1e-6 * Math.max(1, Math.abs(w.x), Math.abs(w.y), 2000 / Math.min(from.scale.x, from.scale.y, to.scale.x, to.scale.y));
        expect(Math.abs(at.x - w.x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(at.y - w.y)).toBeLessThanOrEqual(tol);
      }
    }), runs(N));
    t.atLeast('anchored', N / 10);
  }, T);
});

describe('parallax planes', () => {
  const factor = fc.oneof(fc.double({ min: 0, max: 2, noNaN: true }), fc.constantFrom(0, 1));
  const opts = fc.record({
    pan: fc.oneof(factor, fc.record({ x: factor, y: factor })),
    zoom: fc.option(fc.oneof(factor, fc.record({ x: factor, y: factor })), { nil: undefined }),
    anchor: fc.option(point(1e3), { nil: undefined }),
  });

  it('a point and its plane image sit under one pixel, and the map inverts', () => {
    fc.assert(fc.property(view(-2, 1, 1e4), opts, point(1e4), (outer, o, p) => {
      const inner = deriveParallaxView(outer, o);
      expect(finite(inner)).toBe(true);
      const m = planeMap(outer, o);
      const q = toPlane(m, p);
      const s1 = viewWorldToScreen(outer, p);
      const s2 = viewWorldToScreen(inner, q);
      const tol = 1e-7 * Math.max(1, Math.abs(s1.x), Math.abs(s1.y), Math.abs(outer.x * outer.scale.x), Math.abs(outer.y * outer.scale.y));
      expect(Math.abs(s1.x - s2.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(s1.y - s2.y)).toBeLessThanOrEqual(tol);
      const back = fromPlane(m, q);
      expect(close(back.x, p.x, 1e-7) && close(back.y, p.y, 1e-7)).toBe(true);
      const r = rectToPlane(m, { x: p.x, y: p.y, width: 10, height: 5 });
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
    }), runs(N));
  }, T);

  it('identity factors give the camera, and planeToPlane composes the two maps', () => {
    fc.assert(fc.property(view(-2, 1, 1e4), opts, opts, point(1e4), (outer, a, b, p) => {
      expect(sameView(deriveParallaxView(outer, { pan: 1, zoom: 1 }), outer)).toBe(true);
      const ma = planeMap(outer, a);
      const mb = planeMap(outer, b);
      const ab = planeToPlane(ma, mb);
      const direct = toPlane(mb, fromPlane(ma, p));
      const via = ab ? toPlane(ab, p) : p;
      const tol = 1e-6 * Math.max(1, Math.abs(direct.x), Math.abs(direct.y), Math.abs(p.x), Math.abs(p.y), Math.abs(ma.offset.x), Math.abs(ma.offset.y), Math.abs(mb.offset.x), Math.abs(mb.offset.y));
      expect(Math.abs(via.x - direct.x)).toBeLessThanOrEqual(tol);
      expect(Math.abs(via.y - direct.y)).toBeLessThanOrEqual(tol);
      expect(planeToPlane(ma, ma)).toBeNull();
    }), runs(N));
  }, T);
});

describe('pick slop', () => {
  it('widening by a positive amount adds it where the slop is measured, and anything else leaves it', () => {
    fc.assert(fc.property(fc.oneof(fc.constant(undefined), positive(0, 20), fc.record({ px: positive(0, 20), scale: fc.record({ x: decades(-2, 2), y: decades(-2, 2) }) })),
      fc.oneof(positive(1e-6, 10), fc.constantFrom(0, -1, NaN)), decades(-2, 2), (slop, px, scale) => {
        const out = widenSlop(slop, px, scale);
        if (!(px > 0)) return void expect(out).toBe(slop);
        if (typeof slop === 'object') expect(out).toEqual({ ...slop, px: slop.px + px });
        else expect(close(out as number, (slop ?? 0) + px / scale, 1e-12)).toBe(true);
        expect(hasSlop(out)).toBe(true);
      }), runs(N));
  }, T);
});
