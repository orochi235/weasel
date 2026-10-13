/**
 * A flat list of items is a scene like any other: `useScene({ items })` puts
 * them under the root in list order, on one layer, and `sceneToAdapter` reads
 * and writes that tree. Nothing about the adapter is particular to a list.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createDeleteOp } from 'core/ops/delete';
import { useScene } from 'core/scene/useScene';
import { buildSceneLayers } from './buildSceneLayer';
import { sceneToAdapter } from './sceneAdapter';

interface Rect { id: string; x: number; y: number; width: number; height: number }

const ITEMS: Rect[] = [
  { id: 'a', x: 0, y: 0, width: 10, height: 10 },
  { id: 'b', x: 20, y: 0, width: 10, height: 10 },
  { id: 'c', x: 40, y: 0, width: 10, height: 10 },
];

function flatList() {
  const { result } = renderHook(() => useScene({ items: ITEMS }));
  const scene = result.current;
  const adapter = sceneToAdapter(scene);
  return { scene, adapter, order: () => adapter.getChildren(null) };
}

describe('a flat item list through sceneToAdapter', () => {
  it('is the root\'s children, in list order, bottom first', () => {
    const { adapter, order } = flatList();
    expect(order()).toEqual(['a', 'b', 'c']);
    expect(adapter.getNodes().map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(adapter.getParent('b')).toBeNull();
  });

  it('reads each item as its own pose', () => {
    const { adapter } = flatList();
    expect(adapter.getPose('b')).toMatchObject({ x: 20, y: 0, width: 10, height: 10 });
  });

  it('paints as one scene layer', () => {
    const { adapter } = flatList();
    const layers = buildSceneLayers({ drawOne: () => [] }, adapter, undefined, () => null);
    expect(layers.map((l) => l.key)).toEqual(['scene:default']);
  });

  it('puts a deleted item back where it was on undo', () => {
    const { scene, adapter, order } = flatList();
    act(() => { adapter.applyOps([createDeleteOp({ node: scene.get('b' as never)! })], 'Delete'); });
    expect(order()).toEqual(['a', 'c']);
    act(() => { scene.undo(); });
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('puts several deleted items back in their places, not reversed', () => {
    const { scene, adapter, order } = flatList();
    act(() => {
      adapter.applyOps([
        createDeleteOp({ node: scene.get('c' as never)! }),
        createDeleteOp({ node: scene.get('a' as never)! }),
      ], 'Delete');
    });
    expect(order()).toEqual(['b']);
    act(() => { scene.undo(); });
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('reorders the list through setChildOrder on the root', () => {
    const { scene, adapter, order } = flatList();
    act(() => { adapter.setChildOrder(null, ['c', 'a', 'b']); });
    expect(order()).toEqual(['c', 'a', 'b']);
    act(() => { scene.undo(); });
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('marquee and lasso take items by where they are', () => {
    const { adapter } = flatList();
    expect(adapter.hitTestArea!({ x: 15, y: -5, width: 20, height: 20 })).toEqual(['b']);
    expect(adapter.hitTestLasso!(
      [{ x: -5, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: -5, y: 15 }],
      'enclosed',
    )).toEqual(['a', 'b']);
  });
});
