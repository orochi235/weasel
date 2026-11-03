import { act, renderHook } from '@testing-library/react';
import { createScene, isPaged, pagesOf, type NodeId, type RectPose, type View } from '@weasel-js/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePages } from './usePages';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };
const continuous = () => createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });

afterEach(() => { vi.useRealTimers(); });

describe('usePages', () => {
  it('adds the first page to a Continuous scene, making it paged', () => {
    const scene = continuous();
    const { result } = renderHook(() => usePages(scene, VIEW, DIMS, () => {}));
    expect(result.current.placed).toEqual([]);
    act(() => result.current.add());
    expect(isPaged(scene)).toBe(true);
    expect(pagesOf(scene)!.pages).toEqual([{ id: 'page-1', width: 816, height: 1056 }]);
  });

  it('keeps its page list while an edit leaves the pages alone', () => {
    const scene = continuous();
    const { result, rerender } = renderHook(() => usePages(scene, VIEW, DIMS, () => {}));
    act(() => result.current.add());
    rerender();
    const placed = result.current.placed;
    expect(placed).toHaveLength(1);
    scene.add({ kind: 'mark', layer: 'main', parent: placed[0]!.id as NodeId, pose: { x: 1, y: 1, width: 2, height: 2 }, data: {} });
    rerender();
    expect(result.current.placed).toBe(placed);
  });

  it('settles the view onto a page with single paging', () => {
    vi.useFakeTimers();
    const scene = continuous();
    const setView = vi.fn();
    const { result } = renderHook(() => usePages(scene, VIEW, DIMS, setView, 24, { paging: 'single' }));
    act(() => result.current.add());
    setView.mockClear();
    act(() => { vi.advanceTimersByTime(150); });
    expect(setView).toHaveBeenCalledTimes(1);
  });
});
