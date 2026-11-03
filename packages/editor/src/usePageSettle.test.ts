import { act, renderHook } from '@testing-library/react';
import { fitViewToPage, type PlacedPage, type View } from '@weasel-js/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageSettle } from './usePageSettle';

const A: PlacedPage = { id: 'a', width: 100, height: 100, x: 0, y: 0, index: 0 };
const B: PlacedPage = { id: 'b', width: 100, height: 100, x: 0, y: 140, index: 1 };
const DIMS = { width: 100, height: 100 };
// Shows world y 90–190: the bottom 10 of A, the gap, and the top 50 of B.
const BETWEEN: View = { x: 0, y: 90, scale: { x: 1, y: 1 } };
const pages = { placed: [A, B] };
const fit = (page: PlacedPage, from: View) => fitViewToPage(page, DIMS, from, { padding: 24 });

afterEach(() => { vi.useRealTimers(); });

describe('usePageSettle', () => {
  it('with single, settles a view between two pages onto the nearer after 150 ms', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, 'single'));
    vi.advanceTimersByTime(149);
    expect(setView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setView).toHaveBeenCalledWith(fit(B, BETWEEN));
  });

  it('settles a view showing only the gap onto the nearest page', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    // World y 105–115: 5 below A, 25 above B.
    const gap: View = { x: 0, y: 105, scale: { x: 10, y: 10 } };
    renderHook(() => usePageSettle(pages, gap, DIMS, setView, 'single'));
    vi.advanceTimersByTime(150);
    expect(setView).toHaveBeenCalledWith(fit(A, gap));
  });

  it('animates when the view it is handed can', () => {
    vi.useFakeTimers();
    const sink = { set: vi.fn(), animate: vi.fn() };
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, sink, 'single'));
    vi.advanceTimersByTime(150);
    expect(sink.animate).toHaveBeenCalledWith(fit(B, BETWEEN));
    expect(sink.set).not.toHaveBeenCalled();
  });

  it('restarts its wait on each view change and holds while a pointer is down', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    const { rerender } = renderHook(({ view }) => usePageSettle(pages, view, DIMS, setView, 'single'), {
      initialProps: { view: BETWEEN },
    });
    vi.advanceTimersByTime(100);
    rerender({ view: { ...BETWEEN, y: 91 } });
    vi.advanceTimersByTime(100);
    expect(setView).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    vi.advanceTimersByTime(500);
    expect(setView).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('pointerup')); });
    vi.advanceTimersByTime(149);
    expect(setView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setView).toHaveBeenCalledTimes(1);
  });

  it('leaves a view already fitted to a page alone', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, fit(A, BETWEEN), DIMS, setView, 'single'));
    vi.advanceTimersByTime(1000);
    expect(setView).not.toHaveBeenCalled();
  });

  it('with continuous, never sets the view', () => {
    vi.useFakeTimers();
    const setView = vi.fn();
    renderHook(() => usePageSettle(pages, BETWEEN, DIMS, setView, 'continuous'));
    vi.advanceTimersByTime(1000);
    act(() => { window.dispatchEvent(new Event('pointerup')); });
    vi.advanceTimersByTime(1000);
    expect(setView).not.toHaveBeenCalled();
  });
});
