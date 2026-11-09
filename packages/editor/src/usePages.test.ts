import { act, renderHook } from '@testing-library/react';
import { addPage, createScene, isPaged, pageInView, pagesOf, placedPagesOf, type NodeId, type RectPose, type View } from '@weasel-js/core';
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

  it('adds after the page last shown while the view sits off every page', () => {
    const scene = continuous();
    let view = VIEW;
    const setView = (v: View) => { view = v; };
    const { result, rerender } = renderHook(() => usePages(scene, view, DIMS, setView));
    for (let i = 0; i < 3; i++) { act(() => result.current.add()); rerender(); }
    act(() => result.current.goTo('page-1'));
    rerender();
    expect(result.current.current).toBe('page-1');
    view = { ...view, x: view.x + 1e6 };
    rerender();
    expect(result.current.current).toBeNull();
    expect(result.current.shown?.id).toBe('page-1');
    act(() => result.current.add());
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-1', 'page-4', 'page-2', 'page-3']);
  });

  it('steps from the page last shown while the view sits off every page', () => {
    const scene = continuous();
    let view = VIEW;
    const setView = (v: View) => { view = v; };
    const { result, rerender } = renderHook(() => usePages(scene, view, DIMS, setView));
    for (let i = 0; i < 3; i++) { act(() => result.current.add()); rerender(); }
    act(() => result.current.goTo('page-2'));
    rerender();
    expect(result.current.current).toBe('page-2');
    view = { ...view, x: view.x + 1e6 };
    rerender();
    expect(result.current.current).toBeNull();
    act(() => result.current.step(1));
    rerender();
    expect(result.current.current).toBe('page-3');
    view = { ...view, x: view.x + 1e6 };
    rerender();
    act(() => result.current.step(-1));
    rerender();
    expect(result.current.current).toBe('page-2');
  });

  it('steps to the first page, either way, from a view never yet on a page', () => {
    const scene = continuous();
    const far: View = { ...VIEW, x: VIEW.x + 1e6 };
    let view = VIEW;
    const setView = (v: View) => { view = v; };
    const { result, rerender } = renderHook(() => usePages(scene, view, DIMS, setView));
    for (let i = 0; i < 3; i++) act(() => result.current.add());
    for (const by of [1, -1] as const) {
      const seen = renderHook(() => usePages(scene, far, DIMS, setView));
      expect(seen.result.current.current).toBeNull();
      expect(seen.result.current.shown?.id).toBe('page-1');
      act(() => seen.result.current.step(by));
      seen.rerender();
      rerender();
      expect(pageInView(placedPagesOf(scene), view, DIMS)?.id, `step(${by})`).toBe('page-1');
      seen.unmount();
    }
  });

  it('adds after the last page from a view never yet on a page', () => {
    const scene = continuous();
    const { result } = renderHook(() => usePages(scene, VIEW, DIMS, () => {}));
    for (let i = 0; i < 2; i++) act(() => result.current.add());
    const far = renderHook(() => usePages(scene, { ...VIEW, x: VIEW.x + 1e6 }, DIMS, () => {}));
    act(() => far.result.current.add());
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-1', 'page-2', 'page-3']);
  });

  it('places a page another maker draws where its own would go', () => {
    const scene = continuous();
    const { result, rerender } = renderHook(() => usePages(scene, VIEW, DIMS, () => {}));
    act(() => result.current.add());
    rerender();
    const make = vi.fn((place: { index: number; size?: { width: number; height: number } }) => {
      addPage(scene, { id: 'made', width: 10, height: 20 }, { index: place.index });
      return 'made';
    });
    act(() => result.current.add({ make }));
    expect(make).toHaveBeenCalledWith({ index: 1, size: { width: 816, height: 1056 } });
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['page-1', 'made']);
  });
});
