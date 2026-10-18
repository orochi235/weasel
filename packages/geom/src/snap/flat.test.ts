import { describe, it, expect } from 'vitest';
import { closestBetweenFlats, closestOnFlat, flatDim, intersectFlats, type Vec } from '../nd';

function expectVecClose(a: Vec, b: Vec, digits = 9) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

describe('flatDim', () => {
  it('counts independent directions only', () => {
    expect(flatDim({ at: [0, 0, 0], dirs: [] })).toBe(0);
    expect(flatDim({ at: [0, 0, 0], dirs: [[1, 0, 0], [2, 0, 0]] })).toBe(1);
    expect(flatDim({ at: [0, 0, 0], dirs: [[1, 0, 0], [0, 0, 0], [1, 1, 0]] })).toBe(2);
  });
});

describe('closestOnFlat', () => {
  it('projects onto a 2D line', () => {
    expectVecClose(closestOnFlat({ at: [0, 0], dirs: [[2, 2]] }, [3, 1]), [2, 2]);
    expectVecClose(closestOnFlat({ at: [0, 5], dirs: [[1, 0]] }, [7, -3]), [7, 5]);
  });

  it('projects onto a 3D plane whose dirs are not orthonormal', () => {
    const plane = { at: [0, 0, 4], dirs: [[1, 0, 0], [1, 3, 0]] };
    expectVecClose(closestOnFlat(plane, [2, -5, 9]), [2, -5, 4]);
  });

  it('returns the flat point for a 0-flat', () => {
    expectVecClose(closestOnFlat({ at: [1, 2], dirs: [] }, [9, 9]), [1, 2]);
  });
});

describe('intersectFlats', () => {
  it('meets two crossing 2D lines in a point', () => {
    const f = intersectFlats({ at: [0, 0], dirs: [[1, 1]] }, { at: [4, 0], dirs: [[0, 1]] });
    expect(f).not.toBeNull();
    expect(flatDim(f!)).toBe(0);
    expectVecClose(f!.at, [4, 4]);
  });

  it('returns null for parallel lines', () => {
    expect(intersectFlats({ at: [0, 0], dirs: [[1, 0]] }, { at: [0, 1], dirs: [[3, 0]] })).toBeNull();
  });

  it('returns the line itself for coincident lines', () => {
    const f = intersectFlats({ at: [0, 1], dirs: [[1, 0]] }, { at: [5, 1], dirs: [[-2, 0]] });
    expect(flatDim(f!)).toBe(1);
    expectVecClose(closestOnFlat(f!, [3, 8]), [3, 1]);
  });

  it('meets two 3D planes in a line', () => {
    const z2 = { at: [0, 0, 2], dirs: [[1, 0, 0], [0, 1, 0]] };
    const x3 = { at: [3, 0, 0], dirs: [[0, 1, 0], [0, 0, 1]] };
    const f = intersectFlats(z2, x3);
    expect(flatDim(f!)).toBe(1);
    expectVecClose(closestOnFlat(f!, [0, 7, 0]), [3, 7, 2]);
    expectVecClose(closestOnFlat(f!, [9, -1, 9]), [3, -1, 2]);
  });
});

describe('closestBetweenFlats', () => {
  it('finds the common perpendicular of a skew ray-line pair in 3D', () => {
    const ray = { at: [0, 0, 0], dirs: [[1, 0, 0]] };
    const line = { at: [0, 5, 3], dirs: [[0, 1, 1]] };
    const { onA, onB } = closestBetweenFlats(ray, line);
    expectVecClose(onA, [0, 0, 0]);
    expectVecClose(onB, [0, 1, -1]);
  });

  it('returns a valid pair for parallel lines', () => {
    const { onA, onB } = closestBetweenFlats({ at: [0, 0], dirs: [[1, 0]] }, { at: [4, 2], dirs: [[1, 0]] });
    expect(Math.abs(onB[1] - onA[1])).toBeCloseTo(2, 9);
    expect(onB[0]).toBeCloseTo(onA[0], 9);
  });
});
