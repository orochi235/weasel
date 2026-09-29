import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCanvasFocus } from './useCanvasFocus';

describe('useCanvasFocus', () => {
  it('starts unfocused by default', () => {
    const { result } = renderHook(() => useCanvasFocus());
    expect(result.current.focused).toBe(false);
    expect(result.current.getFocused()).toBe(false);
  });

  it('honors `initial: true`', () => {
    const { result } = renderHook(() => useCanvasFocus({ initial: true }));
    expect(result.current.focused).toBe(true);
    expect(result.current.getFocused()).toBe(true);
  });

  it('focusProps.tabIndex defaults to 0', () => {
    const { result } = renderHook(() => useCanvasFocus());
    expect(result.current.focusProps.tabIndex).toBe(0);
  });

  it('focusProps.tabIndex can be customized', () => {
    const { result } = renderHook(() => useCanvasFocus({ tabIndex: -1 }));
    expect(result.current.focusProps.tabIndex).toBe(-1);
  });

  it('onFocus / onBlur drive the focused boolean', () => {
    const { result } = renderHook(() => useCanvasFocus());
    expect(result.current.focused).toBe(false);
    act(() => {
      result.current.focusProps.onFocus();
    });
    expect(result.current.focused).toBe(true);
    expect(result.current.getFocused()).toBe(true);

    act(() => {
      result.current.focusProps.onBlur();
    });
    expect(result.current.focused).toBe(false);
    expect(result.current.getFocused()).toBe(false);
  });

  it('setFocused programmatic toggle works', () => {
    const { result } = renderHook(() => useCanvasFocus());
    act(() => {
      result.current.setFocused(true);
    });
    expect(result.current.focused).toBe(true);
    act(() => {
      result.current.setFocused(false);
    });
    expect(result.current.focused).toBe(false);
  });

  it('repeated onFocus while focused does not re-render or flip state', () => {
    const { result } = renderHook(() => useCanvasFocus({ initial: true }));
    expect(result.current.focused).toBe(true);
    act(() => {
      result.current.focusProps.onFocus();
      result.current.focusProps.onFocus();
    });
    expect(result.current.focused).toBe(true);
  });

  it('getFocused() returns live state inside closures (no stale capture)', () => {
    const { result } = renderHook(() => useCanvasFocus());
    const getter = result.current.getFocused;
    expect(getter()).toBe(false);
    act(() => {
      result.current.focusProps.onFocus();
    });
    // Same getter reference, but reads new state.
    expect(getter()).toBe(true);
  });

  it('keeps focusProps identity across renders until tabIndex changes', () => {
    const { result, rerender } = renderHook(({ tabIndex }) => useCanvasFocus({ tabIndex }), {
      initialProps: { tabIndex: 0 },
    });
    const first = result.current.focusProps;
    rerender({ tabIndex: 0 });
    expect(result.current.focusProps).toBe(first);
    rerender({ tabIndex: -1 });
    expect(result.current.focusProps).not.toBe(first);
    expect(result.current.focusProps.tabIndex).toBe(-1);
  });
});
