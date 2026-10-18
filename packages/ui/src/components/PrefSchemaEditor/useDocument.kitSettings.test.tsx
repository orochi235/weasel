import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import type { DocumentCodec } from './document';
import { COALESCE_MS, useDocument } from './useDocument';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

interface Doc { n: number }
const BASE: Doc = { n: 0 };

const codec: DocumentCodec<Doc> = {
  openDraft: () => null,
  saveDraft: () => {},
  dropDraft: () => {},
  packSent: (value) => ({ ...value }),
  afterTaken: (value) => value,
  saveSent: () => {},
  openSent: () => null,
  dropSent: () => {},
};

/** The value one undo leaves after two edits under one key, `gap` apart. */
function undoOnceAfter(settings: KitSettingsOverrides | undefined, gap: number): Doc {
  vi.useFakeTimers({ toFake: ['Date'] });
  const wrapper = settings === undefined
    ? undefined
    : ({ children }: { children: ReactNode }) => <KitSettingsProvider value={settings}>{children}</KitSettingsProvider>;
  const { result } = renderHook(() => {
    const [value, setValue] = useState(BASE);
    const doc = useDocument({
      value, onChange: setValue, base: BASE, codec, opened: null, taken: false,
      selection: { get: () => [], set: () => {} },
    });
    return { value, doc };
  }, { wrapper });
  act(() => result.current.doc.commit({ n: 1 }, 'name'));
  vi.advanceTimersByTime(gap);
  act(() => result.current.doc.commit({ n: 2 }, 'name'));
  act(() => result.current.doc.step('undo'));
  return result.current.value;
}

describe('useDocument kit settings', () => {
  it('coalesces edits inside the constant with no provider', () => {
    expect(undoOnceAfter(undefined, COALESCE_MS - 1)).toEqual(BASE);
    cleanup();
    expect(undoOnceAfter(undefined, COALESCE_MS + 1)).toEqual({ n: 1 });
  });

  it("coalesces edits inside the provider's history.coalesceMs", () => {
    expect(undoOnceAfter({ history: { coalesceMs: 50 } }, 51)).toEqual({ n: 1 });
    cleanup();
    expect(undoOnceAfter({ history: { coalesceMs: 5000 } }, COALESCE_MS + 1)).toEqual(BASE);
  });

  it('follows a change to history.coalesceMs made after it mounted', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let setSettings: (next: KitSettingsOverrides) => void = () => {};
    function Wrapper({ children }: { children: ReactNode }) {
      const [settings, set] = useState<KitSettingsOverrides>({ history: { coalesceMs: 5000 } });
      setSettings = set;
      return <KitSettingsProvider value={settings}>{children}</KitSettingsProvider>;
    }
    const { result } = renderHook(() => {
      const [value, setValue] = useState(BASE);
      const doc = useDocument({
        value, onChange: setValue, base: BASE, codec, opened: null, taken: false,
        selection: { get: () => [], set: () => {} },
      });
      return { value, doc };
    }, { wrapper: Wrapper });
    act(() => setSettings({ history: { coalesceMs: 50 } }));
    act(() => result.current.doc.commit({ n: 1 }, 'name'));
    vi.advanceTimersByTime(51);
    act(() => result.current.doc.commit({ n: 2 }, 'name'));
    act(() => result.current.doc.step('undo'));
    expect(result.current.value).toEqual({ n: 1 });
  });
});
