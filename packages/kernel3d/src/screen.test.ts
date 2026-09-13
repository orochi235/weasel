import { describe, expect, it } from 'vitest';
import {
  lookAt, multiply, perspective, transformPoint4, type Aabb, type Mat4, type Vec3,
} from '@weasel-js/geom/3d';
import {
  ndcToScreen, projectAabbToScreen, rayThroughScreenPoint, screenToNdc, type ViewportRect,
} from './screen';

const RECT: ViewportRect = { x: 0, y: 0, w: 400, h: 300 };
const NEAR = 0.1;

function cameraAt(eye: Vec3, target: Vec3 = [0, 0, 0]): Mat4 {
  return multiply(
    perspective(Math.PI / 4, RECT.w / RECT.h, NEAR, 100),
    lookAt(eye, target, [0, 1, 0]),
  );
}

/** What the lab did before this package: drop every corner behind the camera
 *  rather than clip the edge. Kept so the near-plane test has something to be
 *  a fix *of* — an assertion that passes against both is not a fix. */
function projectByDroppingCorners(box: Aabb, vp: Mat4, rect: ViewportRect) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = [
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2],
    ];
    const [cx, cy, , cw] = transformPoint4(vp, corner);
    if (cw <= 1e-9) continue;
    const s = ndcToScreen({ x: cx / cw, y: cy / cw }, rect);
    minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y);
    any = true;
  }
  return any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

describe('screenToNdc / ndcToScreen', () => {
  it('round-trips the centre and inverts y', () => {
    expect(screenToNdc({ x: 200, y: 150 }, RECT)).toEqual({ x: 0, y: 0 });
    expect(screenToNdc({ x: 0, y: 0 }, RECT)).toEqual({ x: -1, y: 1 });
    expect(ndcToScreen({ x: -1, y: 1 }, RECT)).toEqual({ x: 0, y: 0 });
  });

  it('is rect-relative, so a pane offset moves the origin', () => {
    const offset: ViewportRect = { x: 50, y: 20, w: 400, h: 300 };
    expect(screenToNdc({ x: 250, y: 170 }, offset)).toEqual({ x: 0, y: 0 });
  });
});

describe('rayThroughScreenPoint', () => {
  const eye: Vec3 = [0, 0, 5];
  const vp = cameraAt(eye);

  it('shoots straight ahead from the middle of the viewport', () => {
    const ray = rayThroughScreenPoint({ x: 200, y: 150 }, RECT, vp, eye);
    expect(ray.origin).toEqual(eye);
    expect(ray.direction[0]).toBeCloseTo(0, 6);
    expect(ray.direction[1]).toBeCloseTo(0, 6);
    expect(ray.direction[2]).toBeCloseTo(-1, 6);
  });

  it('leans right for a point right of centre', () => {
    const ray = rayThroughScreenPoint({ x: 350, y: 150 }, RECT, vp, eye);
    expect(ray.direction[0]).toBeGreaterThan(0);
    expect(ray.direction[2]).toBeLessThan(0);
  });

  it('leans up for a point above centre, despite y running down the screen', () => {
    const ray = rayThroughScreenPoint({ x: 200, y: 50 }, RECT, vp, eye);
    expect(ray.direction[1]).toBeGreaterThan(0);
  });
});

describe('projectAabbToScreen', () => {
  const unitCube: Aabb = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };

  it('centres a centred box and grows it as the camera closes in', () => {
    const far = projectAabbToScreen(unitCube, cameraAt([0, 0, 8]), RECT);
    const near = projectAabbToScreen(unitCube, cameraAt([0, 0, 3]), RECT);
    expect(far).not.toBeNull();
    expect(near).not.toBeNull();
    expect(far!.x + far!.width / 2).toBeCloseTo(200, 4);
    expect(far!.y + far!.height / 2).toBeCloseTo(150, 4);
    expect(near!.width).toBeGreaterThan(far!.width);
  });

  it('reports null for a box entirely behind the camera', () => {
    const behind: Aabb = { min: [-0.5, -0.5, 9], max: [0.5, 0.5, 10] };
    expect(projectAabbToScreen(behind, cameraAt([0, 0, 5]), RECT)).toBeNull();
  });

  it('clips a box straddling the near plane instead of shrinking it', () => {
    // The camera sits inside this box: four corners are behind it.
    const around: Aabb = { min: [-2, -2, -2], max: [2, 2, 2] };
    const vp = cameraAt([0, 0, 1]);

    const clipped = projectAabbToScreen(around, vp, RECT);
    const dropped = projectByDroppingCorners(around, vp, RECT);

    expect(clipped).not.toBeNull();
    expect(dropped).not.toBeNull();
    // The box surrounds the viewport, so its screen rect must too.
    expect(clipped!.x).toBeLessThanOrEqual(0);
    expect(clipped!.y).toBeLessThanOrEqual(0);
    expect(clipped!.x + clipped!.width).toBeGreaterThanOrEqual(RECT.w);
    expect(clipped!.y + clipped!.height).toBeGreaterThanOrEqual(RECT.h);
    // And the old behaviour must not have managed that, or this proves nothing.
    expect(dropped!.width).toBeLessThan(clipped!.width);
  });

  it('agrees with corner-dropping when nothing is behind the near plane', () => {
    const vp = cameraAt([0, 0, 8]);
    const clipped = projectAabbToScreen(unitCube, vp, RECT)!;
    const dropped = projectByDroppingCorners(unitCube, vp, RECT)!;
    expect(clipped.x).toBeCloseTo(dropped.x, 9);
    expect(clipped.width).toBeCloseTo(dropped.width, 9);
  });
});
