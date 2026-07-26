/**
 * Shared paste materialization — the one place the paste recipe lives:
 * offset policy → `commitPaste` → the op batch (InsertOps parents-first +
 * a SetSelectionOp). Both `useClipboardOps.paste` (in-memory paste) and the
 * kit weasel-JSON content handler (OS-clipboard paste) dispatch exactly this
 * batch, so the two arrival paths stay indistinguishable in history.
 *
 * Pure: no dispatching here — callers own how the ops are applied
 * (`dispatchApplyBatch` vs `IngestCtx.applyOps`) and any post-paste
 * bookkeeping (the hook's cascade re-snapshot, the handler's selection set).
 */
import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { ClipboardSnapshot, InsertAdapter } from 'core/adapters/types';

/** Shared paste materialization: offset policy → commitPaste → the op batch
 *  both the in-memory paste and the OS-paste handler dispatch. Returns null
 *  when the adapter can't paste or nothing was created. */
export function materializePaste<TNode extends { id: string }>(
  adapter: InsertAdapter<TNode>,
  snapshot: ClipboardSnapshot,
  opts: {
    currentSelection: string[];
    dropPoint?: { worldX: number; worldY: number } | null;
  },
): { ops: Op[]; newIds: string[]; created: TNode[] } | null {
  const commitPaste = adapter.commitPaste;
  if (!commitPaste) return null;
  const offset = adapter.getPasteOffset?.(snapshot) ?? { dx: 0, dy: 0 };
  const ctx = opts.dropPoint != null ? { dropPoint: opts.dropPoint } : undefined;
  const created = commitPaste.call(adapter, snapshot, offset, ctx);
  if (created.length === 0) return null;
  const newIds = created.map((o) => o.id);
  const ops: Op[] = [
    ...created.map((o) => createInsertOp({ node: o })),
    createSetSelectionOp({ from: opts.currentSelection as NodeId[], to: newIds as NodeId[] }),
  ];
  return { ops, newIds, created };
}
