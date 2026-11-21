import { afterEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEventLog } from './useEventLog';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

test('a move claimed after the first of a run marks the run’s line claimed', () => {
  vi.useFakeTimers();
  const root = document.createElement('div');
  const target = document.createElement('span');
  root.append(target);
  document.body.append(root);
  const ref = { current: root };
  const hook = renderHook(() => useEventLog(ref, ['moves']));
  const move = (claim: boolean) => act(() => {
    const e = new PointerEvent('pointermove', { bubbles: true, cancelable: true });
    if (claim) target.addEventListener('pointermove', (ev) => ev.preventDefault(), { once: true });
    target.dispatchEvent(e);
    vi.runAllTimers();
  });
  move(false);
  move(true);
  expect(hook.result.current.log).toHaveLength(1);
  expect(hook.result.current.log[0]).toMatchObject({ count: 2, claimed: true });
});
