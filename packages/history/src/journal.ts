import { createEmitter } from '@weasel-js/registry';
import type { Op } from './op';
import { _journalAccessInternal, createHistory, type CreateHistoryOptions, type History, type HistoryEntry, type HistoryStep, type RecordEntryOptions } from './history';

const RESUMERS = new WeakMap<Journal, () => void>();
/** A journal opened inside another, to the one it was opened in. */
const ENCLOSING = new WeakMap<Journal, Journal>();

/** Throw when a journal other than `except` is active on a history. Not part of the public API. */
export function _refuseWhileActiveInternal(active: Journal | null, except?: Journal): void {
  if (active !== null && active !== except && active.isActive()) {
    throw new Error('A journal is already active — commit, cancel, or suspend it first');
  }
}

/** A journal opened inside another, to the history that journal records into. */
const OWNER = new WeakMap<Journal, History>();

/** Resume `j` through the history it was opened on when that is not `by`, and say whether it did.
 *  Not part of the public API. */
export function _resumedByOwnerInternal(j: Journal, by: History): boolean {
  const owner = OWNER.get(j);
  if (owner === undefined || owner === by) return false;
  if (!ENCLOSING.get(j)!.isActive()) throw new Error('The journal this one was opened inside is not active');
  owner.resumeJournal(j);
  return true;
}

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
  /** Coalesce window for the journal's own entries, as
   *  `CreateHistoryOptions.coalesceWindowMs`. Defaults to the parent's. */
  coalesceWindowMs?: CreateHistoryOptions['coalesceWindowMs'];
}

/**
 * A scoped sub-history forked from a `History`, opened by
 * `history.beginJournal()`. Applies, undoes and redoes against the same
 * adapter as its parent, but keeps its entries to itself: `commit` flushes the
 * journal's applied ops to the parent as one entry, `cancel` rewinds them
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
  /** As `History.recordEntry`, for the journal's own entries: ops that have already applied. */
  recordEntry(ops: Op[], label: string, options?: RecordEntryOptions): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  entries(): { undo: readonly HistoryEntry[]; redo: readonly HistoryEntry[] };
  /** As `History.seal`, for the journal's own entries. */
  seal(): void;
  /** As `History.observe`, for the journal's own entries: each push, coalesce, undo and redo inside it. */
  observe(listener: (step: HistoryStep) => void): () => void;
  /** Open a journal inside this one, as `History.beginJournal` does on a
   *  history: its commit lands here as one entry, and its cancel leaves this
   *  journal as it was. */
  beginJournal(opts: BeginJournalOptions): Journal;
  /** Counter bumped on every change a reader of this journal could see: an
   *  apply, undo, redo or coalesce inside it, and every lifecycle transition
   *  (`isActive` changes). Pairs with `subscribe` for `useSyncExternalStore`. */
  getVersion(): number;
  /** Fires whenever `getVersion` bumps. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;

  // Lifecycle
  /** Throws while a journal opened inside this one is still active or suspended. */
  commit(label: string): void;
  /** Cancels every journal still open inside this one first, suspended ones included. */
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
  inherited: Pick<CreateHistoryOptions, 'coalesceWindowMs' | 'now' | 'debug' | 'selection'> = {},
): Journal {
  const inner = createHistory(adapter, {
    ...inherited,
    ...(opts.coalesceWindowMs !== undefined ? { coalesceWindowMs: opts.coalesceWindowMs } : {}),
  });
  const selection = inherited.selection;
  let version = 0;
  const changed = createEmitter();
  function bump(): void {
    version++;
    changed.emit();
  }
  inner.subscribe(bump);
  const forkedAtEntryId = parent.currentEntryId();
  // The whole session collapses to one parent entry, so the selection that
  // entry restores is the one the session opened under — not whatever the
  // last keystroke left.
  const selectionBefore = selection ? [...selection.get()] : undefined;
  type State = 'active' | 'suspended' | 'closed';
  let state: State = 'active';
  const targetId = opts.targetId;
  /** Journals opened inside this one; each leaves `RESUMERS` when it closes. */
  const children: Journal[] = [];
  const openChildren = (): Journal[] => children.filter((c) => RESUMERS.has(c));

  const journal: Journal = {
    targetId,
    forkedAtEntryId,

    applyBatch(ops: Op[], label: string): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.applyOps(ops, label);
    },
    recordEntry(ops: Op[], label: string, options?: RecordEntryOptions): void {
      if (state !== 'active') throw new Error('Journal is not active');
      inner.recordEntry(ops, label, options);
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
    seal(): void {
      inner.seal();
    },
    observe: (listener) => inner.observe(listener),
    beginJournal(nested: BeginJournalOptions): Journal {
      if (state !== 'active') throw new Error('Journal is not active');
      const child = inner.beginJournal(nested);
      ENCLOSING.set(child, journal);
      OWNER.set(child, inner);
      children.push(child);
      return child;
    },
    getVersion: () => version,
    subscribe: changed.subscribe,
    commit(label: string): void {
      if (state !== 'active') throw new Error('Journal is not active');
      // Its ops are applied but recorded nowhere this commit reads.
      if (openChildren().length > 0) throw new Error('A journal inside this one is still active or suspended — commit or cancel it first');
      // Coalescing splits an entry in two: the forward half is the latest
      // push, the base half the first, and undo inverts the base.
      const { forwardOps, baseOps } = _journalAccessInternal(inner).appliedOps();
      _journalAccessInternal(parent).record(
        forwardOps, baseOps, label, selectionBefore ? { selectionBefore } : undefined,
      );
      state = 'closed';
      RESUMERS.delete(journal);
      onClose?.();
      bump();
    },
    cancel(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      for (const child of openChildren().reverse()) {
        if (!child.isActive()) RESUMERS.get(child)!();
        child.cancel();
      }
      inner.goto(0);
      state = 'closed';
      RESUMERS.delete(journal);
      onClose?.();
      bump();
    },
    suspend(): void {
      if (state !== 'active') throw new Error('Journal is not active');
      state = 'suspended';
      onClose?.();
      bump();
    },
    isActive(): boolean {
      return state === 'active';
    },
  };

  RESUMERS.set(journal, () => {
    if (state !== 'suspended') throw new Error('Journal is not suspended');
    state = 'active';
    bump();
  });

  return journal;
}
