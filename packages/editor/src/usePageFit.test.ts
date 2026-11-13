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
});
