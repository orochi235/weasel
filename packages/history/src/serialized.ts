/**
 * A history's entries, their wire form, and the trip between the two.
 */
import type { Op } from './op';

export interface Entry {
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
  /** `now()` at last push or coalesce: gates the coalesce window, and is the
   *  entry's place in time for `depthAt` and `prune`. */
  timestamp: number;
  /** See `HistoryEntry.pushes`. */
  pushes: number;
  /** Node ids touched by ops in this entry. See `HistoryEntry.touchedIds`. */
  touchedIds: ReadonlySet<string>;
  /** Selection as of just before this entry's ops ran; restored by undo.
   *  Undefined when nothing supplied one (no `selection` option, or a
   *  `recordEntry` call that captured none). */
  selectionBefore?: readonly string[];
  /** Selection as of just before this entry was last undone; restored by
   *  redo. Written on the way past, so it reflects where the user actually
   *  was rather than where the entry's ops left them. */
  selectionAfter?: readonly string[];
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
  /** See `HistoryEntry.pushes`. Absent in snapshots that predate it; read as 1. */
  pushes?: number;
  /** See `HistoryEntry.timestamp`. Absent in snapshots that predate it; read as 0. */
  timestamp?: number;
  selectionBefore?: readonly string[];
  selectionAfter?: readonly string[];
}

/** Snapshot of an entire `History` instance. Designed to live alongside the
 *  scene snapshot so a reload restores the undo / redo stacks to exactly
 *  where they were. Op `args` are carried by reference, so the snapshot is
 *  as serializable as they are: JSON drops a function an op's args hold,
 *  where a structured clone (IndexedDB, `postMessage`) throws on it. */
export interface SerializedHistory {
  version: 1;
  undoStack: SerializedHistoryEntry[];
  /** Stored newest-first, mirroring the in-memory stack so a deserialized
   *  history matches the original's `entries().redo` ordering. */
  redoStack: SerializedHistoryEntry[];
  nextEntryId: number;
  /** Futures kept by a branching history, each under the id of the entry it
   *  forks from (`floor`'s for the oldest reachable state), entries in time
   *  order. Absent when none. */
  branches?: { at: number; entries: SerializedHistoryEntry[] }[];
  /** The id naming the state beneath the undo stack: that of the last undo
   *  entry evicted or left out of the snapshot. Absent, and read as 0, when
   *  the stack reaches back to the start. */
  floor?: number;
  /** Entries left out: those with an op lacking a `name`, which can't
   *  round-trip through the op-factory registry, and those only reachable
   *  across one. Always present (zero when nothing was dropped) so callers
   *  can detect loss without parsing the debug log. */
  droppedEntries: number;
}

/** Diagnostics sink for {@link CreateHistoryOptions.debug}. Messages arrive
 *  pre-formatted and unconditional; deciding whether to emit them is the
 *  caller's job. */
export interface HistoryLogger {
  log(message: string): void;
  warn(message: string): void;
}

/** The stacks a history holds, as `snapshot` reads them and `rebuilt` answers. */
export interface Stacks {
  undoStack: Entry[];
  redoStack: Entry[];
  /** Futures set aside, by the id of the entry they fork from. */
  forks: Map<number, Entry[][]>;
  floorId: number;
  nextEntryId: number;
}

/** `stacks` as a snapshot: see `History.serialize` for what is left out. */
export function snapshot(stacks: Stacks, logger: HistoryLogger): SerializedHistory {
  const { undoStack, redoStack, forks, floorId, nextEntryId } = stacks;
  let total = 0;
  const project = (entries: readonly Entry[]): (SerializedHistoryEntry | null)[] => {
    total += entries.length;
    return entries.map((e) => entryToSerial(e, logger));
  };
  // Both stacks keep the entries nearest the current state at their end,
  // so what survives a nameless entry is whatever follows the last one.
  const nearest = (stack: readonly Entry[]): SerializedHistoryEntry[] => {
    const serial = project(stack);
    return serial.slice(serial.lastIndexOf(null) + 1) as SerializedHistoryEntry[];
  };
  const undo = nearest(undoStack);
  const redo = nearest(redoStack);

  // Cutting the undo stack raises the snapshot's floor to the last entry cut.
  const floor = undo.length === undoStack.length ? floorId : undoStack[undoStack.length - undo.length - 1]!.id;
  const reachable = new Set<number>([floor, ...[...undo, ...redo].map((e) => e.id)]);
  let pending = [...forks].flatMap(([at, kept]) => kept.map((b) => {
    const serial = project(b);
    const cut = serial.indexOf(null);
    return { at, entries: (cut < 0 ? serial : serial.slice(0, cut)) as SerializedHistoryEntry[] };
  })).filter((b) => b.entries.length > 0);
  const branches: { at: number; entries: SerializedHistoryEntry[] }[] = [];
  for (let grew = true; grew; ) {
    grew = false;
    const waiting: typeof pending = [];
    for (const b of pending) {
      if (!reachable.has(b.at)) { waiting.push(b); continue; }
      branches.push(b);
      for (const e of b.entries) reachable.add(e.id);
      grew = true;
    }
    pending = waiting;
  }

  const carried = undo.length + redo.length + branches.reduce((n, b) => n + b.entries.length, 0);
  return {
    version: 1,
    undoStack: undo,
    redoStack: redo,
    ...(branches.length > 0 ? { branches } : {}),
    ...(floor !== 0 ? { floor } : {}),
    nextEntryId,
    droppedEntries: total - carried,
  };
}

