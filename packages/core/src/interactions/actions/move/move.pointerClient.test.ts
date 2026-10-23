/**
 * `GestureContext.pointer.clientX` / `clientY`: the client point the
 * dispatcher handed the action, or absent when the event carried none.
 */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { MoveBehavior, PointerState } from '../../gestures/types';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  const base = { world: { x: 0, y: 0 }, modifiers: MODS, deps: { selection: { get: () => [a] as NodeId[] }, scene } };
  const seen: PointerState[] = [];
  const spy: MoveBehavior<unknown> = {
    onStart: (ctx) => { seen.push({ ...ctx.pointer }); },
    onMove: (ctx) => { seen.push({ ...ctx.pointer }); },
  };
  const opts = { behaviors: [spy] } as BindingOpts;
  const at = (x: number, screen?: { x: number; y: number }): InvocationCtx => ({
    ...base,
    world: { x, y: 0 },
    ...(screen ? { screen } : {}),
    drag: { start: { x: 0, y: 0 }, current: { x, y: 0 }, delta: { x, y: 0 } },
  }) as unknown as InvocationCtx;
  return { base, opts, at, seen };
}

describe('GestureContext.pointer client point', () => {
  it('carries the client point of the press and of each move', () => {
    const { base, opts, at, seen } = fixture();
    const press = { ...base, screen: { x: 300, y: 200 } } as unknown as InvocationCtx;
    const handle = (moveAction.invoker as OngoingInvoker).start(press, opts) as OngoingHandle;
    handle.onMove!(at(10, { x: 340, y: 205 }));
    expect(seen.map((p) => [p.clientX, p.clientY])).toEqual([[300, 200], [340, 205]]);
  });

  it('is absent, not zero, when the event carried no client point', () => {
    const { base, opts, at, seen } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(base as unknown as InvocationCtx, opts) as OngoingHandle;
    handle.onMove!(at(10));
    expect(seen.map((p) => [p.clientX, p.clientY])).toEqual([[undefined, undefined], [undefined, undefined]]);
  });
});
