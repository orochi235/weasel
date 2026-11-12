/**
 * A camera in a world whose `up` is not +y. A z-up world is the y-up one turned a quarter about x, +y onto +z and +z
 * onto -y; every picture and every gesture there is the y-up one carried by that turn. The camera holds no up of its
 * own: the world's reaches it through the viewport, the dep and the aim.
 */
import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createScene, type NodeId } from '@weasel-js/core';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { add, cross, dot, len, scale, sub, type Vec3 } from '@weasel-js/geom/3d';
import { aimOf3d } from './aim';
import { cameraBasis, cameraEye, createCamera, dollyToward, orbitBy, panBy, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { createNodeAtPoint, screenBoxOf } from './deps';
import { pose3, type Pose3 } from './pose3';
import { projectPoint, type Viewport3d } from './project';
import { dollyAction, orbitAction, panAction } from './tools';

const Z: Vec3 = { x: 0, y: 0, z: 1 };
/** The quarter turn about x carrying a y-up world onto a z-up one. */
const turn = (p: Vec3): Vec3 => ({ x: p.x, y: -p.z, z: p.y });
const PANE = { width: 800, height: 600 };

const CAMERAS: Partial<Camera3d>[] = [
  { distance: 10 },
  { distance: 7, yaw: 0.6, pitch: 0.45, target: { x: 1, y: 2, z: -3 } },
  { distance: 25, yaw: -2.4, pitch: -0.9, target: { x: -4, y: 0.5, z: 6 }, fov: 1.1 },
  { distance: 3, yaw: 4, pitch: 1.3, target: { x: 0, y: -1, z: 0 } },
];
const yUp = (init: Partial<Camera3d>) => createCamera(init);
const zUp = (init: Partial<Camera3d>) => createCamera({ ...init, target: turn(init.target ?? { x: 0, y: 0, z: 0 }) });

function expectNear(a: Vec3, b: Vec3, tol = 1e-9) {
  expect(len(sub(a, b))).toBeLessThanOrEqual(tol * Math.max(1, len(b)));
}
/** Two cameras show one picture when their worlds are matched by `turn`. */
function expectSamePicture(y: Camera3d, z: Camera3d) {
  expectNear(z.target, turn(y.target));
  expect(z.yaw).toBeCloseTo(y.yaw, 12);
  expect(z.pitch).toBeCloseTo(y.pitch, 12);
  expect(z.distance).toBeCloseTo(y.distance, 12);
  expectNear(cameraEye(z, Z), turn(cameraEye(y)));
  const vy: Viewport3d = { camera: y, ...PANE };
  const vz: Viewport3d = { camera: z, ...PANE, up: Z };
  for (const p of [{ x: 1, y: 2, z: 3 }, { x: -5, y: 0, z: 1 }, add(y.target, { x: 0.3, y: -0.2, z: 0.1 })]) {
    const sy = projectPoint(p, vy);
    const sz = projectPoint(turn(p), vz);
    expect(sz === null).toBe(sy === null);
    if (sy && sz) {
      expect(sz.x).toBeCloseTo(sy.x, 6);
      expect(sz.y).toBeCloseTo(sy.y, 6);
    }
  }
}

describe('a z-up camera', () => {
  it('sits down -y at yaw 0 and rises along z with pitch', () => {
    expectNear(cameraEye(createCamera({ distance: 5 }), Z), { x: 0, y: -5, z: 0 });
    const eye = cameraEye(createCamera({ distance: 5, pitch: Math.PI / 6 }), Z);
    expect(eye.z).toBeCloseTo(2.5, 12);
  });

  it('keeps its horizon level: the world z axis stands upright on screen at any turn', () => {
    for (const init of CAMERAS) {
      const camera = zUp(init);
      const vp: Viewport3d = { camera, ...PANE, up: Z };
      const { right, up, forward, orbitUp } = cameraBasis(camera, Z);
      expect(right.z).toBeCloseTo(0, 12);
      expect(orbitUp).toEqual(Z);
      // A right-handed screen basis, looking down `forward`.
      expectNear(cross(right, up), scale(forward, -1));
      // Two points level with the target, either side of it, draw on one screen row; one above it draws higher.
      const level = cross(Z, forward);
      const a = projectPoint(add(camera.target, scale(level, 0.5)), vp)!;
      const b = projectPoint(sub(camera.target, scale(level, 0.5)), vp)!;
      const above = projectPoint(add(camera.target, scale(Z, 0.5)), vp)!;
      expect(a.y).toBeCloseTo(b.y, 6);
      expect(above.y).toBeLessThan(a.y);
    }
  });

  it('shows the y-up picture turned, at every place and angle', () => {
    for (const init of CAMERAS) expectSamePicture(yUp(init), zUp(init));
  });

  it('orbits, pans and dollies as a y-up camera does, turned', () => {
    for (const init of CAMERAS) {
      const y = yUp(init), z = zUp(init);
      expectSamePicture(orbitBy(y, 0.7, -0.3), orbitBy(z, 0.7, -0.3));
      expectSamePicture(panBy(y, 120, -45, 600), panBy(z, 120, -45, 600, Z));
      expectSamePicture(
        dollyToward(y, 0.6, { x: 650, y: 120 }, PANE),
        dollyToward(z, 0.6, { x: 650, y: 120 }, PANE, undefined, Z),
      );
    }
  });

  it('pans along the ground plane and the screen, never off it', () => {
    const c = zUp({ distance: 10, yaw: 0.4 });
    const moved = panBy(c, 50, 0, 600, Z);
    expect(moved.target.z).toBeCloseTo(0, 12);
    expect(dot(sub(moved.target, c.target), cameraBasis(c, Z).forward)).toBeCloseTo(0, 12);
  });

  it('falls back to +y for an up with no direction', () => {
    const plain = createCamera({ distance: 4, yaw: 1, pitch: 0.2 });
    expect(cameraEye(plain, { x: 0, y: 0, z: 0 })).toEqual(cameraEye(plain));
    expect(cameraEye(plain, { x: 0, y: NaN, z: 0 })).toEqual(cameraEye(plain));
    expect(cameraEye(plain, { x: 0, y: 3, z: 0 })).toEqual(cameraEye(plain));
  });

  it('orbits about a down-pointing up upside down, its eye level with the target at pitch 0', () => {
    const eye = cameraEye(createCamera({ distance: 5, pitch: 0.3 }), { x: 0, y: -1, z: 0 });
    expect(eye.y).toBeCloseTo(-5 * Math.sin(0.3), 12);
  });
});

function depsFor(camera: Camera3d, up?: Vec3) {
  let current = camera;
  const camera3d: Camera3dDep = {
    get: () => current,
    set: (c) => { current = c; },
    size: () => PANE,
    ...(up ? { up: () => up } : {}),
  };
  return { deps: { camera3d } as unknown as ActionDeps, camera: () => current };
}
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };
const ctxOf = (deps: ActionDeps, more: Partial<InvocationCtx> = {}) =>
  ({ world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: NO_MODS, deps, ...more }) as InvocationCtx;
