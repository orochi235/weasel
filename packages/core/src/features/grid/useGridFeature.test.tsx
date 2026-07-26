/**
 * Tests for `useGridFeature` — the role-taxonomy hook (`{api, attrs, layers}`)
 * that wires grid hover + render layers. We verify:
 *   - pointer events update the live cell via screen→world projection,
 *   - onChange fires only when the cell changes (not on every move),
 *   - leave/cancel clear the cell,
 *   - layer factories return RenderLayer-shaped objects for both slots.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridFeature } from './useGridFeature';
import type { ViewTransform } from 'core/viewport/viewTransform';

const IDENTITY: ViewTransform = { panX: 0, panY: 0, zoom: { x: 1, y: 1 } };

function fakePointerEvent(clientX: number, clientY: number) {
  // Mimic a PointerEvent enough to satisfy the hook's reads.
  return {
    clientX,
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    },
  } as unknown as React.PointerEvent<HTMLElement>;
}

function mount(extra: Partial<Parameters<typeof useGridFeature>[0]> = {}) {
  const onChange = vi.fn();
  const r = renderHook(() => useGridFeature({
    spacing: 10,
    bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    view: () => IDENTITY,
    onChange,
    ...extra,
  }));
  return { ...r, onChange };
}

describe('useGridFeature.api', () => {
  it('starts with no cell hovered', () => {
    const { result } = mount();
    expect(result.current.api.cell).toBeNull();
    expect(result.current.api.getCell()).toBeNull();
  });

  it('updates cell on pointer move within bounds', () => {
    const { result, onChange } = mount();
    act(() => {
      result.current.attrs.onPointerMove(fakePointerEvent(25, 35));
    });
    // Spacing=10, origin (0,0): (25,35) → col 2, row 3.
    expect(result.current.api.cell).toEqual({ col: 2, row: 3 });
    expect(onChange).toHaveBeenCalledWith({ col: 2, row: 3 });
  });

  it('onChange does not fire when the cell is unchanged across moves', () => {
    const { result, onChange } = mount();
    act(() => {
      result.current.attrs.onPointerMove(fakePointerEvent(25, 35));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => {
      // Same cell (2,3): (28, 33) still lands in [20,30) × [30,40).
      result.current.attrs.onPointerMove(fakePointerEvent(28, 33));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('onPointerLeave clears the cell', () => {
    const { result, onChange } = mount();
    act(() => {
      result.current.attrs.onPointerMove(fakePointerEvent(25, 35));
    });
    act(() => {
      result.current.attrs.onPointerLeave(fakePointerEvent(0, 0));
    });
    expect(result.current.api.cell).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('onPointerCancel clears the cell', () => {
    const { result } = mount();
    act(() => {
      result.current.attrs.onPointerMove(fakePointerEvent(25, 35));
    });
    act(() => {
      result.current.attrs.onPointerCancel(fakePointerEvent(0, 0));
    });
    expect(result.current.api.cell).toBeNull();
  });

  it('getCell returns the live ref without re-render', () => {
    const { result } = mount();
    act(() => {
      result.current.attrs.onPointerMove(fakePointerEvent(45, 55));
    });
    // getCell is stable (useCallback []), but the cell it reads is fresh.
    expect(result.current.api.getCell()).toEqual({ col: 4, row: 5 });
  });
});

describe('useGridFeature.layers', () => {
  it('exposes grid and highlight layer factories', () => {
    const { result } = mount();
    expect(typeof result.current.layers.grid).toBe('function');
    expect(typeof result.current.layers.highlight).toBe('function');
  });

  it('factories ignore the `current` arg and return a fresh RenderLayer each call', () => {
    const { result } = mount();
    const grid1 = result.current.layers.grid(null);
    const grid2 = result.current.layers.grid(null);
    expect(grid1).not.toBe(grid2);
    expect(typeof grid1.draw).toBe('function');
    const highlight = result.current.layers.highlight(null);
    expect(typeof highlight.draw).toBe('function');
  });
});
