import { describe, it, expect } from 'vitest';
import { cubicEvalAt, elevateQuadraticToCubic, cubicBounds, quadraticEvalAt, splitCubicAt, splitQuadraticAt, splitLineAt } from './curve';
import { approxEq } from './scalar';

describe('cubicEvalAt', () => {
  it('hits the endpoints at t=0 and t=1', () => {
    const p0: [number, number] = [0, 0], p1: [number, number] = [1, 2], p2: [number, number] = [3, 2], p3: [number, number] = [4, 0];
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 0)).toEqual([0, 0]);
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 1)).toEqual([4, 0]);
  });
});

describe('elevateQuadraticToCubic', () => {
  it('produces a cubic that samples identically to the quadratic', () => {
    // quad: q0=(0,0) c=(2,4) q1=(4,0). Elevated cubic control points:
    //   c1 = q0 + 2/3 (c - q0),  c2 = q1 + 2/3 (c - q1)
    const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(0, 0, 2, 4, 4, 0);
    expect(approxEq(c1x, 4 / 3)).toBe(true);
    expect(approxEq(c1y, 8 / 3)).toBe(true);
    expect(approxEq(c2x, 8 / 3)).toBe(true);
    expect(approxEq(c2y, 8 / 3)).toBe(true);
    // sample agreement at t=0.5: quad B(0.5)=(2,2); cubic must match.
    const cub = cubicEvalAt(0, 0, c1x, c1y, c2x, c2y, 4, 0, 0.5);
    expect(approxEq(cub[0], 2)).toBe(true);
    expect(approxEq(cub[1], 2)).toBe(true);
  });
});

describe('cubicBounds', () => {
  it('is tight — a symmetric arch peaks at y=7.5, not the control y=10', () => {
    // cubic with control points pulling to y=10 actually reaches y=7.5 at apex.
    const b = cubicBounds(0, 0, 0, 10, 10, 10, 10, 0);
    expect(approxEq(b[0], 0)).toBe(true);   // minX
    expect(approxEq(b[1], 0)).toBe(true);   // minY
    expect(approxEq(b[2], 10)).toBe(true);  // maxX
    expect(approxEq(b[3], 7.5)).toBe(true); // maxY (curve apex < control hull)
  });
});

describe('quadraticEvalAt', () => {
  it('hits the endpoints and the Bernstein midpoint', () => {
    expect(quadraticEvalAt(0, 0, 2, 4, 4, 0, 0)).toEqual([0, 0]);
    expect(quadraticEvalAt(0, 0, 2, 4, 4, 0, 1)).toEqual([4, 0]);
    expect(quadraticEvalAt(0, 0, 2, 4, 4, 0, 0.5)).toEqual([2, 2]);
  });
});

const close = (a: readonly number[], b: readonly number[]) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
};

describe('splitCubicAt', () => {
  const C = [0, 0, 1, 3, 5, -2, 6, 1] as const;

  it('meets at the point on the curve at t, and each half traces its span', () => {
    const t = 0.3;
    const [left, right] = splitCubicAt(...C, t);
    close(left.slice(0, 2), [0, 0]);
    close(right.slice(6), [6, 1]);
    close(left.slice(6), cubicEvalAt(...C, t));
    close(right.slice(0, 2), cubicEvalAt(...C, t));
    for (const s of [0.1, 0.5, 0.9]) {
      close(cubicEvalAt(...left, s), cubicEvalAt(...C, s * t));
      close(cubicEvalAt(...right, s), cubicEvalAt(...C, t + s * (1 - t)));
    }
  });

  it('at the endpoints yields a degenerate half and the whole curve', () => {
    const [l0, r0] = splitCubicAt(...C, 0);
    close(l0, [0, 0, 0, 0, 0, 0, 0, 0]);
    close(r0, C);
    const [l1, r1] = splitCubicAt(...C, 1);
    close(l1, C);
    close(r1, [6, 1, 6, 1, 6, 1, 6, 1]);
  });
});

describe('splitQuadraticAt', () => {
  const Q = [0, 0, 2, 4, 4, 0] as const;

  it('meets at the point on the curve at t, and each half traces its span', () => {
    const t = 0.7;
    const [left, right] = splitQuadraticAt(...Q, t);
    close(left.slice(4), quadraticEvalAt(...Q, t));
    close(right.slice(0, 2), quadraticEvalAt(...Q, t));
    for (const s of [0.25, 0.75]) {
      close(quadraticEvalAt(...left, s), quadraticEvalAt(...Q, s * t));
      close(quadraticEvalAt(...right, s), quadraticEvalAt(...Q, t + s * (1 - t)));
    }
  });

  it('at the endpoints yields a degenerate half and the whole curve', () => {
    const [l0, r0] = splitQuadraticAt(...Q, 0);
    close(l0, [0, 0, 0, 0, 0, 0]);
    close(r0, Q);
  });
});

describe('splitLineAt', () => {
  it('splits at the interpolated point', () => {
    expect(splitLineAt(0, 0, 10, 20, 0.25)).toEqual([[0, 0, 2.5, 5], [2.5, 5, 10, 20]]);
  });
});
