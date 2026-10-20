import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { layoutPages } from '@weasel-js/core';
import { usePagesView } from './usePagesView';

describe('usePagesView', () => {
  it('keeps its layer and bounds across renders that pass equal pages in a new object', () => {
    const placed = layoutPages([{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }]);
    const { result, rerender } = renderHook(() => usePagesView({ placed, fill: '#fff' }));
    const first = result.current;
    rerender();
    expect(result.current.layers).toBe(first.layers);
    expect(result.current.box).toBe(first.box);
  });

  it('is empty without pages', () => {
    const { result } = renderHook(() => usePagesView(undefined));
    expect(result.current).toEqual({ layers: undefined, box: undefined });
  });
});
