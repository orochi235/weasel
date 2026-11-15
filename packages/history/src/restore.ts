/**
 * Turning a serialized history back into live entries: rebuilding each op,
 * and what happens to one nothing can rebuild.
 */
import { deepEqual } from '@weasel-js/registry';
import type { Op } from './op';
import {
  touchedIdsFromOps,
  type Entry, type HistoryLogger, type SerializedHistory, type SerializedHistoryEntry, type SerializedOp, type Stacks,
} from './serialized';

/**
 * How `restore` treats an op it cannot rebuild.
 *
 * - `'strict'`, the default: the restore throws {@link HistoryRestoreError} and the history is left
 *   as it was.
 * - `'best-effort'`: the op becomes a placeholder that changes nothing, so its entry keeps its place
 *   in the stack; the report lists it, and each undo or redo that steps past it calls `onSkip`.
 */
export type HistoryRecovery = 'strict' | 'best-effort';

/** A restored op that could not be rebuilt, or one a best-effort replay stepped past. */
export interface UnresolvedOp {
  readonly entryId: number;
  readonly label: string;
  readonly name: string;
  readonly args: unknown;
  /** `'unknown'` when nothing rebuilds the name; otherwise what the rebuilder reported, such as a
   *  scene's `'no-adapter'`. */
  readonly reason: string;
}

/** What `restore` did. */
export interface HistoryRestoreReport {
  /** Whether the stacks were replaced. */
  readonly restored: boolean;
  /** Each op nothing could rebuild, in stack order: once per half of its entry that holds it. */
  readonly unresolved: readonly UnresolvedOp[];
}

/** Options for `History.restore`. */
export interface RestoreOptions {
  /** Defaults to `'strict'`. */
  recovery?: HistoryRecovery;
  /** Best-effort only: called each time an undo, redo or goto steps past a restored op it cannot
   *  apply, as the step reaches it. */
  onSkip?: (skip: UnresolvedOp) => void;
}

/** A strict restore that met ops it could not rebuild. The history was left as it was. */
export class HistoryRestoreError extends Error {
  constructor(readonly report: HistoryRestoreReport, message?: string) {
    const listed = report.unresolved.slice(0, 3).map((u) => `"${u.name}" (${u.reason}) in entry ${u.entryId} "${u.label}"`);
    const more = report.unresolved.length > 3 ? `, and ${report.unresolved.length - 3} more` : '';
    super(message ?? `History.restore: cannot rebuild ${listed.join(', ')}${more}`);
    this.name = 'HistoryRestoreError';
  }
}

/** A rebuilder's answer for an op it recognizes but cannot make usable: the reason, reported. */
export interface UnresolvableOp {
  readonly unresolved: string;
}

/** What a rebuilder is told about the op it is asked for. */
export interface RebuildContext {
  /** The entry the op belongs to. */
  readonly entry: { readonly id: number; readonly label: string };
  readonly recovery: HistoryRecovery;
  /** Report the op skipped by a replay. A rebuilt op that degrades in best-effort recovery, rather
   *  than throw, calls this when it does. */
  skipped(name: string, args: unknown, reason: string): void;
}

/** Signature of `CreateHistoryOptions.rebuildOp`: the op `name` and `args` describe, `null` for a
 *  name it does not know, or an {@link UnresolvableOp}. */
export type RebuildOp = (name: string, args: unknown, context: RebuildContext) => Op | UnresolvableOp | null;

/** A placeholder's apply changes nothing and reports itself; it is its own inverse. */
function placeholderOp(so: SerializedOp, label: string, skip: () => void): Op {
  const op: Op = {
    name: so.name,
    args: so.args,
    label,
    apply: () => {
      skip();
      return 'noop' as const;
    },
    invert: () => op,
  };
  return op;
}

/** The stacks `snapshot` describes, each op rebuilt through `rebuild`, and the ops it could not.
 *  Throws {@link HistoryRestoreError} for any it could not under strict recovery. */
export function rebuilt(
  snapshot: SerializedHistory, rebuild: RebuildOp | undefined, options: RestoreOptions, logger: HistoryLogger,
): { stacks: Stacks; unresolved: UnresolvedOp[] } {
  const recovery = options.recovery ?? 'strict';
  const unresolved: UnresolvedOp[] = [];
  const issue = (se: SerializedHistoryEntry, name: string, args: unknown, reason: string): UnresolvedOp =>
    ({ entryId: se.id, label: se.label, name, args, reason });

  function op(so: SerializedOp, se: SerializedHistoryEntry): Op {
    const context: RebuildContext = {
      entry: { id: se.id, label: se.label },
      recovery,
      skipped: (name, args, reason) => options.onSkip?.(issue(se, name, args, reason)),
    };
    const got = rebuild ? rebuild(so.name, so.args, context) : null;
    if (got !== null && !('unresolved' in got)) return got;
    const u = issue(se, so.name, so.args, got === null ? 'unknown' : got.unresolved);
    unresolved.push(u);
    logger.log(`restore: cannot rebuild "${so.name}" (${u.reason}) — substituting no-op placeholder`);
    return placeholderOp(so, se.label, () => options.onSkip?.(u));
  }

  const entry = (se: SerializedHistoryEntry): Entry => serialToEntry(se, op);
  const undoStack = snapshot.undoStack.map(entry);
  const redoStack = snapshot.redoStack.map(entry);
  const forks = new Map<number, Entry[][]>();
  for (const b of snapshot.branches ?? []) {
    const entries = b.entries.map(entry);
    const kept = forks.get(b.at);
    if (kept) kept.push(entries);
    else forks.set(b.at, [entries]);
  }
  if (unresolved.length > 0 && recovery === 'strict') throw new HistoryRestoreError({ restored: false, unresolved });
  // Seed nextEntryId from the snapshot, then defensively bump past any
  // restored id — a malformed snapshot with duplicate or out-of-range
  // ids should never produce a collision with future entries.
  let nextEntryId = snapshot.nextEntryId;
  const seen = [undoStack, redoStack, ...[...forks.values()].flat()];
  for (const entries of seen) for (const e of entries) if (e.id >= nextEntryId) nextEntryId = e.id + 1;
  return { stacks: { undoStack, redoStack, forks, floorId: snapshot.floor ?? 0, nextEntryId }, unresolved };
}

function sameSerialOps(a: readonly SerializedOp[], b: readonly SerializedOp[]): boolean {
  return a === b || deepEqual(a, b);
}

/** Rebuild a runtime entry from its serialized form. */
function serialToEntry(se: SerializedHistoryEntry, op: (so: SerializedOp, se: SerializedHistoryEntry) => Op): Entry {
  const forwardOps = se.forwardOps.map((so) => op(so, se));
  // An entry nothing coalesced into holds one array as both halves, and a
  // step that throws unwinds differently when they differ.
  const baseOps = sameSerialOps(se.forwardOps, se.baseOps)
    ? forwardOps
    : se.baseOps.map((so) => op(so, se));
  return {
    id: se.id,
    label: se.label,
    forwardOps,
    baseOps,
    timestamp: se.timestamp ?? 0,
    pushes: se.pushes ?? 1,
    // Re-derive touchedIds from the rebuilt ops rather than trying to
    // round-trip the Set through the serialized form (Sets aren't JSON-safe).
    touchedIds: touchedIdsFromOps(baseOps === forwardOps ? forwardOps : [...baseOps, ...forwardOps]),
    ...(se.selectionBefore ? { selectionBefore: [...se.selectionBefore] } : {}),
    ...(se.selectionAfter ? { selectionAfter: [...se.selectionAfter] } : {}),
  };
}
