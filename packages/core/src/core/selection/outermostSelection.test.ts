import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { asNodeId, type NodeId } from 'core/scene/types';
import { outermostSelection } from './outermostSelection';
import { useSelection } from './useSelection';

const parents: Record<string, string | null> = { g: null, a: 'g', c: null };
const parentOf = (id: NodeId) => parents[id] as NodeId | null;
const ids = (list: string[]) => list.map(asNodeId);
const none = { shift: false, meta: false, ctrl: false };

describe('outermostSelection', () => {
  function mount() {
    const { result } = renderHook(() => useSelection({ mode: 'multi' }));
    return { api: result.current, view: outermostSelection(result.current, parentOf) };
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

  it('absorbs a selected child when its ancestor is clicked in', () => {
    const { api, view } = mount();
    api.set(ids(['a']));
    view.applyClick(asNodeId('g'), { ...none, shift: true });
    expect(api.get()).toEqual(ids(['g']));
  });

  it('is one view per api and tree', () => {
    const { api, view } = mount();
    expect(outermostSelection(api, parentOf)).toBe(view);
  });
});
