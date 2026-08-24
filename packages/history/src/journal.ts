import type { Op } from './op';
import { createHistory, type History, type HistoryEntry, type HistorySelection } from './history';

const RESUMERS = new WeakMap<Journal, () => void>();

/** Called by `history.resumeJournal`. Not part of the public API. */
export function _resumeJournalInternal(j: Journal): void {
  const r = RESUMERS.get(j);
  if (!r) throw new Error('Journal is not resumable (already committed or cancelled)');
  r();
}

/** Options for `history.beginJournal()`. */
export interface BeginJournalOptions {
  /** Label for the single parent-history entry the journal flushes on commit. */
  label: string;
  /** Caller-supplied tag naming what this journal is scoped to — typically the
   *  id of the node being edited. The history layer only carries it; callers
   *  read it back off the journal to decide whether a suspended journal
   *  matches what they are about to edit. */
  targetId?: string;
}

/**
 * A scoped sub-history forked from a `History`, opened by
 * `history.beginJournal()`. Applies, undoes and redoes against the same
 * adapter as its parent, but keeps its entries to itself: `commit` flushes the
 * journal's net forward ops to the parent as one entry, `cancel` rewinds them
 * and contributes nothing. Use it when a self-contained editing session (a
 * text edit, a modal drag) should collapse to a single step in the parent's
 * undo stack while still offering undo *within* the session.
 *
 * A journal is active, suspended or closed. `commit` and `cancel` are
 * terminal; `suspend` lets the parent be used again and can be reversed with
 * `history.resumeJournal()`. Every mutating method throws when the journal is
 * not active.
 */
export interface Journal {
  readonly targetId: string | undefined;
  readonly forkedAtEntryId: number;

  // Same operational surface as History
  applyBatch(ops: Op[], label: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  entries(): { undo: HistoryEntry[]; redo: HistoryEntry[] };

  // Lifecycle
  commit(label: string): void;
  cancel(): void;
  suspend(): void;
  isActive(): boolean;
}

/** Internal factory used by `createHistory`'s `beginJournal` method.
 *  Not exported via the package's `index.ts` — callers go through
 *  `history.beginJournal()`. */
export function createJournalInternal(
  parent: History,
  adapter: unknown,
  opts: BeginJournalOptions,
  onClose?: () => void,
  selection?: HistorySelection,
): Journal {
  const inner = createHistory(adapter, selection ? { selection } : {});
  const forkedAtEntryId = parent.currentEntryId();
  // The whole session collapses to one parent entry, so the selection that
  // entry restores is the one the session opened under — not whatever the
  // last keystroke left.
  const selectionBefore = selection ? [...selection.get()] : undefined;
  type State = 'active' | 'suspended' | 'closed';
  let state: State = 'active';
  const targetId = opts.targetId;

  const journal: Journal = {
    targetId,
    forkedAtEntryId,

    applyBatch(ops: Op[], label: string): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.applyOps(ops, label);
    },
    undo(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.undo();
    },
    redo(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.redo();
    },
    canUndo(): boolean {
      return inner.canUndo();
    },
    canRedo(): boolean {
      return inner.canRedo();
    },
    entries() {
      return inner.entries();
    },
    commit(label: string): void {
      if (state !== 'active') throw new Error('Journal is not active');
      const netOps = inner.allForwardOps();
      if (netOps.length > 0) {
        parent.recordEntry(netOps, label, selectionBefore ? { selectionBefore } : undefined);
      }
      state = 'closed';
      RESUMERS.delete(journal);
      onClose?.();
    },
    cancel(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.goto(0);
      state = 'closed';
      RESUMERS.delete(journal);
      onClose?.();
    },
    suspend(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      state = 'suspended';
      onClose?.();
    },
    isActive(): boolean {
      return state === 'active';
    },
  };

  RESUMERS.set(journal, () => {
    if (state !== 'suspended') throw new Error('Journal is not suspended');
    state = 'active';
  });

  return journal;
}