function drag(action: typeof orbitAction, deps: ActionDeps, to: { x: number; y: number }) {
  const handle = (action.invoker as OngoingInvoker).start(ctxOf(deps), undefined);
  handle.onMove?.(ctxOf(deps, {
    drag: { start: { x: 0, y: 0 }, current: to, delta: to, screenDelta: to },
  } as Partial<InvocationCtx>));
}

describe('the camera actions in a z-up world', () => {
  it('orbit, pan and dolly the camera3d dep as they do in a y-up one, turned', () => {
    for (const init of CAMERAS) {
      for (const act of [
        (deps: ActionDeps) => drag(orbitAction, deps, { x: 40, y: -25 }),
        (deps: ActionDeps) => drag(panAction, deps, { x: -70, y: 30 }),
        (deps: ActionDeps) => (dollyAction.invoker as ImmediateInvoker).run(deps, { deltaY: -150, clientX: 600, clientY: 200 }),
      ]) {
        const y = depsFor(yUp(init)), z = depsFor(zUp(init), Z);
        act(y.deps);
        act(z.deps);
        expectSamePicture(y.camera(), z.camera());
      }
    }
  });
});

describe('a z-up camera as an aim', () => {
  it('lays its frustum out as the y-up one turned', () => {
    for (const init of CAMERAS) {
      const fy = aimOf3d({ camera: yUp(init), ...PANE }, null).extent;
      const fz = aimOf3d({ camera: zUp(init), ...PANE }, null, { up: Z }).extent;
      expectNear(fz.eye, turn(fy.eye));
      fy.far.forEach((p, i) => expectNear(fz.far[i]!, turn(p), 1e-8));
      fy.near.forEach((p, i) => expectNear(fz.near[i]!, turn(p), 1e-8));
    }
  });
});

describe('a world whose only up is World3d.up', () => {
  const at = (position: Vec3) => ({ kind: 'mark' as const, layer: 'solids' as const, pose: pose3(position), data: {} });
  const scene = createScene<Record<string, never>, 'solids', Pose3>({
    composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'solids' }],
    initial: [at({ x: -3, y: 0, z: 0 }), at({ x: 3, y: 0, z: 0 }), at({ x: 0, y: 0, z: 2 })],
  });
  const [left, right, above] = [...scene.renderOrder()] as NodeId[];
  // A camera with no up of its own, looking down on the ground from yaw 0.
  const camera = createCamera({ distance: 12, pitch: 0.45 });
  const world = { scene, viewport: () => ({ camera, ...PANE }), up: Z };

  it('draws the scene with a level horizon, z upright on screen', () => {
    const l = screenBoxOf(world, left!, world.viewport())!;
    const r = screenBoxOf(world, right!, world.viewport())!;
    const a = screenBoxOf(world, above!, world.viewport())!;
    expect(l.y + l.height / 2).toBeCloseTo(r.y + r.height / 2, 6);
    expect(l.x).toBeLessThan(r.x);
    // Raised along z, it draws above the two on the ground.
    expect(a.y + a.height).toBeLessThan(l.y);
  });

  it('picks along the rays it draws by', () => {
    const a = screenBoxOf(world, above!, world.viewport())!;
    expect(createNodeAtPoint(world)({ x: a.x + a.width / 2, y: a.y + a.height / 2 })).toBe(above);
  });
});
