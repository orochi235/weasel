import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RenderLayer } from 'core/layers/render';
import { useExtraLayers, type LayerGate } from './useExtraLayers';

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, space: 'screen', draw: () => [], hitTest: () => ({}) });

function mount(gate: LayerGate = {}, slots: RenderLayer<unknown>[] = []) {
  return renderHook(() => useExtraLayers({ current: gate }, { current: slots })).result;
}

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 1, height: 1 };

describe('registerLayer', () => {
  it('keeps a layer two owners registered until both release it', () => {
    const result = mount();
    const shared = layer('shared');
    let first!: () => void;
    let second!: () => void;
    act(() => { first = result.current.registerLayer(shared); });
    act(() => { second = result.current.registerLayer(shared); });
    act(() => { first(); });
    expect([...result.current.extrasRef.current]).toEqual([shared]);
    act(() => { first(); });
    expect([...result.current.extrasRef.current]).toEqual([shared]);
    act(() => { second(); });
    expect([...result.current.extrasRef.current]).toEqual([]);
  });

  it('moves a layer registered again to the top of hit order', () => {
    const result = mount();
    const a = layer('a');
    const b = layer('b');
    act(() => { result.current.registerLayer(a); result.current.registerLayer(b); result.current.registerLayer(a); });
    expect([...result.current.extrasRef.current]).toEqual([b, a]);
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(result.current.hitTestExtrasIn(0, 0, view, { width: 1, height: 1 }, null)?.layerId).toBe('a');
  });

  it('puts a layer back in its place when the owner that moved it to the top releases it', () => {
    const result = mount();
    const a = layer('a');
    const b = layer('b');
    let again!: () => void;
    act(() => { result.current.registerLayer(a); result.current.registerLayer(b); });
    act(() => { again = result.current.registerLayer(a); });
    expect([...result.current.extrasRef.current]).toEqual([b, a]);
    act(() => { again(); });
    expect([...result.current.extrasRef.current]).toEqual([a, b]);
  });
});

describe('hitTestExtrasIn', () => {
  it('asks the topmost layer first in the order layerOrder paints them', () => {
    const a = layer('a');
    const b = layer('b');
    const result = mount({ layerOrder: ['b', 'a'] });
    act(() => { result.current.registerLayer(a); result.current.registerLayer(b); });
    expect(result.current.hitTestExtrasIn(0, 0, VIEW, DIMS, null)?.layerId).toBe('a');
  });

  it("gates a view's layers by the view's stack, not the surface's layerVisibility", () => {
    const slot = layer('slot');
    const result = mount({ layerVisibility: { slot: false } }, [slot]);
    expect(result.current.hitTestExtrasIn(0, 0, VIEW, DIMS, null)).toBeNull();
    expect(result.current.hitTestExtrasIn(0, 0, VIEW, DIMS, null, [slot])?.layerId).toBe('slot');
  });

  it("passes the asker's chrome predicate to hitTest, not the surface's", () => {
    const chrome: RenderLayer<unknown> = {
      ...layer('chrome'), hitTest: (_x, _y, _d, _v, _dims, isVisible) => (isVisible?.('handles') ? {} : null),
    };
    const result = mount({ getIsVisible: () => () => false }, [chrome]);
    expect(result.current.hitTestExtrasIn(0, 0, VIEW, DIMS, null)).toBeNull();
    const viewHelpers = { getIsVisible: () => () => true };
    expect(result.current.hitTestExtrasIn(0, 0, VIEW, DIMS, viewHelpers, [chrome])?.layerId).toBe('chrome');
  });
});
