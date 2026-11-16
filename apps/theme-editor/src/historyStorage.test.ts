import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSavedHistory, localHistoryStore } from './historyStorage';

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
