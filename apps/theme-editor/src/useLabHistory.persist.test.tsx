import { act, cleanup, fireEvent, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SerializedHistory } from '@weasel-js/history';
import type { StoredTheme } from '@weasel-js/theme/engine';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitted, type LabHistoryStore, type SavedLabHistory } from './historyStorage';
import { PaletteLab } from './PaletteLab';
import { ThemeWorkbench } from './ThemeWorkbench';
import { clearDraftHistory, draftHistory } from './theme/draftStorage';
import { weasel } from './theme/fixtures';
import { removePin, setPin } from './theme/model';
import { useLabHistory } from './useLabHistory';

vi.setConfig({ testTimeout: 20_000 });

interface S {
  n: number;
}

function memoryStore<T>(): LabHistoryStore<T> & { held: SavedLabHistory<T> | null } {
  const store = {
    held: null as SavedLabHistory<T> | null,
    load: () => store.held && structuredClone(store.held),
    save: (saved: SavedLabHistory<T>) => {
      store.held = JSON.parse(JSON.stringify(saved));
    },
  };
  return store;
}

// Under Node 26 the environment has no working `localStorage`.
function stubStorage() {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() {
      return items.size;
    },
    key: (i: number) => [...items.keys()][i] ?? null,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useLabHistory with a store', () => {
  it('undoes and redoes the same steps after a remount, a drag still one step', () => {
    const store = memoryStore<S>();
    const first = renderHook(() => useLabHistory<S>({ n: 0 }, store));
    act(() => {
      for (let n = 1; n <= 5; n += 1) first.result.current.update({ n }, 'n');
    });
    act(() => first.result.current.update({ n: 9 }, 'other'));
    act(() => first.result.current.undo());
    first.unmount();

    const again = renderHook(() => useLabHistory<S>({ n: 5 }, store));
    expect(again.result.current.canUndo).toBe(true);
    expect(again.result.current.canRedo).toBe(true);
    act(() => again.result.current.redo());
    expect(again.result.current.state.n).toBe(9);
    act(() => again.result.current.undo());
    act(() => again.result.current.undo());
    expect(again.result.current.state.n).toBe(0);
  });

  it('saves a step still resting when the page turns hidden', () => {
    const store = memoryStore<S>();
    const { result } = renderHook(() => useLabHistory<S>({ n: 0 }, store));
    act(() => result.current.update({ n: 1 }, 'n'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.restoreAllMocks();
    expect(store.held?.state.n).toBe(1);
  });

  it('drops a history saved against other state than the hook opens on', () => {
    const store = memoryStore<S>();
    const first = renderHook(() => useLabHistory<S>({ n: 0 }, store));
    act(() => first.result.current.update({ n: 1 }, 'n'));
    first.unmount();

    const again = renderHook(() => useLabHistory<S>({ n: 7 }, store));
    expect(again.result.current.canUndo).toBe(false);
  });

  it('cuts the oldest steps from a history too big to save', () => {
    const entry = (id: number) => ({ id, label: 'n', forwardOps: [], baseOps: [], timestamp: id });
    const big: SerializedHistory = {
      version: 1,
      undoStack: [entry(1), entry(2), entry(3)],
      redoStack: [entry(4)],
      nextEntryId: 5,
      droppedEntries: 0,
    };
    const one = JSON.stringify(entry(1)).length;
    const cut = fitted(big, JSON.stringify(big).length - one);
    expect(cut.undoStack.map((e) => e.id)).toEqual([2, 3]);
    expect(cut.floor).toBe(1);
    expect(cut.droppedEntries).toBe(1);
  });
});

describe('a reload', () => {
  it('keeps the palette lab undo and redo', async () => {
    stubStorage();
    const first = renderWithIcons(<PaletteLab />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    first.unmount();

    renderWithIcons(<PaletteLab />);
    const rail = screen.getByRole('toolbar', { name: 'Lab actions' });
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    fireEvent.click(within(rail).getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    fireEvent.click(within(rail).getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
  });

  it("keeps a theme draft's undo and redo", async () => {
    stubStorage();
    const onDisk = setPin(removePin(weasel, 'gray-800'), 'gray-800', { value: '#1a1c21', type: 'color' });
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: onDisk };
    const props = {
      api: { list: async () => [stored], get: async () => stored, put: vi.fn() },
      themes: [stored],
      stored,
      onPick: vi.fn(),
      onSaved: vi.fn(),
      onReload: vi.fn(async () => {}),
      onDiscard: vi.fn(),
      onNew: vi.fn(() => null),
    };
    const start = removePin(onDisk, 'gray-800');
    const first = renderWithIcons(<ThemeWorkbench {...props} start={{ definition: start, baseHash: 'h1' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin gray-800' }));
    first.unmount();

    renderWithIcons(<ThemeWorkbench {...props} start={{ definition: onDisk, baseHash: 'h1' }} />);
    const undo = within(screen.getByRole('toolbar', { name: 'Theme actions' })).getByRole('button', { name: 'Undo' });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(screen.getByRole('button', { name: 'Pin gray-800' })).toBeInTheDocument();
  });
});

describe("a theme draft's history, once the draft is discarded", () => {
  const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
  const props = {
    api: { list: async () => [stored], get: async () => stored, put: vi.fn() },
    themes: [stored],
    stored,
    start: { definition: removePin(weasel, 'gray-800'), baseHash: 'h1' },
    onPick: vi.fn(),
    onSaved: vi.fn(),
    onReload: vi.fn(async () => {}),
    onDiscard: vi.fn(),
    onNew: vi.fn(() => null),
  };

  it('is not written back by the save pending when the editor unmounts', async () => {
    stubStorage();
    const bench = renderWithIcons(<ThemeWorkbench {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin gray-800' }));
    clearDraftHistory('weasel');
    bench.unmount();
    expect(draftHistory('weasel').load()).toBeNull();
  });

  it('is not written back when the page hides', async () => {
    stubStorage();
    renderWithIcons(<ThemeWorkbench {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin gray-800' }));
    clearDraftHistory('weasel');
    window.dispatchEvent(new Event('pagehide'));
    expect(draftHistory('weasel').load()).toBeNull();
  });

  it('is saved again for an edit made after', async () => {
    stubStorage();
    const bench = renderWithIcons(<ThemeWorkbench {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin gray-800' }));
    clearDraftHistory('weasel');
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Theme actions' })).getByRole('button', { name: 'Undo' }));
    bench.unmount();
    expect(draftHistory('weasel').load()?.history.redoStack).toHaveLength(1);
  });
});
