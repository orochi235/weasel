import { aimSpace2d, type AimSpace } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { aimOf3d, aimSpace3d, cameraOfAim3d, type Aim3d } from './aim';
import { createCamera, MAX_PITCH } from './camera';
import { projectPoint, type Viewport3d } from './project';

const VP: Viewport3d = { camera: createCamera({}), width: 200, height: 100 };
const FLAT = aimSpace2d(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });
/** A z-up world, where the level default camera looks straight down at the ground. */
const Z_UP = { up: { x: 0, y: 0, z: 1 } };
/** Looking down at the y-up ground, centered on (1, 0, 2). */
const DOWN: Viewport3d = { ...VP, camera: createCamera({ pitch: MAX_PITCH, target: { x: 1, y: 0, z: 2 } }) };
const PANE_CORNERS = [[0, 0], [200, 0], [200, 100], [0, 100]] as const;

describe('aimOf3d', () => {
  it('outlines its own pane at the frame corners', () => {
    const out = aimOf3d(VP, 'p').outlineIn(aimSpace3d(VP, 'p'))!;
    [[0, 0], [200, 0], [200, 100], [0, 100]].forEach(([x, y], i) => {
      expect(out[i]!.x).toBeCloseTo(x!, 6);
      expect(out[i]!.y).toBeCloseTo(y!, 6);
    });
  });
  it('outlines its footprint on the y = 0 ground in a 2D space, the 2D x and y along world x and z', () => {
    const out = aimOf3d(DOWN, 'p').outlineIn(FLAT)!;
    expect(out).toHaveLength(4);
    const drawn = out.map((p) => projectPoint({ x: p.x, y: 0, z: p.y }, DOWN)!);
    for (const [x, y] of PANE_CORNERS) {
      expect(drawn.some((d) => Math.hypot(d.x - x, d.y - y) < 1e-6)).toBe(true);
    }
  });
  it('outlines its footprint on z = 0 in a 2D space when z is up', () => {
    const out = aimOf3d(VP, 'p', Z_UP).outlineIn(FLAT)!;
    const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-8.2843, 3); expect(Math.max(...xs)).toBeCloseTo(8.2843, 3);
    expect(Math.min(...ys)).toBeCloseTo(-4.1421, 3); expect(Math.max(...ys)).toBeCloseTo(4.1421, 3);
  });
  it('outlines the part of the ground it sees when the ground runs off past its far plane or its horizon', () => {
    // Grazing z = 0 at about 10 degrees, so the pane's far side looks past it.
    const grazing: Viewport3d = { ...VP, camera: createCamera({ yaw: 1.4, far: 60 }) };
    const out = aimOf3d(grazing, 'p', Z_UP).outlineIn(FLAT)!;
    expect(out.length).toBeGreaterThanOrEqual(3);
    // The camera's target, the origin, is in view, so the outline holds it.
    let winding = 0;
    out.forEach((a, i) => {
      const b = out[(i + 1) % out.length]!;
      winding += Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
    });
    expect(Math.abs(winding)).toBeCloseTo(2 * Math.PI, 6);
    // Nothing past the far plane: every point within `far` of the eye.
    const eye = aimOf3d(grazing, 'p', Z_UP).extent.eye;
    for (const p of out) expect(Math.hypot(p.x - eye.x, p.y - eye.y, eye.z)).toBeLessThanOrEqual(60 / Math.cos(Math.PI / 4) + 1e-6);
  });
  it('answers null in a 2D space behind it', () => {
    const away = { ...VP, camera: createCamera({ target: { x: 0, y: 0, z: -40 } }) };
    expect(aimOf3d(away, 'p', Z_UP).outlineIn(FLAT)).toBeNull();
  });
  it('pans its camera target across the ground by the world distance in a 2D space', () => {
    const moved = aimOf3d(DOWN, 'p').pannedIn(FLAT, { x: 0, y: 0 }, { x: 1, y: 2 }) as Aim3d;
    expect(cameraOfAim3d(moved).target).toEqual({ x: 2, y: 0, z: 4 });
  });
  it('pans along x and y when z is up', () => {
    const moved = aimOf3d(VP, 'p', Z_UP).pannedIn(FLAT, { x: 0, y: 0 }, { x: 1, y: 0 }) as Aim3d;
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
  const MID = { x: 100, y: 50 };
  it('projects in frame px, from the pane top-left', () => {
    const p = aimSpace3d(PANE, 'p').project({ x: 0, y: 0 })!;
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });
  it('projects a 2D point from the ground, its y along world z', () => {
    const p = aimSpace3d(DOWN, 'p').project({ x: 1, y: 2 })!;
    expect(p.x).toBeCloseTo(MID.x, 6);
    expect(p.y).toBeCloseTo(MID.y, 6);
  });
  it('unprojects frame px onto the ground as a 2D point, world z as its y', () => {
    const w = aimSpace3d(DOWN, 'p').unproject(MID)!;
    expect(w.x).toBeCloseTo(1, 6);
    expect(w.y).toBeCloseTo(2, 6);
    expect(w.z).toBeCloseTo(0, 6);
  });
  it('unprojects frame px onto z = 0 through a pane with an origin when z is up', () => {
    const w = aimSpace3d(PANE, 'p', Z_UP).unproject(MID)!;
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
    expect(w.z).toBeCloseTo(0, 6);
  });
  it('unprojects to null where the ray runs parallel to the ground', () => {
    expect(aimSpace3d(VP, 'p').unproject(MID)).toBeNull();
  });
  it('declines to pan when either point misses the ground', () => {
    expect(aimOf3d(VP, 'p').pannedIn(aimSpace3d(VP, 'p'), MID, MID)).toBeNull();
  });
});
