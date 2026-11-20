/** A move of a node on a layer whose plane map is the identity, or collapses an axis. */
import { describe, expect, it } from 'vitest';
import { moveAction } from './action';
import type { InvocationCtx, OngoingHandle, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { RectPose } from '@weasel-js/core';

type S = ReturnType<typeof createScene<object, 'main', RectPose>>;

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });
const DRAG = { start: { x: 5, y: 5 }, current: { x: 35, y: 25 }, delta: { x: 30, y: 20 } };

function drag(plane: { scale: { x: number; y: number }; offset: { x: number; y: number } }): RectPose {
  const scene: S = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const view = { get: () => null, planeOf: (layer: string) => (layer === 'main' ? plane : null) };
  const ctx = (d?: typeof DRAG) => ({
    world: d ? d.current : { x: 5, y: 5 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { operands: { get: () => [id] } as unknown as SelectionApi, scene, view },
    drag: d,
  }) as unknown as InvocationCtx;
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(), {}) as OngoingHandle;
  handle.onMove!(ctx(DRAG));
  handle.onEnd!(ctx(DRAG), 'commit');
  return scene.get(id)!.pose;
}

describe('moveAction on a layer with an edge-case plane', () => {
  it('moves by the drag under an identity plane map', () => {
    expect(drag({ scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } })).toEqual(box(30, 20));
  });

  it('leaves a node on a plane that collapses an axis where it is', () => {
    expect(drag({ scale: { x: 0, y: 1 }, offset: { x: 0, y: 0 } })).toEqual(box(0, 0));
  });
});
