import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewAnimation } from './useViewAnimation';

describe('useViewAnimation', () => {
  it('returns animateTo and cancel', () => {
    const { result } = renderHook(() => useViewAnimation(vi.fn()));
    expect(typeof result.current.animateTo).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
  });

  it('animateTo calls setView', () => {
    const setView = vi.fn();
    let fired = false;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { if (!fired) { fired = true; cb(0); } return 1; });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const { result } = renderHook(() => useViewAnimation(setView));
    result.current.animateTo({ x: 0, y: 0, scale: 1 }, { x: 10, y: 0, scale: 1 });
    expect(setView).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
