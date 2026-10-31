import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave, type SessionWrite } from './useAutosave';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const write = (value: string) => (): SessionWrite => ({ primary: ['doc', value] });

describe('useAutosave', () => {
  it('writes after the delay, not before', () => {
    vi.useFakeTimers();
    renderHook(() => useAutosave(write('a')));
    vi.advanceTimersByTime(299);
    expect(localStorage.getItem('doc')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(localStorage.getItem('doc')).toBe('a');
  });

  it('writes a pending save at once on pagehide and on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ v }) => useAutosave(write(v)), { initialProps: { v: 'a' } });
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem('doc')).toBe('a');
    rerender({ v: 'b' });
    unmount();
    expect(localStorage.getItem('doc')).toBe('b');
  });

  it('with a revision, saves on mount and then only when it changes', () => {
    vi.useFakeTimers();
    let written = 0;
    const counted = (v: string) => (): SessionWrite => { written += 1; return { primary: ['doc', v] }; };
    const { rerender } = renderHook(({ v }) => useAutosave(counted(v), { revision: v }), { initialProps: { v: 'a' } });
    vi.advanceTimersByTime(300);
    expect([localStorage.getItem('doc'), written]).toEqual(['a', 1]);
    rerender({ v: 'a' });
    vi.advanceTimersByTime(300);
    expect(written).toBe(1);
    rerender({ v: 'b' });
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem('doc')).toBe('b');
  });

  it('writes the dependents beside the primary, skips a null write, and reports each attempt', () => {
    vi.useFakeTimers();
    const onSaved = vi.fn();
    const { rerender } = renderHook(({ skip }) => useAutosave(
      (): SessionWrite | null => (skip ? null : { primary: ['doc', 'a'], dependents: [['undo', 'u']] }),
      { onSaved },
    ), { initialProps: { skip: true } });
    vi.advanceTimersByTime(300);
    expect(onSaved).not.toHaveBeenCalled();
    rerender({ skip: false });
    vi.advanceTimersByTime(300);
    expect([localStorage.getItem('doc'), localStorage.getItem('undo')]).toEqual(['a', 'u']);
    expect(onSaved).toHaveBeenLastCalledWith(true);
  });

  it('reports a failure when the write will not serialize or storage is unreachable', () => {
    vi.useFakeTimers();
    const onSaved = vi.fn();
    renderHook(() => useAutosave(() => { throw new Error('cycle'); }, { onSaved }));
    vi.advanceTimersByTime(300);
    expect(onSaved).toHaveBeenLastCalledWith(false);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    renderHook(() => useAutosave(write('a'), { onSaved }));
    vi.advanceTimersByTime(300);
    expect(onSaved).toHaveBeenLastCalledWith(false);
  });
});
