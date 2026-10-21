import { aimSpace2d } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { aimOf3d, aimSpace3d, cameraOfAim3d, type Aim3d } from './aim';
import { createCamera } from './camera';
import type { Viewport3d } from './project';

const VP: Viewport3d = { camera: createCamera({}), width: 200, height: 100 };
const FLAT = aimSpace2d(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });

describe('aimOf3d', () => {
  it('outlines its own pane at the frame corners', () => {
    const out = aimOf3d(VP, 'p').outlineIn(aimSpace3d(VP, 'p'))!;
    [[0, 0], [200, 0], [200, 100], [0, 100]].forEach(([x, y], i) => {
      expect(out[i]!.x).toBeCloseTo(x!, 6);
      expect(out[i]!.y).toBeCloseTo(y!, 6);
    });
  });
  it('outlines its footprint on z = 0 in a 2D space', () => {
    const out = aimOf3d(VP, 'p').outlineIn(FLAT)!;
    const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-8.2843, 3); expect(Math.max(...xs)).toBeCloseTo(8.2843, 3);
    expect(Math.min(...ys)).toBeCloseTo(-4.1421, 3); expect(Math.max(...ys)).toBeCloseTo(4.1421, 3);
  });
  it('answers null in a 2D space behind it', () => {
    const away = { ...VP, camera: createCamera({ target: { x: 0, y: 0, z: -40 } }) };
    expect(aimOf3d(away, 'p').outlineIn(FLAT)).toBeNull();
  });
  it('pans its camera target by the world distance in a 2D space', () => {
    const moved = aimOf3d(VP, 'p').pannedIn(FLAT, { x: 0, y: 0 }, { x: 1, y: 0 }) as Aim3d;
    expect(cameraOfAim3d(moved).target).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('names the view it was read in', () => {
    expect(aimOf3d(VP, 'p').viewId).toBe('p');
  });
});
