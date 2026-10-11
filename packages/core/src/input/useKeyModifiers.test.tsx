import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useKeyModifiers } from './useKeyModifiers';

afterEach(cleanup);

const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit) =>
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init })); });

describe('useKeyModifiers', () => {
  it('re-renders with the modifiers held as they change', () => {
    const { result } = renderHook(() => useKeyModifiers());
    expect(result.current).toEqual({ shift: false, ctrl: false, alt: false, meta: false });
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(result.current.shift).toBe(true);
    key('keydown', { key: 'Alt', code: 'AltLeft', shiftKey: true, altKey: true });
    expect(result.current).toEqual({ shift: true, ctrl: false, alt: true, meta: false });
    key('keyup', { key: 'Shift', code: 'ShiftLeft', altKey: true });
    expect(result.current).toEqual({ shift: false, ctrl: false, alt: true, meta: false });
  });

  it('keeps one object while nothing about the modifiers changes', () => {
    const { result } = renderHook(() => useKeyModifiers());
    const before = result.current;
    key('keydown', { key: 'a', code: 'KeyA' });
    expect(result.current).toBe(before);
  });
});
