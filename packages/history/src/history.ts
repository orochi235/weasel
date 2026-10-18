import { createEmitter } from '@weasel-js/registry';
import type { Op } from './op';
import { createJournalInternal, _resumeJournalInternal, type Journal, type BeginJournalOptions } from './journal';
import {
  rebuilt, snapshot, touchedIdsFromOps,
  type Entry, type HistoryLogger, type SerializedHistory,
} from './serialized';

export { touchedIdsFromOps } from './serialized';
export type { HistoryLogger, SerializedHistory, SerializedHistoryEntry, SerializedOp } from './serialized';

/** Snapshot of an entry handed to `onEvict` when it permanently leaves the
 *  reachable stacks. Ops are live references — read `name`/`args`, don't
 *  mutate. */
export interface EvictedEntry {
  id: number;
  label: string;
  forwardOps: readonly Op[];
  baseOps: readonly Op[];
}

/** Read-only view of a history entry exposed via `History.entries()`. */
export interface HistoryEntry {
  /** Stable monotonic id (preserved across coalesce merges). */
  id: number;
  /** Human-readable label (the `label` arg passed to `applyOps`). */
  label: string;
  /** Push/last-coalesce timestamp (ms). */
  timestamp: number;
  /** How many pushes this entry holds: 1 when it was pushed once, plus one
   *  for every later push coalesced into it. */
  pushes: number;
  /** Set of node ids touched by any op in this entry. Populated from ops
   *  whose `args` carry an `id` field (transform, setPath, reparent) or a
   *  `node.id` field (insert, delete). Ops without a recognisable id field
   *  contribute nothing. May be `undefined` for deserialized entries
   *  restored from an older snapshot that predates this field. */
  touchedIds?: ReadonlySet<string>;
  /** Selection restored when this entry is undone. */
  selectionBefore?: readonly string[];
  /** Selection restored when this entry is redone. */
  selectionAfter?: readonly string[];
}

/** One future at the current entry, as `History.branches()` lists it. */
export interface HistoryBranch {
  /** The id of the branch's first entry; what `switchBranch` takes. */
  id: number;
  /** The first entry's label and timestamp. */
  label: string;
  timestamp: number;
  /** How many entries run along it from here, nested branches not counted. */
  length: number;
  /** Whether `redo()` would follow it. */
  current: boolean;
}

