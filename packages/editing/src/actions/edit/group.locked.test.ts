import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core/engine';
import { asNodeId, type RectPose, type Scene } from '@weasel-js/core';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { stubDepsForTests as stubDeps } from '@weasel-js/core/test-seams';
import { groupAction } from './group';
import { makeSelection } from './paintActionTestUtils';

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 20 } });
  scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 20, height: 20 } });
  scene.setLocked(asNodeId('b'), true);
  return scene as unknown as Scene<unknown, string, unknown>;
}

describe('group over a locked member', () => {
  it('is disabled as locked, and its run changes nothing', () => {
    const scene = makeScene();
    const deps = stubDeps({ scene, operands: makeSelection(['a', 'b']) });
    expect(groupAction.enabled!(deps, undefined, undefined, undefined)).toBe(ActionDisabledReason.Locked);
    const size = scene.nodes.size;
    (groupAction.invoker as ImmediateInvoker).run(deps, {});
    expect(scene.nodes.size).toBe(size);
  });
});
