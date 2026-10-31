/** The history engine's public shapes: the controller `createHistory` returns, its options, and the views it hands out. */
import type { Op } from './op';
import type { Journal, BeginJournalOptions } from './journal';
import type { HistoryLogger, SerializedHistory } from './serialized';

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

/** One change to a history's stacks, as `History.observe` reports it.
 *
 * - `'push'` — an entry was added: `applyOps`, `apply`, `recordEntry`, a journal's commit.
 * - `'coalesce'` — a push merged into the entry on top; `ops` are the ones it brought.
 * - `'undo'` / `'redo'` / `'goto'` — the entries walked across, in the order walked.
 * - `'branch'` — `switchBranch` made another future the redo stack: its entries, next redo first.
 * - `'prune'` — the undo entries `prune` evicted, oldest first.
 * - `'clear'` / `'restore'` — the stacks were replaced wholesale; no entries.
 */
export interface HistoryStep {
  kind: 'push' | 'coalesce' | 'undo' | 'redo' | 'goto' | 'branch' | 'prune' | 'clear' | 'restore';
  /** Ops are live references — read `name`/`args`, don't mutate. */
  entries: readonly { id: number; label: string; ops: readonly Op[] }[];
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
  /** Hear what each change was, after the stacks have changed and before
   *  `subscribe`'s listeners run. A step that changed nothing reports
   *  nothing. Returns the unsubscribe. */
  observe(listener: (step: HistoryStep) => void): () => void;
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
  /** The journal open on this history now, which applies and undoes in its place, or null. Optional, so a
   *  history that never journals need not answer. */
  activeJournal?(): Journal | null;
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
  /** Fold these ops into the entry on top when it was recorded under the same key and nothing has
   *  happened since: no other push, step, or `seal`. Undo then returns to the state before the
   *  first of them. Unlike an op's own key this needs no coalesce window; `seal` ends the run. */
  coalesceKey?: string;
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
