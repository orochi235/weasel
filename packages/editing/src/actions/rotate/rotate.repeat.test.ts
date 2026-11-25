/** What a rotate leaves for Transform Again to repeat. */
import { describe, it, expect } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import { asNodeId, lastTransform, recordTransform, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import * as ops from '@weasel-js/core/ops';
import { rotateAction } from './action';

const ID = asNodeId('n');
const POSE: RectPose = { x: 0, y: 0, width: 100, height: 60 };
const CENTER = { x: 50, y: 30 };

function rotate(behaviors: unknown[]): Scene<object, 'main', RectPose> {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', layer: 'main', data: {}, pose: POSE });
  recordTransform(scene, { kind: 'translate', dx: 5, dy: 0 }, [ID]);
  const ctxAt = (angle: number) => ({
    world: { x: CENTER.x + 100 * Math.cos(angle), y: CENTER.y + 100 * Math.sin(angle) },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { operands: { get: () => [ID] as NodeId[] }, scene: scene as unknown as Scene<unknown, string, unknown> },
  }) as unknown as InvocationCtx;
  const invoker = rotateAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctxAt(0), { behaviors });
  handle.onMove!(ctxAt(0.5));
  handle.onEnd!(ctxAt(0.5), 'commit');
  return scene;
}

describe('rotate and Transform Again', () => {
  it('records its own turn', () => {
    expect(lastTransform(rotate([]))).toMatchObject({ kind: 'rotate', pivot: 'union' });
  });

  it("forgets the last transform when a behavior's ops were the commit", () => {
    const moved: RectPose = { ...POSE, x: 40 };
    const scene = rotate([{ onEnd: () => [ops.setPose<unknown>({ id: ID, from: POSE, to: moved })] }]);
    expect(scene.get(ID)!.pose).toEqual(moved);
    expect(lastTransform(scene)).toBeUndefined();
  });
});
