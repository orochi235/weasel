import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { useHeldKeys } from './useHeldKeys';

afterEach(cleanup);

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
