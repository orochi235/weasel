/**
 * Resizing a multi-selection that holds a rotated member. The handles sit on
 * the union of what is drawn, and a turned member's own axes are not the axes
 * the drag scales.
 */
import { describe, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { expectSamePose } from 'core/scene/frameFixture';
import type { InvocationCtx } from '@weasel-js/routing';
import { resizeAction } from './action';

const U = asNodeId('upright');
const T = asNodeId('turned');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: U, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } });
  // A quarter turn about (120, 50): drawn 20 wide and 40 tall, x 110 to 130.
  scene.add({ id: T, kind: 'mark', layer: 'main', data: {}, pose: { x: 100, y: 40, width: 40, height: 20, rotation: Math.PI / 2 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

// The bottom-right handle of the drawn union, (0, 0) to (130, 100).
const START = { x: 130, y: 100 };

function ctxAt(scene: Scene<unknown, string, unknown>, at: { x: number; y: number }): InvocationCtx {
  return {
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [U, T] as NodeId[] }, scene },
    drag: {
      start: START,
      current: at,
      delta: { x: at.x - START.x, y: at.y - START.y },
      affordance: { kind: 'handle:bottom-right', targetIds: [U, T], anchor: { x: 'min', y: 'min' } },
    },
  } as unknown as InvocationCtx;
}

describe('resizeAction on a multi-selection with a rotated member', () => {
  it('stretches the turned member along the axis it is drawn on, and keeps the corner under the pointer', () => {
    const scene = makeScene();
    const invoker = resizeAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(scene, START), undefined);
    // Twice as wide: the drawn union goes from 130 to 260.
    const to = { x: 260, y: 100 };
    handle.onMove!(ctxAt(scene, to));
    handle.onEnd!(ctxAt(scene, to), 'commit');

    expectSamePose(scene.get(U)!.pose as RectPose, { x: 0, y: 0, width: 200, height: 100 });
    // Drawn 40 wide now: its stored height is the horizontal extent. Its
    // right edge, 240 + 20, is where the pointer is.
    expectSamePose(scene.get(T)!.pose as RectPose, { x: 220, y: 30, width: 40, height: 40, rotation: Math.PI / 2 });
  });
});
