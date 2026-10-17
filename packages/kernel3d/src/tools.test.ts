import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { createCamera, type Camera3d } from './camera';
import type { Camera3dDep } from './cameraDep';
import { dollyAction, homeAction, panAction, pinchDollyAction, useOrbitTool } from './tools';

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
