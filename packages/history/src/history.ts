import { depthAt, timestampAt } from './stackTime';
import type { Op } from './op';
import { appliedHalves, createApplier, entryView, stepOf } from './entryOps';
import { createWalk } from './walk';
import { createVersionClock } from './versionClock';
import { createForks } from './forks';
import { createRecorder } from './recording';
import { createJournalSlot } from './journalSlot';
import {
  snapshot,
  type Entry, type HistoryLogger, type SerializedHistory,
} from './serialized';
import { rebuilt, type HistoryRestoreReport, type RestoreOptions } from './restore';
import type { CreateHistoryOptions, History, RecordEntryOptions } from './historyTypes';

export { touchedIdsOf } from './serialized';
export type { HistoryLogger, SerializedHistory, SerializedHistoryEntry, SerializedOp } from './serialized';
export { HistoryRestoreError } from './restore';
export type {
  HistoryRecovery, HistoryRestoreReport, RebuildContext, RebuildOp, RestoreOptions, UnresolvableOp, UnresolvedOp,
} from './restore';
export type {
  EvictedEntry, HistoryEntry, HistoryBranch, History, HistorySelection, HistoryStep, RecordEntryOptions,
  CreateHistoryOptions,
} from './historyTypes';

/** What a journal needs from a history beyond its public surface: both halves
 *  of every applied entry, and a way to record both on its parent. */
interface JournalAccess {
  appliedOps(): ReturnType<typeof appliedHalves>;
  record(forwardOps: Op[], baseOps: Op[], label: string, options?: RecordEntryOptions): void;
}

const JOURNAL_ACCESS = new WeakMap<History, JournalAccess>();

/** Called by `Journal.commit`. Not part of the public API. */
export function _journalAccessInternal(history: History): JournalAccess {
  const access = JOURNAL_ACCESS.get(history);
  if (!access) throw new Error('Not a history built by createHistory');
  return access;
}

/** Silent default — keeps every call site unconditional. */
const SILENT: HistoryLogger = { log: () => {}, warn: () => {} };

/** `n`, once it is a depth `goto` can walk to on a history of `total` entries. */
function gotoDepth(n: number, total: number): number {
  if (Number.isInteger(n) && n >= 0 && n <= total) return n;
  throw new RangeError(`goto: depth ${n} is not a whole number from 0 to ${total}`);
}

/** Build an op-batched undo/redo `History`. The adapter is passed to each op's `apply`/`invert`. */
export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());
  const historyLimit = Math.max(0, options.historyLimit ?? Infinity);
  const customRebuild = options.rebuildOp;
  const selection = options.selection;
  const logger = options.debug ?? SILENT;
  const clock = createVersionClock();
  const journals = createJournalSlot(adapter, {
    coalesceWindowMs, now, debug: logger,
    ...(selection ? { selection } : {}),
  });

  const forks = createForks({ undoStack, redoStack, branching: options.branching ?? false, onEvict: options.onEvict, logger });

  const applyAllOrNothing = createApplier(adapter, logger);

  const { walkTo, walkOrReturn, readSelection } = createWalk({
    undoStack, redoStack, selection, applyAllOrNothing, refuse: journals.refuse, logger,
  });

  const recorder = createRecorder({
    undoStack, forks, clock, applyAllOrNothing, readSelection, now, coalesceWindowMs, historyLimit, logger,
  });
  const { pushOrCoalesce, record } = recorder;

  const history: History = {
    apply(op, label) {
      pushOrCoalesce([op], label ?? op.label ?? '', true);
    },
    applyOps(ops, label) {
      pushOrCoalesce(ops, label);
    },
    undo() {
      if (undoStack.length === 0) return;
      const { walked, applied } = walkTo(undoStack.length - 1);
      clock.bump(stepOf('undo', walked, applied));
    },
    redo() {
      if (redoStack.length === 0) return;
      const { walked, applied } = walkTo(undoStack.length + 1);
      clock.bump(stepOf('redo', walked, applied));
    },
    seal() {
      clock.seal();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    clear: () => {
      const had = undoStack.length > 0 || redoStack.length > 0;
      undoStack.length = 0;
      redoStack.length = 0;
      if (forks.reset() || had) clock.bump(stepOf('clear'));
    },
    entries() {
      // redoStack is internally stored newest-on-top (so `pop()` redoes the
      // next-most-recent undo). Reverse on the way out so callers see the
      // entries in chronological order — the user's next redo is the first
      // element, matching `entries().redo[0]` semantics.
      return {
        undo: undoStack.map(entryView),
        redo: [...redoStack].reverse().map(entryView),
      };
    },
    goto(n) {
      // Total length stays constant during this walk: entries only move between the two stacks.
      if (gotoDepth(n, undoStack.length + redoStack.length) === undoStack.length) return;
      const walked = walkOrReturn(n, () => clock.bump());
      clock.bump(stepOf('goto', walked.walked, walked.applied));
    },
    timestampAt: (i) => timestampAt(undoStack, redoStack, i),
    depthAt: (t) => depthAt(undoStack, redoStack, t),
    prune(t) {
      const evicted = forks.evictBefore(t);
      if (evicted.length > 0) clock.bump(stepOf('prune', evicted));
    },
    branches: forks.branches,
    dropRedo() {
      if (redoStack.length === 0) return;
      const dropped = [...redoStack].reverse();
      forks.retireRedo(forks.forkPoint());
      clock.bump(stepOf('drop', dropped));
    },
    switchBranch(id) {
      const chosen = forks.switchTo(id);
      if (chosen) clock.bump(stepOf('branch', chosen));
    },
    getVersion: clock.current,
    subscribe: clock.subscribe,
    observe: clock.observe,
    serialize: () => snapshot({ undoStack, redoStack, ...forks.state(), nextEntryId: recorder.nextEntryId() }, logger),
    recordEntry(ops: Op[], label: string, options?: RecordEntryOptions): void {
      record(ops, ops, label, options);
    },
    allForwardOps(): Op[] {
      const out: Op[] = [];
      for (const e of undoStack) {
        for (const op of e.forwardOps) out.push(op);
      }
      return out;
    },
    nextEntryId: recorder.nextEntryId,
    beginJournal: (opts) => journals.begin(history, opts),
    activeJournal: journals.active,
    resumeJournal: (journal) => journals.resume(history, journal),
    restore(serialized: SerializedHistory, restoreOptions: RestoreOptions = {}): HistoryRestoreReport {
      const { stacks: next, unresolved } = rebuilt(serialized, customRebuild, restoreOptions, logger);
      undoStack.splice(0, undoStack.length, ...next.undoStack);
      redoStack.splice(0, redoStack.length, ...next.redoStack);
      forks.replace(next);
      recorder.resumeIdsAt(next.nextEntryId);
      clock.bump(stepOf('restore'));
      return { restored: true, unresolved };
    },
  };
  JOURNAL_ACCESS.set(history, {
    appliedOps: () => appliedHalves(undoStack),
    record,
  });
  return history;
}
