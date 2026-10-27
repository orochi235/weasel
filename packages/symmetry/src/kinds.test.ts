import { describe, expect, it } from 'vitest';
import { applyToPoint, multiply, type Affine } from '@weasel-js/geom';
import {
  DEFAULT_SYMMETRY, HORIZONTAL_AXIS, SYMMETRY_KINDS, VERTICAL_AXIS, symmetryTransforms,
  type SymmetryKind, type SymmetrySpec,
} from './kinds';

const C = { x: 40, y: -25 };
const spec = (kind: SymmetryKind, over: Partial<SymmetrySpec> = {}): SymmetrySpec => ({ ...DEFAULT_SYMMETRY, kind, ...over });
const same = (a: Affine, b: Affine) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const ID: Affine = [1, 0, 0, 1, 0, 0];
const at = (m: Affine, x: number, y: number) => {
  const [px, py] = applyToPoint(m, x, y);
  return { x: Math.round(px * 1e6) / 1e6, y: Math.round(py * 1e6) / 1e6 };
};

describe('symmetryTransforms', () => {
  it('mirrors across a vertical axis through the center', () => {
    const [m] = symmetryTransforms(spec('mirror', { angle: VERTICAL_AXIS }), C);
    expect(at(m, C.x + 10, C.y + 3)).toEqual({ x: C.x - 10, y: C.y + 3 });
  });

  it('mirrors across a horizontal axis through the center', () => {
    const [m] = symmetryTransforms(spec('mirror', { angle: HORIZONTAL_AXIS }), C);
    expect(at(m, C.x + 10, C.y + 3)).toEqual({ x: C.x + 10, y: C.y - 3 });
  });

  it('mirrors across a line at any angle, fixing the points on it', () => {
    const angle = 0.3;
    const [m] = symmetryTransforms(spec('mirror', { angle }), C);
    const on = { x: C.x + 50 * Math.cos(angle), y: C.y + 50 * Math.sin(angle) };
    expect(at(m, on.x, on.y)).toEqual(at(ID, on.x, on.y));
  });

  it('turns a point 180 degrees about the center', () => {
    const [m] = symmetryTransforms(spec('point'), C);
    expect(at(m, C.x + 10, C.y + 3)).toEqual({ x: C.x - 10, y: C.y - 3 });
  });

  it.each([
    ['mirror', 1], ['both', 3], ['point', 1], ['radial', 5], ['kaleidoscope', 11],
  ] as const)('%s with a count of 6 makes %i copies', (kind, n) => {
    expect(symmetryTransforms(spec(kind), C)).toHaveLength(n);
  });

  it.each(Object.keys(SYMMETRY_KINDS) as SymmetryKind[])(
    '%s has a point group: every product of two of it is the original or another of it',
    (kind) => {
      for (const count of [2, 3, 5, 8]) {
        const ms = SYMMETRY_KINDS[kind].pointGroup(spec(kind, { count, angle: 0.4, cell: 'kaleidoscope', cellAngle: 0.2 }), C);
        const all = [ID, ...ms];
        for (const a of all) {
          for (const b of all) expect(all.some((m) => same(m, multiply(a, b))), `${kind} ×${count}`).toBe(true);
        }
      }
    },
  );

  it('repeats along the angle by the spacing', () => {
    const ms = symmetryTransforms(spec('repeat', { count: 3, angle: 0, spacing: 100 }), C);
    expect(ms.map((m) => at(m, C.x, C.y + 5))).toEqual([{ x: C.x + 100, y: C.y + 5 }, { x: C.x + 200, y: C.y + 5 }]);
  });

  it('mirrors every other repeat across the line it runs along under glide', () => {
    const ms = symmetryTransforms(spec('repeat', { count: 3, angle: 0, spacing: 100, glide: true }), C);
    expect(ms.map((m) => at(m, C.x, C.y + 5))).toEqual([{ x: C.x + 100, y: C.y - 5 }, { x: C.x + 200, y: C.y + 5 }]);
  });
});
