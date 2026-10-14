import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { drawPrefs } from './prefs';
import { useSymmetry } from './useSymmetry';

const PAGE = { width: 600, height: 800 };

beforeEach(() => act(() => drawPrefs().reset()));

const storeOf = (r: { current: ReturnType<typeof useSymmetry> }) => r.current.contribution.deps!.symmetry!()!;

describe('useSymmetry', () => {
  it('starts off', () => {
    const { result } = renderHook(() => useSymmetry(PAGE));
    expect(result.current.commands.symmetryOn).toBe(false);
    expect(storeOf(result).get()).toBeNull();
  });

  it('turns on about the page center, on the axis the preference names', () => {
    act(() => drawPrefs().set('view.symmetryAxis', 'both'));
    const { result } = renderHook(() => useSymmetry(PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(drawPrefs().get('view.symmetry')).toBe(true);
    expect(result.current.commands.symmetryOn).toBe(true);
    expect(storeOf(result).get()).toEqual({ axis: 'both', center: { x: 300, y: 400 } });
  });

  it('keeps an axis that was dragged across a change of axis, and drops it with the page', () => {
    act(() => drawPrefs().set('view.symmetry', true));
    const { result, rerender } = renderHook(({ page }) => useSymmetry(page), { initialProps: { page: PAGE } });
    act(() => storeOf(result).set({ axis: 'vertical', center: { x: 120, y: 400 } }));
    act(() => drawPrefs().set('view.symmetryAxis', 'horizontal'));
    expect(storeOf(result).get()).toEqual({ axis: 'horizontal', center: { x: 120, y: 400 } });
    rerender({ page: { width: 200, height: 100 } });
    expect(storeOf(result).get()?.center).toEqual({ x: 100, y: 50 });
  });

  it('turns off again', () => {
    act(() => drawPrefs().set('view.symmetry', true));
    const { result } = renderHook(() => useSymmetry(PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(storeOf(result).get()).toBeNull();
  });
});
