import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { useHeldKeys } from './useHeldKeys';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('lets go of every key when focus leaves an element target', () => {
  const el = document.createElement('div');
  el.tabIndex = 0;
  const other = document.createElement('button');
  document.body.append(el, other);
  const { result } = renderHook(() => useHeldKeys(el));
  act(() => { fireEvent.keyDown(el, { code: 'Tab' }); });
  expect([...result.current]).toEqual(['Tab']);
  act(() => {
    fireEvent.focusOut(el, { relatedTarget: other });
    fireEvent.keyUp(other, { code: 'Tab' });
  });
  expect([...result.current]).toEqual([]);
  el.remove();
  other.remove();
});

const holdWThenTapMeta = () => {
  const { result } = renderHook(() => useHeldKeys());
  act(() => {
    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.keyDown(window, { code: 'MetaLeft' });
    fireEvent.keyUp(window, { code: 'MetaLeft' });
  });
  return [...result.current];
};

it('lets go of the other keys with Command on macOS, which sends no key-up for them', () => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  expect(holdWThenTapMeta()).toEqual([]);
});

it('keeps a key held through a tap of Win or Super elsewhere', () => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
  expect(holdWThenTapMeta()).toEqual(['KeyW']);
});
