import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import type { DocumentCodec, DraftStorage } from './document';
import { useDocument } from './useDocument';

afterEach(cleanup);

interface Doc { n: number }
const BASE: Doc = { n: 0 };

function memory(): DraftStorage & { keys(): string[] } {
  const held = new Map<string, string>();
  return {
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => void held.set(k, v),
    removeItem: (k) => void held.delete(k),
    keys: () => [...held.keys()],
  };
}

/** What the stub codec was last asked to keep as sent, by key. */
const sentUnder = new Map<string, unknown>();
afterEach(() => sentUnder.clear());

const codec: DocumentCodec<Doc> = {
  openDraft: () => null,
  saveDraft: (key, value, _base, _stacks, savedAt, storage) => storage!.setItem(key, JSON.stringify({ value, savedAt })),
  dropDraft: (key, storage) => storage!.removeItem(key),
  packSent: (value) => ({ ...value }),
  // What was sent is the baseline's now; anything else is still the reader's.
  afterTaken: (value, sent, base) => (value.n === (sent as Doc).n ? base : value),
  saveSent: (key, sent) => void sentUnder.set(key, sent),
  openSent: (key) => sentUnder.get(key) ?? null,
  dropSent: (key) => void sentUnder.delete(key),
};

function setup(storage = memory()) {
  const hook = renderHook(({ taken }: { taken: boolean }) => {
    const [value, setValue] = useState(BASE);
    const doc = useDocument({
      value, onChange: setValue, base: BASE, codec, opened: null, draftKey: 'k', draftStorage: storage, taken,
      selection: { get: () => [], set: () => {} },
    });
    return { value, setValue, doc };
  }, { initialProps: { taken: false } });
  return { ...hook, storage };
}

describe('useDocument', () => {
  it('commits an edit, steps back from it, and steps forward again', () => {
    const { result } = setup();
    act(() => result.current.doc.commit({ n: 1 }));
    expect(result.current.value).toEqual({ n: 1 });
    expect(result.current.doc.canUndo).toBe(true);
    act(() => result.current.doc.step('undo'));
    expect(result.current.value).toBe(BASE);
    expect(result.current.doc.canRedo).toBe(true);
    act(() => result.current.doc.step('redo'));
    expect(result.current.value).toEqual({ n: 1 });
  });

  it('keeps a draft after an edit and drops it back at the baseline', () => {
    const { result, storage } = setup();
    act(() => result.current.doc.commit({ n: 1 }));
    expect(storage.keys()).toEqual(['k']);
    expect(result.current.doc.draftSavedAt).not.toBeNull();
    act(() => result.current.doc.step('undo'));
    expect(storage.keys()).toEqual([]);
    expect(result.current.doc.draftSavedAt).toBeNull();
  });

  it('starts its history over when the value is set from outside', () => {
    const { result } = setup();
    act(() => result.current.doc.commit({ n: 1 }));
    act(() => result.current.setValue({ n: 9 }));
    expect(result.current.doc.canUndo).toBe(false);
  });

  it('returns to the baseline once what it sent is taken, and keeps no step back', async () => {
    const { result, rerender, storage } = setup();
    act(() => result.current.doc.commit({ n: 1 }));
    await act(() => result.current.doc.send(async () => {}));
    expect(sentUnder.get('k')).toEqual({ n: 1 });
    rerender({ taken: true });
    expect(result.current.value).toBe(BASE);
    expect(result.current.doc.canUndo).toBe(false);
    expect(storage.keys()).toEqual([]);
    expect(sentUnder.size).toBe(0);
  });
});
