import type { Op } from './op';
import { appliedHalves, createApplier, recordedOps, stepOf } from './entryOps';
import { createStackView } from './stackView';
import { createWalk } from './walk';
import { createVersionClock } from './versionClock';
import { createForks } from './forks';
import { createRecorder } from './recording';
import { createJournalSlot } from './journalSlot';
import {
  snapshot,
  type Entry, type HistoryLogger, type SerializedHistory,
} from './serialized';
import { HistoryRestoreError, rebuilt, type HistoryRestoreReport, type RebuildOp, type RestoreOptions } from './restore';
import { snapshotFault } from './snapshotShape';
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
  /** Undo down to `depth` entries when deeper, past a journal still open on this history. */
  rewind(depth: number): void;
}

const JOURNAL_ACCESS = new WeakMap<History, JournalAccess>();

/** Called by `Journal.commit`. Not part of the public API. */
export function _journalAccessInternal(history: History): JournalAccess {
  const access = JOURNAL_ACCESS.get(history);
  if (!access) throw new Error('Not a history built by createHistory');
  return access;
}

/** One list as both halves of an entry nothing coalesced into. */
const twice = (ops: Op[]): [Op[], Op[]] => [ops, ops];

/** Silent default — keeps every call site unconditional. */
const SILENT: HistoryLogger = { log: () => {}, warn: () => {} };

/** `n`, once it is a depth `goto` can walk to on a history of `total` entries. */
function gotoDepth(n: number, total: number): number {
  if (Number.isInteger(n) && n >= 0 && n <= total) return n;
  throw new RangeError(`goto: depth ${n} is not a whole number from 0 to ${total}`);
}

/** The undo-stack cap `historyLimit` asks for: unbounded when omitted, a negative one clamped to 0. */
function limitOf(limit: number | undefined): number {
  if (Number.isNaN(limit)) throw new RangeError('createHistory: historyLimit is NaN');
  return Math.max(0, limit ?? Infinity);
}

/** Build an op-batched undo/redo `History`. The adapter is passed to each op's `apply`/`invert`. */
export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());
  const historyLimit = limitOf(options.historyLimit);
  const customRebuild = options.rebuildOp;
  const selection = options.selection;
  const logger = options.debug ?? SILENT;
  const clock = createVersionClock();
  const journals = createJournalSlot(adapter, {
    coalesceWindowMs, now, debug: logger,
    ...(selection ? { selection } : {}),
  }, clock.seal);

  const forks = createForks({ undoStack, redoStack, branching: options.branching ?? false, onEvict: options.onEvict, logger });

  const applyAllOrNothing = createApplier(adapter, logger);

  const { walkTo, walkOrReturn, reported, readSelection } = createWalk({
    undoStack, redoStack, selection, applyAllOrNothing, logger, report: clock.bump,
  });

  const recorder = createRecorder({
    undoStack, forks, clock, applyAllOrNothing, readSelection, now, coalesceWindowMs, historyLimit, logger,
  });
  const { pushOrCoalesce, record } = recorder;

  const history: History = {
    ...createStackView(undoStack, redoStack),
    apply(op, label) {
      journals.refuse();
      pushOrCoalesce([op], label ?? op.label ?? '', true);
    },
    applyOps(ops, label) {
      journals.refuse();
      pushOrCoalesce(ops, label);
    },
    undo() {
      journals.refuse();
      if (undoStack.length > 0) reported('undo', (into) => walkTo(undoStack.length - 1, into));
    },
    redo() {
      journals.refuse();
      if (redoStack.length > 0) reported('redo', (into) => walkTo(undoStack.length + 1, into));
    },
    seal() {
      clock.seal();
    },
    clear: () => {
      const had = undoStack.length > 0 || redoStack.length > 0;
      undoStack.length = 0;
      redoStack.length = 0;
      if (forks.reset() || had) clock.bump(stepOf('clear'));
    },
    goto(n) {
      // Total length stays constant during this walk: entries only move between the two stacks.
      const depth = gotoDepth(n, undoStack.length + redoStack.length);
      journals.refuse();
      if (depth === undoStack.length) return;
      reported('goto', (into) => walkOrReturn(n, into));
    },
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
      journals.refuse();
      record(...twice(recordedOps(ops, [], false)), label, options);
    },
    nextEntryId: recorder.nextEntryId,
    beginJournal: (opts) => journals.begin(history, opts),
    activeJournal: journals.active,
    resumeJournal: (journal) => journals.resume(history, journal),
    restore(serialized: SerializedHistory, restoreOptions: RestoreOptions = {}): HistoryRestoreReport {
      journals.refuse();
      const fault = snapshotFault(serialized);
      if (fault) {
        const report = { restored: false, unresolved: [] };
        const message = `History.restore: malformed snapshot: ${fault}`;
        if ((restoreOptions.recovery ?? 'strict') === 'strict') throw new HistoryRestoreError(report, message);
        logger.warn(`${message} — dropped`);
        return report;
      }
      const first = restoreOptions.rebuildOp;
      const rebuild: RebuildOp | undefined = first
        ? (name, args, context) => first(name, args, context) ?? customRebuild?.(name, args, context) ?? null
        : customRebuild;
      const { stacks: next, unresolved } = rebuilt(serialized, rebuild, restoreOptions, logger);
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
    rewind: (depth) => depth < undoStack.length && reported('goto', (into) => walkOrReturn(depth, into)),
  });
  return history;
}