/** The stacks `snapshot` describes, each op rebuilt through `custom`. */
export function rebuilt(snapshot: SerializedHistory, custom: CustomRebuild | undefined, logger: HistoryLogger): Stacks {
  const entry = (se: SerializedHistoryEntry): Entry => serialToEntry(se, custom, logger);
  const undoStack = snapshot.undoStack.map(entry);
  const redoStack = snapshot.redoStack.map(entry);
  const forks = new Map<number, Entry[][]>();
  for (const b of snapshot.branches ?? []) {
    const entries = b.entries.map(entry);
    const kept = forks.get(b.at);
    if (kept) kept.push(entries);
    else forks.set(b.at, [entries]);
  }
  // Seed nextEntryId from the snapshot, then defensively bump past any
  // restored id — a malformed snapshot with duplicate or out-of-range
  // ids should never produce a collision with future entries.
  let nextEntryId = snapshot.nextEntryId;
  const seen = [undoStack, redoStack, ...[...forks.values()].flat()];
  for (const entries of seen) for (const e of entries) if (e.id >= nextEntryId) nextEntryId = e.id + 1;
  return { undoStack, redoStack, forks, floorId: snapshot.floor ?? 0, nextEntryId };
}

/** Extract node ids from an op's `args`. Handles the common patterns:
 *  - `args.id` (string) — transform, setPath, reparent
 *  - `args.node.id` (string) — insert, delete
 *  - `args.nodes[].id` (string) — an op that takes several nodes at once
 *  Ops that match none of them contribute nothing. */
export function touchedIdsFromOps(ops: readonly Op[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.args === null || typeof op.args !== 'object') continue;
    const a = op.args as Record<string, unknown>;
    if (typeof a['id'] === 'string') {
      ids.add(a['id']);
    } else if (a['node'] !== null && typeof a['node'] === 'object') {
      const n = a['node'] as Record<string, unknown>;
      if (typeof n['id'] === 'string') ids.add(n['id']);
    } else if (Array.isArray(a['nodes'])) {
      for (const n of a['nodes'] as unknown[]) {
        const id = n !== null && typeof n === 'object' ? (n as Record<string, unknown>)['id'] : undefined;
        if (typeof id === 'string') ids.add(id);
      }
    }
  }
  return ids;
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
function entryToSerial(e: Entry, logger: HistoryLogger): SerializedHistoryEntry | null {
  const forwardOps: SerializedOp[] = [];
  for (const op of e.forwardOps) {
    const s = opToSerial(op);
    if (s === null) {
      logger.log(`serialize: dropping entry id=${e.id} "${e.label}" — forwardOp without name`);
      return null;
    }
    forwardOps.push(s);
  }
  const baseOps: SerializedOp[] = [];
  for (const op of e.baseOps) {
    const s = opToSerial(op);
    if (s === null) {
      logger.log(`serialize: dropping entry id=${e.id} "${e.label}" — baseOp without name`);
      return null;
    }
    baseOps.push(s);
  }
  return {
    id: e.id, label: e.label, forwardOps, baseOps, pushes: e.pushes, timestamp: e.timestamp,
    ...(e.selectionBefore ? { selectionBefore: e.selectionBefore } : {}),
    ...(e.selectionAfter ? { selectionAfter: e.selectionAfter } : {}),
  };
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

/** Signature of a per-instance op rebuilder (`CreateHistoryOptions.rebuildOp`). */
type CustomRebuild = (name: string, args: unknown) => Op | null;

/** Rebuild a single serialized op via `custom` (if provided), falling back to
 *  a no-op placeholder.
 *
 *  This engine deliberately knows nothing about any op registry: hydrating a
 *  `(name, args)` pair back into an op is the caller's concern, injected
 *  through `CreateHistoryOptions.rebuildOp`. `@weasel-js/core`'s
 *  `createHistory` wrapper supplies its global op-factory registry as that
 *  hook, so core consumers see unchanged behavior. */
function rebuildSerialOp(so: SerializedOp, label: string, custom: CustomRebuild | undefined, logger: HistoryLogger): Op {
  const viaCustom = custom ? custom(so.name, so.args) : null;
  if (viaCustom !== null) return viaCustom;
  logger.log(`restore: unknown op name "${so.name}" — substituting no-op placeholder`);
  return placeholderOp(so.name, so.args, label);
}

/** Rebuild a runtime entry from its serialized form. Unknown op names become
 *  no-op placeholders so the entry still occupies its slot in the stack. */
function serialToEntry(se: SerializedHistoryEntry, custom: CustomRebuild | undefined, logger: HistoryLogger): Entry {
  const forwardOps = se.forwardOps.map((so) => rebuildSerialOp(so, se.label, custom, logger));
  const baseOps = se.baseOps.map((so) => rebuildSerialOp(so, se.label, custom, logger));
  return {
    id: se.id,
    label: se.label,
    forwardOps,
    baseOps,
    timestamp: se.timestamp ?? 0,
    pushes: se.pushes ?? 1,
    // Re-derive touchedIds from the rebuilt ops rather than trying to
    // round-trip the Set through the serialized form (Sets aren't JSON-safe).
    touchedIds: touchedIdsFromOps(forwardOps),
    ...(se.selectionBefore ? { selectionBefore: [...se.selectionBefore] } : {}),
    ...(se.selectionAfter ? { selectionAfter: [...se.selectionAfter] } : {}),
  };
}
