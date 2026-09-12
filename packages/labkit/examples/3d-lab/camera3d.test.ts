import { describe, it, expect } from 'vitest';
import {
  createCamera,
  cameraEye,
  cameraViewProjection,
  orbitBy,
  dollyBy,
  MAX_PITCH,
  type Camera3d,
} from './camera3d';
import { rayThroughScreenPoint, normalize, sub, type Vec3 } from './math3d';

const RECT = { x: 0, y: 0, w: 800, h: 600 };

function expectVecClose(a: Vec3, b: Vec3, digits = 6) {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

describe('cameraEye', () => {
  it('sits down +z at yaw zero', () => {
    const cam = createCamera({ distance: 5 });
    expectVecClose(cameraEye(cam), [0, 0, 5]);
  });

  it('swings to +x at a quarter turn of yaw', () => {
    const cam = createCamera({ distance: 5, yaw: Math.PI / 2 });
    expectVecClose(cameraEye(cam), [5, 0, 0], 5);
  });

  it('rises with pitch', () => {
    const cam = createCamera({ distance: 5, pitch: Math.PI / 6 });
    const eye = cameraEye(cam);
    expect(eye[1]).toBeCloseTo(2.5, 5);
    expect(eye[2]).toBeCloseTo(5 * Math.cos(Math.PI / 6), 5);
  });

  it('orbits around the target, not the origin', () => {
    const cam = createCamera({ distance: 5, target: [10, 0, 0] });
    expectVecClose(cameraEye(cam), [10, 0, 5]);
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
    const horizontal = Math.hypot(eye[0], eye[2]);
    expect(horizontal).toBeGreaterThan(0);
  });

  it('does not move the target or the distance', () => {
    const before = createCamera({ distance: 7, target: [1, 2, 3] });
    const after = orbitBy(before, 1, 0.2);
    expect(after.distance).toBe(7);
    expect(after.target).toEqual([1, 2, 3]);
  });
});

describe('dollyBy', () => {
  it('scales the distance', () => {
    expect(dollyBy(createCamera({ distance: 10 }), 2).distance).toBeCloseTo(20, 6);
    expect(dollyBy(createCamera({ distance: 10 }), 0.5).distance).toBeCloseTo(5, 6);
  });

  it('clamps to a usable range rather than letting the camera reach the target', () => {
    const near = dollyBy(createCamera({ distance: 10 }), 0.0001);
    expect(near.distance).toBeGreaterThan(0);
    const far = dollyBy(createCamera({ distance: 10 }), 10000);
    expect(Number.isFinite(far.distance)).toBe(true);
    expect(far.distance).toBeLessThan(10000 * 10);
  });
});

describe('cameraViewProjection', () => {
  it('aims the center-screen ray from the eye at the target', () => {
    const cam: Camera3d = createCamera({ distance: 5, yaw: 0.7, pitch: 0.4, target: [1, 0, -2] });
    const eye = cameraEye(cam);
    const vp = cameraViewProjection(cam, RECT.w / RECT.h);
    const ray = rayThroughScreenPoint({ x: 400, y: 300 }, RECT, vp, eye);
    expectVecClose(ray.direction, normalize(sub(cam.target, eye)), 4);
  });
});
