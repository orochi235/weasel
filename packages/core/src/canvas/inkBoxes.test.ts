import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose, Scene } from 'core/scene/types';
import { inkBoxes } from './inkBoxes';

describe('inkBoxes', () => {
  it('boxes a group around where the document holds its members, not where an override shows them', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
    const m = scene.add({ kind: 'mark', layer: 'main', parent: g, data: { shape: 'rect' }, pose: { x: 10, y: 20, width: 30, height: 40 } });
    const groupBox = () => inkBoxes({ scene: scene as unknown as Scene<unknown, string, unknown> } as Parameters<typeof inkBoxes>[0])
      .aabb(g, scene.get(g)!.pose);
    const held = groupBox();
    scene.overrides.set(m, { pose: { x: 500, y: 500, width: 30, height: 40 } });
    expect(groupBox()).toEqual(held);
  });
});
