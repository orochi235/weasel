/**
 * Adding to a history's undo stack: applying a batch and pushing it as an
 * entry or coalescing it into the top one, and recording ops that already
 * ran. Owns the id the next entry takes.
 */
import type { Op } from './op';
import { coalesceEntry, foldEntry, recordedOps, sameCoalesceKeys, stepOf, type createApplier } from './entryOps';
import { touchedIdsOf, type Entry, type HistoryLogger } from './serialized';
import type { Forks } from './forks';
import type { VersionClock } from './versionClock';
import type { HistoryStep, RecordEntryOptions } from './historyTypes';

export interface RecorderEnv {
  undoStack: Entry[];
  forks: Pick<Forks, 'forkPoint' | 'retireRedo' | 'evictPast'>;
  clock: VersionClock;
  applyAllOrNothing: ReturnType<typeof createApplier>;
  readSelection(): readonly string[] | undefined;
  now(): number;
  coalesceWindowMs: number | (() => number);
  historyLimit: number;
  logger: HistoryLogger;
}

function coalesceStep(top: Entry, ops: Op[]): HistoryStep {
  return { kind: 'coalesce', entries: [{ id: top.id, label: top.label, ops, applied: ops }] };
}

export function createRecorder(env: RecorderEnv) {
  const { undoStack, forks, clock, applyAllOrNothing, readSelection, now, coalesceWindowMs, historyLimit, logger } = env;
  let nextEntryId = 1;

  /** Coalesce eligibility: inside the window, which a clock set back since (a machine waking to a corrected
   *  time) is not, and the same keys. Matched by multiset rather than position so a multi-id selection can
   *  re-emit ops in any order between batches without breaking the merge. */
  function canCoalesce(top: Entry, incoming: Op[]): boolean {
    const windowMs = typeof coalesceWindowMs === 'function' ? coalesceWindowMs() : coalesceWindowMs, gap = now() - top.timestamp;
    if (!(windowMs > 0) || top.coalesceKey !== undefined || !clock.anchored() || !(gap >= 0 && gap <= windowMs)) return false;
    return sameCoalesceKeys(top.forwardOps, incoming);
  }

  /** Push `entry`, retiring the redo stack and evicting past the limit. */
  function push(entry: Entry): void {
    const at = forks.forkPoint();
    undoStack.push(entry);
    forks.retireRedo(at);
    forks.evictPast(historyLimit);
    clock.bump(clock.observed() ? stepOf('push', [entry], [entry.forwardOps]) : undefined);
  }

  function pushOrCoalesce(applied: Op[], label: string, owned = false): void {
    if (applied.length === 0) return;
    const selectionBefore = readSelection();
    const idle: Op[] = [];
    const anyMutated = applyAllOrNothing(applied, undefined, idle);
    const ops = recordedOps(applied, idle, owned);
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
      coalesceEntry(top, ops, incoming, now());
      // No dropRedo() here: the anchor only survives until the stack is
      // stepped, and every step clears it, so a live anchor implies an empty
      // redo stack.
      logger.log(`coalesce '${label}' into entry id=${top.id} (${ops.length} ops)`);
      clock.bump(clock.observed() ? coalesceStep(top, ops) : undefined);
      clock.anchor();
      return;
    }
    logger.log(`push '${label}' (${ops.length} ops)`);
    push({
      id: nextEntryId++, forwardOps: ops, baseOps: ops, label, timestamp: now(), pushes: 1, touchedIds: incoming,
      ...(selectionBefore ? { selectionBefore } : {}),
    });
    clock.anchor();
  }

  /** Record ops that already ran, folding them into the top entry when it
   *  carries the same `coalesceKey` and the window is still open. */
  function record(forwardOps: Op[], baseOps: Op[], label: string, options: RecordEntryOptions = {}): void {
    if (forwardOps.length === 0) return;
    const key = options.coalesceKey;
    const top = undoStack[undoStack.length - 1];
    if (key !== undefined && top?.coalesceKey === key && clock.anchored() && forwardOps === baseOps) {
      foldEntry(top, forwardOps, now());
      clock.bump(clock.observed() ? coalesceStep(top, forwardOps) : undefined);
      clock.anchor();
      return;
    }
    push({
      id: nextEntryId++, forwardOps, baseOps, label, timestamp: now(), pushes: 1,
      touchedIds: touchedIdsOf(forwardOps),
      ...(options.selectionBefore ? { selectionBefore: [...options.selectionBefore] } : {}),
      ...(key !== undefined ? { coalesceKey: key } : {}),
    });
    if (key !== undefined) clock.anchor();
  }

  return {
    pushOrCoalesce,
    record,
    nextEntryId: () => nextEntryId,
    /** Continue numbering from `id`, as a restored snapshot does. */
    resumeIdsAt(id: number): void {
      nextEntryId = id;
    },
  };
}
