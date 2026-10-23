/**
 * The three scene-backed adapters apply the same ops the same way: the canvas
 * adapter, the default actions' commit adapter, and the move gesture adapter.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { createDeleteOp } from 'core/ops/delete';
import { createSetLayerOp } from 'core/ops/setLayer';
import { createSetLayoutOp } from 'core/ops/setLayout';
import type { Scene } from 'core/scene/types';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { moveGestureAdapter } from 'interactions/actions/move/gestureAdapter';
import type { LayoutStrategy } from '../layout/types';
import { sceneToAdapter } from './sceneAdapter';

interface Pose { x: number; y: number; width: number; height: number }
type S = Scene<object, 'bg' | 'fg', Pose>;

const POSE: Pose = { x: 0, y: 0, width: 1, height: 1 };

const ADAPTERS: [string, (scene: S) => unknown][] = [
  ['sceneToAdapter', (scene) => sceneToAdapter(scene)],
  ['defaultCommitAdapter', (scene) => defaultCommitAdapter(scene as never)],
  ['moveGestureAdapter', (scene) => moveGestureAdapter(scene as never)],
];

function fixture() {
  const scene: S = createScene<object, 'bg' | 'fg', Pose>({ systemLayers: [{ id: 'bg' }, { id: 'fg' }] });
  const leaf = () => scene.add({ kind: 'mark', layer: 'bg', data: {}, pose: POSE });
  return { scene, ids: [leaf(), leaf(), leaf()] };
}

describe.each(ADAPTERS)('scene-backed ops through %s', (_name, make) => {
  it('applies and undoes a layer change', () => {
    const { scene, ids } = fixture();
    scene.applyBatch([createSetLayerOp({ id: ids[0], from: 'bg', to: 'fg' })], 'Layer', make(scene));
    expect(scene.get(ids[0])!.layer).toBe('fg');
    scene.undo();
    expect(scene.get(ids[0])!.layer).toBe('bg');
  });

  it('applies and undoes a layout change', () => {
    const { scene } = fixture();
    const box = scene.add({ kind: 'group', layer: 'bg', data: {}, pose: POSE });
    const layout = { childPoses: () => new Map() } as unknown as LayoutStrategy<Pose>;
    scene.applyBatch([createSetLayoutOp({ id: box, from: null, to: layout })], 'Layout', make(scene));
    expect(scene.layoutOf(box)).toBe(layout);
    scene.undo();
    expect(scene.layoutOf(box)).toBe(null);
  });

  it('records a bare sibling reorder as one undo step', () => {
    const { scene, ids } = fixture();
    const adapter = make(scene) as { setChildOrder(parent: string | null, ids: string[]): void };
    adapter.setChildOrder(null, [ids[2], ids[1], ids[0]]);
    expect(scene.roots).toEqual([ids[2], ids[1], ids[0]]);
    scene.undo();
    expect(scene.roots).toEqual(ids);
  });

  it('folds a sibling reorder into the batch it is called inside', () => {
    const { scene, ids } = fixture();
    const adapter = make(scene) as { setChildOrder(parent: string | null, ids: string[]): void };
    scene.batch('Outer', () => {
      adapter.setChildOrder(null, [ids[2], ids[1], ids[0]]);
      scene.setPose(ids[0], { ...POSE, x: 9 });
    });
    scene.undo();
    expect(scene.roots).toEqual(ids);
    expect(scene.get(ids[0])!.pose).toEqual(POSE);
  });

  it('brings a deleted node\'s dependents back on undo', () => {
    const { scene, ids } = fixture();
    const edge = scene.add({ kind: 'mark', layer: 'bg', data: {}, pose: POSE, dependsOn: [ids[0]] });
    scene.applyBatch([createDeleteOp({ node: scene.get(ids[0])! })], 'Delete', make(scene));
    expect(scene.get(edge)).toBeUndefined();
    scene.undo();
    expect(scene.get(ids[0])).toBeDefined();
    expect(scene.get(edge)).toBeDefined();
  });
});
