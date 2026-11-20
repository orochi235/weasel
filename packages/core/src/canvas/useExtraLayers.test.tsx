import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RenderLayer } from 'core/layers/render';
import { useExtraLayers } from './useExtraLayers';

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, space: 'screen', draw: () => [], hitTest: () => ({}) });

function mount() {
  return renderHook(() => useExtraLayers({ current: {} }, { current: [] })).result;
}

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
});
