import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import { sceneParentsOf } from './scenePickReads';
import type { PickCandidate } from './pickWalk';

describe('sceneParentsOf', () => {
  it('answers each container with the data the scene shows it with, as painting reads it', () => {
    const scene = createScene<{ fill?: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const group = scene.add({ kind: 'group', layer: 'main', pose: box, data: {} });
    const child = scene.add({ kind: 'mark', layer: 'main', pose: box, data: { fill: 'inherit' }, parent: group });
    const hold = scene.overrides.hold();
    hold.show(new Map([[group as NodeId, { data: () => ({ fill: 'red' }) }]]));
    const parents = sceneParentsOf(scene)(scene.get(child)! as unknown as PickCandidate<RectPose>);
    expect((parents[0] as { data?: unknown }).data).toEqual({ fill: 'red' });
    hold.drop();
  });
});
