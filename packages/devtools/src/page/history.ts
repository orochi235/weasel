/** A scene's history steps as the devtools hook keeps them: one plain record per step, in a rolling ring. */
import { touchedIdsFromOps, type History, type HistoryStep } from '@weasel-js/history';
import type { TraceRing } from '@weasel-js/routing';
import type { DevtoolsHistoryOp, DevtoolsHistoryRecord, DevtoolsHistorySlice } from './protocol';
import type { DevtoolsRoot } from './root';
import { serialize } from './serialize';

/** How much of one step a record keeps: a jump can walk the whole stack, and a batch can hold any number of ops. */
export const HISTORY_RECORD_LIMITS = { entries: 50, ops: 50 };

const SUMMARY = { depth: 4, items: 20, chars: 200 };

function opOf(op: HistoryStep['entries'][number]['ops'][number]): DevtoolsHistoryOp {
  return { kind: op.name ?? '?', targets: [...touchedIdsFromOps([op])], summary: serialize(op.args, SUMMARY) };
}

function recordOf(step: HistoryStep, history: Pick<History, 'undoDepth' | 'redoDepth'>): DevtoolsHistoryRecord {
  const index = history.undoDepth();
  return {
    ts: Date.now(),
    step: step.kind,
    entries: step.entries.slice(0, HISTORY_RECORD_LIMITS.entries).map((e) => ({
      id: e.id,
      label: e.label,
      opCount: e.ops.length,
      ops: e.ops.slice(0, HISTORY_RECORD_LIMITS.ops).map(opOf),
    })),
    position: { index, total: index + history.redoDepth() },
  };
}

/** Push a record of each step `history` takes into `ring`, while the ring is recording. Returns the stop. */
export function recordHistory(history: History, ring: TraceRing<DevtoolsHistoryRecord>): () => void {
  return history.observe((step) => {
    if (ring.recording()) ring.push(recordOf(step, history));
  });
}

export function historySlice(root: DevtoolsRoot, cursor: number, checkpoints: boolean | undefined): DevtoolsHistorySlice {
  const ring = root.source.history;
  const scene = root.source.scene();
  if (!ring || !scene) throw new Error('no history to read');
  const slice = ring.since(cursor);
  const index = scene.history.undoDepth();
  const out: DevtoolsHistorySlice = {
    entries: slice.entries,
    cursor: slice.cursor,
    position: { index, total: index + scene.history.redoDepth(), canUndo: scene.canUndo(), canRedo: scene.canRedo() },
  };
  if (checkpoints) out.checkpoints = scene.historyEntries().map((e) => ({ id: e.id, label: e.label }));
  return out;
}
