/** A rotate behavior later in the chain reads the selection as turned by an earlier behavior's answer. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { RectPose, RotateBehavior } from '@weasel-js/core';
import { rotateAction } from './action';

type Pose = RectPose & { rotation?: number };

describe('a rotate behavior returning a pose', () => {
  it('leaves gctx.current at the turn it sets for the behaviors after it', () => {
    const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 20, rotation: 0 } });
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 80, y: 0, width: 20, height: 20, rotation: 0 } });
    const seen: number[] = [];
    const quarter: RotateBehavior<unknown> = { onMove: (_g, p) => ({ pose: { ...(p.pose as Pose), rotation: Math.PI / 2 } }) };
    const reader: RotateBehavior<unknown> = { onMove: (g) => { seen.push((g.current.get(b) as Pose).rotation ?? 0); } };
    const at = (x: number, y: number) => ({
      world: { x, y }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      drag: { start: { x: 150, y: 10 }, current: { x, y }, delta: { x: x - 150, y: y - 10 } },
      deps: { operands: { get: () => [a, b], set: () => {} }, scene },
    }) as unknown as InvocationCtx;
    const handle = (rotateAction.invoker as OngoingInvoker).start(at(150, 10), { behaviors: [quarter, reader] } as never);
    // A small turn of the pointer, which the first behavior answers with a quarter turn.
    handle.onMove!(at(150, 20));
    handle.onEnd!(at(150, 20), 'commit');
    expect(seen[0]).toBeCloseTo(Math.PI / 2, 9);
    expect(scene.get(b)!.pose.rotation).toBeCloseTo(Math.PI / 2, 9);
  });
});
