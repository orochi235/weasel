/**
 * A gesture's plane: the basis spanning the plane normal to any `up` is orthonormal and at right angles to it, runs
 * along the world axes for an axis `up`, and an unconstrained input flat is that plane through δ-space's origin.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cross, dot, len, normalize } from '@weasel-js/geom/3d';
import { direction, maxDiff3, runs, timeoutFor, v3 } from '../pbt.fixture';
import { inputFlat3d, planeBasis } from './plane';

const RUNS = 300;
const T = timeoutFor(RUNS, 1);

describe('planeBasis, property', () => {
  it('spans the plane normal to `up` with two unit directions at right angles, right-handed about it', () => {
    fc.assert(fc.property(fc.oneof(direction, v3(1e6).filter((v) => len(v) > 1e-3)), (up) => {
      const [u, v] = planeBasis(up);
      const n = normalize(up);
      expect(Math.abs(len(u) - 1)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(len(v) - 1)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(dot(u, v))).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(dot(u, n))).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(dot(v, n))).toBeLessThanOrEqual(1e-12);
      expect(maxDiff3(cross(n, v), u)).toBeLessThanOrEqual(1e-12);
    }), runs(RUNS));
  }, T);

  it('runs along the world axes for an `up` along x that is not unit length (shrunk)', () => {
    expect(planeBasis({ x: 28.964073924039155, y: 0, z: 0 })).toEqual([{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }]);
  });

  it('runs along the other two world axes for an axis `up`', () => {
    fc.assert(fc.property(fc.constantFrom('x', 'y', 'z'), fc.constantFrom(1, -1), fc.double({ min: 1e-3, max: 1e3, noNaN: true }), (axis, sign, k) => {
      const up = { x: 0, y: 0, z: 0, [axis]: sign * k };
      for (const e of planeBasis(up)) {
        expect(e[axis as 'x' | 'y' | 'z']).toBe(0);
        expect([e.x, e.y, e.z].filter((c) => Math.abs(c) === 1)).toHaveLength(1);
      }
    }), runs(RUNS));
  }, T);
});

describe('inputFlat3d, property', () => {
  it('is the plane itself through the origin while no constraint is held', () => {
    fc.assert(fc.property(direction, v3(10), v3(10), fc.constantFrom(undefined, 'axis' as const, 'aspect' as const), fc.boolean(), (up, d0, about, c, held) => {
      const basis = planeBasis(up);
      const flat = inputFlat3d(c, held && c !== 'axis', basis, d0, about);
      expect(flat.at).toEqual([0, 0, 0]);
      expect(flat.dirs).toEqual(basis.map((e) => [e.x, e.y, e.z]));
    }), runs(RUNS));
  }, T);
});
