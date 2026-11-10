import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compose, identity, invert, multiply, perspective, transformPoint, type Mat4 } from './mat4';
import { distance, len, quatFromAxisAngle, quatMultiply, quatRotate, vec3, type Quat, type Vec3 } from './vec3';
import { intersectRayAabb, pointOnRay, transformAabb, type Aabb } from './ray3';
import { coord, decades, maxDiff, runs } from '../pbt.fixture';

const RUNS = runs(200);

const v3 = (limit = 1000): fc.Arbitrary<Vec3> => fc.tuple(coord(limit), coord(limit), coord(limit))
  .map(([x, y, z]) => vec3(x, y, z));
const unit: fc.Arbitrary<Vec3> = v3(1).filter((v) => len(v) > 1e-3);
const quat: fc.Arbitrary<Quat> = fc.tuple(unit, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }))
  .map(([axis, a]) => quatFromAxisAngle(axis, a));

/** `R1 · diag(1, r1, r2)·s · R2`, then moved: condition number `1 / min(r1, r2)` before rounding. */
function conditioned(ratio: fc.Arbitrary<number>): fc.Arbitrary<Mat4> {
  return fc.record({
    q1: quat, q2: quat, s: fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
    r1: ratio, r2: fc.double({ min: 0, max: 1, noNaN: true }), at: v3(1e4),
  }).map(({ q1, q2, s, r1, r2, at }) => {
    const small = r1 + (1 - r1) * r2;
    const scaled = compose(vec3(0, 0, 0), q2, vec3(s, s * r1, s * small));
    return multiply(compose(at, q1, vec3(1, 1, 1)), scaled);
  });
}

function norm1(m: Mat4): number {
  let most = 0;
  for (let c = 0; c < 4; c++) most = Math.max(most, Math.abs(m[c * 4]!) + Math.abs(m[c * 4 + 1]!) + Math.abs(m[c * 4 + 2]!) + Math.abs(m[c * 4 + 3]!));
  return most;
}

const linear = (m: Mat4): Mat4 => [...m.slice(0, 12), 0, 0, 0, 1];

describe('invert (3D), property', () => {
  it('composes with its matrix to the identity, within the error its conditioning allows', () => {
    fc.assert(fc.property(conditioned(decades(-11, 0)), (m) => {
      const inv = invert(m);
      expect(inv).not.toBeNull();
      const limit = norm1(linear(m)) * norm1(linear(inv!)) * 1e-14;
      expect(maxDiff(multiply(linear(m), linear(inv!)), identity())).toBeLessThan(limit);
    }), RUNS);
  });

  it('refuses a matrix whose condition number is past the shared limit', () => {
    fc.assert(fc.property(conditioned(decades(-18, -13)), (m) => {
      expect(invert(m)).toBeNull();
    }), RUNS);
  });

  it('carries a point back through a perspective projection', () => {
    const proj = fc.record({
      fov: fc.double({ min: 0.1, max: 3, noNaN: true }),
      aspect: fc.double({ min: 0.2, max: 5, noNaN: true }),
      near: fc.double({ min: 0.01, max: 10, noNaN: true }),
      depth: fc.double({ min: 1.5, max: 1000, noNaN: true }),
    });
    fc.assert(fc.property(proj, v3(1), fc.double({ min: 0, max: 1, noNaN: true }), ({ fov, aspect, near, depth }, p, t) => {
      const far = near * depth;
      const m = perspective(fov, aspect, near, far);
      const inv = invert(m)!;
      const z = -(near + (far - near) * t);
      const q = vec3(p.x * -z, p.y * -z, z);
      const back = transformPoint(inv, transformPoint(m, q));
      expect(distance(back, q)).toBeLessThan((len(q) + 1) * 1e-6 * depth);
    }), RUNS);
  });

  it('refuses a matrix holding NaN or Infinity anywhere', () => {
    const bad = fc.constantFrom(Number.NaN, Infinity, -Infinity);
    fc.assert(fc.property(conditioned(decades(-2, 0)), fc.integer({ min: 0, max: 15 }), bad, (m, i, v) => {
      const broken = [...m];
      broken[i] = v;
      expect(invert(broken)).toBeNull();
    }), RUNS);
  });
});

