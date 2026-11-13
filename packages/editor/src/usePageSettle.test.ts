import { act, renderHook } from '@testing-library/react';
import { fitViewToPage, type PlacedPage, type View } from '@weasel-js/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageSettle } from './usePageSettle';

const A: PlacedPage = { id: 'a', width: 100, height: 100, x: 0, y: 0, index: 0 };
const B: PlacedPage = { id: 'b', width: 100, height: 100, x: 0, y: 400, index: 1 };
// A page fits at scale 3.52, so a view at scale 1 or 3.5 is zoomed out from it.
const DIMS = { width: 400, height: 400 };
// Shows world y 90–490: the bottom 10 of A, the gap, and the top 90 of B.
const BETWEEN: View = { x: 0, y: 90, scale: { x: 1, y: 1 } };
const pages = { placed: [A, B] };
const fit = (page: PlacedPage, from: View) => fitViewToPage(page, DIMS, from, { padding: 24 })!;

const pointer = (type: string, pointerId: number) => {
  act(() => { window.dispatchEvent(Object.assign(new Event(type), { pointerId })); });
};

afterEach(() => { vi.useRealTimers(); });

describe('usePageSettle', () => {
  it('with single, settles a view between two pages onto the nearer after 150 ms', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, { paging: 'single' }));
    vi.advanceTimersByTime(149);
    expect(setView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setView).toHaveBeenCalledWith(fit(B, BETWEEN));
  });

  it('settles a view showing only the gap onto the nearest page', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    // World y 110–224: 10 below A, 176 above B.
    const gap: View = { x: 0, y: 110, scale: { x: 3.5, y: 3.5 } };
    renderHook(() => usePageSettle(pages, gap, DIMS, setView, { paging: 'single' }));
    vi.advanceTimersByTime(150);
    expect(setView).toHaveBeenCalledWith(fit(A, gap));
  });

  it('animates when the view it is handed can', () => {
    vi.useFakeTimers();
    const sink = { set: vi.fn(), animate: vi.fn() };
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, sink, { paging: 'single' }));
    vi.advanceTimersByTime(150);
    expect(sink.animate).toHaveBeenCalledWith(fit(B, BETWEEN));
    expect(sink.set).not.toHaveBeenCalled();
  });

  it('restarts its wait on each view change and holds while a pointer is down', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    const { rerender } = renderHook(({ view }) => usePageSettle(pages, view, DIMS, setView, { paging: 'single' }), {
      initialProps: { view: BETWEEN },
    });
    vi.advanceTimersByTime(100);
    rerender({ view: { ...BETWEEN, y: 91 } });
    vi.advanceTimersByTime(100);
    expect(setView).not.toHaveBeenCalled();
    pointer('pointerdown', 1);
    vi.advanceTimersByTime(500);
    expect(setView).not.toHaveBeenCalled();
    pointer('pointerup', 1);
    vi.advanceTimersByTime(149);
    expect(setView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setView).toHaveBeenCalledTimes(1);
  });

  it('leaves a view already fitted to a page alone', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, fit(A, BETWEEN), DIMS, setView, { paging: 'single' }));
    vi.advanceTimersByTime(1000);
    expect(setView).not.toHaveBeenCalled();
  });

  it('with continuous, never sets the view', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, { paging: 'continuous' }));
    vi.advanceTimersByTime(1000);
    pointer('pointerup', 1);
    vi.advanceTimersByTime(1000);
    expect(setView).not.toHaveBeenCalled();
  });

  it('holds while any finger of a pinch is still down', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, { paging: 'single' }));
    pointer('pointerdown', 1);
    pointer('pointerdown', 2);
    pointer('pointerup', 1);
    vi.advanceTimersByTime(500);
    expect(setView).not.toHaveBeenCalled();
    pointer('pointerup', 2);
    vi.advanceTimersByTime(150);
    expect(setView).toHaveBeenCalledTimes(1);
  });

  it('lets go of the held pointers when the window loses focus', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, { paging: 'single' }));
    pointer('pointerdown', 1);
    act(() => { window.dispatchEvent(new Event('blur')); });
    vi.advanceTimersByTime(150);
    expect(setView).toHaveBeenCalledTimes(1);
  });

  it('leaves a view zoomed in past the page fit where it is', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    const fitted = fit(B, BETWEEN);
    const s = fitted.scale.x * 4;
    // 4x the fit, looking at B's middle.
    const zoomed: View = { x: 40, y: 440, scale: { x: s, y: s } };
    renderHook(() => usePageSettle(pages, zoomed, DIMS, setView, { paging: 'single' }));
    vi.advanceTimersByTime(150);
    vi.advanceTimersByTime(1000);
    expect(setView).not.toHaveBeenCalled();
  });

  it('refits a view fitted to its page when the host shrinks, and leaves one zoomed in alone', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    const fitted = fit(A, BETWEEN);
    const small = { width: 200, height: 200 };
    const { rerender } = renderHook(({ view, dims }) => usePageSettle(pages, view, dims, setView, { paging: 'single' }), {
      initialProps: { view: fitted, dims: DIMS },
    });
    vi.advanceTimersByTime(150);
    expect(setView).not.toHaveBeenCalled();
    rerender({ view: fitted, dims: small });
    vi.advanceTimersByTime(150);
    expect(setView).toHaveBeenCalledWith(fitViewToPage(A, small, fitted, { padding: 24 })!);

    setView.mockClear();
    const zoomed = { ...fitted, scale: { x: fitted.scale.x * 2, y: fitted.scale.y * 2 } };
    rerender({ view: zoomed, dims: DIMS });
    vi.advanceTimersByTime(150);
    rerender({ view: zoomed, dims: small });
    vi.advanceTimersByTime(150);
    expect(setView).not.toHaveBeenCalled();
  });
});
