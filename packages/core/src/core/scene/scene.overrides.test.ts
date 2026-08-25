import { describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import type { NodeId } from './types';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id: NodeId = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  return { scene, id };
}

describe('Scene.overrides', () => {
  it('does not bump the version or notify scene subscribers', () => {
    const { scene, id } = makeScene();
    const listener = vi.fn();
    scene.subscribe(listener);
    const version = scene.getVersion();

    scene.overrides.set(id, { pose: { x: 100, y: 100, width: 10, height: 10 } });
    scene.overrides.commit();

    expect(scene.getVersion()).toBe(version);
    expect(listener).not.toHaveBeenCalled();
  });

  it('records no history entry and leaves undo alone', () => {
    const { scene, id } = makeScene();
    const before = scene.historyEntries().length;

    for (let frame = 0; frame < 60; frame++) {
      scene.overrides.set(id, { pose: { x: frame, y: 0, width: 10, height: 10 } });
      scene.overrides.commit();
    }

    expect(scene.historyEntries()).toHaveLength(before);
    expect(scene.canUndo()).toBe(true); // the `add`, not the overrides
  });

  it('never reaches toJSON — the document pose is what serializes', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 777, y: 777, width: 10, height: 10 } });
    scene.overrides.commit();

    const json = scene.toJSON();
    expect(json.nodes[0].pose).toEqual(POSE);
    expect(JSON.stringify(json)).not.toContain('777');
  });

  it('leaves the node\'s document pose untouched', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
    expect(scene.get(id)!.pose).toEqual(POSE);
  });

  it('is not restored by loadState', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
    const snapshot = scene.toJSON();
    scene.overrides.clearAll();
    scene.loadState(snapshot);
    expect(scene.overrides.ids()).toEqual([]);
  });
});

describe('Scene.overrides — lifecycle', () => {
  it('clears the override of a removed node, and of its descendants', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const parent = scene.add({ kind: 'container', layer: 'main', pose: POSE, data: { label: 'p' } });
    const child = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'c' }, parent });

    scene.overrides.set(parent, { pose: { x: 1, y: 1, width: 10, height: 10 } });
    scene.overrides.set(child, { pose: { x: 2, y: 2, width: 10, height: 10 } });

    scene.remove(parent);

    expect(scene.overrides.ids()).toEqual([]);
  });

  it('does not resurrect the override when undo restores the node', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 9, y: 9, width: 10, height: 10 } });
    scene.remove(id);
    scene.undo();

    expect(scene.get(id)).toBeDefined();
    expect(scene.overrides.has(id)).toBe(false);
  });
});
