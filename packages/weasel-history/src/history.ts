import type { Op } from 'core/ops/types';
import { rebuildOp } from 'core/ops/registry';
import { dwarn, dlog } from 'debug/flag';
import { createJournalInternal, _resumeJournalInternal, type Journal, type BeginJournalOptions } from './journal';

interface Entry {
  /** Monotonic id assigned at first push. Stable across coalesce merges
   *  (a merged entry keeps the original id) so UI lists keyed on `id` don't
   *  flicker when the underlying entry mutates. */
  id: number;
  /** Forward ops — applied on redo, reflect the latest to-state after any
   *  coalescing. Diverges from `baseOps` only after a coalesce. */
  forwardOps: Op[];
  /** Original ops at first push — their `.invert()` is what undo replays.
   *  Preserved across coalesces so undo always returns to the original
   *  pre-edit state, no matter how many coalesces happened. */
  baseOps: Op[];
  label: string;
  /** ms timestamp at last push or coalesce; used to gate the coalesce window. */
  timestamp: number;
}

/** Wire form of a single op inside a serialized history. The pair
 *  `(name, args)` reconstructs a live `Op` via the op-factory registry. */
export interface SerializedOp {
  name: string;
  args: unknown;
}

/** Wire form of one history entry. `forwardOps` / `baseOps` mirror the
 *  in-memory entry's fields (see `Entry` above) but only carry the
 *  serializable `(name, args)` projection of each op. */
export interface SerializedHistoryEntry {
  id: number;
  label: string;
  forwardOps: SerializedOp[];
  baseOps: SerializedOp[];
}

/** Snapshot of an entire `History` instance. Designed to live alongside the
 *  scene snapshot in IDB so a reload restores the undo / redo stacks to
 *  exactly where they were. */
export interface SerializedHistory {
  version: 1;
  undoStack: SerializedHistoryEntry[];
  /** Stored newest-first, mirroring the in-memory stack so a deserialized
   *  history matches the original's `entries().redo` ordering. */
  redoStack: SerializedHistoryEntry[];
  nextEntryId: number;
}

/** Read-only view of a history entry exposed via `History.entries()`. */
export interface HistoryEntry {
  /** Stable monotonic id (preserved across coalesce merges). */
  id: number;
  /** Human-readable label (the `label` arg passed to `applyOps`). */
  label: string;
  /** Push/last-coalesce timestamp (ms). */
  timestamp: number;
}

/** Op-batched undo/redo controller returned by `createHistory`. */
export interface History {
  apply(op: Op, label?: string): void;
  applyOps(ops: Op[], label: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  /** Snapshot of the current undo + redo stacks. `undo` is oldest→newest
   *  (i.e. the last element is what `undo()` would pop next); `redo` is
   *  also oldest→newest from the user's perspective (i.e. the *first*
   *  element is what `redo()` would pop next — see implementation note).
   *  Callers should treat the arrays as immutable. */
  entries(): { undo: HistoryEntry[]; redo: HistoryEntry[] };
  /** Walk the history forward/back until exactly `n` entries are on the
   *  undo stack (0 ≤ n ≤ entries().undo.length + entries().redo.length).
   *  Equivalent to repeated `undo()`/`redo()` calls but doesn't bother
   *  rebuilding entry snapshots between steps. No-op if already at `n`. */
  goto(n: number): void;
  /** Monotonic counter bumped on every push/undo/redo/clear/coalesce.
   *  Cheap to read; callers use it as a React dep to detect changes. */
  getVersion(): number;
  /** Subscribe to history changes. Fires after every push/undo/redo/
   *  clear/coalesce. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
  /** Snapshot the undo + redo stacks in a structured-clone-safe form.
   *  Entries whose ops aren't all kit-registered (i.e. any op missing a
   *  `name`) are dropped from the snapshot with a debug-level log — they
   *  can't round-trip, so we omit them rather than emit a half-restorable
   *  entry. The in-memory stacks aren't modified. */
  serialize(): SerializedHistory;
  /** Replace the current undo + redo stacks with the deserialized contents
   *  of `snapshot`. Ops are rebuilt via `rebuildOp`; unknown names become
   *  no-op placeholders so stack ordering survives across kit-version
   *  skew. Bumps `version` and notifies subscribers exactly once. */
  restore(snapshot: SerializedHistory): void;
  /** Push an entry whose ops have already been applied to the adapter.
   *  Unlike `applyOps`, does NOT call `op.apply()`. Used by Journal.commit
   *  to flush a session's net forward ops to the parent as one entry without
   *  re-mutating the scene. */
  recordEntry(ops: Op[], label: string): void;
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
   *  flushed to this History as one entry. See spec docs/superpowers/specs/
   *  2026-05-24-modality-design.md for the full lifecycle. */
  beginJournal(opts: BeginJournalOptions): Journal;
  /** Re-activate a suspended journal. Throws if the journal was committed or
   *  cancelled (those are terminal). Staleness checking is the caller's
   *  responsibility — consult `journal.forkedAtEntryId` against
   *  `currentEntryId()` and your own op-semantic rules to decide whether
   *  to resume or discard before calling this. */
  resumeJournal(journal: Journal): void;
}

/** Options for `createHistory`. */
export interface CreateHistoryOptions {
  /** Window (ms) within which a new entry may merge into the previous one
   *  via matching `Op.coalesceKey`. Defaults to `0` (no coalescing — every
   *  `applyOps` pushes a discrete entry). Recommended: ~500ms for typical
   *  rapid-input UX (nudge, per-keystroke text edits). The window resets on
   *  each successful coalesce, so a sustained burst keeps merging. */
  coalesceWindowMs?: number;
  /** Clock injection point for tests. Defaults to `Date.now`. */
  now?: () => number;
}

/** Build an op-batched undo/redo `History`. The adapter is passed to each op's `apply`/`invert`. */
export function createHistory(adapter: unknown, options: CreateHistoryOptions = {}): History {
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  let activeJournal: Journal | null = null;
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());
  let nextEntryId = 1;
  let version = 0;
  const listeners = new Set<() => void>();
  function bump(): void {
    version++;
    for (const l of listeners) l();
  }

