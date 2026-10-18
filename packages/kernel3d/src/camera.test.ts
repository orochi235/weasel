import { describe, it, expect } from 'vitest';
import {
  createCamera,
  cameraEye,
  cameraViewProjection,
  orbitBy,
  dollyBy,
  clampCamera,
  dollyToward,
  panBy,
  MAX_PITCH,
  type Camera3d,
} from './camera';
import { normalize, sub, transformPoint4, type Vec3 } from '@weasel-js/geom/3d';
import { rayThroughScreenPoint } from './screen';

const RECT = { x: 0, y: 0, width: 800, height: 600 };

function expectVecClose(a: Vec3, b: Vec3, digits = 6) {
  for (const axis of ['x', 'y', 'z'] as const) expect(a[axis]).toBeCloseTo(b[axis], digits);
}

describe('cameraEye', () => {
  it('sits down +z at yaw zero', () => {
    const cam = createCamera({ distance: 5 });
    expectVecClose(cameraEye(cam), { x: 0, y: 0, z: 5 });
  });

  it('swings to +x at a quarter turn of yaw', () => {
    const cam = createCamera({ distance: 5, yaw: Math.PI / 2 });
    expectVecClose(cameraEye(cam), { x: 5, y: 0, z: 0 }, 5);
  });

  it('rises with pitch', () => {
    const cam = createCamera({ distance: 5, pitch: Math.PI / 6 });
    const eye = cameraEye(cam);
    expect(eye.y).toBeCloseTo(2.5, 5);
    expect(eye.z).toBeCloseTo(5 * Math.cos(Math.PI / 6), 5);
  });

  it('orbits around the target, not the origin', () => {
    const cam = createCamera({ distance: 5, target: { x: 10, y: 0, z: 0 } });
    expectVecClose(cameraEye(cam), { x: 10, y: 0, z: 5 });
  });
});

