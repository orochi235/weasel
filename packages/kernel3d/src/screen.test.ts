import { describe, expect, it } from 'vitest';
import {
  lookAt, multiply, perspective, transformPoint4, type Aabb, type Mat4, type Vec3,
} from '@weasel-js/geom/3d';
import {
  ndcToScreen, projectAabbToScreen, rayThroughScreenPoint, screenToNdc, type ScreenBox,
} from './screen';

const RECT: ScreenBox = { x: 0, y: 0, width: 400, height: 300 };
const NEAR = 0.1;

function cameraAt(eye: Vec3, target: Vec3 = { x: 0, y: 0, z: 0 }): Mat4 {
  return multiply(
    perspective(Math.PI / 4, RECT.width / RECT.height, NEAR, 100),
    lookAt(eye, target, { x: 0, y: 1, z: 0 }),
  );
}

/** What the lab did before this package: drop every corner behind the camera
 *  rather than clip the edge. Kept so the near-plane test has something to be
 *  a fix *of* — an assertion that passes against both is not a fix. */
function projectByDroppingCorners(box: Aabb, vp: Mat4, rect: ScreenBox) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = {
      x: i & 1 ? box.max.x : box.min.x,
      y: i & 2 ? box.max.y : box.min.y,
      z: i & 4 ? box.max.z : box.min.z,
    };
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
    const offset: ScreenBox = { x: 50, y: 20, width: 400, height: 300 };
    expect(screenToNdc({ x: 250, y: 170 }, offset)).toEqual({ x: 0, y: 0 });
  });
});

describe('rayThroughScreenPoint', () => {
  const eye: Vec3 = { x: 0, y: 0, z: 5 };
  const vp = cameraAt(eye);

  it('shoots straight ahead from the middle of the viewport', () => {
    const ray = rayThroughScreenPoint({ x: 200, y: 150 }, RECT, vp, eye)!;
    expect(ray.origin).toEqual(eye);
    expect(ray.direction.x).toBeCloseTo(0, 6);
    expect(ray.direction.y).toBeCloseTo(0, 6);
    expect(ray.direction.z).toBeCloseTo(-1, 6);
  });

  it('leans right for a point right of centre', () => {
    const ray = rayThroughScreenPoint({ x: 350, y: 150 }, RECT, vp, eye)!;
    expect(ray.direction.x).toBeGreaterThan(0);
    expect(ray.direction.z).toBeLessThan(0);
  });

  it('leans up for a point above centre, despite y running down the screen', () => {
    const ray = rayThroughScreenPoint({ x: 200, y: 50 }, RECT, vp, eye)!;
    expect(ray.direction.y).toBeGreaterThan(0);
  });

  it('casts no ray through a view-projection with no inverse', () => {
    // An eye on its own target has no orientation.
    const flat = cameraAt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(
      rayThroughScreenPoint({ x: 350, y: 150 }, RECT, flat, { x: 0, y: 0, z: 0 }),
    ).toBeNull();
    const zero = new Array(16).fill(0) as Mat4;
    expect(rayThroughScreenPoint({ x: 350, y: 150 }, RECT, zero, eye)).toBeNull();
  });

  it('casts no ray through a pane with no area', () => {
    expect(rayThroughScreenPoint({ x: 0, y: 150 }, { x: 0, y: 0, width: 0, height: 300 }, vp, eye)).toBeNull();
  });

  it('casts the same ray through a world scaled down by 1e-10', () => {
    const k = 1e-10;
    const tinyEye: Vec3 = { x: 0, y: 0, z: 5 * k };
    const tinyVp = multiply(
      perspective(Math.PI / 4, RECT.width / RECT.height, NEAR * k, 100 * k),
      lookAt(tinyEye, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    );
    const unit = rayThroughScreenPoint({ x: 350, y: 50 }, RECT, vp, eye)!;
    const tiny = rayThroughScreenPoint({ x: 350, y: 50 }, RECT, tinyVp, tinyEye)!;
    expect(tiny).not.toBeNull();
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(tiny.direction[axis]).toBeCloseTo(unit.direction[axis], 6);
    }
  });

  it('casts the same ray whatever the far plane', () => {
    const farVp = multiply(
      perspective(Math.PI / 4, RECT.width / RECT.height, NEAR, 1e10),
      lookAt(eye, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    );
    const unit = rayThroughScreenPoint({ x: 350, y: 50 }, RECT, vp, eye)!;
    const far = rayThroughScreenPoint({ x: 350, y: 50 }, RECT, farVp, eye)!;
    expect(far).not.toBeNull();
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(far.direction[axis]).toBeCloseTo(unit.direction[axis], 6);
    }
  });
});

