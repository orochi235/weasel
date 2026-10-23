import { asNodeId, createScene, type NodeId, type RectPose, type SelectionApi, sceneToAdapter } from '@weasel-js/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LayerListItem } from './LayerList';
import { ANNOTATION_LAYER_ROW, useSceneLayerList, type SceneLayerListAnnotations } from './useSceneLayerList';

const box: RectPose = { x: 0, y: 0, width: 10, height: 10 };

/** Roots `a`, `g`, `b` back to front; `g` holds `g1`, `g2`. */
function setup() {
  const scene = createScene<{ name: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (name: string, parent?: NodeId, kind: 'mark' | 'group' = 'mark') =>
    scene.add({ id: asNodeId(name), kind, layer: 'main', pose: box, data: { name }, ...(parent ? { parent } : {}) });
  add('a');
  const g = add('g', undefined, 'group');
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

  it('reorders through the scene when no adapter is passed, as one undo step', () => {
    const { scene, selection } = setup();
    const hook = renderHook(() => useSceneLayerList({ scene, selection, itemFor: (n) => ({ label: n.data.name }) }));
    hook.result.current.onReorder({ ids: ['a'], parentId: null, index: 0 });
    expect(scene.roots).toEqual(['g', 'b', 'a']);
    scene.undo();
    expect(scene.roots).toEqual(['a', 'g', 'b']);
  });

  it('moves a child within its container', () => {
    const { hook, scene } = setup();
    hook.result.current.onReorder({ ids: ['g1'], parentId: 'g', index: 0 });
    expect(scene.childrenOf(asNodeId('g'))).toEqual(['g2', 'g1']);
  });
});

describe('useSceneLayerList — hide, lock, rename', () => {
  it('hides and locks any node from its row, each one undo step', () => {
    const { hook, scene } = setup();
    hook.result.current.onVisibilityChange!('a', false);
    hook.result.current.onLockChange!('g', true);
    hook.rerender();
    const items = hook.result.current.items;
    expect(items.find((it) => it.id === 'a')).toMatchObject({ visible: false });
    expect(items.find((it) => it.id === 'g')).toMatchObject({ locked: true });
    expect(scene.isHidden(asNodeId('a'))).toBe(true);
    expect(scene.isLocked(asNodeId('g1'))).toBe(true);
    scene.undo();
    expect(scene.isLocked(asNodeId('g1'))).toBe(false);
    scene.undo();
    expect(scene.isHidden(asNodeId('a'))).toBe(false);
  });

  it('renames a row through `rename`, as one undoable data write, and offers none without it', () => {
    const { hook, scene } = setup();
    expect(hook.result.current.onRename).toBeUndefined();
    const selection = { current: [], set: vi.fn() } as unknown as SelectionApi;
    const named = renderHook(() => useSceneLayerList({
      scene, selection, itemFor: (n) => ({ label: n.data.name }), rename: (n, label) => ({ ...n.data, name: label }),
    }));
    named.result.current.onRename!('a', 'Apple');
    expect(scene.get(asNodeId('a'))!.data).toEqual({ name: 'Apple' });
    scene.undo();
    expect(scene.get(asNodeId('a'))!.data).toEqual({ name: 'a' });
  });
});

/** A content box and two notes on an annotation layer. */
function annotated(annotations?: SceneLayerListAnnotations) {
  const scene = createScene<{ name: string }, 'main' | 'notes', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
  });
  scene.add({ id: asNodeId('box'), kind: 'mark', layer: 'main', pose: box, data: { name: 'box' } });
  scene.add({ id: asNodeId('n1'), kind: 'mark', layer: 'notes', pose: box, data: { name: 'n1' } });
  scene.add({ id: asNodeId('n2'), kind: 'mark', layer: 'notes', pose: box, data: { name: 'n2' } });
  const selection = { current: [asNodeId('box')], set: vi.fn() } as unknown as SelectionApi;
  const hook = renderHook(() =>
    useSceneLayerList({ scene, selection, itemFor: (n) => ({ label: n.data.name }), ...(annotations ? { annotations } : {}) }),
  );
  return { scene, selection, hook };
}

describe('useSceneLayerList — annotation layers', () => {
  const row = `${ANNOTATION_LAYER_ROW}notes`;

  it('leaves annotations out of the list by default', () => {
    const { hook } = annotated();
    expect(ids(hook.result.current.items)).toEqual(['box']);
    expect(hook.result.current.onRemove).toBeUndefined();
  });

  it('shows each annotation layer as a row holding its nodes, marked not printed', () => {
    const { hook } = annotated({ picked: null, pick: vi.fn(), labelOf: () => 'Measurements' });
    const items = hook.result.current.items;
    expect(ids(items)).toEqual([[row, ['n2', 'n1']], 'box']);
    expect(items[0]).toMatchObject({ label: 'Measurements', nonPrinting: true, removable: false });
    expect(items[0]!.children![0]).toMatchObject({ nonPrinting: true });
    expect(items[0]).toMatchObject({ renamable: false });
    expect(items[1]).toMatchObject({ removable: false });
  });

  it('picks an annotation row without touching the content selection', () => {
    const pick = vi.fn();
    const { hook, selection } = annotated({ picked: 'n1', pick });
    expect(hook.result.current.selectedIds).toEqual(['box', 'n1']);
    hook.result.current.onSelect(['n2']);
    expect(pick).toHaveBeenCalledWith('n2');
    expect(selection.set).not.toHaveBeenCalled();
  });

  it('locks the annotation layer from its row, and hides one note from its own', () => {
    const { hook, scene } = annotated({ picked: null, pick: vi.fn() });
    hook.result.current.onLockChange!(row, true);
    expect(scene.layers.find((l) => l.id === 'notes')?.locked).toBe(true);
    hook.rerender();
    expect(hook.result.current.items[0]).toMatchObject({ locked: true });
    hook.result.current.onVisibilityChange!('n1', false);
    expect(scene.get(asNodeId('n1'))!.hidden).toBe(true);
    expect(scene.layers.find((l) => l.id === 'notes')?.visible).toBe(true);
  });

  it('hides the annotation layer from its row, and removes a node from its row', () => {
    const pick = vi.fn();
    const { hook, scene } = annotated({ picked: 'n1', pick });
    hook.result.current.onVisibilityChange!(row, false);
    expect(scene.layers.find((l) => l.id === 'notes')?.visible).toBe(false);
    hook.result.current.onRemove!('n1');
    expect(scene.get(asNodeId('n1'))).toBeUndefined();
    expect(pick).toHaveBeenCalledWith(null);
    hook.result.current.onRemove!('box');
    expect(scene.get(asNodeId('box'))).toBeDefined();
  });
});
