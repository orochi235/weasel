/**
 * `GestureContext.kitSettings`: a behavior or snap strategy reads a kit
 * setting off the gesture, so every action that builds a gesture context
 * asks for the `kitSettings` dep.
 */
import { describe, it, expect } from 'vitest';
import { createKitSettingsStore, type KitSettingsStore } from '@weasel-js/react';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { MoveBehavior } from '../gestures/types';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { insertAction } from './insert/action';
import { cloneAction } from './clone/action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

describe('GestureContext.kitSettings', () => {
  it('is the kitSettings dep, on the context a move behavior sees', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const s = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
    const kitSettings = createKitSettingsStore({ view: { animationMs: 1 } });
    let seen: KitSettingsStore | null | undefined;
    const spy: MoveBehavior<RectPose> = { onMove: (ctx) => { seen = ctx.kitSettings; } };
    const base = { world: { x: 0, y: 0 }, modifiers: MODS, deps: { selection: { get: () => [s] as NodeId[] }, scene, kitSettings } };
    const handle = (moveAction.invoker as OngoingInvoker)
      .start(base as unknown as InvocationCtx, { behaviors: [spy] } as BindingOpts) as OngoingHandle;
    handle.onMove!({ ...base, world: { x: 5, y: 0 }, drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 0 }, delta: { x: 5, y: 0 } } } as unknown as InvocationCtx);
    expect(seen).toBe(kitSettings);
  });

  it('is asked for by every action that builds a gesture context', () => {
    for (const action of [moveAction, resizeAction, rotateAction, insertAction, cloneAction]) {
      expect(action.requires, action.id).toContain('kitSettings');
    }
  });
});
