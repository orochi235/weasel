/**
 * Property tests for the rect-pose geometry: unions bound what they bound and no more, a pose drawn turned or
 * skewed reports the extent of its ink, the rect descriptor's remap is the affine between two boxes, and a turned
 * leaf remapped inside a group resize is drawn where the group's map puts its old drawing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { transformPoint, poseFrameOf } from '@weasel-js/geom';
import { close, coord, positive, runs, tally, timeoutFor } from '../pbt.fixture';
import { axisAlignedBounds, positiveBox, unionAABB, unionBounds } from './unionBounds';
import { RECT_POSE_DESCRIPTOR, remapRotatedLeaf, translatePoseViaDescriptor, type RotatedPose } from './poseDescriptor';
import type { Bounds } from 'core/viewport/fitViewToBounds';

const N = 300;
const T = timeoutFor(N, 1);

const box = fc.record({ x: coord(1e4), y: coord(1e4), width: coord(1e3), height: coord(1e3) });
const posBox = fc.record({ x: coord(1e4), y: coord(1e4), width: positive(0, 1e3), height: positive(0, 1e3) });
const angle = fc.oneof(fc.integer({ min: -1e6, max: 1e6 }).map((n) => (n / 1e6) * Math.PI), fc.constantFrom(0, Math.PI / 2, -Math.PI / 2, Math.PI));
const linear = fc.tuple(coord(3), coord(3), coord(3), coord(3)).filter(([a, b, c, d]) => Math.abs(a * d - b * c) > 1e-3);
const framed = fc.record({
  x: coord(1e4), y: coord(1e4), width: coord(1e3), height: coord(1e3),
  rotation: fc.option(angle, { nil: undefined }),
  transform: fc.option(linear, { nil: undefined }),
}).map((p) => {
  const out: Bounds = { x: p.x, y: p.y, width: p.width, height: p.height };
  if (p.rotation !== undefined) out.rotation = p.rotation;
  if (p.transform !== undefined) (out as Bounds & { transform?: readonly number[] }).transform = p.transform;
  return out;
});

/** The four corners of `b` where its pose draws them. */
function inkCorners(b: Bounds): [number, number][] {
  const frame = poseFrameOf(b);
  const corners: [number, number][] = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
  return frame ? corners.map(([x, y]) => transformPoint(frame, x, y) as [number, number]) : corners;
}

const slack = (...ns: number[]) => 1e-9 * Math.max(1, ...ns.map(Math.abs));

function expectHolds(outer: Bounds, x: number, y: number): void {
  const s = slack(outer.x, outer.y, outer.width, outer.height, x, y);
  expect(x).toBeGreaterThanOrEqual(outer.x - s);
  expect(x).toBeLessThanOrEqual(outer.x + outer.width + s);
  expect(y).toBeGreaterThanOrEqual(outer.y - s);
  expect(y).toBeLessThanOrEqual(outer.y + outer.height + s);
}

describe('unions', () => {
  it('unionBounds holds every corner of every box, has no negative size, and each edge touches one', () => {
    fc.assert(fc.property(fc.array(box, { minLength: 1, maxLength: 6 }), (boxes) => {
      const u = unionBounds(boxes)!;
      expect(u.width).toBeGreaterThanOrEqual(0);
      expect(u.height).toBeGreaterThanOrEqual(0);
      const xs = boxes.flatMap((b) => [b.x, b.x + b.width]);
      const ys = boxes.flatMap((b) => [b.y, b.y + b.height]);
      for (const b of boxes) for (const [x, y] of inkCorners({ x: b.x, y: b.y, width: b.width, height: b.height })) expectHolds(u, x, y);
      expect(u.x).toBe(Math.min(...xs));
      expect(u.y).toBe(Math.min(...ys));
      expect(close(u.x + u.width, Math.max(...xs), 1e-12)).toBe(true);
      expect(close(u.y + u.height, Math.max(...ys), 1e-12)).toBe(true);
      expect(unionBounds([])).toBeNull();
    }), runs(N));
  }, T);

  it('unionAABB holds every drawn corner of every part, tightly, skipping holes, and never reports a rotation', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.option(framed, { nil: undefined, freq: 5 }), { maxLength: 6 }), (parts) => {
      const u = unionAABB(parts);
      const real = parts.filter((p): p is Bounds => p !== undefined);
      if (real.length === 0) return void expect(u).toBeNull();
      expect(u).not.toBeNull();
      expect(u!.rotation).toBeUndefined();
      const corners = real.flatMap(inkCorners);
      for (const [x, y] of corners) expectHolds(u!, x, y);
      const s = slack(...corners.flat());
      expect(Math.abs(u!.x - Math.min(...corners.map((c) => c[0])))).toBeLessThanOrEqual(s);
      expect(Math.abs(u!.y + u!.height - Math.max(...corners.map((c) => c[1])))).toBeLessThanOrEqual(s);
      if (real.some((p) => p.rotation || (p as { transform?: unknown }).transform)) t.count('turned');
    }), runs(N));
    t.atLeast('turned', N / 4);
  }, T);

  it('axisAlignedBounds of a plain box is that box made positive, and of a drawn one covers the ink exactly', () => {
    fc.assert(fc.property(framed, (b) => {
      const a = axisAlignedBounds(b);
      expect(a.width).toBeGreaterThanOrEqual(0);
      expect(a.height).toBeGreaterThanOrEqual(0);
      expect(a.rotation).toBeUndefined();
      for (const [x, y] of inkCorners(b)) expectHolds(a, x, y);
      if (!b.rotation && !(b as { transform?: unknown }).transform) {
        const p = positiveBox(b);
        expect(a).toEqual({ x: p.x, y: p.y, width: p.width, height: p.height });
        expect(positiveBox(p)).toBe(p);
        expectHolds(p, b.x, b.y);
        expectHolds(p, b.x + b.width, b.y + b.height);
      }
    }), runs(N));
  }, T);
});

