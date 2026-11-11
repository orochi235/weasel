/**
 * Property tests of carrying clips between parallax planes: `clipCarrier` against mapping each corner out of
 * one plane's world and into the other's, whatever clips it has carried before, shared clip objects included;
 * `pathFromPlane` the same out to the camera's; `planeTransform` there and back as the identity.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type Path } from '@weasel-js/geom';
import { fromPlane, planeMap, toPlane, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { clipCarrier, pathFromPlane, planeTransform } from './planeClips';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const coord = (limit: number) => fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
const factor = fc.oneof(fc.constant(1), fc.double({ min: 0.1, max: 2, noNaN: true }));
const camera: fc.Arbitrary<View> = fc.record({
  x: coord(500), y: coord(500), scale: fc.double({ min: 0.25, max: 4, noNaN: true }).map((s) => ({ x: s, y: s })),
});
const parallax = fc.record({ pan: factor, zoom: factor });

const LAYERS = ['p0', 'p1', 'p2', 'flat'] as const;
type Layer = (typeof LAYERS)[number];

const rect = fc.record({ x: coord(300), y: coord(300), width: fc.double({ min: 1, max: 200, noNaN: true }), height: fc.double({ min: 1, max: 200, noNaN: true }) })
  .map((r): Path => ({ kind: 'rect', ...r }));

/** `p` out of `from`'s world into the camera's, then into `to`'s. */
const through = (from: PlaneMap | null, to: PlaneMap | null, p: { x: number; y: number }) => {
  const cam = from ? fromPlane(from, p) : p;
  return to ? toPlane(to, cam) : cam;
};

const corners = (r: Path) => {
  const b = r as { x: number; y: number; width: number; height: number };
  return [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height }];
};

function expectRectNear(got: Path, want: { x: number; y: number }[]): void {
  const b = got as { kind: string; x: number; y: number; width: number; height: number };
  expect(b.kind).toBe('rect');
  const xs = want.map((p) => p.x), ys = want.map((p) => p.y);
  const tol = (v: number) => 1e-9 * Math.max(1, Math.abs(v));
  const close = (a: number, e: number) => expect(Math.abs(a - e)).toBeLessThanOrEqual(tol(e) * 10);
  close(b.x, Math.min(...xs));
  close(b.y, Math.min(...ys));
  close(b.x + b.width, Math.max(...xs));
  close(b.y + b.height, Math.max(...ys));
}

describe('clipCarrier', () => {
  it('maps each corner out of the clip’s plane and into the target’s, whatever it carried before', () => {
    let moved = 0, shared = 0;
    fc.assert(fc.property(
      camera, fc.tuple(parallax, parallax, parallax), fc.array(rect, { minLength: 1, maxLength: 3 }),
      fc.array(fc.record({ clip: fc.nat(), from: fc.constantFrom(...LAYERS), to: fc.constantFrom(...LAYERS) }), { minLength: 1, maxLength: 12 }),
      (cam, [a, b, c], clips, asks) => {
        const maps = new Map<Layer, PlaneMap>([['p0', planeMap(cam, a)], ['p1', planeMap(cam, b)], ['p2', planeMap(cam, c)]]);
        const planeOf = (l: string) => maps.get(l as Layer) ?? null;
        const carry = clipCarrier(planeOf);
        const fromSeen = new Map<Path, Set<string>>();
        for (const ask of asks) {
          const clip = clips[ask.clip % clips.length]!;
          const got = carry(clip, ask.from, ask.to);
          if (ask.from === ask.to) expect(got).toBe(clip);
          else {
            expectRectNear(got, corners(clip).map((p) => through(planeOf(ask.from), planeOf(ask.to), p)));
            moved++;
          }
          const seen = fromSeen.get(clip) ?? new Set();
          if (seen.size > 0 && !seen.has(ask.from)) shared++;
          seen.add(ask.from);
          fromSeen.set(clip, seen);
        }
      },
    ), runs(RUNS));
    expect(moved).toBeGreaterThan(RUNS);
    expect(shared).toBeGreaterThan(RUNS / 4);
  }, timeoutFor(RUNS, 2));

  it('passes every clip through untouched with no planes', () => {
    fc.assert(fc.property(rect, fc.constantFrom(...LAYERS, undefined), fc.constantFrom(...LAYERS, undefined), (clip, from, to) => {
      expect(clipCarrier(null)(clip, from, to)).toBe(clip);
    }), runs(RUNS));
  });
});

describe('pathFromPlane and planeTransform', () => {
  it('pathFromPlane maps a rect out to the camera’s world', () => {
    fc.assert(fc.property(camera, parallax, rect, (cam, opts, r) => {
      const m = planeMap(cam, opts);
      expectRectNear(pathFromPlane(r, m), corners(r).map((p) => fromPlane(m, p)));
      expect(pathFromPlane(r, null)).toBe(r);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('a plane transform there and back is the identity, and none between a plane and itself', () => {
    fc.assert(fc.property(camera, parallax, fc.option(parallax, { nil: null }), (cam, a, b) => {
      const from = planeMap(cam, a);
      const to = b === null ? null : planeMap(cam, b);
      expect(planeTransform(from, from)).toBeUndefined();
      const there = planeTransform(from, to);
      const back = planeTransform(to, from);
      if (there === undefined || back === undefined) {
        expect(there).toBe(back);
        return;
      }
      const id = mat3.multiply(back, there);
      [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(id[i]!).toBeCloseTo(v, 9));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
