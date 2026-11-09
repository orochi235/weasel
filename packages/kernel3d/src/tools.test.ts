import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { dollyAction, homeAction, orbitAction, panAction, pinchDollyAction, useOrbitTool } from './tools';

describe('useOrbitTool', () => {
  it('returns the same tool on every render', () => {
    // A new object per render makes useTools rebuild its ToolsApi every render,
    // which loops a canvas whose onToolsCreated sets state.
    const { result, rerender } = renderHook(() => useOrbitTool());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

function depsFor(init: Partial<Camera3d>, extra: Partial<Camera3dDep> = {}) {
  let camera = createCamera(init);
  const camera3d: Camera3dDep = {
    get: () => camera,
    set: (c) => { camera = c; },
    size: () => ({ width: 800, height: 600 }),
    ...extra,
  };
  return { deps: { camera3d } as unknown as ActionDeps, camera: () => camera };
}

const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };
const ctxOf = (deps: ActionDeps, more: Partial<InvocationCtx> = {}) =>
  ({ world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: NO_MODS, deps, ...more }) as InvocationCtx;
const run = (action: typeof dollyAction, deps: ActionDeps, params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

describe('camera.dolly', () => {
  it('holds to the dep limits rather than the defaults', () => {
    const { deps, camera } = depsFor({ distance: 1000 }, { limits: () => ({ maxDistance: 1e6 }) });
    run(dollyAction, deps, { deltaY: 100 });
    expect(camera().distance).toBeGreaterThan(1000);
  });

  it('dollies about the point under the pointer, the middle leaving the target put', () => {
    const middle = depsFor({ distance: 10 });
    run(dollyAction, middle.deps, { deltaY: -100, clientX: 400, clientY: 300 });
    expect(middle.camera().target).toEqual({ x: 0, y: 0, z: 0 });
    const right = depsFor({ distance: 10 });
    run(dollyAction, right.deps, { deltaY: -100, clientX: 700, clientY: 300 });
    // In toward a point right of the middle: at yaw 0 the target moves to +x.
    expect(right.camera().distance).toBeLessThan(10);
    expect(right.camera().target.x).toBeGreaterThan(0);
  });

  it('reads the pointer from the pane origin, for a pane offset on its canvas', () => {
    const plain = depsFor({ distance: 10 });
    run(dollyAction, plain.deps, { deltaY: -100, clientX: 700, clientY: 100 });
    const offset = depsFor({ distance: 10 }, { origin: () => ({ x: 300, y: 50 }) });
    run(dollyAction, offset.deps, { deltaY: -100, clientX: 1000, clientY: 150 });
    expect(offset.camera()).toEqual(plain.camera());
  });

  it('dollies in on a Safari pinch that spreads', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    run(dollyAction, deps, { scale: 2 });
    expect(camera().distance).toBeCloseTo(5);
  });

  it('binds the ctrl+wheel a trackpad pinch arrives as', () => {
    const specs = (dollyAction.defaultBinding as { spec: { kind: string; mods?: object } }[])
      .map((b) => b.spec);
    expect(specs).toContainEqual({ kind: 'wheel', mods: { ctrl: true } });
  });
});

describe('camera.pan', () => {
  it('moves the target and nothing else, from the camera the drag began on', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const handle = (panAction.invoker as OngoingInvoker).start(ctxOf(deps), undefined);
    const drag = (dx: number) => ctxOf(deps, {
      drag: { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 }, screenDelta: { x: dx, y: 0 } },
    } as Partial<InvocationCtx>);
    handle.onMove?.(drag(10));
    handle.onMove?.(drag(20));
    // Dragging right brings the scene right, so the target goes left: -x at yaw 0.
    const twenty = camera().target.x;
    expect(twenty).toBeLessThan(0);
    handle.onMove?.(drag(10));
    expect(camera().target.x).toBeCloseTo(twenty / 2);
    expect(camera().distance).toBe(10);
  });
});

describe('a camera drag the camera changes under', () => {
  const dragTo = (deps: ActionDeps, dx: number) => ctxOf(deps, {
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 }, screenDelta: { x: dx, y: 0 } },
  } as Partial<InvocationCtx>);

  it('keeps a wheel dolly made mid-orbit, and turns on from where it was', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const handle = (orbitAction.invoker as OngoingInvoker).start(ctxOf(deps), undefined);
    handle.onMove?.(dragTo(deps, 10));
    const yaw = camera().yaw;
    run(dollyAction, deps, { deltaY: 200 });
    const dollied = camera().distance;
    expect(dollied).toBeGreaterThan(10);
    handle.onMove?.(dragTo(deps, 20));
    expect(camera().distance).toBeCloseTo(dollied);
    expect(camera().yaw).toBeCloseTo(2 * yaw);
  });

  it('keeps a camera set mid-pan, and pans on from it', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const handle = (panAction.invoker as OngoingInvoker).start(ctxOf(deps), undefined);
    handle.onMove?.(dragTo(deps, 10));
    (deps.camera3d as Camera3dDep).set(createCamera({ distance: 10, target: { x: 0, y: 5, z: 0 } }));
    handle.onMove?.(dragTo(deps, 10));
    expect(camera().target).toEqual({ x: 0, y: 5, z: 0 });
  });

  it('keeps a dolly made mid-pinch', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const handle = (pinchDollyAction.invoker as OngoingInvoker).start(
      ctxOf(deps, { multiTouch: { spread: 100 } } as Partial<InvocationCtx>),
      undefined,
    );
    const spreadTo = (s: number) =>
      ctxOf(deps, { multiTouch: { pinch: { currentSpread: s } } } as Partial<InvocationCtx>);
    handle.onMove?.(spreadTo(200));
    expect(camera().distance).toBeCloseTo(5);
    (deps.camera3d as Camera3dDep).set({ ...camera(), yaw: 1 });
    handle.onMove?.(spreadTo(400));
    expect(camera().yaw).toBe(1);
    expect(camera().distance).toBeCloseTo(2.5);
  });

  it('reads a host that has not yet caught up with its own last set as unchanged', () => {
    let held = createCamera({ distance: 10 });
    let pending: ReturnType<typeof createCamera> | null = null;
    const camera3d: Camera3dDep = {
      // As a React host's ref, which takes the value on the next render.
      get: () => held,
      set: (c) => { pending = c; },
      size: () => ({ width: 800, height: 600 }),
    };
    const deps = { camera3d } as unknown as ActionDeps;
    const handle = (orbitAction.invoker as OngoingInvoker).start(ctxOf(deps), undefined);
    handle.onMove?.(dragTo(deps, 10));
    const once = pending!;
    handle.onMove?.(dragTo(deps, 20));
    held = pending!;
    handle.onMove?.(dragTo(deps, 30));
    expect(pending!.yaw).toBeCloseTo(3 * once.yaw);
  });
});

