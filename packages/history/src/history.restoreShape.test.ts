import { describe, expect, it } from 'vitest';
import { createHistory, HistoryRestoreError, type SerializedHistory } from './history';

const snapshotOf = (fields: Partial<SerializedHistory> & Record<string, unknown>): SerializedHistory =>
  ({ version: 1, undoStack: [], redoStack: [], nextEntryId: 1, droppedEntries: 0, ...fields }) as SerializedHistory;

describe('History.restore — a snapshot of the wrong shape', () => {
  it('refuses a branch with no entries', () => {
    const h = createHistory(undefined);
    const bad = snapshotOf({ branches: [{ at: 0, entries: [] }] });
    expect(() => h.restore(bad)).toThrow(HistoryRestoreError);
    expect(h.restore(bad, { recovery: 'best-effort' }).restored).toBe(false);
    expect(h.branches()).toEqual([]);
  });
});
