import { asNodeId, createScene, type NodeId, type RectPose, type SelectionApi, sceneToAdapter } from '@weasel-js/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LayerListItem } from './LayerList';
import { useSceneLayerList } from './useSceneLayerList';

const box: RectPose = { x: 0, y: 0, width: 10, height: 10 };

/** Roots `a`, `g`, `b` back to front; `g` holds `g1`, `g2`. */
function setup() {
  const scene = createScene<{ name: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (name: string, parent?: NodeId, kind: 'leaf' | 'container' = 'leaf') =>
    scene.add({ id: asNodeId(name), kind, layer: 'main', pose: box, data: { name }, ...(parent ? { parent } : {}) });
  add('a');
  const g = add('g', undefined, 'container');
  add('g1', g);
  add('g2', g);
  add('b');
  const selection = { current: [asNodeId('b')], set: vi.fn() } as unknown as SelectionApi;
  const adapter = sceneToAdapter(scene, {});
  const hook = renderHook(() =>
    useSceneLayerList({ scene, selection, adapter, itemFor: (n) => ({ label: n.data.name }) }),
  );
  return { scene, selection, hook };
}

const ids = (items: LayerListItem[]): unknown[] =>
  items.map((it) => (it.children ? [it.id, ids(it.children)] : it.id));

describe('useSceneLayerList', () => {
  it('lists the scene front to back, with a container holding its children', () => {
    const { hook } = setup();
    expect(ids(hook.result.current.items)).toEqual(['b', ['g', ['g2', 'g1']], 'a']);
  });

  it('reads and writes the selection', () => {
    const { hook, selection } = setup();
    expect(hook.result.current.selectedIds).toEqual(['b']);
    hook.result.current.onSelect(['a']);
    expect(selection.set).toHaveBeenCalledWith(['a']);
  });

  it('moves a root to the front', () => {
    const { hook, scene } = setup();
    hook.result.current.onReorder({ ids: ['a'], parentId: null, index: 0 });
    expect(scene.roots).toEqual(['g', 'b', 'a']);
  });

  it('moves a root to the back', () => {
    const { hook, scene } = setup();
    hook.result.current.onReorder({ ids: ['b'], parentId: null, index: 2 });
    expect(scene.roots).toEqual(['b', 'a', 'g']);
  });

  it('moves a child within its container', () => {
    const { hook, scene } = setup();
    hook.result.current.onReorder({ ids: ['g1'], parentId: 'g', index: 0 });
    expect(scene.childrenOf(asNodeId('g'))).toEqual(['g2', 'g1']);
  });
});