  function applyOps(ops: Op[]): void {
    for (const op of ops) op.apply(adapter);
  }

  /** Apply each op and collect whether any reported a real mutation.
   *  Returns true iff at least one op did NOT explicitly return `false` /
   *  `'noop'`. Used by `pushOrCoalesce` to skip pushing entries when every
   *  op in the batch was a silent no-op (e.g. reorder where the order
   *  already matched). Existing ops that return `undefined`/`void` count
   *  as "mutated" — the default — so this is backwards-compatible. */
  function applyOpsAndDetectMutation(ops: Op[]): boolean {
    let anyMutated = false;
    for (const op of ops) {
      const r = op.apply(adapter);
      if (r !== false && r !== 'noop') anyMutated = true;
    }
    return anyMutated;
  }

  function invertEntry(entry: Entry): Op[] {
    return [...entry.baseOps].reverse().map((op) => op.invert());
  }

  /** Coalesce eligibility: every op on both sides has a `coalesceKey`, and
   *  the multisets of keys match (order-independent). Match by multiset
   *  rather than positional index so a multi-id selection can re-emit ops in
   *  any order between batches without breaking the merge. */
  function canCoalesce(top: Entry, incoming: Op[]): boolean {
    if (coalesceWindowMs <= 0) return false;
    if (now() - top.timestamp > coalesceWindowMs) return false;
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

  function pushOrCoalesce(ops: Op[], label: string): void {
    if (ops.length === 0) return;
    const anyMutated = applyOpsAndDetectMutation(ops);
    if (!anyMutated) {
      // Every op reported `false`/`'noop'`. Skip the push so undo stays
      // tied to real state changes. Surfaced through the kit's debug
      // flag so the upstream caller can consider avoiding the dispatch
      // entirely. Hidden by default; enable via
      // `localStorage.setItem('weasel.debug', '1')`.
      dwarn(
        `[history] '${label}' batch was a no-op — every op reported false/'noop'. ` +
        `Skipping the undo entry; consider gating the dispatch upstream to avoid the wasted work.`,
      );
      return;
    }
    const top = undoStack[undoStack.length - 1];
    if (top && canCoalesce(top, ops)) {
      top.forwardOps = ops;
      top.timestamp = now();
      // baseOps + label + id intentionally preserved — undo returns to the
      // pre-edit state, the original label sticks, and the entry id stays
      // stable so React lists keyed on id don't flicker.
      redoStack.length = 0;
      bump();
      return;
    }
    undoStack.push({ id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now() });
    redoStack.length = 0;
    bump();
  }

  return {
    apply(op, label) {
      pushOrCoalesce([op], label ?? op.label ?? '');
    },
    applyOps(ops, label) {
      pushOrCoalesce(ops, label);
    },
    undo() {
      const entry = undoStack.pop();
      if (!entry) return;
      applyOps(invertEntry(entry));
      redoStack.push(entry);
      bump();
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return;
      applyOps(entry.forwardOps);
      undoStack.push(entry);
      bump();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear: () => {
      const had = undoStack.length > 0 || redoStack.length > 0;
      undoStack.length = 0;
      redoStack.length = 0;
      if (had) bump();
    },
    entries() {
      const toView = (e: Entry): HistoryEntry => ({ id: e.id, label: e.label, timestamp: e.timestamp });
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
      if (n < 0 || n > total) return;
      while (undoStack.length > n) {
        const entry = undoStack.pop()!;
        applyOps(invertEntry(entry));
        redoStack.push(entry);
      }
      while (undoStack.length < n) {
        const entry = redoStack.pop();
        if (!entry) break; // defensive — shouldn't fire given the bounds check above
        applyOps(entry.forwardOps);
        undoStack.push(entry);
      }
      bump();
    },
    getVersion: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    serialize(): SerializedHistory {
      return {
        version: 1,
        undoStack: undoStack
          .map((e) => entryToSerial(e))
          .filter((e): e is SerializedHistoryEntry => e !== null),
        redoStack: redoStack
          .map((e) => entryToSerial(e))
          .filter((e): e is SerializedHistoryEntry => e !== null),
        nextEntryId,
      };
    },
    recordEntry(ops: Op[], label: string): void {
      if (ops.length === 0) return;
      undoStack.push({ id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now() });
      redoStack.length = 0;
      bump();
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
      const j = createJournalInternal(this, adapter, opts, () => { activeJournal = null; });
      activeJournal = j;
      return j;
    },
    resumeJournal(journal: Journal): void {
      _resumeJournalInternal(journal);
    },
    restore(snapshot: SerializedHistory): void {
      undoStack.length = 0;
      redoStack.length = 0;
      for (const se of snapshot.undoStack) {
        undoStack.push(serialToEntry(se));
      }
      for (const se of snapshot.redoStack) {
        redoStack.push(serialToEntry(se));
      }
      // Seed nextEntryId from the snapshot, then defensively bump past any
      // restored id — a malformed snapshot with duplicate or out-of-range
      // ids should never produce a collision with future entries.
      nextEntryId = snapshot.nextEntryId;
      for (const e of undoStack) if (e.id >= nextEntryId) nextEntryId = e.id + 1;
      for (const e of redoStack) if (e.id >= nextEntryId) nextEntryId = e.id + 1;
      bump();
    },
  };
}

/** Project an `Op` to its `(name, args)` wire form. Returns `null` for ops
 *  missing `name` — the caller drops the containing entry. */
function opToSerial(op: Op): SerializedOp | null {
  if (typeof op.name !== 'string') return null;
  return { name: op.name, args: op.args };
}

/** Project a runtime entry to its serialized form, or `null` if any op in
 *  the entry can't be serialized (we drop the whole entry then — a partially
 *  serializable entry would invert against the wrong baseline on undo). */
function entryToSerial(e: Entry): SerializedHistoryEntry | null {
  const forwardOps: SerializedOp[] = [];
  for (const op of e.forwardOps) {
    const s = opToSerial(op);
    if (s === null) {
      dlog(`[history.serialize] dropping entry id=${e.id} "${e.label}" — forwardOp without name`);
      return null;
    }
    forwardOps.push(s);
  }
  const baseOps: SerializedOp[] = [];
  for (const op of e.baseOps) {
    const s = opToSerial(op);
    if (s === null) {
      dlog(`[history.serialize] dropping entry id=${e.id} "${e.label}" — baseOp without name`);
      return null;
    }
    baseOps.push(s);
  }
  return { id: e.id, label: e.label, forwardOps, baseOps };
}

/** Placeholder op used when the registry lacks the requested name. Stable
 *  identity (each placeholder is its own invert) keeps undo/redo plumbing
 *  happy without performing any adapter mutation. */
function placeholderOp(name: string, args: unknown, label?: string): Op {
  const op: Op = {
    name,
    args,
    label,
    apply: () => 'noop' as const,
    invert: () => op,
  };
  return op;
}

/** Rebuild a runtime entry from its serialized form. Unknown op names become
 *  no-op placeholders so the entry still occupies its slot in the stack. */
function serialToEntry(se: SerializedHistoryEntry): Entry {
  const forwardOps = se.forwardOps.map((so) => {
    const built = rebuildOp(so.name, so.args);
    if (built !== null) return built;
    dlog(`[history.restore] unknown op name "${so.name}" — substituting no-op placeholder`);
    return placeholderOp(so.name, so.args, se.label);
  });
  const baseOps = se.baseOps.map((so) => {
    const built = rebuildOp(so.name, so.args);
    if (built !== null) return built;
    dlog(`[history.restore] unknown op name "${so.name}" — substituting no-op placeholder`);
    return placeholderOp(so.name, so.args, se.label);
  });
  return {
    id: se.id,
    label: se.label,
    forwardOps,
    baseOps,
    // Restored entries inherit a "now" timestamp — coalesce eligibility is
    // a within-session concept and a restored entry shouldn't merge with a
    // freshly-typed one regardless of when it was originally pushed.
    timestamp: 0,
  };
}
