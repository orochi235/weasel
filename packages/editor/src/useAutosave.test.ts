import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createMemoryAdapter, openRecordsSync } from '@weasel-js/storage';
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
    expect(localStorage.getItem('doc')).toBe('"a"');
  });

  it('writes a pending save at once on pagehide and on unmount', async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ v }) => useAutosave(write(v)), { initialProps: { v: 'a' } });
    window.dispatchEvent(new Event('pagehide'));
    expect(localStorage.getItem('doc')).toBe('"a"');
    rerender({ v: 'b' });
    unmount();
    // Behind the first save's write, so a few microtasks later.
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem('doc')).toBe('"b"');
  });

  it('writes a pending save at once when the page turns hidden', () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    renderHook(() => useAutosave(write('a'), { debounceMs: Infinity }));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(localStorage.getItem('doc')).toBe('"a"');
  });

  it('with a revision, saves on mount and then only when it changes', async () => {
    vi.useFakeTimers();
    let written = 0;
    const counted = (v: string) => (): SessionWrite => { written += 1; return { primary: ['doc', v] }; };
    const { rerender } = renderHook(({ v }) => useAutosave(counted(v), { revision: v }), { initialProps: { v: 'a' } });
    vi.advanceTimersByTime(300);
    expect([localStorage.getItem('doc'), written]).toEqual(['"a"', 1]);
    rerender({ v: 'a' });
    vi.advanceTimersByTime(300);
    expect(written).toBe(1);
    rerender({ v: 'b' });
    await vi.advanceTimersByTimeAsync(300);
    expect(localStorage.getItem('doc')).toBe('"b"');
  });

  it('writes the dependents beside the primary, skips a null write, and reports each attempt', async () => {
    vi.useFakeTimers();
    const onSaved = vi.fn();
    const { rerender } = renderHook(({ skip }) => useAutosave(
      (): SessionWrite | null => (skip ? null : { primary: ['doc', 'a'], dependents: [['undo', 'u']] }),
      { onSaved },
    ), { initialProps: { skip: true } });
    await vi.advanceTimersByTimeAsync(300);
    expect(onSaved).not.toHaveBeenCalled();
    rerender({ skip: false });
    await vi.advanceTimersByTimeAsync(300);
    expect([localStorage.getItem('doc'), localStorage.getItem('undo')]).toEqual(['"a"', '"u"']);
    expect(onSaved).toHaveBeenLastCalledWith(true);
  });

  it('reports a failure when the write will not serialize or storage is unreachable', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onSaved = vi.fn();
    renderHook(() => useAutosave(() => { throw new Error('cycle'); }, { onSaved }));
    await vi.advanceTimersByTimeAsync(300);
    expect(onSaved).toHaveBeenLastCalledWith(false);
    onSaved.mockClear();
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    renderHook(() => useAutosave(write('a'), { onSaved }));
    await vi.advanceTimersByTimeAsync(300);
    expect(onSaved).toHaveBeenLastCalledWith(false);
  });

  it('writes to the records it is given, and reports a write they refuse', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const backing = new Map<string, unknown>();
    const memory = createMemoryAdapter(backing);
    let full = false;
    const storage = { ...memory, set: async (k: string, v: unknown) => { if (full) throw new Error('quota'); await memory.set(k, v); } };
    const records = openRecordsSync({ storage, prefix: 'app:', retryMs: false });
    const onSaved = vi.fn();
    const { rerender } = renderHook(({ v }) => useAutosave(() => ({ primary: ['doc', { v }] }), { records, onSaved }), { initialProps: { v: 1 } });
    await vi.advanceTimersByTimeAsync(300);
    expect([backing.get('app:doc'), localStorage.getItem('doc')]).toEqual([{ v: 1 }, null]);
    expect(onSaved).toHaveBeenLastCalledWith(true);
    full = true;
    rerender({ v: 2 });
    await vi.advanceTimersByTimeAsync(300);
    expect(onSaved).toHaveBeenLastCalledWith(false);
    expect([backing.get('app:doc'), records.get('doc')]).toEqual([{ v: 1 }, { v: 1 }]);
    await records.close();
  });
});
