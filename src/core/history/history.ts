import type { Op } from '../ops/types';
import { dwarn } from '../../debug/flag';

interface Entry {
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

/** Op-batched undo/redo controller returned by `createHistory`. */
export interface History {
  apply(op: Op, label?: string): void;
  applyOps(ops: Op[], label: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
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
  const coalesceWindowMs = options.coalesceWindowMs ?? 0;
  const now = options.now ?? (() => Date.now());

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
      // baseOps + label intentionally preserved — undo returns to the
      // pre-edit state and the original label sticks.
      redoStack.length = 0;
      return;
    }
    undoStack.push({ forwardOps: ops, baseOps: ops, label, timestamp: now() });
    redoStack.length = 0;
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
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return;
      applyOps(entry.forwardOps);
      undoStack.push(entry);
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear: () => {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
