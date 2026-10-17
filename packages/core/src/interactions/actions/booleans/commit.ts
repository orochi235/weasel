import type { Path } from '@weasel-js/geom';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import { locateChild } from 'core/ops/slot';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { BooleanEntry, BooleanOp, BooleansAdapter, BooleanZOrder } from './booleans';
import { placementOps } from './placement';

/** One path to mint: the index of the source it stands in for, and the op it
 *  is recorded as made by. */
export interface BooleanCommitPiece {
  path: Path;
  source: number;
  producedBy: BooleanOp;
}

/**
 * Replace every entry with `pieces` as one undoable batch, and select what
 * was made. Each piece is minted from its own source, wears the paint a stroke
 * folded into that source left it, and takes its slot. Returns the new ids.
 */
export function commitPieces(
  adapter: BooleansAdapter,
  sel: readonly NodeId[],
  entries: readonly BooleanEntry[],
  pieces: readonly BooleanCommitPiece[],
  label: string,
): string[] {
  // Every source's slot, read before the scene is mutated.
  const slots: (BooleanZOrder | undefined)[] =
    entries.map((e) => locateChild(adapter, e.id) ?? undefined);
  const made = pieces.map((piece) => {
    const { id, operand } = entries[piece.source]!;
    return { node: adapter.createPathNode(piece.path, piece.producedBy, id, operand.paint), slot: slots[piece.source] };
  });
  const newNodes = made.map((m) => m.node);
  const ops: Op[] = [];
  // Capture the full node so the delete's `invert()` (an insert) restores
  // every field on undo. The index is -1 for a source its parent does not list.
  const captured = entries.map((e, i) => ({
    node: adapter.getNode(e.id) ?? { id: e.id },
    index: slots[i]?.index ?? -1,
  }));
  // Order by index DESC so reverse-then-invert (history's undo path)
  // re-inserts ASC — each splice lands on a correctly-sized array
  // instead of clamping high indices to a still-growing length.
  captured.sort((a, b) => b.index - a.index);
  for (const { node, index } of captured) ops.push(createDeleteOp({ node, index }));
  for (const n of newNodes) ops.push(createInsertOp({ node: n }));
  ops.push(...placementOps(made.map((m) => ({ id: m.node.id, slot: m.slot })), slots));
  ops.push(createSetSelectionOp({ from: sel, to: newNodes.map((n) => n.id as NodeId) }));
  dispatchApplyBatch(adapter, ops, label);
  return newNodes.map((n) => n.id);
}
