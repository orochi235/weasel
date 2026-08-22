/**
 * Property tests over pseudo-random input. The kernel is pure, so these are
 * cheap; the seed is fixed so a failure reproduces exactly.
 */
import { describe, it, expect } from 'vitest';
import { cubicBounds, cubicEvalAt, flattenCubic, elevateQuadraticToCubic } from './curve';
import { identity, invert, multiply, applyToPoint, rotateAboutPoint, boxToBox } from './mat3';
import { approxEq } from './scalar';
import { boundsOfCoords, boxContainsPoint } from './box';
import { transformCoords } from './affine';

/** mulberry32 — a small deterministic PRNG so failures reproduce. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUNS = 400;

describe('cubicBounds', () => {
  it('contains every point on the curve', () => {
    const r = rng(1);
    for (let i = 0; i < RUNS; i++) {
      const p = Array.from({ length: 8 }, () => (r() - 0.5) * 2000);
      const b = cubicBounds(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
      for (let k = 0; k <= 200; k++) {
        const [x, y] = cubicEvalAt(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], k / 200);
        expect(boxContainsPoint(b, x, y)).toBe(true);
      }
    }
  });

  it('is no larger than the control hull', () => {
    const r = rng(2);
    for (let i = 0; i < RUNS; i++) {
      const p = Array.from({ length: 8 }, () => (r() - 0.5) * 2000);
      const b = cubicBounds(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
      const hull = boundsOfCoords(p)!;
      expect(b[0]).toBeGreaterThanOrEqual(hull[0] - 1e-9);
      expect(b[1]).toBeGreaterThanOrEqual(hull[1] - 1e-9);
      expect(b[2]).toBeLessThanOrEqual(hull[2] + 1e-9);
      expect(b[3]).toBeLessThanOrEqual(hull[3] + 1e-9);
    }
  });
});

describe('flattenCubic', () => {
  it('ends at the endpoint and stays inside the cubic bounds', () => {
    const r = rng(3);
    for (let i = 0; i < RUNS; i++) {
      const p = Array.from({ length: 8 }, () => (r() - 0.5) * 2000);
      const out: number[] = [];
      flattenCubic(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 0.5, out);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out[out.length - 2]).toBe(p[6]);
      expect(out[out.length - 1]).toBe(p[7]);
      const b = cubicBounds(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
      for (let k = 0; k < out.length; k += 2) {
        expect(boxContainsPoint(b, out[k], out[k + 1])).toBe(true);
      }
    }
  });

  it('emits more points as the tolerance tightens', () => {
    const r = rng(4);
    for (let i = 0; i < RUNS; i++) {
      const p = Array.from({ length: 8 }, () => (r() - 0.5) * 2000);
      const loose: number[] = [];
      const tight: number[] = [];
      flattenCubic(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 4, loose);
      flattenCubic(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 0.25, tight);
      expect(tight.length).toBeGreaterThanOrEqual(loose.length);
    }
  });
});

describe('elevateQuadraticToCubic', () => {
  it('samples identically to the quadratic it elevates', () => {
    const r = rng(5);
    for (let i = 0; i < RUNS; i++) {
      const [q0x, q0y, cx, cy, q1x, q1y] = Array.from({ length: 6 }, () => (r() - 0.5) * 2000);
      const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(q0x, q0y, cx, cy, q1x, q1y);
      for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const u = 1 - t;
        const qx = u * u * q0x + 2 * u * t * cx + t * t * q1x;
        const qy = u * u * q0y + 2 * u * t * cy + t * t * q1y;
        const [bx, by] = cubicEvalAt(q0x, q0y, c1x, c1y, c2x, c2y, q1x, q1y, t);
        expect(approxEq(bx, qx)).toBe(true);
        expect(approxEq(by, qy)).toBe(true);
      }
    }
  });
});

describe('mat3', () => {
  it('m · invert(m) is the identity', () => {
    const r = rng(6);
    for (let i = 0; i < RUNS; i++) {
      const m = [
        (r() - 0.5) * 20, (r() - 0.5) * 20,
        (r() - 0.5) * 20, (r() - 0.5) * 20,
        (r() - 0.5) * 2000, (r() - 0.5) * 2000,
      ];
      const inv = invert(m);
      if (inv === null) continue;   // rejected as ill-conditioned
      const id = multiply(m, inv);
      for (let k = 0; k < 6; k++) expect(approxEq(id[k], identity()[k], 1e-4)).toBe(true);
    }
  });

  it('rotateAboutPoint leaves its pivot fixed', () => {
    const r = rng(7);
    for (let i = 0; i < RUNS; i++) {
      const cx = (r() - 0.5) * 2000, cy = (r() - 0.5) * 2000;
      const [x, y] = applyToPoint(rotateAboutPoint(cx, cy, (r() - 0.5) * 20), cx, cy);
      expect(approxEq(x, cx, 1e-6)).toBe(true);
      expect(approxEq(y, cy, 1e-6)).toBe(true);
    }
  });

  it('boxToBox maps the source corners onto the destination corners', () => {
    const r = rng(8);
    for (let i = 0; i < RUNS; i++) {
      const [sx, sy, dx, dy] = Array.from({ length: 4 }, () => (r() - 0.5) * 2000);
      const sw = (r() - 0.5) * 500 || 1, sh = (r() - 0.5) * 500 || 1;
      const dw = (r() - 0.5) * 500, dh = (r() - 0.5) * 500;
      const m = boxToBox(sx, sy, sw, sh, dx, dy, dw, dh);
      const near = applyToPoint(m, sx, sy);
      const far = applyToPoint(m, sx + sw, sy + sh);
      expect(approxEq(near[0], dx, 1e-6)).toBe(true);
      expect(approxEq(near[1], dy, 1e-6)).toBe(true);
      expect(approxEq(far[0], dx + dw, 1e-6)).toBe(true);
      expect(approxEq(far[1], dy + dh, 1e-6)).toBe(true);
    }
  });

  it('transformCoords agrees with applyToPoint', () => {
    const r = rng(9);
    for (let i = 0; i < RUNS; i++) {
      const m = Array.from({ length: 6 }, () => (r() - 0.5) * 20);
      const coords = Array.from({ length: 10 }, () => (r() - 0.5) * 2000);
      const out = transformCoords(coords, m);
      for (let k = 0; k < coords.length; k += 2) {
        const [x, y] = applyToPoint(m, coords[k], coords[k + 1]);
        expect(out[k]).toBe(x);
        expect(out[k + 1]).toBe(y);
      }
    }
  });
});