/** Op-batched undo/redo controller returned by `createHistory`. */
export interface History {
  apply(op: Op, label?: string): void;
  applyOps(ops: Op[], label: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Number of entries on the undo stack (O(1); `entries().undo.length`
   *  without materializing the views). */
  undoDepth(): number;
  /** Number of entries on the redo stack (O(1)). */
  redoDepth(): number;
  clear(): void;
  /** Snapshot of the current undo + redo stacks. `undo` is oldest→newest
   *  (i.e. the last element is what `undo()` would pop next); `redo` is
   *  also oldest→newest from the user's perspective (i.e. the *first*
   *  element is what `redo()` would pop next — see implementation note).
   *  Freshly built on each call, and readonly so that stays true. */
  entries(): { undo: readonly HistoryEntry[]; redo: readonly HistoryEntry[] };
  /** Walk the history forward/back until exactly `n` entries are on the
   *  undo stack (0 ≤ n ≤ entries().undo.length + entries().redo.length).
   *  Equivalent to repeated `undo()`/`redo()` calls but doesn't bother
   *  rebuilding entry snapshots between steps. No-op if already at `n`.
   *  When a step throws, as with `undo` and `redo`, the ops it ran are
   *  inverted and the history stays where the call found it. */
  goto(n: number): void;
  /** The `timestamp` of entry `i`, counting in time order through the undo
   *  stack and on into the redo stack, so `timestampAt(undoDepth())` is the
   *  next redo's. `undefined` outside the entries. Allocates nothing. */
  timestampAt(i: number): number | undefined;
  /** The undo depth at which every entry stamped at or before `t` is applied
   *  and none after it: `goto(depthAt(t))` seeks the history to `t`, either
   *  way. Assumes stamps never decrease in time order, which holds while
   *  `now()` does not run backward between pushes. */
  depthAt(t: number): number;
  /** Evict the oldest undo entries stamped before `t`, reporting each through
   *  `onEvict` — retention by age, beside `historyLimit`'s by count. Redo
   *  entries are never pruned: they are a future still reachable. */
  prune(t: number): void;
  /** The futures that fork from the current entry, oldest first: the redo
   *  stack, marked `current`, and any a branching history kept. Empty when
   *  there is nothing to redo and nothing was kept. */
  branches(): readonly HistoryBranch[];
  /** Make the branch `id` the redo future, keeping the one it replaces. Applies
   *  nothing — both start from where the history stands. Throws when no branch
   *  of that id forks from the current entry. */
  switchBranch(id: number): void;
  /** Monotonic counter bumped on every push/undo/redo/clear/coalesce.
   *  Cheap to read; callers use it as a React dep to detect changes. */
  getVersion(): number;
  /** End the current coalescing run: the next entry is pushed fresh even if
   *  its keys match the top entry and it lands inside the window. For a
   *  caller that changed state the stack does not know about, so an entry
   *  coalesced across that change would undo past it. */
  seal(): void;
  /** Subscribe to history changes. Fires after every push/undo/redo/
   *  clear/coalesce. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  /** Snapshot the undo + redo stacks as `(name, args)` pairs — see
   *  `SerializedHistory` for what that takes to store. An entry with an op
   *  missing a `name` can't round-trip, and neither can anything that is only
   *  reached by stepping across it: the snapshot keeps the undo entries newer
   *  than the last such entry, the redo entries nearer than the first, and
   *  the branches forking from an entry it kept. The rest is counted in
   *  `droppedEntries`. The in-memory stacks aren't modified. */
  serialize(): SerializedHistory;
  /** Replace the current undo + redo stacks with the deserialized contents
   *  of `snapshot`. Ops are rebuilt via the `rebuildOp` option when
   *  provided, then the global registry; unknown names become no-op
   *  placeholders so stack ordering survives across kit-version skew.
   *  Bumps `version` and notifies subscribers exactly once. */
  restore(snapshot: SerializedHistory): void;
  /** Push an entry whose ops have already been applied to the adapter.
   *  Unlike `applyOps`, does NOT call `op.apply()`. Used by Journal.commit
   *  to flush a session's net forward ops to the parent as one entry without
   *  re-mutating the scene. */
  recordEntry(ops: Op[], label: string, options?: RecordEntryOptions): void;
  /** Concatenated forwardOps of every undo-stack entry, in order. Snapshot
   *  of "what changes are currently applied via this history" — useful for
   *  Journal.commit to flush to a parent, and for any caller that wants to
   *  diff against a baseline. */
  allForwardOps(): Op[];
  /** The id that will be assigned to the *next* pushed entry. Stable
   *  monotonic counter; callers use it to tag a fork point (see Journal). */
  currentEntryId(): number;
  /** Open a scoped sub-history. All apply/undo/redo on the returned Journal
   *  affect the same adapter; on commit, the Journal's net forward ops are
   *  flushed to this History as one entry. */
  beginJournal(opts: BeginJournalOptions): Journal;
  /** Re-activate a suspended journal. Throws if the journal was committed or
   *  cancelled (those are terminal), or if a different journal is currently
   *  active — at most one journal writes to the adapter at a time, on resume
   *  as well as on open. Staleness checking is the caller's
   *  responsibility — consult `journal.forkedAtEntryId` against
   *  `currentEntryId()` and your own op-semantic rules to decide whether
   *  to resume or discard before calling this. */
  resumeJournal(journal: Journal): void;
}

/** Read/write access to whatever holds the caller's selection. The engine
 *  stores the ids it is handed and hands them back on the way past; it
 *  attaches no meaning to them and never records a selection change as an
 *  entry of its own. */
export interface HistorySelection {
  get(): readonly string[];
  set(ids: readonly string[]): void;
}

/** Options for `recordEntry`. */
export interface RecordEntryOptions {
  /** Selection as of before the already-applied ops ran. `recordEntry` is
   *  called after the fact, so the live selection has moved on by then and
   *  the engine cannot sample it — a caller that wants undo to restore the
   *  selection captures it when the batch opens and passes it here. */
  selectionBefore?: readonly string[];
}

/** Options for `createHistory`. */
export interface CreateHistoryOptions {
  /** Window (ms) within which a new entry may merge into the previous one
   *  via matching `Op.coalesceKey`. Defaults to `0` (no coalescing — every
   *  `applyOps` pushes a discrete entry). Recommended: ~500ms for typical
   *  rapid-input UX (nudge, per-keystroke text edits). The window resets on
   *  each successful coalesce, so a sustained burst keeps merging, and closes
   *  on any other history operation — only the entry the last push created is
   *  ever a merge target. A function is called at each push, so the window
   *  can follow a setting that changes after the history is made. */
  coalesceWindowMs?: number | (() => number);
  /** Clock injection point for tests. Defaults to `Date.now`. */
  now?: () => number;
  /** Where the caller's selection lives. Supplied, each entry records the
   *  selection around it and undo / redo / goto restore it; omitted, the
   *  engine never reads or writes selection at all. */
  selection?: HistorySelection;
  /** Maximum undo-stack depth. When a push overflows the cap the oldest
   *  entry is evicted (reported via `onEvict`) and can no longer be undone.
   *  `0` disables the undo stack entirely — every push is evicted
   *  synchronously (negative values are clamped to `0`). Default: unbounded. */
  historyLimit?: number;
  /** Fired once per entry that permanently leaves the reachable stacks:
   *  redo entries dropped by a branch edit (a new push or `recordEntry`
   *  after undo) and undo entries evicted by `historyLimit`.
   *  NOT fired by `clear()` or `restore()` — those wholesale-replace the
   *  history and the caller already knows. Note `restore()` does not enforce
   *  `historyLimit` either: a restored snapshot may exceed the cap, which
   *  re-applies (evicting via `onEvict`) on the next push. */
  onEvict?: (entry: EvictedEntry) => void;
  /** Keep the redo future when a push is made while there is one, as a branch
   *  `branches()` lists and `switchBranch` returns to, instead of dropping it.
   *  Undo and redo still walk one line, the current branch. An entry evicted by
   *  `historyLimit` or `prune` takes along the branches forking from the state
   *  before it, which nothing can return to; the ones forking from the state
   *  it leaves stay, at the bottom of the undo stack. Default `false`. */
  branching?: boolean;
  /** Custom op rebuilder consulted by `restore()` before the global
   *  op-factory registry. Return `null` to fall through (global registry,
   *  then a no-op placeholder). Lets an owner rebuild ops whose handlers
   *  live in per-instance state the global registry can't reach (e.g. a
   *  Scene's registered op kinds).
   *
   *  May be invoked more than once per entry with the same `(name, args)` —
   *  once per op for `forwardOps` and again for `baseOps` (the same array
   *  until a coalesce splits them). Unlike `onEvict`, a throwing hook is
   *  NOT caught: it aborts `restore()` mid-rebuild and can leave the
   *  stacks partially rebuilt. */
  rebuildOp?: (name: string, args: unknown) => Op | null;
  /** Diagnostics sink. Omitted, the engine is silent — it deliberately owns no
   *  logging utility, so that this package depends on nothing. `@weasel-js/core`'s
   *  `createHistory` wrapper routes these into its `debug/flag` namespace, which
   *  is what makes `DEBUG=history` work for kit consumers. */
  debug?: HistoryLogger;
}

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
  function bump(): void {
    version++;
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
    for (const e of entries) {
      reportEvicted([e]);
      const stranded = forks.get(floorId);
      forks.delete(floorId);
      floorId = e.id;
      for (const branch of stranded ?? []) evict(branch);
    }
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
      evictFloor([undoStack.shift()!]);
    }
  }

  /** Apply `ops` best-effort while unwinding a failed step: the throw being
   *  unwound is the one the caller sees, so a second one is only logged. */
  function applyUnwinding(ops: Op[]): void {
    for (const op of ops) {
      try {
        op.apply(adapter);
      } catch (err) {
        logger.warn(`unwinding a failed step: op "${op.name ?? '?'}" threw: ${String(err)}`);
      }
    }
  }

  /** Apply every op or none: when one throws, the ops that ran before it are
   *  inverted, newest first, then `settle` is applied, and the throw
   *  propagates. Returns true iff at least one op did NOT explicitly return
   *  `false` / `'noop'` — `pushOrCoalesce` skips the entry when every op in
   *  the batch was a silent no-op (e.g. reorder where the order already
   *  matched). Ops returning `undefined`/`void` count as "mutated".
   *
   *  `settle` is for a coalesced entry, whose two halves are not each
   *  other's inverse: inverting what ran lands on the other half's far side,
   *  and re-applying that half is what returns to where the step began. */
  function applyAllOrNothing(ops: Op[], settle?: () => Op[], idle?: Set<Op>): boolean {
    let anyMutated = false;
    let done = 0;
    try {
      for (; done < ops.length; done++) {
        const r = ops[done]!.apply(adapter);
        if (r !== false && r !== 'noop') anyMutated = true;
        else idle?.add(ops[done]!);
      }
    } catch (err) {
      if (done > 0) {
        applyUnwinding(ops.slice(0, done).reverse().map((op) => op.invert()));
        if (settle) applyUnwinding(settle());
      }
      throw err;
    }
    return anyMutated;
  }

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
  function walkTo(n: number): void {
    while (undoStack.length > n) {
      const entry = undoStack[undoStack.length - 1]!;
      stepBack(entry);
      undoStack.pop();
      redoStack.push(entry);
    }
    while (undoStack.length < n && redoStack.length > 0) {
      const entry = redoStack[redoStack.length - 1]!;
      stepForward(entry);
      redoStack.pop();
      undoStack.push(entry);
    }
  }

  /** Coalesce eligibility: every op on both sides has a `coalesceKey`, and
   *  the multisets of keys match (order-independent). Match by multiset
   *  rather than positional index so a multi-id selection can re-emit ops in
   *  any order between batches without breaking the merge. */
  function canCoalesce(top: Entry, incoming: Op[]): boolean {
    const windowMs = typeof coalesceWindowMs === 'function' ? coalesceWindowMs() : coalesceWindowMs;
    if (!(windowMs > 0) || version !== coalesceAnchorVersion || now() - top.timestamp > windowMs) return false;
    if (top.forwardOps.length === 0 || incoming.length === 0) return false;
    if (top.forwardOps.length !== incoming.length) return false;
    const counts = new Map<string, number>();
    for (const op of top.forwardOps) {
      const k = op.coalesceKey;
      if (k === undefined) return false;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const op of incoming) {
      const k = op.coalesceKey;
      if (k === undefined) return false;
      const c = counts.get(k);
      if (!c) return false;
      counts.set(k, c - 1);
    }
    return true;
  }

  function pushOrCoalesce(applied: Op[], label: string): void {
    if (applied.length === 0) return;
    const selectionBefore = readSelection();
    const idle = new Set<Op>();
    const anyMutated = applyAllOrNothing(applied, undefined, idle);
    const ops = (idle.size === 0 ? applied : applied.filter((op) => !(op.elideNoop && idle.has(op))))
      .flatMap((op) => op.caused?.() ?? [op]);
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
      bump();
      coalesceAnchorVersion = version;
      return;
    }
    logger.log(`push '${label}' (${ops.length} ops)`);
    const at = forkPoint();
    undoStack.push({
      id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now(), pushes: 1, touchedIds: incoming,
      ...(selectionBefore ? { selectionBefore } : {}),
    });
    retireRedo(at);
    enforceLimit();
    bump();
    coalesceAnchorVersion = version;
  }

  function record(forwardOps: Op[], baseOps: Op[], label: string, options: RecordEntryOptions = {}): void {
    if (forwardOps.length === 0) return;
    const at = forkPoint();
    undoStack.push({
      id: nextEntryId++, forwardOps, baseOps, label, timestamp: now(), pushes: 1,
      touchedIds: touchedIdsFromOps(forwardOps),
      ...(options.selectionBefore ? { selectionBefore: [...options.selectionBefore] } : {}),
    });
    retireRedo(at);
    enforceLimit();
    bump();
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
      walkTo(undoStack.length - 1);
      bump();
    },
    redo() {
      if (redoStack.length === 0) return;
      walkTo(undoStack.length + 1);
      bump();
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
      if (had) bump();
    },
    entries() {
      const toView = (e: Entry): HistoryEntry => ({
        id: e.id, label: e.label, timestamp: e.timestamp, pushes: e.pushes, touchedIds: e.touchedIds,
        ...(e.selectionBefore ? { selectionBefore: e.selectionBefore } : {}),
        ...(e.selectionAfter ? { selectionAfter: e.selectionAfter } : {}),
      });
      // redoStack is internally stored newest-on-top (so `pop()` redoes the
      // next-most-recent undo). Reverse on the way out so callers see the
      // entries in chronological order — the user's next redo is the first
      // element, matching `entries().redo[0]` semantics.
      return {
        undo: undoStack.map(toView),
        redo: [...redoStack].reverse().map(toView),
      };
    },
    goto(n) {
      // Total length stays constant during this walk (we only shuffle
      // entries between undo and redo stacks).
      const total = undoStack.length + redoStack.length;
      if (n < 0 || n > total || n === undoStack.length) return;
      const start = undoStack.length;
      try {
        walkTo(n);
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
      bump();
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
      evictFloor(undoStack.splice(0, k));
      bump();
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
      bump();
    },
    getVersion: () => version,
    subscribe: changed.subscribe,
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
      bump();
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
