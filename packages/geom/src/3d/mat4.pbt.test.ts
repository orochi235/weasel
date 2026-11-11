import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compose, identity, invert, lookAt, multiply, perspective, transformPoint, type Mat4 } from './mat4';
import {
  add, cross, distance, dot, len, normalize, quatConjugate, quatFromAxisAngle, quatMultiply, quatRotate, sub, vec3, type Quat, type Vec3,
} from './vec3';
import { intersectRayAabb, pointOnRay, transformAabb, type Aabb } from './ray3';
import { coord, decades, maxDiff, runs, timeoutFor } from '../pbt.fixture';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 1);

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
  }, TIMEOUT);

  it('refuses a matrix whose condition number is past the shared limit', () => {
    fc.assert(fc.property(conditioned(decades(-18, -13)), (m) => {
      expect(invert(m)).toBeNull();
    }), RUNS);
  }, TIMEOUT);

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
  }, TIMEOUT);

  it('refuses a matrix holding NaN or Infinity anywhere', () => {
    const bad = fc.constantFrom(Number.NaN, Infinity, -Infinity);
    fc.assert(fc.property(conditioned(decades(-2, 0)), fc.integer({ min: 0, max: 15 }), bad, (m, i, v) => {
      const broken = [...m];
      broken[i] = v;
      expect(invert(broken)).toBeNull();
    }), RUNS);
  }, TIMEOUT);
});

describe('invert (3D), an affine inverse (shrunk counterexample)', () => {
  it('is affine exactly, so it inverts in turn', () => {
    // The bottom row came out 0.9999999999999999, so the inverse was judged as projective and refused.
    const m = [0.001, 0, 0, 0, 0, 0.0000010001757745759682, 0, 0, 0, 0, 0.0000010001757745759682, 0, 0, -999.5880079149057, 0, 1];
    const inv = invert(m)!;
    expect([inv[3], inv[7], inv[11], inv[15]]).toEqual([0, 0, 0, 1]);
    expect(maxDiff(invert(inv)!, m)).toBeLessThan(1e-9);
  });
});

describe('matrices, property', () => {
  const v1 = v3(1);
  it('multiply composes: the product applies the right matrix first', () => {
    fc.assert(fc.property(conditioned(decades(-2, 0)), conditioned(decades(-2, 0)), v3(), (a, b, v) => {
      const once = transformPoint(multiply(a, b), v);
      const twice = transformPoint(a, transformPoint(b, v));
      expect(distance(once, twice)).toBeLessThan((len(twice) + norm1(a) * (norm1(b) + len(v))) * 1e-12);
    }), RUNS);
  }, TIMEOUT);

  it('invert undoes its matrix on a point, and inverting twice comes back', () => {
    fc.assert(fc.property(conditioned(decades(-3, 0)), v3(), (m, v) => {
      const inv = invert(m)!;
      const back = transformPoint(inv, transformPoint(m, v));
      const k = norm1(linear(m)) * norm1(linear(inv));
      expect(distance(back, v)).toBeLessThan((len(v) + norm1(inv) * 1e4) * k * 1e-13);
      const again = invert(inv)!;
      expect(maxDiff(again, m)).toBeLessThan(k * k * (norm1(m) + 1) * 1e-13);
    }), RUNS);
  }, TIMEOUT);

  it('compose scales, then rotates, then moves', () => {
    fc.assert(fc.property(v3(1e4), quat, v3(100), v3(), (at, q, s, v) => {
      const want = add(at, quatRotate(q, vec3(s.x * v.x, s.y * v.y, s.z * v.z)));
      const got = transformPoint(compose(at, q, s), v);
      expect(distance(got, want)).toBeLessThan((len(at) + (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z)) * len(v)) * 1e-13 + 1e-300);
    }), RUNS);
  }, TIMEOUT);

  it('lookAt puts the eye at the origin and the target down -z, through a rotation', () => {
    fc.assert(fc.property(v3(1e3), v3(1e3), v1, (eye, target, up) => {
      const view = sub(eye, target);
      fc.pre(len(view) > 1e-3 && len(up) > 1e-3 && len(cross(normalize(up), normalize(view))) > 1e-3);
      const m = lookAt(eye, target, up);
      const scale = len(eye) + len(target);
      expect(len(transformPoint(m, eye))).toBeLessThan(scale * 1e-13);
      const t = transformPoint(m, target);
      expect(Math.hypot(t.x, t.y)).toBeLessThan(scale * 1e-12);
      expect(Math.abs(t.z + len(view))).toBeLessThan(scale * 1e-12);
      const lin = linear(m);
      expect(maxDiff(multiply(lin, [lin[0], lin[4], lin[8], 0, lin[1], lin[5], lin[9], 0, lin[2], lin[6], lin[10], 0, 0, 0, 0, 1]), identity())).toBeLessThan(1e-14);
      // Up stays up: the view's y axis leans toward it.
      const upView = transformPoint(lin, up);
      expect(upView.y).toBeGreaterThan(0);
    }), RUNS);
  }, TIMEOUT);
});

