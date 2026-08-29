import type { Op } from './types';
import { createDeleteOp } from './delete';
import { registerOpFactory } from './registry';
import { parentOf, resolveSlot, slotFromIndex, type OrderedReader, type Slot } from './slot';

interface InsertAdapter<TNode> extends OrderedReader {
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
  /** Sibling ordinal to insert at. Sugar for `slot: { index }` — the weaker
   *  of the two forms, and all a fresh-insert callsite can know. */
  index?: number;
  /** Full slot, anchor included. Produced only by `captureSlot` (via a
   *  delete op's `invert`), and supersedes `index` when present. */
  slot?: Slot;
}

/** Op: insert `node` into the scene; inverts to a delete of the same id. */
export function createInsertOp<TNode extends { id: string }>(args: InsertArgs<TNode>): InsertOp {
  const { node, label } = args;
  const slot: Slot = args.slot ?? slotFromIndex(args.index);
  return {
    name: 'insert',
    args: { node, label, slot },
    label,
    apply(adapter) {
      const a = adapter as InsertAdapter<TNode>;
      const parentId = parentOf(node);
      a.insertNode(node, resolveSlot(a.getChildren?.(parentId), slot));
    },
    invert() {
      return createDeleteOp({ node, label, slot });
    },
  };
}

registerOpFactory<InsertArgs<{ id: string }>>('insert', (args) => createInsertOp(args));
