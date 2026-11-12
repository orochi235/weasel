import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { legalSelection, settleSelection } from './legalSelection';
import { useSelection } from './useSelection';

const ids = (list: string[]) => list.map(asNodeId);
const none = { shift: false, meta: false, ctrl: false };
const POSE = { x: 0, y: 0, width: 1, height: 1 };

function makeScene() {
  const scene = createScene<Record<string, never>, 'main'>({ systemLayers: [{ id: 'main' }] });
  const add = (id: string, parent?: string, kind: 'mark' | 'group' = 'mark') => scene.add({
    id: asNodeId(id), kind, layer: 'main', data: {}, pose: { ...POSE },
    ...(parent ? { parent: asNodeId(parent) } : {}),
  } as never);
  add('g', undefined, 'group'); add('a', 'g'); add('c'); add('d');
  return scene;
}

describe('legalSelection', () => {
  function mount() {
    const scene = makeScene();
    const { result } = renderHook(() => useSelection({ mode: 'multi' }));
    return { scene, api: result.current, view: legalSelection(result.current, scene.selectable) };
  }

  it('keeps only outermost ids on every write path', () => {
    const { api, view } = mount();
    view.set(ids(['a', 'g']));
    expect(api.get()).toEqual(ids(['g']));
    view.toggle(asNodeId('a'));
    expect(api.get()).toEqual(ids(['g']));
    view.adapterMethods.setSelection(ids(['g', 'a', 'c']));
    expect(api.get()).toEqual(ids(['g', 'c']));
  });

  it('keeps no locked, hidden or missing node, as the scene keeps none', () => {
    const { scene, api, view } = mount();
    scene.setLocked(asNodeId('c'), true);
    scene.setHidden(asNodeId('d'), true);
    view.set(ids(['g', 'c', 'd', 'gone']));
    expect(api.get()).toEqual(ids(['g']));
  });

  it('absorbs a selected child when its ancestor is clicked in', () => {
    const { api, view } = mount();
    api.set(ids(['a']));
    view.applyClick(asNodeId('g'), { ...none, shift: true });
    expect(api.get()).toEqual(ids(['g']));
  });

  it('is one view per api and scene', () => {
    const { scene, api, view } = mount();
    expect(legalSelection(api, scene.selectable)).toBe(view);
  });
});

describe('settleSelection', () => {
  it('drops what an edit put out of reach, and leaves a legal selection alone', () => {
    const scene = makeScene();
    const { result } = renderHook(() => useSelection({ mode: 'multi' }));
    const api = result.current;
    act(() => api.set(ids(['c', 'd'])));
    const before = api.get();
    settleSelection(api, scene.selectable);
    expect(api.get()).toBe(before);
    scene.setHidden(asNodeId('c'), true);
    scene.remove(asNodeId('d'));
    act(() => settleSelection(api, scene.selectable));
    expect(api.get()).toEqual([] as NodeId[]);
  });
});
