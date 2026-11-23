import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SerializedHistory } from '@weasel-js/history';
import { clearSavedHistory, fitted, localHistoryStore } from './historyStorage';

afterEach(() => { localStorage.clear(); });

describe('clearSavedHistory', () => {
  it("still cancels a save registered after an earlier one was released twice", () => {
    const store = localHistoryStore<number>('k');
    const stop = store.onClear!(() => {});
    stop();
    const later = vi.fn();
    store.onClear!(later);
    stop();
    clearSavedHistory('k');
    expect(later).toHaveBeenCalledOnce();
  });
});

describe('fitted', () => {
  const entry = (id: number) => ({ id, label: `step ${id}`, forwardOps: [], baseOps: [] });
  const saved: SerializedHistory = {
    version: 1,
    undoStack: Array.from({ length: 12 }, (_, i) => entry(i + 1)),
    redoStack: [entry(14), entry(13)],
    nextEntryId: 15,
    droppedEntries: 0,
  } as SerializedHistory;

  it('cuts until the history really fits its budget', () => {
    const empty = JSON.stringify({ ...saved, undoStack: [], redoStack: [], floor: 12, droppedEntries: 14 }).length;
    for (let budget = empty; budget <= JSON.stringify(saved).length; budget += 1) {
      expect(JSON.stringify(fitted(saved, budget)).length).toBeLessThanOrEqual(budget);
    }
  });
});
