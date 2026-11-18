import { depthAt, timestampAt } from './stackTime';
import type { Op } from './op';
import { anyCaused, appliedHalves, createApplier, entryView, foldEntry, sameCoalesceKeys, stepOf } from './entryOps';
import { createWalk, type Walked } from './walk';
import { createVersionClock } from './versionClock';
import { createForks } from './forks';
import { createJournalInternal, _resumeJournalInternal, _resumedByOwnerInternal, _refuseWhileActiveInternal as refuseWhileActive, type Journal, type BeginJournalOptions } from './journal';
import {
  snapshot, touchedIdsOf,
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
  let activeJournal: Journal | null = null;
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());
  const historyLimit = Math.max(0, options.historyLimit ?? Infinity);
  const customRebuild = options.rebuildOp;
  const selection = options.selection;
  const logger = options.debug ?? SILENT;
  let nextEntryId = 1;
  const clock = createVersionClock();

  const forks = createForks({ undoStack, redoStack, branching: options.branching ?? false, onEvict: options.onEvict, logger });

  /** Evict the oldest undo entries past `historyLimit`, reporting each. */
  function enforceLimit(): void {
    forks.evictPast(historyLimit);
  }

  const applyAllOrNothing = createApplier(adapter, logger);

  const { walkTo, readSelection } = createWalk({
    undoStack, redoStack, selection, applyAllOrNothing, refuse: () => refuseWhileActive(activeJournal),
  });

  /** Coalesce eligibility: inside the window, which a clock set back since (a machine waking to a corrected
   *  time) is not, and the same keys. Matched by multiset rather than position so a multi-id selection can
   *  re-emit ops in any order between batches without breaking the merge. */
  function canCoalesce(top: Entry, incoming: Op[]): boolean {
    const windowMs = typeof coalesceWindowMs === 'function' ? coalesceWindowMs() : coalesceWindowMs, gap = now() - top.timestamp;
    if (!(windowMs > 0) || top.coalesceKey !== undefined || !clock.anchored() || !(gap >= 0 && gap <= windowMs)) return false;
    return sameCoalesceKeys(top.forwardOps, incoming);
  }

  function pushOrCoalesce(applied: Op[], label: string, owned = false): void {
    if (applied.length === 0) return;
    const selectionBefore = readSelection();
    const idle: Op[] = [];
    const anyMutated = applyAllOrNothing(applied, undefined, idle);
    const kept = idle.length === 0 ? applied : applied.filter((op) => !(op.elideNoop && idle.includes(op)));
    const ops = anyCaused(kept) ? kept.flatMap((op) => op.caused?.() ?? [op]) : owned || kept !== applied ? kept : kept.slice();
    if (!anyMutated) {
      // Every op reported `false`/`'noop'`. Skip the push so undo stays
      // tied to real state changes. Surfaced through the kit's debug
      // flag so the upstream caller can consider avoiding the dispatch
      // entirely. Hidden by default; enable via
      // `localStorage.setItem('weasel.debug', '1')`.
      logger.warn(
        `'${label}' batch was a no-op — every op reported false/'noop'. ` +
        `Skipping the undo entry; consider gating the dispatch upstream to avoid the wasted work.`,
      );
      return;
    }
    if (ops.length === 0) return;
    const incoming = touchedIdsOf(ops);
    const top = undoStack[undoStack.length - 1];
    if (top && canCoalesce(top, ops)) {
      top.forwardOps = ops;
      top.timestamp = now();
      top.pushes++;
      // Merge incoming touched ids into the coalesced entry's set.
      if (incoming.size > 0) {
        const merged = new Set(top.touchedIds);
        for (const id of incoming) merged.add(id);
        top.touchedIds = merged;
      }
      // baseOps + label + id intentionally preserved — undo returns to the
      // pre-edit state, the original label sticks, and the entry id stays
      // stable so React lists keyed on id don't flicker. No dropRedo() here:
      // the anchor only survives until the stack is stepped, and every step
      // clears it, so a live anchor implies an empty redo stack.
      logger.log(`coalesce '${label}' into entry id=${top.id} (${ops.length} ops)`);
      clock.bump(clock.observed() ? { kind: 'coalesce', entries: [{ id: top.id, label: top.label, ops, applied: ops }] } : undefined);
      clock.anchor();
      return;
    }
    logger.log(`push '${label}' (${ops.length} ops)`);
    const at = forks.forkPoint();
    const entry: Entry = {
      id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now(), pushes: 1, touchedIds: incoming,
      ...(selectionBefore ? { selectionBefore } : {}),
    };
    undoStack.push(entry);
    forks.retireRedo(at);
    enforceLimit();
    clock.bump(clock.observed() ? stepOf('push', [entry], [ops]) : undefined);
    clock.anchor();
  }

  function fold(top: Entry, ops: Op[]): void {
    foldEntry(top, ops, now());
    clock.bump(clock.observed() ? { kind: 'coalesce', entries: [{ id: top.id, label: top.label, ops, applied: ops }] } : undefined);
    clock.anchor();
  }

  function record(forwardOps: Op[], baseOps: Op[], label: string, options: RecordEntryOptions = {}): void {
    if (forwardOps.length === 0) return;
    const key = options.coalesceKey;
    const top = undoStack[undoStack.length - 1];
    if (key !== undefined && top?.coalesceKey === key && clock.anchored() && forwardOps === baseOps) {
      return fold(top, forwardOps);
    }
    const at = forks.forkPoint();
    const entry: Entry = {
      id: nextEntryId++, forwardOps, baseOps, label, timestamp: now(), pushes: 1,
      touchedIds: touchedIdsOf(forwardOps),
      ...(options.selectionBefore ? { selectionBefore: [...options.selectionBefore] } : {}),
      ...(key !== undefined ? { coalesceKey: key } : {}),
    };
    undoStack.push(entry);
    forks.retireRedo(at);
    enforceLimit();
    clock.bump(clock.observed() ? stepOf('push', [entry], [forwardOps]) : undefined);
    if (key !== undefined) clock.anchor();
  }

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
      const start = undoStack.length;
      let walked: Walked;
      try {
        walked = walkTo(n);
      } catch (err) {
        // Stop where the walk began rather than partway. A second throw on
        // the way back is logged: the stacks still match the state, at
        // whatever depth that walk reached.
        try {
          walkTo(start);
        } catch (back) {
          logger.warn(`goto: returning to depth ${start} threw: ${String(back)}`);
        }
        if (undoStack.length !== start) clock.bump();
        throw err;
      }
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
    serialize: () => snapshot({ undoStack, redoStack, ...forks.state(), nextEntryId }, logger),
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
    nextEntryId: () => nextEntryId,
    beginJournal(opts: BeginJournalOptions): Journal {
      refuseWhileActive(activeJournal);
      // `adapter` is the closure-captured adapter passed to createHistory.
      // The returned History object's `this` doesn't carry it, so we pass
      // it through to the factory directly.
      const j = createJournalInternal(history, adapter, opts, () => { activeJournal = null; }, {
        coalesceWindowMs, now, debug: logger,
        ...(selection ? { selection } : {}),
      });
      activeJournal = j;
      return j;
    },
    activeJournal: () => (activeJournal?.isActive() ? activeJournal : null),
    resumeJournal(journal: Journal): void {
      if (_resumedByOwnerInternal(journal, history)) return;
      refuseWhileActive(activeJournal, journal);
      _resumeJournalInternal(journal);
      activeJournal = journal;
    },
    restore(serialized: SerializedHistory, restoreOptions: RestoreOptions = {}): HistoryRestoreReport {
      const { stacks: next, unresolved } = rebuilt(serialized, customRebuild, restoreOptions, logger);
      undoStack.splice(0, undoStack.length, ...next.undoStack);
      redoStack.splice(0, redoStack.length, ...next.redoStack);
      forks.replace(next);
      nextEntryId = next.nextEntryId;
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
