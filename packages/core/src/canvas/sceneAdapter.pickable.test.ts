import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

interface Pose { x: number; y: number; width: number; height: number; }

function setup() {
  const scene = createScene<{ label: string }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({
    kind: 'mark', layer: 'main', data: { label: 'caption' },
    pose: { x: 0, y: 0, width: 10, height: 10 }, pickable: false,
  });
  return { scene, id, adapter: sceneToAdapter(scene) };
}

describe('sceneToAdapter keeps a click-through node click-through', () => {
  it('when a removed node is inserted again', () => {
    const { scene, id, adapter } = setup();
    const node = scene.get(id)!;
    adapter.removeNode!(id);
    adapter.insertNode!(node);
    expect(scene.get(id)!.pickable).toBe(false);
  });

  it('through copy and paste', () => {
    const { scene, id, adapter } = setup();
    const pasted = adapter.commitPaste!(adapter.snapshotSelection!([id]), { dx: 12, dy: 12 });
    expect(pasted).toHaveLength(1);
    adapter.insertNode!(pasted[0]);
    expect(scene.get(pasted[0].id)!.pickable).toBe(false);
  });
});
