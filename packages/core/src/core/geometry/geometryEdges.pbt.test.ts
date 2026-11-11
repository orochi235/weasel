/**
 * Second-pass property tests for the rect-pose geometry: unions as a join (any order, any grouping, repeats
 * changing nothing), unions and remaps over boxes at the edges of the double range, and a turned leaf inside a
 * group resized to nothing on one axis or from a box of next to no size.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyToPoint, extentScale, poseFrameOf } from '@weasel-js/geom';
import { coord, positive, runs, tally, timeoutFor } from '../pbt.fixture';
import { unionAABB, unionBounds, axisAlignedBounds } from './unionBounds';
import { RECT_POSE_DESCRIPTOR, remapRotatedLeaf, type RotatedPose } from './poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';

const N = 300;
const T = timeoutFor(N, 1);

const EDGES = [0, -0, NaN, Infinity, -Infinity, Number.MIN_VALUE, -Number.MIN_VALUE, 1e-310, 1e300, -1e300, Number.MAX_VALUE];
const edgy = (limit: number) => fc.oneof({ weight: 3, arbitrary: coord(limit) }, fc.constantFrom(...EDGES));
const box = fc.record({ x: coord(1e4), y: coord(1e4), width: coord(1e3), height: coord(1e3) });
const wildBox = fc.record({ x: edgy(1e4), y: edgy(1e4), width: edgy(1e3), height: edgy(1e3) });
const angle = fc.oneof(fc.integer({ min: -1e6, max: 1e6 }).map((n) => (n / 1e6) * Math.PI), fc.constantFrom(0, Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI));
const allFinite = (b: { x: number; y: number; width: number; height: number }) => [b.x, b.y, b.width, b.height].every(Number.isFinite);

describe('unions are a join', () => {
  it('any order, any split into two unions, and a repeated box give the same union', () => {
    fc.assert(fc.property(fc.array(box, { minLength: 1, maxLength: 8 }), fc.nat(), fc.nat(), (boxes, cut, seed) => {
      const u = unionBounds(boxes)!;
      const shuffled = [...boxes].sort((a, b) => ((a.x * 31 + seed) % 7) - ((b.x * 31 + seed) % 7));
      expect(unionBounds(shuffled)).toEqual(u);
      expect(unionBounds([...boxes, ...boxes])).toEqual(u);
      const k = 1 + (cut % boxes.length);
      const left = unionBounds(boxes.slice(0, k))!;
      const right = boxes.length > k ? unionBounds(boxes.slice(k)) : null;
      const joined = unionBounds(right ? [left, right] : [left])!;
      expect(joined.x).toBe(u.x);
      expect(joined.y).toBe(u.y);
      expect(Math.abs(joined.x + joined.width - (u.x + u.width))).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(u.x), u.width));
      expect(unionAABB(boxes)).toEqual(unionAABB(shuffled));
    }), runs(N));
  }, T);

  it('a union over boxes at the edges of the range is null, or finite with no negative size, and holds every finite box', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(wildBox, { maxLength: 5 }), (boxes) => {
      for (const u of [unionBounds(boxes), unionAABB(boxes)]) {
        const real = boxes.filter((b) => allFinite(b) && Number.isFinite(b.x + b.width) && Number.isFinite(b.y + b.height));
        if (u === null) {
          expect(real, 'a union of finite boxes is something').toEqual([]);
          t.count('null');
          continue;
        }
        expect(u.width, JSON.stringify({ boxes, u })).toBeGreaterThanOrEqual(0);
        expect(u.height).toBeGreaterThanOrEqual(0);
        for (const b of real) {
          expect(u.x).toBeLessThanOrEqual(Math.min(b.x, b.x + b.width));
          expect(u.y).toBeLessThanOrEqual(Math.min(b.y, b.y + b.height));
        }
        if (real.length < boxes.length) t.count('wild');
      }
    }), runs(N));
    t.atLeast('wild', N / 4);
    t.atLeast('null', 5);
  }, T);
});

describe('remaps between boxes of next to no size', () => {
  const tiny = fc.oneof(fc.constantFrom(0, Number.MIN_VALUE, 1e-310, 1e-300), positive(1, 500));

  it('remapBounds from a box of any size onto a finite one is finite', () => {
    const t = tally();
    fc.assert(fc.property(box, fc.record({ x: coord(500), y: coord(500), width: tiny, height: tiny }), fc.record({ x: coord(500), y: coord(500), width: positive(0, 500), height: positive(0, 500) }),
      (p, src, dst) => {
        const out = RECT_POSE_DESCRIPTOR.remapBounds(p, src, dst);
        // A finite factor can still carry a point off the source box past the double range: the map's own image.
        if (!Number.isFinite((p.x - src.x) * extentScale(src.width, dst.width)) || !Number.isFinite((p.y - src.y) * extentScale(src.height, dst.height))) return;
        expect(allFinite(out), JSON.stringify({ p, src, dst, out })).toBe(true);
        if (src.width > 0 && src.width < 1e-200) t.count('subnormal');
      }), runs(N));
    t.atLeast('subnormal', N / 10);
  }, T);

  it('a turned leaf in a group resized to nothing, or from next to nothing, stays finite and drawn where the group map puts it', () => {
    const t = tally();
    const leaf = fc.record({ x: coord(500), y: coord(500), width: positive(0.1, 200), height: positive(0.1, 200), rotation: angle });
    const src = fc.record({ x: coord(500), y: coord(500), width: tiny, height: tiny });
    const dst = fc.record({ x: coord(500), y: coord(500), width: fc.oneof(fc.constant(0), positive(1, 500)), height: fc.oneof(fc.constant(0), positive(1, 500)) });
    fc.assert(fc.property(leaf, src, dst, (p: RotatedPose, s: Bounds, d: Bounds) => {
      const next = remapRotatedLeaf(p, s, d);
      const flat = [next.x, next.y, next.width, next.height, next.rotation, ...((next as { transform?: number[] }).transform ?? [])];
      expect(flat.every(Number.isFinite), JSON.stringify({ p, s, d, next })).toBe(true);
      // The group map as the descriptor reads it: an axis with no source extent keeps its scale.
      const sx = extentScale(s.width, d.width);
      const sy = extentScale(s.height, d.height);
      if (sx > 1e6 || sy > 1e6) return;
      const g = ([x, y]: readonly number[]) => [d.x + (x! - s.x) * sx, d.y + (y! - s.y) * sy];
      const corners = (b: Bounds) => {
        const frame = poseFrameOf(b);
        const cs = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]] as const;
        return cs.map(([x, y]) => (frame ? applyToPoint(frame, x, y) : [x, y]));
      };
      const want = corners(p).map(g);
      const got = corners(next);
      const tol = 1e-6 * Math.max(1, ...want.flat().map(Math.abs));
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(got[i]![0]! - want[i]![0]!), JSON.stringify({ p, s, d, next })).toBeLessThanOrEqual(tol);
        expect(Math.abs(got[i]![1]! - want[i]![1]!)).toBeLessThanOrEqual(tol);
      }
      t.count(d.width === 0 || d.height === 0 ? 'collapsed' : 'open');
      expect(axisAlignedBounds(next).width).toBeGreaterThanOrEqual(0);
    }), runs(N));
    t.atLeast('collapsed', N / 10);
  }, T);
});
