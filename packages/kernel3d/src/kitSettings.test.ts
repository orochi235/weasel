import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/core';
import { createKitSettingsStore, type KitSettingsOverrides } from '@weasel-js/react';
import { createCamera, type Camera3d } from './camera';
import { DOLLY_RATE, ORBIT_RATE, dollyAction, orbitAction } from './tools';
import { kernel3dKitSettingsSchema } from './kitSettings';

function cameraDeps(settings?: KitSettingsOverrides) {
  let camera = createCamera({});
  const deps = {
    camera3d: { get: () => camera, set: (c: Camera3d) => { camera = c; }, size: () => ({ width: 100, height: 100 }) },
    ...(settings ? { kitSettings: createKitSettingsStore(settings) } : {}),
  } as unknown as ActionDeps;
  return { deps, camera: () => camera };
}

const orbitYaw = (settings?: KitSettingsOverrides): number => {
  const { deps, camera } = cameraDeps(settings);
  const base = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps };
  const handle = (orbitAction.invoker as OngoingInvoker).start(base as InvocationCtx, undefined);
  handle.onMove!({ ...base, drag: { start: { x: 0, y: 0 }, current: { x: 10, y: 0 }, delta: { x: 10, y: 0 }, screenDelta: { x: 10, y: 0 } } } as InvocationCtx);
  return camera().yaw;
};

const dollied = (settings?: KitSettingsOverrides): number => {
  const { deps, camera } = cameraDeps(settings);
  (dollyAction.invoker as ImmediateInvoker).run(deps, { deltaY: 100 });
  return camera().distance;
};

describe('camera tools under the orbit3d kit settings', () => {
  it('orbit at orbit3d.orbitRate, else ORBIT_RATE', () => {
    expect(orbitYaw()).toBeCloseTo(-10 * ORBIT_RATE);
    expect(orbitYaw({ orbit3d: { orbitRate: 0.02 } })).toBeCloseTo(-0.2);
  });

  it('dolly at orbit3d.dollyRate, else DOLLY_RATE', () => {
    expect(dollied()).toBeCloseTo(10 * Math.exp(100 * DOLLY_RATE));
    expect(dollied({ orbit3d: { dollyRate: 0.005 } })).toBeCloseTo(10 * Math.exp(0.5));
  });
});

describe('kernel3dKitSettingsSchema', () => {
  it('defaults every leaf to its constant', () => {
    const { orbitRate, dollyRate } = kernel3dKitSettingsSchema.children.orbit3d.children;
    expect([orbitRate.default, dollyRate.default]).toEqual([ORBIT_RATE, DOLLY_RATE]);
  });
});
