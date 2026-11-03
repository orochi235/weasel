import { act, renderHook } from '@testing-library/react';
import { createScene, isPaged, pagesOf, type NodeId, type RectPose, type View } from '@weasel-js/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePages } from './usePages';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };
// Zoomed out past a Letter page's fit (about 0.52), so single paging settles it.
const OUT: View = { x: 0, y: 0, scale: { x: 0.2, y: 0.2 } };
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

  it('does not re-render the host for an edit that leaves the pages alone', () => {
    const scene = continuous();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return usePages(scene, VIEW, DIMS, () => {});
    });
    act(() => result.current.add());
    const before = renders;
    act(() => {
      scene.add({ kind: 'mark', layer: 'main', parent: result.current.placed[0]!.id as NodeId, pose: { x: 1, y: 1, width: 2, height: 2 }, data: {} });
    });
    expect(renders).toBe(before);
  });

  it('animates going to a page when the view it is handed can', () => {
    const scene = continuous();
    const sink = { set: vi.fn(), animate: vi.fn() };
    const { result } = renderHook(() => usePages(scene, VIEW, DIMS, sink));
    act(() => result.current.add());
    expect(sink.animate).toHaveBeenCalledTimes(1);
    act(() => result.current.goTo('page-1'));
    expect(sink.animate).toHaveBeenCalledTimes(2);
    expect(sink.set).not.toHaveBeenCalled();
  });

  it('settles the view onto a page with single paging', () => {
    vi.useFakeTimers();
    const scene = continuous();
    const setView = vi.fn();
    const { result } = renderHook(() => usePages(scene, OUT, DIMS, setView, 24, { paging: 'single' }));
    act(() => result.current.add());
    setView.mockClear();
    act(() => { vi.advanceTimersByTime(150); });
    expect(setView).toHaveBeenCalledTimes(1);
  });
});