describe('the rect descriptor', () => {
  it('remapBounds takes src onto dst, and remapping a then b is remapping straight from the first box to the last', () => {
    fc.assert(fc.property(posBox, posBox, posBox, posBox, (p, a, b, c) => {
      const s = (...more: number[]) => 1e-7 * Math.max(1, ...[p, a, b, c].flatMap((q) => [q.x, q.y, q.width, q.height]).map(Math.abs), ...more.map(Math.abs));
      if (a.width < 1e-3 || a.height < 1e-3 || b.width < 1e-3 || b.height < 1e-3) return;
      const onto = RECT_POSE_DESCRIPTOR.remapBounds(a, a, b);
      for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(onto[k] - b[k])).toBeLessThanOrEqual(s());
      const twice = RECT_POSE_DESCRIPTOR.remapBounds(RECT_POSE_DESCRIPTOR.remapBounds(p, a, b), b, c);
      const once = RECT_POSE_DESCRIPTOR.remapBounds(p, a, c);
      const scale = Math.max(c.width / a.width, c.height / a.height, 1);
      for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(twice[k] - once[k])).toBeLessThanOrEqual(s(scale * 1e4, once[k]));
      const moved = translatePoseViaDescriptor(p, 3, -4, RECT_POSE_DESCRIPTOR);
      expect(moved).toEqual({ ...p, x: p.x + 3, y: p.y - 4 });
    }), runs(N));
  }, T);

  it('lerp starts at a, ends at b up to a whole turn, and takes the short way round', () => {
    fc.assert(fc.property(framed, framed, fc.double({ min: 0, max: 1, noNaN: true }), (a, b, k) => {
      const lerp = RECT_POSE_DESCRIPTOR.lerp!;
      const z = lerp(a, b, 1);
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(close(lerp(a, b, 0)[key], a[key], 1e-12)).toBe(true);
        expect(close(z[key], b[key], 1e-12)).toBe(true);
      }
      if (a.rotation !== undefined || b.rotation !== undefined) {
        const turn = (z.rotation! - (b.rotation ?? 0)) / (2 * Math.PI);
        expect(Math.abs(turn - Math.round(turn))).toBeLessThan(1e-9);
        const mid = lerp(a, b, k).rotation! - (a.rotation ?? 0);
        expect(Math.abs(mid)).toBeLessThanOrEqual(Math.PI * k + 1e-9);
      }
    }), runs(N));
  }, T);
});

describe('remapRotatedLeaf', () => {
  it('draws the leaf where the group\'s map takes its old drawing', () => {
    const t = tally();
    const leaf = fc.record({
      x: coord(500), y: coord(500), width: positive(0.1, 200), height: positive(0.1, 200), rotation: angle,
      transform: fc.option(linear, { nil: undefined }),
    }).map((p) => {
      const { transform, ...rest } = p;
      return (transform ? { ...rest, transform } : rest) as RotatedPose;
    });
    const groupBox = fc.record({ x: coord(500), y: coord(500), width: fc.integer({ min: 1, max: 500 }), height: fc.integer({ min: 1, max: 500 }) });
    fc.assert(fc.property(leaf, groupBox, groupBox, (p, src, dst) => {
      const next = remapRotatedLeaf(p, src, dst);
      const sx = dst.width / src.width;
      const sy = dst.height / src.height;
      const g = ([x, y]: [number, number]): [number, number] => [dst.x + (x - src.x) * sx, dst.y + (y - src.y) * sy];
      const want = inkCorners(p).map(g);
      const got = inkCorners(next);
      const s = 1e-6 * Math.max(1, ...want.flat().map(Math.abs));
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(got[i]![0] - want[i]![0]), JSON.stringify({ p, src, dst, next })).toBeLessThanOrEqual(s);
        expect(Math.abs(got[i]![1] - want[i]![1])).toBeLessThanOrEqual(s);
      }
      expect([next.x, next.y, next.width, next.height, next.rotation].every(Number.isFinite)).toBe(true);
      t.count(Math.abs(sx - sy) > 0.1 && Math.abs(Math.sin(2 * p.rotation)) > 0.1 ? 'skewing' : 'other');
    }), runs(N));
    t.atLeast('skewing', N / 4);
  }, T);
});
