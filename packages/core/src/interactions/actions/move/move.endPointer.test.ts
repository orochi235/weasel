/**
 * `MoveEnd.pointer`: where the pointer was let go, as a move behavior's
 * `onEnd` is told it.
 */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { MoveBehavior, MoveEnd } from '../../gestures/types';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  const base = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: MODS, deps: { selection: { get: () => [a] as NodeId[] }, scene } };
  const seen: MoveEnd['pointer'][] = [];
  const spy: MoveBehavior<unknown> = { onEnd: (_ctx, end) => { seen.push(end.pointer); } };
  const opts = { behaviors: [spy] } as BindingOpts;
  const at = (x: number, y: number, dx: number): InvocationCtx => ({
    ...base,
    world: { x, y },
    drag: { start: { x: 0, y: 0 }, current: { x, y }, delta: { x: dx, y: 0 } },
  }) as unknown as InvocationCtx;
  const press = base as unknown as InvocationCtx;
  return { press, opts, at, seen };
}

describe('MoveEnd.pointer', () => {
  it('is the world point of the release, not of the last move', () => {
    const { press, opts, at, seen } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(press, opts) as OngoingHandle;
    handle.onMove!(at(10, 0, 10));
    handle.onEnd!(at(12, 3, 10), 'commit');
    expect(seen).toEqual([{ x: 12, y: 3 }]);
  });

  it('falls back to the last move when the end carries no drag', () => {
    const { press, opts, at, seen } = fixture();
    const handle = (moveAction.invoker as OngoingInvoker).start(press, opts) as OngoingHandle;
    handle.onMove!(at(10, 4, 10));
    handle.onEnd!(press, 'commit');
    expect(seen).toEqual([{ x: 10, y: 4 }]);
  });
});
