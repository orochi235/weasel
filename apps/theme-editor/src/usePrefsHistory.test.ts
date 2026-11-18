import { renderHook } from '@testing-library/react';
import { openPrefsSync, type PrefsStore } from '@weasel-js/prefs';
import { pref, type PrefGroup } from '@weasel-js/prefs-schema';
import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { usePrefsHistory } from './usePrefsHistory';

const SCHEMA = {
  name: 'T',
  children: { a: pref.number('A', 1), b: pref.number('B', 2) },
} satisfies PrefGroup;

describe('usePrefsHistory', () => {
  it('undoes only the leaf its step wrote, leaving a write made around it', () => {
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'p.' }) as unknown as PrefsStore<PrefGroup>;
    const { result } = renderHook(() => usePrefsHistory(store));
    result.current.set('a', 5);
    // As another tab's write, which this store hears, reaches it.
    store.set('b' as never, 9 as never);
    result.current.history.undo();
    expect(store.get('a' as never)).toBe(1);
    expect(store.get('b' as never)).toBe(9);
    result.current.history.redo();
    expect(store.get('a' as never)).toBe(5);
    expect(store.get('b' as never)).toBe(9);
  });
});
