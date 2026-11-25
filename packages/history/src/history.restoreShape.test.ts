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

  it('refuses a snapshot in a version it does not read', () => {
    const h = createHistory(undefined);
    const later = snapshotOf({ version: 2 as 1 });
    expect(() => h.restore(later)).toThrow(/version/);
    expect(h.restore(later, { recovery: 'best-effort' }).restored).toBe(false);
  });

  it('refuses a snapshot whose version is a BigInt or holds a cycle', () => {
    const h = createHistory(undefined, { debug: { log: () => {}, warn: () => {} } });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const version of [1n, cycle]) {
      const bad = snapshotOf({ version: version as unknown as 1 });
      expect(() => h.restore(bad)).toThrow(HistoryRestoreError);
      expect(h.restore(bad, { recovery: 'best-effort' }).restored).toBe(false);
    }
  });

  it('refuses a branch forking from an entry the snapshot does not hold', () => {
    const h = createHistory(undefined, { branching: true });
    const entry = (id: number) => ({ id, label: 'e', forwardOps: [], baseOps: [] });
    const stray = snapshotOf({ undoStack: [entry(1)], branches: [{ at: 7, entries: [entry(2)] }], nextEntryId: 3 });
    expect(() => h.restore(stray)).toThrow(/forks from entry 7/);
    const floored = snapshotOf({ floor: 5, undoStack: [entry(6)], branches: [{ at: 5, entries: [entry(7)] }], nextEntryId: 8 });
    expect(h.restore(floored).restored).toBe(true);
  });

  it('refuses a snapshot naming one entry id twice', () => {
    const h = createHistory(undefined);
    const entry = (id: number) => ({ id, label: 'e', forwardOps: [], baseOps: [] });
    const across = snapshotOf({ undoStack: [entry(1)], redoStack: [entry(2)], branches: [{ at: 1, entries: [entry(2)] }], nextEntryId: 3 });
    expect(() => h.restore(across)).toThrow(/id 2/);
    expect(() => h.restore(snapshotOf({ undoStack: [entry(1), entry(1)], nextEntryId: 2 }))).toThrow(/id 1/);
  });
});
