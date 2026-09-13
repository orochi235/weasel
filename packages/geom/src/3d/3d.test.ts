import { describe, it, expect } from 'vitest';
import {
  add,
  compose,
  cross,
  dot,
  identity,
  intersectRayAabb,
  intersectRayPlane,
  invert,
  len,
  lookAt,
  multiply,
  normalize,
  perspective,
  quatFromAxisAngle,
  scale,
  sub,
  transformAabb,
  transformPoint,
  type Mat4,
  type Vec3,
} from './index';

function expectVecClose(a: Vec3, b: Vec3, digits = 6) {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

function expectMatClose(a: Mat4, b: Mat4, digits = 6) {
  for (let i = 0; i < 16; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

describe('vector algebra', () => {
  it('adds, subtracts and scales componentwise', () => {
    expectVecClose(add([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
    expectVecClose(sub([4, 5, 6], [1, 2, 3]), [3, 3, 3]);
    expectVecClose(scale([1, 2, 3], 2), [2, 4, 6]);
  });

  it('computes dot, cross and length', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expectVecClose(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    expect(len([3, 4, 0])).toBe(5);
  });

  it('keeps the direction of a tiny vector', () => {
    expectVecClose(normalize([1e-10, 0, 0]), [1, 0, 0]);
  });

  it('normalizes to unit length, and leaves a zero vector alone', () => {
    expectVecClose(normalize([0, 5, 0]), [0, 1, 0]);
    expectVecClose(normalize([0, 0, 0]), [0, 0, 0]);
  });
});

describe('perspective', () => {
  it('matches the textbook matrix at fov 90, square aspect', () => {
    const m = perspective(Math.PI / 2, 1, 1, 101);
    // f = 1 / tan(fov/2) = 1
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(-102 / 100, 6);
    expect(m[11]).toBeCloseTo(-1, 6);
    expect(m[14]).toBeCloseTo(-202 / 100, 6);
    expect(m[15]).toBeCloseTo(0, 6);
  });

  it('narrows x by the aspect ratio', () => {
    const square = perspective(Math.PI / 2, 1, 1, 100);
    const wide = perspective(Math.PI / 2, 2, 1, 100);
    expect(wide[0]).toBeCloseTo(square[0] / 2, 6);
    expect(wide[5]).toBeCloseTo(square[5], 6);
  });
});

describe('lookAt', () => {
  it('puts a target in front of the eye down -z', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    expectVecClose(transformPoint(view, [0, 0, 0]), [0, 0, -5]);
  });

  it('keeps up pointing up', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const above = transformPoint(view, [0, 1, 0]);
    expect(above[1]).toBeGreaterThan(0);
  });

  it('orients a tiny view the way it orients a unit one', () => {
    const tiny = lookAt([0, 0, 5e-10], [0, 0, 0], [0, 1, 0]);
    const unit = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) expect(tiny[i]).toBeCloseTo(unit[i], 9);
  });

  it('has no orientation, and so no inverse, when up is parallel to the view to within rounding', () => {
    const view = lookAt([1e-13, 5, 0], [0, 0, 0], [0, 1, 0]);
    expect(invert(view)).toBeNull();
  });
});

describe('matrix arithmetic', () => {
  it('multiplies by identity without change', () => {
    const m = perspective(1, 1.5, 0.1, 100);
    expectMatClose(multiply(m, identity()), m);
    expectMatClose(multiply(identity(), m), m);
  });

  it('inverts back to identity', () => {
    const m = multiply(perspective(1, 1.5, 0.1, 100), lookAt([3, 4, 5], [0, 1, 0], [0, 1, 0]));
    const inv = invert(m);
    expect(inv).not.toBeNull();
    expectMatClose(multiply(m, inv!), identity(), 5);
  });

  it('returns null for a singular matrix', () => {
    const singular = new Array(16).fill(0) as unknown as Mat4;
    expect(invert(singular)).toBeNull();
  });

  it('inverts a uniformly tiny scale', () => {
    // Determinant 1e-16: an absolute floor calls this singular.
    const tiny = [1e-4, 0, 0, 0, 0, 1e-4, 0, 0, 0, 0, 1e-4, 0, 0, 0, 0, 1e-4];
    const inv = invert(tiny);
    expect(inv).not.toBeNull();
    expect(inv![0]).toBeCloseTo(1e4, 6);
    expectMatClose(multiply(tiny, inv!), identity(), 9);
  });

  it('inverts a projection with a tiny near plane', () => {
    // One column is ~1e-12 long; judged against the largest column instead
    // of all four, a legitimate camera would read as singular.
    const m = perspective(Math.PI / 4, 1, 1e-12, 1);
    const inv = invert(m);
    expect(inv).not.toBeNull();
    expectMatClose(multiply(m, inv!), identity(), 6);
  });

  it('rejects a large matrix whose determinant is cancellation', () => {
    const m = [
      1e6, 1e6, 0, 0,
      1e6, 1e6 + 1e-7, 0, 0,
      0, 0, 1e6, 0,
      0, 0, 0, 1e6,
    ];
    expect(invert(m)).toBeNull();
  });

  it('rejects a genuinely singular matrix at any magnitude', () => {
    const m = [1e6, 2e6, 0, 0, 2e6, 4e6, 0, 0, 0, 0, 1e6, 0, 0, 0, 0, 1e6];
    expect(invert(m)).toBeNull();
  });

  it('rejects a non-finite matrix rather than returning NaNs', () => {
    const m = [...identity()];
    m[5] = NaN;
    expect(invert(m)).toBeNull();
  });

  it('divides through a tiny w instead of dropping it', () => {
    // A far plane at 1e10 unprojects to w = 1e-10.
    const m = [...identity()];
    m[15] = 1e-10;
    expectVecClose(transformPoint(m, [1, 2, 3]).map((v) => v / 1e10) as unknown as Vec3, [1, 2, 3]);
  });

  it('composes position, rotation and scale', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const m = compose([1, 2, 3], q, [2, 2, 2]);
    // The x axis, scaled by 2 and turned a quarter turn about z, then translated.
    expectVecClose(transformPoint(m, [1, 0, 0]), [1, 4, 3], 5);
  });
});

describe('intersectRayAabb', () => {
  const min: Vec3 = [-1, -1, -1];
  const max: Vec3 = [1, 1, 1];

  it('hits a box dead ahead at the near face', () => {
    const t = intersectRayAabb({ origin: [0, 0, 5], direction: [0, 0, -1] }, min, max);
    expect(t).toBeCloseTo(4, 6);
  });

  it('misses a box off to the side', () => {
    expect(intersectRayAabb({ origin: [5, 0, 5], direction: [0, 0, -1] }, min, max)).toBeNull();
  });

  it('misses a box behind the ray', () => {
    expect(intersectRayAabb({ origin: [0, 0, 5], direction: [0, 0, 1] }, min, max)).toBeNull();
  });

  it('hits from inside the box at t=0', () => {
    const t = intersectRayAabb({ origin: [0, 0, 0], direction: [0, 0, -1] }, min, max);
    expect(t).toBeCloseTo(0, 6);
  });

  it('hits along a tiny, unnormalized direction', () => {
    const t = intersectRayAabb({ origin: [0, 0, 5], direction: [0, 0, -1e-10] }, min, max);
    expect(t).toBeCloseTo(4e10, -1);
  });

  it('hits along a slab boundary it runs parallel to', () => {
    const t = intersectRayAabb({ origin: [1, 0, 5], direction: [0, 0, -1] }, min, max);
    expect(t).toBeCloseTo(4, 6);
  });

  it('survives an axis-parallel ray that never enters a slab', () => {
    expect(intersectRayAabb({ origin: [5, 0, 0], direction: [0, 1, 0] }, min, max)).toBeNull();
  });
});

describe('intersectRayPlane', () => {
  it('hits the ground plane below the ray', () => {
    const t = intersectRayPlane({ origin: [0, 5, 0], direction: [0, -1, 0] }, [0, 1, 0], 0);
    expect(t).toBeCloseTo(5, 6);
  });

  it('hits along a tiny, unnormalized direction', () => {
    const t = intersectRayPlane({ origin: [0, 5, 0], direction: [0, -1e-10, 0] }, [0, 1, 0], 0);
    expect(t).toBeCloseTo(5e10, -1);
  });

  it('calls a ray parallel to within rounding parallel', () => {
    expect(
      intersectRayPlane({ origin: [0, 5, 0], direction: [1, -1e-13, 0] }, [0, 1, 0], 0),
    ).toBeNull();
  });

  it('returns null for a ray parallel to the plane', () => {
    expect(intersectRayPlane({ origin: [0, 5, 0], direction: [1, 0, 0] }, [0, 1, 0], 0)).toBeNull();
  });

  it('returns null when the plane is behind the ray', () => {
    expect(intersectRayPlane({ origin: [0, 5, 0], direction: [0, 1, 0] }, [0, 1, 0], 0)).toBeNull();
  });
});
describe('transformAabb', () => {
  const unit = { min: [-0.5, -0.5, -0.5] as Vec3, max: [0.5, 0.5, 0.5] as Vec3 };

  it('translates a box without changing its size', () => {
    const box = transformAabb(compose([3, 0, -2], [0, 0, 0, 1], [1, 1, 1]), unit);
    expect(box.min[0]).toBeCloseTo(2.5, 9);
    expect(box.max[0]).toBeCloseTo(3.5, 9);
    expect(box.max[2] - box.min[2]).toBeCloseTo(1, 9);
  });

  it('widens under rotation rather than rotating', () => {
    const spun = transformAabb(
      compose([0, 0, 0], quatFromAxisAngle([0, 0, 1], Math.PI / 4), [1, 1, 1]),
      unit,
    );
    expect(spun.max[0]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(spun.max[1]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(spun.max[2]).toBeCloseTo(0.5, 9);
  });
});
