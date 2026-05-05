import { describe, expect, it } from 'vitest';
import { createScene } from '../core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

interface Data { label: string; }
interface Pose { x: number; y: number; width: number; height: number; }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

describe('sceneToAdapter', () => {
  it('getObjects returns nodes in render order, hidden layers filtered', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'fg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getObjects().map((n) => n.id)).toEqual([a, b]);
    scene.setLayerVisible('bg', false);
    expect(adapter.getObjects().map((n) => n.id)).toEqual([b]);
  });

  it('getPose / setPose round-trip and record undo', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getPose(id)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    adapter.setPose(id, { x: 5, y: 5, width: 2, height: 2 });
    expect(scene.get(id)!.pose).toEqual({ x: 5, y: 5, width: 2, height: 2 });
    scene.undo();
    expect(adapter.getPose(id)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('getParent / setParent reparent through scene.move', () => {
    const scene = makeScene();
    const parent = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'p' } });
    const child = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getParent!(child)).toBeNull();
    adapter.setParent!(child, parent);
    expect(scene.get(child)!.parent).toBe(parent);
    adapter.setParent!(child, null);
    expect(scene.get(child)!.parent).toBeNull();
  });

  it('getChildren returns container children', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c2' }, parent: p });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getChildren!(p)).toEqual([c1, c2]);
    expect(adapter.getChildren!(c1)).toEqual([]);
  });

  it('applyBatch wraps ops in scene.batch (single undo entry)', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } });
    const adapter = sceneToAdapter(scene);
    const before = scene.canUndo();
    expect(before).toBe(true); // from add
    // Two-op batch via inline Op shims
    adapter.applyBatch!(
      [
        { apply: (a) => (a as typeof adapter).setPose(id, { x: 1, y: 1, width: 1, height: 1 }), invert: () => ({ apply: () => {}, invert: () => ({} as never) }) },
        { apply: (a) => (a as typeof adapter).setPose(id, { x: 2, y: 2, width: 1, height: 1 }), invert: () => ({ apply: () => {}, invert: () => ({} as never) }) },
      ],
      'drag',
    );
    expect(scene.get(id)!.pose).toEqual({ x: 2, y: 2, width: 1, height: 1 });
    // One additional undo entry (the batch), even though two setPose calls happened.
    scene.undo();
    expect(scene.get(id)!.pose).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
