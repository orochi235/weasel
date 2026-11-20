import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePageFit } from './usePageFit';

describe('usePageFit', () => {
  it('fits a page to the workspace once it is measured', () => {
    const setView = vi.fn();
    renderHook(() => usePageFit({ width: 200, height: 200 }, 'doc', { x: 0, y: 0, width: 100, height: 100 }, setView, { padding: 0 }));
    expect(setView).toHaveBeenCalledWith({ x: 0, y: 0, scale: { x: 2, y: 2 } });
  });

  it('goes to the world origin at scale 1 in a document without pages', () => {
    const setView = vi.fn();
    renderHook(() => usePageFit({ width: 200, height: 200 }, 'doc', null, setView));
    expect(setView).toHaveBeenCalledWith({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  });

  it('keeps one refit across a padding change, and the refit fits with the latest padding', () => {
    const setView = vi.fn();
    const page = { x: 0, y: 0, width: 100, height: 100 };
    const { result, rerender } = renderHook(
      ({ padding }) => usePageFit({ width: 200, height: 200 }, 'doc', page, setView, { padding }),
      { initialProps: { padding: 0 } },
    );
    const first = result.current;
    rerender({ padding: 50 });
    expect(result.current).toBe(first);
    first();
    expect(setView).toHaveBeenLastCalledWith({ x: -50, y: -50, scale: { x: 1, y: 1 } });
  });
});
