import { createEmitter } from '@weasel-js/registry';
import type { Op } from './op';
import { anyCaused, createApplier, entryView, foldEntry, sameCoalesceKeys, stepOf } from './entryOps';
import { createJournalInternal, _resumeJournalInternal, type Journal, type BeginJournalOptions } from './journal';
import {
  rebuilt, snapshot, touchedIdsFromOps,
  type Entry, type HistoryLogger, type SerializedHistory,
} from './serialized';
import type {
  CreateHistoryOptions, History, HistoryBranch, HistoryStep, RecordEntryOptions,
} from './historyTypes';

export { touchedIdsFromOps } from './serialized';
export type { HistoryLogger, SerializedHistory, SerializedHistoryEntry, SerializedOp } from './serialized';
export type {
  EvictedEntry, HistoryEntry, HistoryBranch, History, HistorySelection, HistoryStep, RecordEntryOptions,
  CreateHistoryOptions,
} from './historyTypes';

/** What a journal needs from a history beyond its public surface: both halves
 *  of every applied entry, and a way to record both on its parent. */
interface JournalAccess {
  appliedOps(): { forwardOps: Op[]; baseOps: Op[] };
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

/** Build an op-batched undo/redo `History`. The adapter is passed to each op's `apply`/`invert`. */
const NO_BRANCHES: readonly Entry[][] = [];

export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  let activeJournal: Journal | null = null;
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());
  const historyLimit = Math.max(0, options.historyLimit ?? Infinity);
  const onEvict = options.onEvict;
  const branching = options.branching ?? false;
  /** Futures a push set aside, by the id of the entry they fork from (the
   *  floor's for the oldest reachable state), each in time order. Only a
   *  branching history adds to it. */
  const forks = new Map<number, Entry[][]>();
  /** Names the state beneath the undo stack: 0 at the start, then the id of
   *  the last undo entry evicted. */
  let floorId = 0;
  const customRebuild = options.rebuildOp;
  const selection = options.selection;
  const logger = options.debug ?? SILENT;
  let nextEntryId = 1;
  let version = 0;
  /** `version` as of the last push or coalesce. A batch may only merge into
   *  the top entry while this still matches: every other operation bumps
   *  `version`, so undo, redo, goto, clear, restore and `recordEntry` all
   *  expire the merge window without having to remember to. Without that, an
   *  edit made after stepping back rewrites whatever entry the step left on
   *  top, and one undo then jumps past it. */
  let coalesceAnchorVersion = -1;
  const changed = createEmitter();
  const stepped = createEmitter<[HistoryStep]>();
  function bump(step?: HistoryStep | (() => HistoryStep)): void {
    version++;
    if (step && stepped.size > 0) stepped.emit(typeof step === 'function' ? step() : step);
    changed.emit();
  }

  /** Report entries that just became permanently unreachable. A throwing
   *  callback must not desync the stacks mid-mutation, so failures are
   *  contained and surfaced via the debug flag. */
  function reportEvicted(entries: Entry[]): void {
    if (!onEvict) return;
    for (const e of entries) {
      try {
        onEvict({ id: e.id, label: e.label, forwardOps: e.forwardOps, baseOps: e.baseOps });
      } catch (err) {
        logger.warn(`onEvict callback threw for entry id=${e.id} "${e.label}": ${String(err)}`);
      }
    }
  }

  /** Report `entries` evicted, and evict every branch forking from them. */
  function evict(entries: Entry[]): void {
    reportEvicted(entries);
    for (const e of entries) {
      const kept = forks.get(e.id);
      if (!kept) continue;
      forks.delete(e.id);
      for (const branch of kept) evict(branch);
    }
  }

  /** Evict `entries` off the bottom of the undo stack, oldest first. Each one
   *  raises the floor to the state it leaves: the futures forking from the old
   *  floor go with it, and the ones forking from the entry now fork from the
   *  floor. */
  function evictFloor(entries: Entry[]): void {
    for (const e of entries) evictOne(e);
  }

  function evictOne(e: Entry): void {
    if (onEvict) reportEvicted([e]);
    const stranded = forks.size > 0 ? forks.get(floorId) : undefined;
    if (stranded !== undefined) forks.delete(floorId);
    floorId = e.id;
    for (const branch of stranded ?? NO_BRANCHES) evict(branch);
  }

  /** The id of the entry the history stands on, the floor's beneath them all. */
  function forkPoint(): number {
    return undoStack[undoStack.length - 1]?.id ?? floorId;
  }

  /** Clear the redo stack after a push forking from `at`: kept as a branch
   *  when branching, else dropped and reported. */
  function retireRedo(at: number): void {
    if (redoStack.length === 0) return;
    const future = redoStack.splice(0);
    if (!branching) return evict(future);
    const kept = forks.get(at);
    if (kept) kept.push(future.reverse());
    else forks.set(at, [future.reverse()]);
  }

  /** Evict the oldest undo entries past `historyLimit`, reporting each. */
  function enforceLimit(): void {
    while (undoStack.length > historyLimit) {
      evictOne(undoStack.shift()!);
    }
  }

  const applyAllOrNothing = createApplier(adapter, logger);

  function invertEntry(entry: Entry): Op[] {
    return [...entry.baseOps].reverse().map((op) => op.invert());
  }

  /** Copy on read: the caller's array is theirs to mutate. */
  function readSelection(): readonly string[] | undefined {
    return selection ? [...selection.get()] : undefined;
  }

  /** Walk one entry backwards. The selection is restored *after* the
   *  inverted ops apply, so an entry that also carries a `setSelection`-style
   *  op can't overwrite the snapshot. */
  function stepBack(entry: Entry): void {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    applyAllOrNothing(invertEntry(entry), coalesced ? () => entry.forwardOps : undefined);
    if (leaving) entry.selectionAfter = leaving;
    if (selection && entry.selectionBefore) selection.set(entry.selectionBefore);
  }

  /** Walk one entry forwards. Mirror of `stepBack`. */
  function stepForward(entry: Entry): void {
    const leaving = readSelection();
    const coalesced = entry.forwardOps !== entry.baseOps;
    applyAllOrNothing(entry.forwardOps, coalesced ? () => invertEntry(entry) : undefined);
    if (leaving) entry.selectionBefore = leaving;
    if (selection && entry.selectionAfter) selection.set(entry.selectionAfter);
  }

  /** Step until `n` entries are on the undo stack. An entry changes stacks
   *  only once its step has run, so a throw leaves both stacks describing
   *  the state as it is. */
  function walkTo(n: number): Entry[] {
    const walked: Entry[] = [];
    while (undoStack.length > n) {
      const entry = undoStack[undoStack.length - 1]!;
      stepBack(entry);
      undoStack.pop();
      redoStack.push(entry);
      walked.push(entry);
    }
    while (undoStack.length < n && redoStack.length > 0) {
      const entry = redoStack[redoStack.length - 1]!;
      stepForward(entry);
      redoStack.pop();
      undoStack.push(entry);
      walked.push(entry);
    }
    return walked;
  }

  /** Coalesce eligibility: inside the window, and the same keys. Matched by
   *  multiset rather than position so a multi-id selection can re-emit ops in
   *  any order between batches without breaking the merge. */
  function canCoalesce(top: Entry, incoming: Op[]): boolean {
    const windowMs = typeof coalesceWindowMs === 'function' ? coalesceWindowMs() : coalesceWindowMs;
    if (!(windowMs > 0) || top.coalesceKey !== undefined || version !== coalesceAnchorVersion || now() - top.timestamp > windowMs) return false;
    return sameCoalesceKeys(top.forwardOps, incoming);
  }

  function pushOrCoalesce(applied: Op[], label: string): void {
    if (applied.length === 0) return;
    const selectionBefore = readSelection();
    const idle: Op[] = [];
    const anyMutated = applyAllOrNothing(applied, undefined, idle);
    const kept = idle.length === 0 ? applied : applied.filter((op) => !(op.elideNoop && idle.includes(op)));
    const ops = anyCaused(kept) ? kept.flatMap((op) => op.caused?.() ?? [op]) : kept.slice();
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
    const incoming = touchedIdsFromOps(ops);
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
      bump(() => ({ kind: 'coalesce', entries: [{ id: top.id, label: top.label, ops }] }));
      coalesceAnchorVersion = version;
      return;
    }
    logger.log(`push '${label}' (${ops.length} ops)`);
    const at = forkPoint();
    const entry: Entry = {
      id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now(), pushes: 1, touchedIds: incoming,
      ...(selectionBefore ? { selectionBefore } : {}),
    };
    undoStack.push(entry);
    retireRedo(at);
    enforceLimit();
    bump(() => stepOf('push', [entry]));
    coalesceAnchorVersion = version;
  }

  function fold(top: Entry, ops: Op[]): void {
    foldEntry(top, ops, now());
    bump(() => ({ kind: 'coalesce', entries: [{ id: top.id, label: top.label, ops }] }));
    coalesceAnchorVersion = version;
  }

  function record(forwardOps: Op[], baseOps: Op[], label: string, options: RecordEntryOptions = {}): void {
    if (forwardOps.length === 0) return;
    const key = options.coalesceKey;
    const top = undoStack[undoStack.length - 1];
    if (key !== undefined && top?.coalesceKey === key && version === coalesceAnchorVersion && forwardOps === baseOps) {
      return fold(top, forwardOps);
    }
    const at = forkPoint();
    const entry: Entry = {
      id: nextEntryId++, forwardOps, baseOps, label, timestamp: now(), pushes: 1,
      touchedIds: touchedIdsFromOps(forwardOps),
      ...(options.selectionBefore ? { selectionBefore: [...options.selectionBefore] } : {}),
      ...(key !== undefined ? { coalesceKey: key } : {}),
    };
    undoStack.push(entry);
    retireRedo(at);
    enforceLimit();
    bump(() => stepOf('push', [entry]));
    if (key !== undefined) coalesceAnchorVersion = version;
  }

  const history: History = {
    apply(op, label) {
      pushOrCoalesce([op], label ?? op.label ?? '');
    },
    applyOps(ops, label) {
      pushOrCoalesce(ops, label);
    },
    undo() {
      if (undoStack.length === 0) return;
      bump(stepOf('undo', walkTo(undoStack.length - 1)));
    },
    redo() {
      if (redoStack.length === 0) return;
      bump(stepOf('redo', walkTo(undoStack.length + 1)));
    },
    seal() {
      coalesceAnchorVersion = -1;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    clear: () => {
      const had = undoStack.length > 0 || redoStack.length > 0 || forks.size > 0;
      undoStack.length = 0;
      redoStack.length = 0;
      forks.clear();
      floorId = 0;
      if (had) bump(stepOf('clear'));
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
      // Total length stays constant during this walk (we only shuffle
      // entries between undo and redo stacks).
      const total = undoStack.length + redoStack.length;
      if (n < 0 || n > total || n === undoStack.length) return;
      const start = undoStack.length;
      let walked: Entry[];
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
        if (undoStack.length !== start) bump();
        throw err;
      }
      bump(stepOf('goto', walked));
    },
    timestampAt(i) {
      if (i < 0) return undefined;
      if (i < undoStack.length) return undoStack[i]!.timestamp;
      // redoStack is newest-on-top, so time order runs from its end.
      return redoStack[redoStack.length - 1 - (i - undoStack.length)]?.timestamp;
    },
    depthAt(t) {
      let n = undoStack.length;
      while (n > 0 && undoStack[n - 1]!.timestamp > t) n--;
      if (n < undoStack.length) return n;
      for (let r = redoStack.length - 1; r >= 0 && redoStack[r]!.timestamp <= t; r--) n++;
      return n;
    },
    prune(t) {
      let k = 0;
      while (k < undoStack.length && undoStack[k]!.timestamp < t) k++;
      if (k === 0) return;
      const evicted = undoStack.splice(0, k);
      evictFloor(evicted);
      bump(stepOf('prune', evicted));
    },
    branches() {
      const view = (entries: readonly Entry[], current: boolean): HistoryBranch => {
        const first = entries[0]!;
        return { id: first.id, label: first.label, timestamp: first.timestamp, length: entries.length, current };
      };
      const out = (forks.get(forkPoint()) ?? []).map((b) => view(b, false));
      if (redoStack.length > 0) out.push(view([...redoStack].reverse(), true));
      return out.sort((a, b) => a.id - b.id);
    },
    switchBranch(id) {
      if (redoStack[redoStack.length - 1]?.id === id) return;
      const at = forkPoint();
      const kept = forks.get(at) ?? [];
      const i = kept.findIndex((b) => b[0]!.id === id);
      if (i < 0) throw new Error(`No branch ${id} forks from entry ${at}`);
      const [chosen] = kept.splice(i, 1);
      if (redoStack.length > 0) kept.push(redoStack.splice(0).reverse());
      if (kept.length > 0) forks.set(at, kept);
      else forks.delete(at);
      redoStack.push(...[...chosen!].reverse());
      bump(stepOf('branch', chosen));
    },
    getVersion: () => version,
    subscribe: changed.subscribe,
    observe: stepped.subscribe,
    serialize: () => snapshot({ undoStack, redoStack, forks, floorId, nextEntryId }, logger),
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
    currentEntryId(): number {
      return nextEntryId;
    },
    beginJournal(opts: BeginJournalOptions): Journal {
      if (activeJournal !== null && activeJournal.isActive()) {
        throw new Error('A journal is already active — commit, cancel, or suspend it first');
      }
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
    resumeJournal(journal: Journal): void {
      if (activeJournal !== null && activeJournal !== journal && activeJournal.isActive()) {
        throw new Error('A journal is already active — commit, cancel, or suspend it first');
      }
      _resumeJournalInternal(journal);
      activeJournal = journal;
    },
    restore(serialized: SerializedHistory): void {
      const next = rebuilt(serialized, customRebuild, logger);
      undoStack.splice(0, undoStack.length, ...next.undoStack);
      redoStack.splice(0, redoStack.length, ...next.redoStack);
      forks.clear();
      for (const [at, kept] of next.forks) forks.set(at, kept);
      floorId = next.floorId;
      nextEntryId = next.nextEntryId;
      bump(stepOf('restore'));
    },
  };
  JOURNAL_ACCESS.set(history, {
    appliedOps: () => ({
      forwardOps: undoStack.flatMap((e) => e.forwardOps),
      baseOps: undoStack.flatMap((e) => e.baseOps),
    }),
    record,
  });
  return history;
}
