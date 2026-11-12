import type { History, SerializedHistory } from '@weasel-js/history';
import { onLeave } from '@weasel-js/storage';
import { useEffect } from 'react';

/** A history saved with the state it ends on. */
export interface SavedLabHistory<T> {
  state: T;
  history: SerializedHistory;
}

/** Where `useLabHistory` keeps its history across a reload. */
export interface LabHistoryStore<T> {
  load(): SavedLabHistory<T> | null;
  save(saved: SavedLabHistory<T>): void;
  /** Hear the saved history being cleared, to drop a save not yet made. Returns the stop. */
  onClear?(cancel: () => void): () => void;
}

/** What drops each key's pending saves, for `clearSavedHistory`. */
const pending = new Map<string, Set<() => void>>();

/** The most a saved history may take, in JSON characters: a theme definition runs to tens of
 *  kilobytes and every step holds two, so the steps farthest from now are cut to fit. */
const SAVED_CHARS = 1_000_000;
/** How long the history rests before it is saved: a slider drag changes it every tick. */
const SAVE_MS = 400;

export function parseSavedHistory<T>(raw: string | null): SavedLabHistory<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const saved = parsed as Partial<SavedLabHistory<T>> | null;
  const history = saved?.history;
  if (!saved || !('state' in saved) || history?.version !== 1) return null;
  if (!Array.isArray(history.undoStack) || !Array.isArray(history.redoStack)) return null;
  return saved as SavedLabHistory<T>;
}

/** A history kept in `localStorage` under `key`. Without storage, nothing is kept. */
export function localHistoryStore<T>(key: string): LabHistoryStore<T> {
  return {
    load: () => {
      try {
        return parseSavedHistory<T>(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    save: (saved) => {
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // Private windows and full quotas both land here.
      }
    },
    onClear: (cancel) => {
      const held = pending.get(key) ?? new Set();
      pending.set(key, held);
      held.add(cancel);
      return () => {
        held.delete(cancel);
        if (held.size === 0) pending.delete(key);
      };
    },
  };
}

/** Forget the history saved under `key`, and the saves of it still to come. */
export function clearSavedHistory(key: string): void {
  for (const cancel of [...(pending.get(key) ?? [])]) cancel();
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** `saved` with the steps farthest from its present cut, oldest undo first, until it fits. */
export function fitted(saved: SerializedHistory, budget = SAVED_CHARS): SerializedHistory {
  let out = saved;
  let size = JSON.stringify(out).length;
  while (size > budget) {
    const [oldest, ...undoStack] = out.undoStack;
    const [farthest, ...redoStack] = out.redoStack;
    const cut = oldest ?? farthest;
    if (!cut) break;
    size -= JSON.stringify(cut).length;
    out = oldest
      ? { ...out, undoStack, floor: oldest.id, droppedEntries: out.droppedEntries + 1 }
      : { ...out, redoStack, droppedEntries: out.droppedEntries + 1 };
  }
  return out;
}

/** Save `history` to `store` beside the state `holder` holds, a rest after each change and
 *  whenever the page goes away or turns hidden, or the caller unmounts. */
export function useSavedLabHistory<T>(
  history: History,
  holder: { readonly current: { value: T } },
  store: LabHistoryStore<T> | undefined,
): void {
  useEffect(() => {
    if (!store) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    const flush = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (!dirty) return;
      dirty = false;
      store.save({ state: holder.current.value, history: fitted(history.serialize()) });
    };
    const off = history.subscribe(() => {
      dirty = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, SAVE_MS);
    });
    const offClear = store.onClear?.(() => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      dirty = false;
    });
    const stopLeave = onLeave(flush);
    return () => {
      off();
      offClear?.();
      stopLeave();
      flush();
    };
  }, [history, holder, store]);
}
