/**
 * Every path that names a node before it exists takes the id from the scene,
 * so a scene given `generateId` holds one id scheme.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import { sceneToAdapter } from '../../canvas/sceneAdapter';
import { copySelection } from './defaults/copySubtree';
import { groupAction } from './defaults/group';

interface Pose { x: number; y: number; width: number; height: number }

function numbered() {
  let n = 0;
  const scene = createScene<{ label: string }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    generateId: () => asNodeId(`srv-${n++}`),
  });
  const leaf = (x: number) =>
    scene.add({ kind: 'mark', layer: 'main', pose: { x, y: 0, width: 10, height: 10 }, data: { label: 'n' } });
  return { scene, a: leaf(0), b: leaf(20) };
}

const SERVER_ID = /^srv-\d+$/;
const anyScene = (scene: unknown) => scene as Scene<unknown, string, unknown>;

describe('scene.mintId', () => {
  it('draws from generateId, in the same sequence scene.add does', () => {
    const { scene, a, b } = numbered();
    expect([a, b]).toEqual(['srv-0', 'srv-1']);
    expect(scene.mintId()).toBe('srv-2');
    expect(scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' } })).toBe('srv-3');
  });

  it('gives distinct ids by default', () => {
    const scene = createScene<{ label: string }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
    expect(scene.mintId()).not.toBe(scene.mintId());
  });

  it('names a pasted node', () => {
    const { scene, a, b } = numbered();
    const adapter = sceneToAdapter(scene);
    const created = adapter.commitPaste!(adapter.snapshotSelection!([a, b]), { dx: 5, dy: 5 }) as unknown as Array<{ id: string }>;
    expect(created).toHaveLength(2);
    for (const node of created) expect(node.id).toMatch(SERVER_ID);
  });

  it('names a node whose insert factory gave no id', () => {
    const { scene } = numbered();
    const adapter = sceneToAdapter(scene, { commitInsert: () => ({ data: { label: 'new' } }) as never });
    const node = adapter.commitInsert!({ x: 0, y: 0, width: 4, height: 4 }) as { id: string } | null;
    expect(node?.id).toMatch(SERVER_ID);
  });

  it('names a copied node', () => {
    const { scene, a } = numbered();
    const { copies } = copySelection(anyScene(scene), [a], (_id, node) => node.pose, 'Duplicate');
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatch(SERVER_ID);
  });

  it('names the container Group makes', () => {
    const { scene, a, b } = numbered();
    const set = vi.fn<(ids: NodeId[]) => void>();
    (groupAction.invoker as ImmediateInvoker).run({
      selection: { get: () => [a, b], set },
      scene: anyScene(scene),
    } as never);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0][0]).toMatch(SERVER_ID);
  });
});
