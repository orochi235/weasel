import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDebouncedText } from './useDebouncedText';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function mount(initial = '') {
  const write = vi.fn();
  const hook = renderHook(({ value }) => useDebouncedText(value, write, 150), {
    initialProps: { value: initial },
  });
  return { write, ...hook };
}

it('writes typed text once the debounce elapses', () => {
  const { write, result } = mount();
  act(() => result.current.type('wor'));
  act(() => result.current.type('word'));
  expect(write).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(150));
  expect(write.mock.calls).toEqual([['word']]);
});

it('writes text still waiting on the debounce when the row unmounts', () => {
  const { write, result, unmount } = mount();
  act(() => result.current.type('word'));
  unmount();
  expect(write.mock.calls).toEqual([['word']]);
  vi.advanceTimersByTime(150);
  expect(write).toHaveBeenCalledTimes(1);
});

it('writes nothing on unmount when nothing is waiting', () => {
  const { write, result, unmount } = mount();
  act(() => result.current.type('word'));
  act(() => vi.advanceTimersByTime(150));
  unmount();
  expect(write).toHaveBeenCalledTimes(1);
});

it('drops text still waiting when the value is replaced from outside', () => {
  const { write, result, rerender } = mount('old');
  act(() => result.current.type('typed'));
  rerender({ value: 'reset' });
  act(() => vi.advanceTimersByTime(150));
  expect(write).not.toHaveBeenCalled();
  expect(result.current.local).toBe('reset');
});
