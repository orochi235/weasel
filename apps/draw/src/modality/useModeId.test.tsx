import { act, renderHook } from '@testing-library/react';
import { createHistory } from '@weasel-js/history';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { describe, expect, it } from 'vitest';
import { createModeMachine } from './machine';
import { useModeId } from './useModeId';

const machine = () => createModeMachine({ modes: DEFAULT_MODES, history: createHistory({}) });

describe('useModeId', () => {
  it('follows the mode, and reads a machine handed in later from its own mode', () => {
    const first = machine();
    const second = machine();
    second.enterMode('path-edit', { targetId: 'p' });
    const { result, rerender } = renderHook(({ m }) => useModeId(m), { initialProps: { m: first } });
    expect(result.current).toBe('normal');
    act(() => { first.enterMode('path-edit', { targetId: 'q' }); });
    expect(result.current).toBe('path-edit');
    act(() => { first.leaveMode(); });
    rerender({ m: second });
    expect(result.current).toBe('path-edit');
  });
});
