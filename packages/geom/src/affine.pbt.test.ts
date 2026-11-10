import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyToPoint, identity, invert, multiply, type Affine } from './affine';
import { affine, conditioned, coord, decades, maxDiff, norm1 } from './pbt.fixtures';

const RUNS = { numRuns: 300 };

/** How far `m · inv` may sit from the identity: rounding grows with the condition number. */
function residualLimit(m: Affine, inv: Affine): number {
  return norm1(m) * norm1(inv) * 1e-14;
}

describe('invert (2D), property', () => {
  it('composes with its matrix to the identity, within the error its conditioning allows', () => {
    fc.assert(fc.property(conditioned(decades(-11, 0)), ({ m }) => {
      const inv = invert(m);
      expect(inv).not.toBeNull();
      const lin = (x: Affine): Affine => [x[0], x[1], x[2], x[3], 0, 0];
      expect(maxDiff(multiply(lin(m), lin(inv!)), identity())).toBeLessThan(residualLimit(m, inv!));
      expect(maxDiff(multiply(lin(inv!), lin(m)), identity())).toBeLessThan(residualLimit(m, inv!));
    }), RUNS);
  });

  it('carries a point back where it started', () => {
    fc.assert(fc.property(affine, coord(), coord(), (m, x, y) => {
      const [u, v] = applyToPoint(m, x, y);
      const [bx, by] = applyToPoint(invert(m)!, u, v);
      const reach = (Math.abs(x) + Math.abs(y) + Math.abs(m[4]) + Math.abs(m[5]) + 1) * 1e-9;
      expect(Math.abs(bx - x)).toBeLessThan(reach);
      expect(Math.abs(by - y)).toBeLessThan(reach);
    }), RUNS);
  });

  it('inverts its own inverse back to the matrix', () => {
    fc.assert(fc.property(affine, (m) => {
      const back = invert(invert(m)!)!;
      const s = norm1(m) + Math.abs(m[4]) + Math.abs(m[5]);
      expect(maxDiff(back, m)).toBeLessThan(s * 1e-11);
    }), RUNS);
  });

  it('refuses a matrix whose condition number is past the shared limit', () => {
    fc.assert(fc.property(conditioned(decades(-18, -13)), ({ m }) => {
      expect(invert(m)).toBeNull();
    }), RUNS);
  });

  it('refuses a matrix holding NaN or Infinity', () => {
    const bad = fc.constantFrom(Number.NaN, Infinity, -Infinity);
    fc.assert(fc.property(affine, fc.integer({ min: 0, max: 5 }), bad, (m, i, v) => {
      const broken = [...m] as [number, number, number, number, number, number];
      broken[i] = v;
      expect(invert(broken)).toBeNull();
    }), RUNS);
  });

  it('refuses a NaN translation, as the 3D invert does (shrunk counterexample)', () => {
    expect(invert([0.001, 0, 0, 0.001, Number.NaN, 0])).toBeNull();
    expect(invert([1, 0, 0, 1, 0, Infinity])).toBeNull();
  });

  it('inverts a product as the product of inverses, reversed', () => {
    fc.assert(fc.property(affine, affine, (m, n) => {
      const lhs = invert(multiply(m, n))!;
      const rhs = multiply(invert(n)!, invert(m)!);
      const s = norm1(lhs) + Math.abs(lhs[4]) + Math.abs(lhs[5]);
      expect(maxDiff(lhs, rhs)).toBeLessThan(s * 1e-9);
    }), RUNS);
  });
});