describe('projectAabbToScreen', () => {
  const unitCube: Aabb = {
    min: { x: -0.5, y: -0.5, z: -0.5 },
    max: { x: 0.5, y: 0.5, z: 0.5 },
  };

  it('centres a centred box and grows it as the camera closes in', () => {
    const far = projectAabbToScreen(unitCube, cameraAt({ x: 0, y: 0, z: 8 }), RECT);
    const near = projectAabbToScreen(unitCube, cameraAt({ x: 0, y: 0, z: 3 }), RECT);
    expect(far).not.toBeNull();
    expect(near).not.toBeNull();
    expect(far!.x + far!.width / 2).toBeCloseTo(200, 4);
    expect(far!.y + far!.height / 2).toBeCloseTo(150, 4);
    expect(near!.width).toBeGreaterThan(far!.width);
  });

  it('projects a world scaled down by 1e-10 onto the same rectangle', () => {
    const k = 1e-10;
    const tinyVp = multiply(
      perspective(Math.PI / 4, RECT.width / RECT.height, NEAR * k, 100 * k),
      lookAt({ x: 0, y: 0, z: 3 * k }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    );
    const tinyCube: Aabb = {
      min: { x: -0.5 * k, y: -0.5 * k, z: -0.5 * k },
      max: { x: 0.5 * k, y: 0.5 * k, z: 0.5 * k },
    };
    const unit = projectAabbToScreen(unitCube, cameraAt({ x: 0, y: 0, z: 3 }), RECT)!;
    const tiny = projectAabbToScreen(tinyCube, tinyVp, RECT);
    expect(tiny).not.toBeNull();
    expect(tiny!.x).toBeCloseTo(unit.x, 4);
    expect(tiny!.width).toBeCloseTo(unit.width, 4);
  });

  it('reports null for a box entirely behind the camera', () => {
    const behind: Aabb = { min: { x: -0.5, y: -0.5, z: 9 }, max: { x: 0.5, y: 0.5, z: 10 } };
    expect(projectAabbToScreen(behind, cameraAt({ x: 0, y: 0, z: 5 }), RECT)).toBeNull();
  });

  it('clips a box straddling the near plane instead of shrinking it', () => {
    // The camera sits inside this box: four corners are behind it.
    const around: Aabb = { min: { x: -2, y: -2, z: -2 }, max: { x: 2, y: 2, z: 2 } };
    const vp = cameraAt({ x: 0, y: 0, z: 1 });

    const clipped = projectAabbToScreen(around, vp, RECT);
    const dropped = projectByDroppingCorners(around, vp, RECT);

    expect(clipped).not.toBeNull();
    expect(dropped).not.toBeNull();
    // The box surrounds the viewport, so its screen rect must too.
    expect(clipped!.x).toBeLessThanOrEqual(0);
    expect(clipped!.y).toBeLessThanOrEqual(0);
    expect(clipped!.x + clipped!.width).toBeGreaterThanOrEqual(RECT.width);
    expect(clipped!.y + clipped!.height).toBeGreaterThanOrEqual(RECT.height);
    // And the old behaviour must not have managed that, or this proves nothing.
    expect(dropped!.width).toBeLessThan(clipped!.width);
  });

  it('agrees with corner-dropping when nothing is behind the near plane', () => {
    const vp = cameraAt({ x: 0, y: 0, z: 8 });
    const clipped = projectAabbToScreen(unitCube, vp, RECT)!;
    const dropped = projectByDroppingCorners(unitCube, vp, RECT)!;
    expect(clipped.x).toBeCloseTo(dropped.x, 9);
    expect(clipped.width).toBeCloseTo(dropped.width, 9);
  });
});
