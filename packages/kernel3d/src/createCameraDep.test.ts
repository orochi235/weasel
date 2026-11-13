import { describe, expect, it } from 'vitest';
import type { ActionDeps, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { cameraBasis, createCamera, type Camera3d } from './camera';
import { createCameraDep } from './createCameraDep';
import { panAction } from './tools';
import type { Viewport3d } from './project';

const Z_UP = { x: 0, y: 0, z: 1 };
const NO_MODS = { alt: false, ctrl: false, meta: false, shift: false };

function panRight(deps: ActionDeps, px: number): void {
  const ctx = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: NO_MODS, deps } as InvocationCtx;
  const handle = (panAction.invoker as OngoingInvoker).start(ctx, undefined);
  handle.onMove!({ ...ctx, drag: { start: { x: 0, y: 0 }, current: { x: px, y: 0 }, delta: { x: px, y: 0 }, screenDelta: { x: px, y: 0 } } } as unknown as InvocationCtx);
}

describe('createCameraDep', () => {
  it('reads the camera and pane the world casts through, and slides a pan across the world\'s up', () => {
    let camera: Camera3d = createCamera({ pitch: 0.4, yaw: 0.7, distance: 10 });
    const world = { up: Z_UP, viewport: (): Viewport3d => ({ camera, width: 800, height: 600 }) };
    const dep = createCameraDep(world, { set: (c) => { camera = c; } });
    expect(dep.get()).toBe(camera);
    expect(dep.size()).toEqual({ width: 800, height: 600 });

    const before = camera;
    panRight({ camera3d: dep } as unknown as ActionDeps, 100);
    const moved = { x: camera.target.x - before.target.x, y: camera.target.y - before.target.y, z: camera.target.z - before.target.z };
    // A pan right slides the target left along the screen's right as a z-up world draws it: nothing along up.
    const { right } = cameraBasis(before, Z_UP);
    expect(moved.z).toBeCloseTo(0, 12);
    expect(moved.x * right.x + moved.y * right.y).toBeLessThan(0);
  });

  it('reads the camera of the view it names', () => {
    const left = createCamera({ yaw: 1 });
    const right = createCamera({ yaw: -1 });
    const world = { viewport: (id?: string | null): Viewport3d => ({ camera: id === 'r' ? right : left, width: 10, height: 10 }) };
    expect(createCameraDep(world, { set: () => {}, viewId: 'r' }).get()).toBe(right);
  });
});
