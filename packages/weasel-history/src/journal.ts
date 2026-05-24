import type { Op } from 'core/ops/types';
import { createHistory, type History, type HistoryEntry } from './history';

const RESUMERS = new WeakMap<Journal, () => void>();

/** Called by `history.resumeJournal`. Not part of the public API. */
export function _resumeJournalInternal(j: Journal): void {
  const r = RESUMERS.get(j);
  if (!r) throw new Error('Journal is not resumable (already committed or cancelled)');
  r();
}

export interface BeginJournalOptions {
  label: string;
  targetId?: string;
}

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
): Journal {
  const inner = createHistory(adapter);
  const forkedAtEntryId = parent.currentEntryId();
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
      if (state === 'closed') throw new Error('Journal already closed');
      const netOps = inner.allForwardOps();
      if (netOps.length > 0) {
        parent.recordEntry(netOps, label);
      }
      state = 'closed';
      RESUMERS.delete(journal);
    },
    cancel(): void {
      if (state === 'closed') throw new Error('Journal already closed');
      inner.goto(0);
      state = 'closed';
      RESUMERS.delete(journal);
    },
    suspend(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      state = 'suspended';
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