describe('quaternions, property', () => {
  it('rotate without changing a vector\'s length', () => {
    fc.assert(fc.property(quat, v3(), (q, v) => {
      expect(Math.abs(len(quatRotate(q, v)) - len(v))).toBeLessThan((len(v) + 1) * 1e-12);
    }), RUNS);
  }, TIMEOUT);

  it('compose: rotating by a·b is rotating by b, then a', () => {
    fc.assert(fc.property(quat, quat, v3(), (a, b, v) => {
      const once = quatRotate(quatMultiply(a, b), v);
      const twice = quatRotate(a, quatRotate(b, v));
      expect(distance(once, twice)).toBeLessThan((len(v) + 1) * 1e-12);
    }), RUNS);
  }, TIMEOUT);
});

describe('quaternions and normalize, property', () => {
  it('a conjugate undoes its rotation, and the axis stays where it is', () => {
    fc.assert(fc.property(unit, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), v3(), (axis, a, v) => {
      const q = quatFromAxisAngle(axis, a);
      expect(distance(quatRotate(quatConjugate(q), quatRotate(q, v)), v)).toBeLessThan((len(v) + 1) * 1e-12);
      const k = normalize(axis);
      expect(distance(quatRotate(q, k), k)).toBeLessThan(1e-14);
      // Rotation by `a` about the axis: a perpendicular turns through `a`.
      const side = normalize(cross(k, Math.abs(k.x) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
      const turned = quatRotate(q, side);
      expect(Math.abs(dot(turned, side) - Math.cos(a))).toBeLessThan(1e-12);
    }), RUNS);
  }, TIMEOUT);

  it('compose associatively', () => {
    fc.assert(fc.property(quat, quat, quat, v3(), (a, b, c, v) => {
      const left = quatRotate(quatMultiply(quatMultiply(a, b), c), v);
      const right = quatRotate(quatMultiply(a, quatMultiply(b, c)), v);
      expect(distance(left, right)).toBeLessThan((len(v) + 1) * 1e-12);
    }), RUNS);
  }, TIMEOUT);

  it('normalize gives a unit vector along any finite nonzero one, at any magnitude', () => {
    const magnitude = fc.double({ min: -320, max: 307, noNaN: true }).map((k) => 10 ** k);
    fc.assert(fc.property(unit, magnitude, (d, m) => {
      const v = vec3(d.x * m, d.y * m, d.z * m);
      fc.pre(len(vec3(v.x / m, v.y / m, v.z / m)) > 0 && (v.x !== 0 || v.y !== 0 || v.z !== 0));
      const n = normalize(v);
      expect(Math.abs(len(n) - 1)).toBeLessThan(1e-15);
      // Same direction as the vector's own components: subnormal ones have lost bits, so compare to those.
      const own = vec3(v.x, v.y, v.z);
      const back = normalize(vec3(own.x * 2 ** 600, own.y * 2 ** 600, own.z * 2 ** 600));
      if (Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) < 1e-290) expect(distance(n, back)).toBeLessThan(1e-15);
      expect(dot(n, own)).toBeGreaterThan(0);
    }), RUNS);
  }, TIMEOUT);
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
  }, TIMEOUT);

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
  }, TIMEOUT);

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
  }, TIMEOUT);
});