describe('camera.pinchDolly', () => {
  it('dollies by the ratio of the spread', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const handle = (pinchDollyAction.invoker as OngoingInvoker).start(
      ctxOf(deps, { multiTouch: { spread: 100 } } as Partial<InvocationCtx>),
      undefined,
    );
    handle.onMove?.(ctxOf(deps, { multiTouch: { pinch: { currentSpread: 200 } } } as Partial<InvocationCtx>));
    expect(camera().distance).toBeCloseTo(5);
  });

  it('reads the centroid from the pane origin, for a pane offset on its canvas', () => {
    const pinch = (extra: Partial<Camera3dDep>, centroid: { x: number; y: number }) => {
      const { deps, camera } = depsFor({ distance: 10 }, extra);
      const handle = (pinchDollyAction.invoker as OngoingInvoker).start(
        ctxOf(deps, { multiTouch: { spread: 100, centroid } } as Partial<InvocationCtx>),
        undefined,
      );
      handle.onMove?.(ctxOf(deps, { multiTouch: { pinch: { currentSpread: 200 } } } as Partial<InvocationCtx>));
      return camera();
    };
    const plain = pinch({}, { x: 700, y: 100 });
    expect(plain.target.x).toBeGreaterThan(0);
    expect(pinch({ origin: () => ({ x: 300, y: 50 }) }, { x: 1000, y: 150 })).toEqual(plain);
  });
});

describe('camera.home', () => {
  it('sets the dep to its home, and does nothing without one', () => {
    const home = createCamera({ yaw: 1 });
    const a = depsFor({}, { home: () => home });
    run(homeAction, a.deps);
    expect(a.camera()).toBe(home);
    const b = depsFor({ yaw: 2 });
    run(homeAction, b.deps);
    expect(b.camera().yaw).toBe(2);
  });
});

describe('a camera action with no camera to move', () => {
  const none = {} as ActionDeps;

  it('hands a drag or a pinch on with an empty handle', () => {
    for (const action of [orbitAction, panAction, pinchDollyAction]) {
      const handle = (action.invoker as OngoingInvoker).start(
        ctxOf(none, { multiTouch: { spread: 100 } } as Partial<InvocationCtx>),
        undefined,
      );
      expect(handle).toEqual({});
    }
  });

  it('passes on a wheel, a pinch or a double click it does nothing with', () => {
    expect(run(dollyAction, none, { deltaY: 100 })).toBe('pass');
    expect(run(homeAction, none)).toBe('pass');
    expect(run(homeAction, depsFor({}).deps)).toBe('pass');
  });

  it('passes on a wheel that moves only sideways, leaving the camera as it was', () => {
    const { deps, camera } = depsFor({ distance: 10 });
    const before = camera();
    expect(run(dollyAction, deps, { deltaX: 40, deltaY: 0 })).toBe('pass');
    expect(camera()).toBe(before);
  });
});
