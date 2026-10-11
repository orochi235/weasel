import type { Op } from './types';
import { createDeleteOp, type PlacedNode } from './delete';
import { registerOpFactory } from './registry';
import { parentOf, resolveSlot, slotFromIndex, type OrderedReader, type SiblingSlot } from './slot';

interface InsertAdapter<TNode> extends OrderedReader {
  getNode?(id: string): TNode | undefined;
  /** When `index` is supplied, insert at that position; adapters that ignore
   *  the second arg (or don't expose it) fall back to their default
   *  placement (typically append-to-end). */
  insertNode(node: TNode, index?: number): void;
}

/** Type alias for ops produced by `createInsertOp`. Carries no extra type info today;
 *  exists so consumers can name the op type when needed. */
export type InsertOp = Op;

/** Arguments to {@link createInsertOp}: the node to insert and where among its siblings. */
export interface InsertArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
  /** Sibling ordinal to insert at. Sugar for `slot: { index }` — the weaker
   *  of the two forms, and all a fresh-insert callsite can know. */
  index?: number;
  /** Full slot, anchor included. Produced only by `captureSlot` (via a
   *  delete op's `invert`), and supersedes `index` when present. */
  slot?: SiblingSlot;
  /** Every node to insert, `node` itself included, each at its ordinal among
   *  its own parent's children and ordered so a parent precedes its children.
   *  What a delete's `cascaded` captures, and how its inverse brings the whole
   *  set back; `node` still goes in at `slot`. One already present is skipped. */
  cascaded?: PlacedNode<TNode>[];
}

/** Op: insert `node`, and the rest of `cascaded` with it; inverts to a delete
 *  of `node`. */
export function createInsertOp<TNode extends { id: string }>(args: InsertArgs<TNode>): InsertOp {
  const { node, label, cascaded } = args;
  const slot: SiblingSlot = args.slot ?? slotFromIndex(args.index);
  return {
    name: 'insert',
    args: { node, label, slot, ...(cascaded ? { cascaded } : {}) },
    label,
    apply(adapter) {
      const a = adapter as InsertAdapter<TNode>;
      const insertRoot = (): void => {
        a.insertNode(node, resolveSlot(a.getChildren?.(parentOf(node)), slot));
      };
      if (!cascaded || cascaded.length === 0) return insertRoot();
      for (const entry of cascaded) {
        // A flat adapter's removeNode doesn't cascade, so its children
        // were never gone — re-inserting them would duplicate them.
        if (a.getNode?.(entry.node.id)) continue;
        if (entry.node.id === node.id) insertRoot();
        else a.insertNode(entry.node, entry.index);
      }
    },
    invert() {
      return createDeleteOp({ node, label, slot, ...(cascaded ? { cascaded } : {}) });
    },
  };
}

registerOpFactory<InsertArgs<{ id: string }>>('insert', (args) => createInsertOp(args));
