import { act, renderHook } from '@testing-library/react';
import { createMemoryAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { usePrefsStore } from './react';
import { recordValue } from './stamp';

const SCHEMA = {
  name: 'Test',
  children: {
    density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
  },
} satisfies PrefGroup;

/** A memory adapter that counts the stores over it: every open lists once,
 *  and a store holds one subscription from its open until its close. */
const counted = (backing = new Map<string, unknown>()) => {
  const inner = createMemoryAdapter(backing);
  const seen = { opens: 0, live: 0 };
  const storage: SyncStorageAdapter = {
    ...inner,
    listSync: (prefix) => {
      seen.opens++;
      return inner.listSync(prefix);
    },
    subscribe: (prefix, on) => {
      seen.live++;
      const stop = inner.subscribe!(prefix, on);
      return () => {
        seen.live--;
        stop();
      };
    },
  };
  return { storage, seen, backing };
};

/** The close waits a microtask for a remount, then flushes before it lets go. */
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('usePrefsStore', () => {
  it('has values on the first render', () => {
    const { storage } = counted(new Map([['p.density', 20]]));
    const first: number[] = [];
    renderHook(() => {
      const store = usePrefsStore(SCHEMA, { storage, prefix: 'p.' });
      first.push(store.get('density'));
    });
    expect(first[0]).toBe(20);
  });

  it('keeps one store across renders that pass a new options object', () => {
    const { storage, seen } = counted();
    const { result, rerender } = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    const store = result.current;
    rerender();
    expect(result.current).toBe(store);
    expect(seen).toEqual({ opens: 1, live: 1 });
  });

  it('opens one store under StrictMode, persists a set made after mount, and closes on unmount', async () => {
    const { storage, seen, backing } = counted();
    const { result, unmount } = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }), {
      wrapper: StrictMode,
    });
    await settle();
    expect(seen).toEqual({ opens: 1, live: 1 });
    act(() => result.current.set('density', 100));
    expect(await result.current.flush()).toBe(true);
    expect(recordValue(backing.get('p.density'))).toBe(100);
    unmount();
    await settle();
    expect(seen).toEqual({ opens: 1, live: 0 });
  });

  it('flushes a write still queued at unmount', async () => {
    const { storage, backing } = counted();
    const { result, unmount } = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    act(() => result.current.set('density', 100));
    unmount();
    await settle();
    expect(recordValue(backing.get('p.density'))).toBe(100);
  });

  it('gives two components on one prefix the same store, open until the last unmounts', async () => {
    const { storage, seen } = counted();
    const a = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    const b = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    expect(b.result.current).toBe(a.result.current);
    a.unmount();
    await settle();
    expect(seen).toEqual({ opens: 1, live: 1 });
    b.unmount();
    await settle();
    expect(seen.live).toBe(0);
  });

  it('opens afresh on a remount after the close, reading what the last store wrote', async () => {
    const { storage, seen } = counted();
    const first = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    act(() => first.result.current.set('density', 100));
    first.unmount();
    await settle();
    const second = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    expect(second.result.current).not.toBe(first.result.current);
    expect(second.result.current.get('density')).toBe(100);
    expect(seen).toEqual({ opens: 2, live: 1 });
    second.unmount();
    await settle();
  });

  it('closes the store and opens another when the prefix changes', async () => {
    const { storage, seen } = counted(new Map([['q.density', 30]]));
    const { result, rerender, unmount } = renderHook(
      ({ prefix }) => usePrefsStore(SCHEMA, { storage, prefix }),
      { initialProps: { prefix: 'p.' } },
    );
    rerender({ prefix: 'q.' });
    await settle();
    expect(result.current.get('density')).toBe(30);
    expect(seen).toEqual({ opens: 2, live: 1 });
    unmount();
    await settle();
    expect(seen.live).toBe(0);
  });

  it('replaces the store when the schema changes, over the same records', async () => {
    const wider = {
      name: 'Test',
      children: { density: { ...SCHEMA.children.density, max: 1000 } },
    } satisfies PrefGroup;
    const { storage, seen } = counted();
    const { result, rerender, unmount } = renderHook(
      ({ schema }: { schema: typeof SCHEMA }) => usePrefsStore(schema, { storage, prefix: 'p.' }),
      { initialProps: { schema: SCHEMA } },
    );
    const narrow = result.current;
    act(() => narrow.set('density', 200));
    rerender({ schema: wider });
    expect(result.current.schema).toBe(wider);
    expect(result.current.get('density')).toBe(200);
    await settle();
    expect(narrow.closed).toBe(true);
    expect(seen).toEqual({ opens: 1, live: 1 });
    unmount();
    await settle();
    expect(seen.live).toBe(0);
  });

  it('keeps both stores open for two components with different schemas on one prefix', async () => {
    const other = {
      name: 'Other',
      children: {
        density: SCHEMA.children.density,
        zoom: { kind: 'number', name: 'Zoom', description: '', default: 1 },
      },
    } satisfies PrefGroup;
    const { storage, seen, backing } = counted();
    const a = renderHook(() => usePrefsStore(SCHEMA, { storage, prefix: 'p.' }));
    const b = renderHook(() => usePrefsStore(other, { storage, prefix: 'p.' }));
    a.rerender();
    await settle();
    expect(a.result.current.closed).toBe(false);
    expect(b.result.current.closed).toBe(false);
    expect(a.result.current.schema).toBe(SCHEMA);
    expect(b.result.current.schema).toBe(other);

    act(() => a.result.current.set('density', 100));
    expect(b.result.current.get('density')).toBe(100);

    a.unmount();
    await settle();
    expect(a.result.current.closed).toBe(true);
    expect(b.result.current.closed).toBe(false);
    act(() => b.result.current.set('zoom', 3));
    expect(await b.result.current.flush()).toBe(true);
    expect(recordValue(backing.get('p.zoom'))).toBe(3);
    expect(seen).toEqual({ opens: 1, live: 1 });
    b.unmount();
    await settle();
    expect(seen.live).toBe(0);
  });

  it('closes a store opened by a render that never mounted', async () => {
    const { storage, seen } = counted();
    const Throws = (): never => {
      usePrefsStore(SCHEMA, { storage, prefix: 'p.' });
      throw new Error('never mounts');
    };
    expect(() => renderHook(() => Throws())).toThrow('never mounts');
    await settle();
    expect(seen.live).toBe(0);
  });
});
