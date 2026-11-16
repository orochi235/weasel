import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KitSettingsProvider } from '@weasel-js/react';
import { useIdleSettle } from './useIdleSettle';

afterEach(() => { vi.useRealTimers(); });

describe('useIdleSettle', () => {
  it('waits out a typing.idleMs longer than one timer holds', () => {
    vi.useFakeTimers();
    const settle = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KitSettingsProvider value={{ typing: { idleMs: 2 ** 31 } }}>{children}</KitSettingsProvider>
    );
    const { result } = renderHook(() => useIdleSettle(settle, true), { wrapper });
    act(() => result.current.typed());
    act(() => { vi.advanceTimersByTime(1); });
    expect(settle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2 ** 31); });
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
