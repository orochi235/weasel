import type { Op } from 'core/ops/types';
import { createHistory, type History, type HistoryEntry } from './history';

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
  let active = true;
  const targetId = opts.targetId;

  return {
    targetId,
    forkedAtEntryId,

    applyBatch(ops: Op[], label: string): void {
      if (!active) throw new Error('Journal is closed; cannot applyBatch');
      inner.applyOps(ops, label);
    },
    undo(): void {
      if (!active) throw new Error('Journal is closed; cannot undo');
      inner.undo();
    },
    redo(): void {
      if (!active) throw new Error('Journal is closed; cannot redo');
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
      if (!active) throw new Error('Journal already closed');
      const netOps = inner.allForwardOps();
      if (netOps.length > 0) {
        parent.recordEntry(netOps, label);
      }
      active = false;
    },
    cancel(): void {
      if (!active) throw new Error('Journal already closed');
      inner.goto(0);
      active = false;
    },
    suspend(): void {
      throw new Error('Journal.suspend not yet implemented');
    },
    isActive(): boolean {
      return active;
    },
  };
}
