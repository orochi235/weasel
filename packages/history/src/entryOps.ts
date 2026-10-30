/**
 * The parts of a history that read or apply an entry's ops without touching
 * its stacks.
 */
import type { Op } from './op';
import { touchedIdsFromOps, type Entry, type HistoryLogger } from './serialized';
import type { HistoryEntry, HistoryStep } from './historyTypes';

export /** Whether both lists are non-empty, every op is keyed, and the keys match as multisets. */
function sameCoalesceKeys(top: readonly Op[], incoming: readonly Op[]): boolean {
  if (top.length === 0 || incoming.length === 0 || top.length !== incoming.length) return false;
  const counts = new Map<string, number>();
  for (const op of top) {
    const k = op.coalesceKey;
    if (k === undefined) return false;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const op of incoming) {
    const k = op.coalesceKey;
    const c = k === undefined ? 0 : counts.get(k) ?? 0;
    if (!c) return false;
    counts.set(k!, c - 1);
  }
  return true;
}

export function entryView(e: Entry): HistoryEntry {
  return {
    id: e.id, label: e.label, timestamp: e.timestamp, pushes: e.pushes, touchedIds: e.touchedIds,
    ...(e.selectionBefore ? { selectionBefore: e.selectionBefore } : {}),
    ...(e.selectionAfter ? { selectionAfter: e.selectionAfter } : {}),
  };
}

export function stepOf(kind: HistoryStep['kind'], entries: readonly Entry[] = []): HistoryStep {
  return { kind, entries: entries.map((e) => ({ id: e.id, label: e.label, ops: e.forwardOps })) };
}

/** Build the all-or-nothing apply a history runs every step through, against `adapter`. */
export function createApplier(adapter: unknown, logger: HistoryLogger) {
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
  function applyAllOrNothing(ops: Op[], settle?: () => Op[], idle?: Op[]): boolean {
    let anyMutated = false;
    let done = 0;
    try {
      for (; done < ops.length; done++) {
        const r = ops[done]!.apply(adapter);
        if (r !== false && r !== 'noop') anyMutated = true;
        else idle?.push(ops[done]!);
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
  return applyAllOrNothing;
}

/** Fold `ops`, recorded under the key `top` carries, into `top`: they run after its own, so its
 *  undo inverts them first and then the state they started from. */
export function foldEntry(top: Entry, ops: Op[], at: number): void {
  const same = top.forwardOps === top.baseOps;
  top.forwardOps = [...top.forwardOps, ...ops];
  top.baseOps = same ? top.forwardOps : [...top.baseOps, ...ops];
  top.timestamp = at;
  top.pushes++;
  const merged = new Set(top.touchedIds);
  for (const id of touchedIdsFromOps(ops)) merged.add(id);
  top.touchedIds = merged;
}

/** Whether any op in `ops` records the ops it caused in its place: a loop
 *  rather than `some`, since every push asks. */
export function anyCaused(ops: readonly Op[]): boolean {
  for (let i = 0; i < ops.length; i++) if (ops[i]!.caused !== undefined) return true;
  return false;
}
