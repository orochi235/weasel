import { describe, expect, it } from 'vitest';
import { asNodeId, booleanGroupFields, createEnteredGroup, createScene, type RectPose } from '@weasel-js/core';
import { createEnterGroupAction } from './enterGroup';

describe('group.enter', () => {
  it('enters a boolean group on a double-click on it', () => {
    const scene = createScene<{ shape?: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const group = scene.add({ ...booleanGroupFields<RectPose>(), layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
    scene.add({ kind: 'mark', layer: 'main', parent: group, pose: { x: 0, y: 0, width: 100, height: 100 }, data: { shape: 'rect' } });
    const entered = createEnteredGroup(scene);
    const action = createEnterGroupAction({
      pickHit: () => group,
      tree: { getParent: (id) => scene.get(asNodeId(id))?.parent ?? null, getNode: (id) => scene.get(asNodeId(id)) },
    });
    const run = action.invoker as { run: (deps: unknown, params: unknown) => void };
    run.run({ enteredGroup: entered }, { world: { x: 25, y: 25 } });
    expect(entered.get()).toBe(group);
  });
});