describe('quaternions, property', () => {
  it('rotate without changing a vector\'s length', () => {
    fc.assert(fc.property(quat, v3(), (q, v) => {
      expect(Math.abs(len(quatRotate(q, v)) - len(v))).toBeLessThan((len(v) + 1) * 1e-12);
    }), RUNS);
  });

  it('compose: rotating by a·b is rotating by b, then a', () => {
    fc.assert(fc.property(quat, quat, v3(), (a, b, v) => {
      const once = quatRotate(quatMultiply(a, b), v);
      const twice = quatRotate(a, quatRotate(b, v));
      expect(distance(once, twice)).toBeLessThan((len(v) + 1) * 1e-12);
    }), RUNS);
  });
});

const aabb: fc.Arbitrary<Aabb> = fc.tuple(v3(), v3()).map(([a, b]) => ({
  min: vec3(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)),
  max: vec3(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)),
}));
const fraction = fc.double({ min: 0, max: 1, noNaN: true });
const inside = (b: Aabb, p: Vec3, slack: number): boolean =>
  p.x >= b.min.x - slack && p.x <= b.max.x + slack
  && p.y >= b.min.y - slack && p.y <= b.max.y + slack
  && p.z >= b.min.z - slack && p.z <= b.max.z + slack;
/** The point `f` of the way across `b`, held inside it: at subnormal extents `min + (max - min)` rounds past `max`. */
const across = (lo: number, hi: number, f: number): number => Math.min(hi, Math.max(lo, lo + (hi - lo) * f));
const pointIn = (b: Aabb, f: readonly [number, number, number]): Vec3 => vec3(
  across(b.min.x, b.max.x, f[0]), across(b.min.y, b.max.y, f[1]), across(b.min.z, b.max.z, f[2]));

describe('rays and boxes, property', () => {
  it('transformAabb holds the image of every point of the box', () => {
    fc.assert(fc.property(conditioned(decades(-2, 0)), aabb, fc.tuple(fraction, fraction, fraction), (m, b, f) => {
      const p = transformPoint(m, pointIn(b, f));
      expect(inside(transformAabb(m, b), p, (len(p) + 1) * 1e-9)).toBe(true);
    }), RUNS);
  });

  it('a ray aimed through a point of the box hits it no later than that point, and lands on the box', () => {
    fc.assert(fc.property(aabb, fc.tuple(fraction, fraction, fraction), v3(5000), (b, f, origin) => {
      const target = pointIn(b, f);
      const direction = vec3(target.x - origin.x, target.y - origin.y, target.z - origin.z);
      fc.pre(len(direction) > 1e-6);
      const t = intersectRayAabb({ origin, direction }, b.min, b.max);
      expect(t).not.toBeNull();
      expect(t!).toBeLessThanOrEqual(1 + 1e-9);
      expect(inside(b, pointOnRay({ origin, direction }, t!), (len(origin) + len(target) + 1) * 1e-9)).toBe(true);
    }), RUNS);
  });

  it('moving the ray and the box together leaves the hit distance alone', () => {
    fc.assert(fc.property(aabb, v3(), v3(), v3(), (b, origin, direction, by) => {
      fc.pre(len(direction) > 1e-3);
      const t = intersectRayAabb({ origin, direction }, b.min, b.max);
      const move = (p: Vec3): Vec3 => vec3(p.x + by.x, p.y + by.y, p.z + by.z);
      const u = intersectRayAabb({ origin: move(origin), direction }, move(b.min), move(b.max));
      // Translation rounds the slabs, so only a ray grazing the box may flip between hit and miss.
      const slack = (len(origin) + len(by) + 2000) * 1e-9;
      const grow = (k: number): [Vec3, Vec3] => [
        vec3(b.min.x - k, b.min.y - k, b.min.z - k), vec3(b.max.x + k, b.max.y + k, b.max.z + k)];
      const wide = intersectRayAabb({ origin, direction }, ...grow(slack)) !== null;
      const tight = b.max.x - b.min.x > 2 * slack && b.max.y - b.min.y > 2 * slack && b.max.z - b.min.z > 2 * slack
        && intersectRayAabb({ origin, direction }, ...grow(-slack)) !== null;
      if (wide !== tight) return;
      expect(t === null).toBe(u === null);
      if (t === null || u === null) return;
      expect(Math.abs(t - u)).toBeLessThan(((len(origin) + len(by) + 2000) / len(direction)) * 1e-9);
    }), RUNS);
  });
});
