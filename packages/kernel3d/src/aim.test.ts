import { aimSpace2d, type AimSpace } from '@weasel-js/core';
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

  it('lays its corners on the near and far planes, top-left first, clockwise', () => {
    const { eye, near, far } = aimOf3d(VP, 'p').extent;
    expect(eye).toEqual({ x: 0, y: 0, z: 10 });
    near.forEach((c) => expect(10 - c.z).toBeCloseTo(VP.camera.near, 6));
    far.forEach((c) => expect(10 - c.z).toBeCloseTo(VP.camera.far, 6));
    for (const quad of [near, far]) {
      const [tl, tr, br, bl] = quad;
      expect(tl.x).toBeLessThan(0); expect(tl.y).toBeGreaterThan(0);
      expect(tr.x).toBeGreaterThan(0); expect(tr.y).toBeGreaterThan(0);
      expect(br.x).toBeGreaterThan(0); expect(br.y).toBeLessThan(0);
      expect(bl.x).toBeLessThan(0); expect(bl.y).toBeLessThan(0);
    }
  });
  it('answers null when a corner does not project', () => {
    const stub = (kind: string): AimSpace => {
      let n = 0;
      return { viewId: null, kind, size: { width: 1, height: 1 }, project: () => (n++ === 2 ? null : { x: 0, y: 0 }), unproject: () => null };
    };
    expect(aimOf3d(VP, 'p').outlineIn(stub('3d'))).toBeNull();
    expect(aimOf3d(VP, 'p').outlineIn(stub('2d'))).toBeNull();
  });
});

describe('aimSpace3d', () => {
  const PANE: Viewport3d = { ...VP, originX: 50, originY: 20 };
  const SIDE: Viewport3d = { ...VP, camera: createCamera({ yaw: Math.PI / 2 }) };
  const MID = { x: 100, y: 50 };
  it('projects in frame px, from the pane top-left', () => {
    const p = aimSpace3d(PANE, 'p').project({ x: 0, y: 0 })!;
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });
  it('unprojects frame px onto z = 0 through a pane with an origin', () => {
    const w = aimSpace3d(PANE, 'p').unproject(MID)!;
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
    expect(w.z).toBeCloseTo(0, 6);
  });
  it('unprojects to null where the ray runs parallel to z = 0', () => {
    expect(aimSpace3d(SIDE, 'p').unproject(MID)).toBeNull();
  });
  it('declines to pan when either point misses the plane', () => {
    expect(aimOf3d(SIDE, 'p').pannedIn(aimSpace3d(SIDE, 'p'), MID, MID)).toBeNull();
  });
});
