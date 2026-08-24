// apps/site/demos/__tests__/platformerCamera.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, TILE } from '../platformer/level';
import { CAM_SCALE, DEAD_ZONE_X, cameraView, createCamera, followCamera, worldToScreen } from '../platformer/camera';

const DIMS = { width: 640, height: 360 };
// 40 x 20 tiles — wider and taller than the viewport in world units.
const BIG = parseLevel(Array.from({ length: 20 }, () => '.'.repeat(40)));

describe('followCamera', () => {
  it('does not move while the target is inside the dead zone', () => {
    const cam = createCamera({ x: 20 * TILE, y: 10 * TILE });
    const next = followCamera(cam, { x: 20 * TILE + 4, y: 10 * TILE }, DIMS, BIG, 1 / 60);
    expect(next.x).toBeCloseTo(cam.x, 6);
  });

  it('chases a target that leaves the dead zone', () => {
    let cam = createCamera({ x: 20 * TILE, y: 10 * TILE });
    const target = { x: 30 * TILE, y: 10 * TILE };
    for (let i = 0; i < 300; i++) cam = followCamera(cam, target, DIMS, BIG, 1 / 60);
    expect(cam.x).toBeGreaterThan(20 * TILE);
    expect(target.x - cam.x).toBeCloseTo(DEAD_ZONE_X, 6);
  });

  it('clamps so the view never leaves the level', () => {
    let cam = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 600; i++) cam = followCamera(cam, { x: -500, y: -500 }, DIMS, BIG, 1 / 60);
    const view = cameraView(cam, DIMS);
    expect(view.x).toBeGreaterThanOrEqual(-0.001);
    expect(view.y).toBeGreaterThanOrEqual(-0.001);

    let far = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 600; i++) far = followCamera(far, { x: 1e5, y: 1e5 }, DIMS, BIG, 1 / 60);
    const farView = cameraView(far, DIMS);
    expect(farView.x + DIMS.width / CAM_SCALE).toBeLessThanOrEqual(BIG.widthPx + 0.001);
    expect(farView.y + DIMS.height / CAM_SCALE).toBeLessThanOrEqual(BIG.heightPx + 0.001);
  });

  it('centers a level smaller than the viewport instead of clamping it to a corner', () => {
    const SMALL = parseLevel(Array.from({ length: 4 }, () => '.'.repeat(4)));
    let cam = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 300; i++) cam = followCamera(cam, { x: 1e4, y: 1e4 }, DIMS, SMALL, 1 / 60);
    const view = cameraView(cam, DIMS);
    expect(view.x + DIMS.width / CAM_SCALE / 2).toBeCloseTo(SMALL.widthPx / 2, 3);
    expect(view.y + DIMS.height / CAM_SCALE / 2).toBeCloseTo(SMALL.heightPx / 2, 3);
  });

  it('produces a view at the camera zoom', () => {
    const view = cameraView(createCamera({ x: 100, y: 50 }), DIMS);
    expect(view.scale).toEqual({ x: CAM_SCALE, y: CAM_SCALE });
    expect(view.x).toBeCloseTo(100 - DIMS.width / CAM_SCALE / 2, 6);
    expect(view.y).toBeCloseTo(50 - DIMS.height / CAM_SCALE / 2, 6);
  });
});

describe('worldToScreen', () => {
  it('puts the view origin at the screen origin', () => {
    const view = cameraView(createCamera({ x: 200, y: 100 }), DIMS);
    const p = worldToScreen(view, view.x, view.y);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('scales world distance by the camera zoom', () => {
    const view = cameraView(createCamera({ x: 200, y: 100 }), DIMS);
    const a = worldToScreen(view, view.x, view.y);
    const b = worldToScreen(view, view.x + 10, view.y + 10);
    expect(b.x - a.x).toBeCloseTo(10 * CAM_SCALE, 6);
    expect(b.y - a.y).toBeCloseTo(10 * CAM_SCALE, 6);
  });

  it('inverts the documented screen→world mapping', () => {
    const view = cameraView(createCamera({ x: 512, y: 256 }), DIMS);
    const screen = worldToScreen(view, 700, 300);
    expect(screen.x / view.scale.x + view.x).toBeCloseTo(700, 4);
    expect(screen.y / view.scale.y + view.y).toBeCloseTo(300, 4);
  });
});
