import { describe, it, expect, vi } from 'vitest';
import { createModeMachine } from './machine';
import { DEFAULT_MODES } from '@orochi235/weasel-modes';

function fakeHistory() {
  let nextEntryId = 1;
  const journals: Array<{ committed: boolean; cancelled: boolean; suspended: boolean }> = [];
  return {
    beginJournal: vi.fn((_opts) => {
      const forkedAtEntryId = nextEntryId;
      const j = {
        forkedAtEntryId,
        committed: false,
        cancelled: false,
        suspended: false,
        applyBatch: vi.fn(),
        commit(_label: string) { this.committed = true; },
        cancel() { this.cancelled = true; },
        suspend() { this.suspended = true; },
        entries: () => ({ undo: [], redo: [] }),
        canUndo: () => false,
        canRedo: () => false,
        undo: vi.fn(),
        redo: vi.fn(),
      };
      journals.push(j);
      return j;
    }),
    resumeJournal: vi.fn(),
    // entries() returns an empty undo stack — no intervening edits in
    // fake-history tests, so all cached journals are considered fresh.
    entries: () => ({ undo: [], redo: [] }),
    journals,
  };
}

describe('createModeMachine', () => {
  it('starts in normal mode with no active journal', () => {
    const m = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
  });

  it('enterMode("path-edit", { targetId }) starts a journal scoped to the target', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'path-1' });

    expect(m.registry.current().id).toBe('path-edit');
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(history.beginJournal.mock.calls[0][0].targetId).toBe('path-1');
    expect(m.getActiveJournal()).not.toBe(null);
  });

  it('exitMode on a soft mode suspends its journal and returns to normal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    const journal = m.getActiveJournal()!;
    m.exitMode();

    expect((journal as never as { suspended: boolean }).suspended).toBe(true);
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
  });

  it('commitMode on a strict mode commits the journal with the mode label', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    const journal = m.getActiveJournal()!;
    m.commitMode();

    expect((journal as never as { committed: boolean }).committed).toBe(true);
    expect(m.registry.current().id).toBe('normal');
  });

  it('cancelMode on a strict mode cancels the journal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    const journal = m.getActiveJournal()!;
    m.cancelMode();

    expect((journal as never as { cancelled: boolean }).cancelled).toBe(true);
    expect(m.registry.current().id).toBe('normal');
  });

  it('discardMode on a soft mode cancels (not suspends) the journal', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    const journal = m.getActiveJournal()!;
    m.discardMode();

    expect((journal as never as { cancelled: boolean }).cancelled).toBe(true);
    expect((journal as never as { suspended: boolean }).suspended).toBe(false);
    expect(m.registry.current().id).toBe('normal');
  });

  it('enterMode while already in a mode throws (only one active journal at a time)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'a' });
    expect(() => m.enterMode('free-transform', { targetId: 'b' })).toThrow();
  });

  it('enterMode("normal") is a no-op', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('normal', {});
    expect(m.getActiveJournal()).toBe(null);
  });

  it('targetId on the active mode is exposed for scoping queries', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    expect(m.getActiveTargetId()).toBe('p');
    m.exitMode();
    expect(m.getActiveTargetId()).toBe(null);
  });
});

describe('mode machine + cache', () => {
  it('soft-mode exitMode caches the suspended journal by (modeId, targetId)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p1' });
    const j1 = m.getActiveJournal();
    m.exitMode();

    m.enterMode('path-edit', { targetId: 'p1' });
    // Re-entered same target — should NOT have called beginJournal a second time.
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(m.getActiveJournal()).toBe(j1);
  });

  it('soft-mode exitMode does NOT cache when the target is null (non-scoping mode use)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('text-edit', { targetId: null });
    m.exitMode();
    m.enterMode('text-edit', { targetId: null });
    // No targetId means no cache key; second entry beings fresh.
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });

  it('strict-mode commitMode does not cache; subsequent entry is fresh', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('free-transform', { targetId: 'sel' });
    m.commitMode();
    m.enterMode('free-transform', { targetId: 'sel' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });

  it('discardMode removes the cache entry', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    m.discardMode();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);  // fresh
  });

  it('clearJournalCache() empties the cache (called on save/load)', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();
    m.clearJournalCache();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// makeRealishHistoryStub — a stub that tracks forkedAtEntryId on journals and
// supports adding entries with touchedIds after a fork point.
// ---------------------------------------------------------------------------

function makeRealishHistoryStub() {
  // Internal mutable entries list, representing the undo stack of the parent.
  const undoEntries: Array<{ id: number; touchedIds: ReadonlySet<string> }> = [];
  let nextEntryId = 1;

  const beginJournal = vi.fn((_opts: unknown) => {
    const forkedAtEntryId = nextEntryId;
    const j = {
      forkedAtEntryId,
      suspended: false,
      committed: false,
      cancelled: false,
      applyBatch: vi.fn(),
      commit(_label: string) { j.committed = true; },
      cancel() { j.cancelled = true; },
      suspend() { j.suspended = true; },
      entries: () => ({ undo: [], redo: [] }),
      canUndo: () => false,
      canRedo: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
      isActive: () => !j.committed && !j.cancelled && !j.suspended,
    };
    return j;
  });

  const resumeJournal = vi.fn();

  const stub = {
    beginJournal,
    resumeJournal,
    entries() {
      return {
        undo: undoEntries.map((e) => ({
          id: e.id,
          label: 'test',
          timestamp: 0,
          touchedIds: e.touchedIds,
        })),
        redo: [],
      };
    },
    /** Add a new parent-history entry that touched the given node ids.
     *  Call this between exitMode and re-enterMode to simulate intervening edits. */
    advanceEntries(touchedIds: ReadonlySet<string>) {
      undoEntries.push({ id: nextEntryId++, touchedIds });
    },
  };

  return stub;
}

describe('stale-journal discard', () => {
  it('discards a cached journal if a parent-history entry since the fork-id touched its target', () => {
    const history = makeRealishHistoryStub();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();

    // Simulate an intervening edit that touched 'p'.
    history.advanceEntries(new Set(['p']));

    // Re-entry must NOT resume — should begin fresh.
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(2);   // fresh
    expect(history.resumeJournal).toHaveBeenCalledTimes(0);
  });

  it('resumes a cached journal when intervening entries did NOT touch the target', () => {
    const history = makeRealishHistoryStub();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });

    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();

    // Intervening edit touched an unrelated node.
    history.advanceEntries(new Set(['unrelated']));

    // Re-entry should resume — target 'p' was not touched.
    m.enterMode('path-edit', { targetId: 'p' });
    expect(history.beginJournal).toHaveBeenCalledTimes(1);   // no fresh begin
    expect(history.resumeJournal).toHaveBeenCalledTimes(1);  // resumed
  });
});