describe('orbitBy', () => {
  it('adds to yaw and pitch', () => {
    const cam = orbitBy(createCamera({}), 0.5, 0.25);
    expect(cam.yaw).toBeCloseTo(0.5, 6);
    expect(cam.pitch).toBeCloseTo(0.25, 6);
  });

  it('clamps pitch short of the poles in both directions', () => {
    expect(orbitBy(createCamera({}), 0, 10).pitch).toBeCloseTo(MAX_PITCH, 6);
    expect(orbitBy(createCamera({}), 0, -10).pitch).toBeCloseTo(-MAX_PITCH, 6);
    expect(MAX_PITCH).toBeLessThan(Math.PI / 2);
  });

  it('leaves the eye off the up axis at full pitch, so lookAt stays defined', () => {
    const eye = cameraEye(orbitBy(createCamera({ distance: 5 }), 0, 10));
    expect(Math.hypot(eye.x, eye.z)).toBeCloseTo(5 * Math.cos(MAX_PITCH), 9);
  });

  it('does not move the target or the distance', () => {
    const before = createCamera({ distance: 7, target: { x: 1, y: 2, z: 3 } });
    const after = orbitBy(before, 1, 0.2);
    expect(after.distance).toBe(7);
    expect(after.target).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('dollyBy', () => {
  it('scales the distance', () => {
    expect(dollyBy(createCamera({ distance: 10 }), 2).distance).toBeCloseTo(20, 6);
    expect(dollyBy(createCamera({ distance: 10 }), 0.5).distance).toBeCloseTo(5, 6);
  });

  it('clamps to a usable range rather than letting the camera reach the target', () => {
    expect(dollyBy(createCamera({ distance: 10 }), 0.0001).distance).toBe(0.5);
    expect(dollyBy(createCamera({ distance: 10 }), 10000).distance).toBe(500);
  });
});

describe('limits', () => {
  it('hold dolly to a caller range, for scenes in other units', () => {
    const limits = { minDistance: 0.01, maxDistance: 1e5 };
    expect(dollyBy(createCamera({ distance: 10 }), 1e-4, limits).distance).toBeCloseTo(0.01, 9);
    expect(dollyBy(createCamera({ distance: 10 }), 1e3, limits).distance).toBeCloseTo(1e4, 6);
  });

  it('hold pitch to a caller range, but never past the poles', () => {
    expect(orbitBy(createCamera({}), 0, 1, { minPitch: 0, maxPitch: 0.5 }).pitch).toBe(0.5);
    expect(orbitBy(createCamera({}), 0, -1, { minPitch: 0, maxPitch: 0.5 }).pitch).toBe(0);
    expect(orbitBy(createCamera({}), 0, 10, { maxPitch: 10 }).pitch).toBeCloseTo(MAX_PITCH, 9);
  });

  it('clampCamera returns a camera already inside them unchanged', () => {
    const cam = createCamera({ distance: 3 });
    expect(clampCamera(cam)).toBe(cam);
    expect(clampCamera(cam, { minDistance: 5 }).distance).toBe(5);
  });
});

describe('panBy', () => {
  // Where the old target lands on screen after the pan, in a pane of RECT's size.
  function targetOnScreen(before: Camera3d, after: Camera3d): { x: number; y: number } {
    const vp = cameraViewProjection(after, RECT.width / RECT.height);
    const [x, y, , w] = transformPoint4(vp, before.target);
    return { x: ((x / w + 1) / 2) * RECT.width, y: ((1 - y / w) / 2) * RECT.height };
  }

  it('moves the point at the old target with the pointer', () => {
    const cam = createCamera({ distance: 8, yaw: 0.9, pitch: 0.5, target: { x: 1, y: 2, z: 3 } });
    const p = targetOnScreen(cam, panBy(cam, 40, -25, RECT.height));
    expect(p.x).toBeCloseTo(400 + 40, 3);
    expect(p.y).toBeCloseTo(300 - 25, 3);
  });

  it('keeps the angles and the distance', () => {
    const moved = panBy(createCamera({ distance: 8, yaw: 0.9, pitch: 0.5 }), 40, 25, RECT.height);
    expect([moved.yaw, moved.pitch, moved.distance]).toEqual([0.9, 0.5, 8]);
  });
});

describe('dollyToward', () => {
  const PANE = { width: RECT.width, height: RECT.height };
  function onScreen(camera: Camera3d, p: Vec3): { x: number; y: number } {
    const [x, y, , w] = transformPoint4(cameraViewProjection(camera, PANE.width / PANE.height), p);
    return { x: ((x / w + 1) / 2) * PANE.width, y: ((1 - y / w) / 2) * PANE.height };
  }

  it('keeps the point under the pointer where it is, as a 2D wheel zoom does', () => {
    const cam = createCamera({ distance: 10, yaw: 0.7, pitch: 0.4, target: { x: 1, y: 0, z: -2 } });
    const at = { x: 620, y: 180 };
    // The point in the target's plane under `at`: the target, slid there.
    const under = panBy(cam, -(at.x - 400), -(at.y - 300), PANE.height).target;
    expect(onScreen(cam, under).x).toBeCloseTo(at.x, 6);
    const near = dollyToward(cam, 0.5, at, PANE);
    expect(near.distance).toBeCloseTo(5, 9);
    const p = onScreen(near, under);
    expect(p.x).toBeCloseTo(at.x, 6);
    expect(p.y).toBeCloseTo(at.y, 6);
  });

  it('is dollyBy at the middle of the pane, and moves no further than the limits let it', () => {
    const cam = createCamera({ distance: 10, yaw: 0.7, pitch: 0.4 });
    expect(dollyToward(cam, 0.5, { x: 400, y: 300 }, PANE)).toEqual(dollyBy(cam, 0.5));
    const held = dollyToward(cam, 0.5, { x: 700, y: 100 }, PANE, { minDistance: 10 });
    expect(held).toEqual(cam);
  });
});

describe('cameraViewProjection', () => {
  it('aims the center-screen ray from the eye at the target', () => {
    const cam: Camera3d = createCamera({ distance: 5, yaw: 0.7, pitch: 0.4, target: { x: 1, y: 0, z: -2 } });
    const eye = cameraEye(cam);
    const vp = cameraViewProjection(cam, RECT.width / RECT.height);
    const ray = rayThroughScreenPoint({ x: 400, y: 300 }, RECT, vp, eye)!;
    expectVecClose(ray.direction, normalize(sub(cam.target, eye)), 4);
  });
});
