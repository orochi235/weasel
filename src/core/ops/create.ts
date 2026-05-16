import type { Op } from './types';
import { createDeleteOp } from './delete';
import { registerOpFactory } from './registry';

interface InsertAdapter<TNode> {
  /** When `index` is supplied, insert at that position; adapters that ignore
   *  the second arg (or don't expose it) fall back to their default
   *  placement (typically append-to-end). */
  insertNode(node: TNode, index?: number): void;
}

/** Type alias for ops produced by `createInsertOp`. Carries no extra type info today;
 *  exists so consumers can name the op type when needed. */
export type InsertOp = Op;

/** @internal */
interface InsertArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
  /** Original z-index in the host array. Forwarded to
   *  `adapter.insertNode(node, index)` when present so undo of a multi-delete
   *  batch restores paint order instead of reversing it. Optional — adapters
   *  that don't honor it still work. */
  index?: number;
}

/** Op: insert `node` into the scene; inverts to a delete of the same id. */
export function createInsertOp<TNode extends { id: string }>(args: InsertArgs<TNode>): InsertOp {
  const { node, label, index } = args;
  return {
    name: 'insert',
    args: { node, label, index },
    label,
    apply(adapter) {
      (adapter as InsertAdapter<TNode>).insertNode(node, index);
    },
    invert() {
      // Insert's `index` is optional (fresh-insert callsites have no
      // meaningful original position); the inverted Delete needs *some*
      // index. Default to -1 — the symmetry only matters when the Insert
      // itself was a re-insert from a prior Delete, in which case the
      // index round-trips correctly.
      return createDeleteOp({ node, label, index: index ?? -1 });
    },
  };
}

registerOpFactory<InsertArgs<{ id: string }>>('insert', (args) => createInsertOp(args));
