import { describe, it, expect } from 'vitest';
import {
  add,
  sub,
  scale,
  dot,
  cross,
  length,
  normalize,
  compose,
  perspective,
  lookAt,
  multiply,
  invert,
  transformPoint,
  identity,
  quatFromAxisAngle,
  rayThroughScreenPoint,
  intersectRayAabb,
  intersectRayPlane,
  projectAabbToScreen,
  type Mat4,
  type Vec3,
} from './math3d';

const RECT = { x: 0, y: 0, w: 800, h: 600 };

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
    expect(length([3, 4, 0])).toBe(5);
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

  it('composes position, rotation and scale', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const m = compose([1, 2, 3], q, [2, 2, 2]);
    // The x axis, scaled by 2 and turned a quarter turn about z, then translated.
    expectVecClose(transformPoint(m, [1, 0, 0]), [1, 4, 3], 5);
  });
});

describe('rayThroughScreenPoint', () => {
  it('shoots straight ahead from the middle of the viewport', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const proj = perspective(Math.PI / 3, RECT.w / RECT.h, 0.1, 100);
    const ray = rayThroughScreenPoint({ x: 400, y: 300 }, RECT, multiply(proj, view), [0, 0, 5]);
    expectVecClose(ray.origin, [0, 0, 5], 5);
    expectVecClose(ray.direction, [0, 0, -1], 5);
  });

  it('leans right for a point right of center', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const proj = perspective(Math.PI / 3, RECT.w / RECT.h, 0.1, 100);
    const ray = rayThroughScreenPoint({ x: 700, y: 300 }, RECT, multiply(proj, view), [0, 0, 5]);
    expect(ray.direction[0]).toBeGreaterThan(0);
    expect(ray.direction[2]).toBeLessThan(0);
  });

  it('leans up for a point above center, despite y running down the screen', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const proj = perspective(Math.PI / 3, RECT.w / RECT.h, 0.1, 100);
    const ray = rayThroughScreenPoint({ x: 400, y: 100 }, RECT, multiply(proj, view), [0, 0, 5]);
    expect(ray.direction[1]).toBeGreaterThan(0);
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

  it('survives an axis-parallel ray that never enters a slab', () => {
    expect(intersectRayAabb({ origin: [5, 0, 0], direction: [0, 1, 0] }, min, max)).toBeNull();
  });
});

describe('intersectRayPlane', () => {
  it('hits the ground plane below the ray', () => {
    const t = intersectRayPlane({ origin: [0, 5, 0], direction: [0, -1, 0] }, [0, 1, 0], 0);
    expect(t).toBeCloseTo(5, 6);
  });

  it('returns null for a ray parallel to the plane', () => {
    expect(intersectRayPlane({ origin: [0, 5, 0], direction: [1, 0, 0] }, [0, 1, 0], 0)).toBeNull();
  });

  it('returns null when the plane is behind the ray', () => {
    expect(intersectRayPlane({ origin: [0, 5, 0], direction: [0, 1, 0] }, [0, 1, 0], 0)).toBeNull();
  });
});

describe('projectAabbToScreen', () => {
  const viewProj = multiply(
    perspective(Math.PI / 3, RECT.w / RECT.h, 0.1, 100),
    lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]),
  );

  it('centers a box that sits on the view axis', () => {
    const b = projectAabbToScreen([-1, -1, -1], [1, 1, 1], viewProj, RECT);
    expect(b).not.toBeNull();
    expect(b!.x + b!.width / 2).toBeCloseTo(400, 0);
    expect(b!.y + b!.height / 2).toBeCloseTo(300, 0);
    expect(b!.width).toBeGreaterThan(0);
    expect(b!.height).toBeGreaterThan(0);
  });

  it('draws a nearer box bigger than a farther one', () => {
    const near = projectAabbToScreen([-1, -1, 0], [1, 1, 2], viewProj, RECT);
    const far = projectAabbToScreen([-1, -1, -20], [1, 1, -18], viewProj, RECT);
    expect(near!.width).toBeGreaterThan(far!.width);
  });

  it('returns null for a box entirely behind the camera', () => {
    expect(projectAabbToScreen([-1, -1, 20], [1, 1, 22], viewProj, RECT)).toBeNull();
  });
});
