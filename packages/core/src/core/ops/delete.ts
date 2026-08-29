import type { Op } from './types';
import { createInsertOp } from './create';
import { registerOpFactory } from './registry';
import { captureSlot, parentOf, slotFromIndex, type OrderedReader, type Slot } from './slot';

interface DeleteAdapter<TNode> extends OrderedReader {
  removeNode(id: string): void;
  /** Subtree reads, used to snapshot descendants before the cascade. Optional
   *  — a flat adapter has neither, and a delete there is a single node. */
  getNode?(id: string): TNode | undefined;
}

interface InsertAdapter<TNode> {
  insertNode(node: TNode, index?: number): void;
  getNode?(id: string): TNode | undefined;
}

/** A captured node plus its slot in its own parent's child list. */
interface Placed<TNode> {
  node: TNode;
  index: number;
}

/** @internal */
interface DeleteArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
  /** Sibling ordinal the node occupies at the moment of delete. Sugar for
   *  `slot: { index }`, and only a seed: `apply` re-observes the node's full
   *  slot through the adapter and that observation supersedes this. Kept
   *  because it is the whole story for a flat adapter with no `getChildren`,
   *  where nothing can be observed. */
  index?: number;
  /** Full slot, anchor included. Written by `apply`; supersedes `index`. */
  slot?: Slot;
  /** Descendants of `node`, preorder (parents before children). `removeNode`
   *  cascades the whole subtree, so an inverse that re-inserts `node` alone
   *  brings the container back empty and drops every child on the floor.
   *  Captured on apply; mirrored into the serialized args so a rebuilt op
   *  can invert without having run. */
  descendants?: Placed<TNode>[];
}

/** Walk `rootId`'s descendants preorder. Returns `null` when the adapter
 *  can't enumerate children, which leaves any previously captured snapshot
 *  in place rather than clobbering it with an empty one. */
function captureDescendants<TNode extends { id: string }>(
  a: DeleteAdapter<TNode>,
  rootId: string,
): Placed<TNode>[] | null {
  const { getChildren, getNode } = a;
  if (!getChildren || !getNode) return null;
  const out: Placed<TNode>[] = [];
  const walk = (parentId: string): void => {
    const kids = getChildren.call(a, parentId);
    for (let i = 0; i < kids.length; i++) {
      const child = getNode.call(a, kids[i]);
      if (!child) continue;
      out.push({ node: child, index: i });
      walk(kids[i]);
    }
  };
  walk(rootId);
  return out;
}

/** Op: remove `node` and its subtree from the scene; inverts to a re-insert
 *  of the whole subtree at its captured slots. */
export function createDeleteOp<TNode extends { id: string }>(args: DeleteArgs<TNode>): Op {
  const { node, label } = args;
  let slot: Slot = args.slot ?? slotFromIndex(args.index);
  const argsForSerial: DeleteArgs<TNode> = { node, label, slot, descendants: args.descendants };
  let captured: Placed<TNode>[] = args.descendants ?? [];
  return {
    name: 'delete',
    args: argsForSerial,
    label,
    apply(adapter) {
      const a = adapter as DeleteAdapter<TNode>;
      const observed = captureSlot(a, parentOf(node), node.id);
      if (observed) {
        slot = observed;
        argsForSerial.slot = observed;
      }
      const snapshot = captureDescendants(a, node.id);
      if (snapshot) {
        captured = snapshot;
        argsForSerial.descendants = snapshot;
      }
      a.removeNode(node.id);
    },
    invert() {
      const subtree = captured;
      const restoredSlot = slot;
      const reinsert = createInsertOp<TNode>({ node, label, slot: restoredSlot });
      if (subtree.length === 0) return reinsert;
      return {
        label,
        apply(adapter) {
          reinsert.apply(adapter);
          const a = adapter as InsertAdapter<TNode>;
          for (const entry of subtree) {
            // A flat adapter's removeNode doesn't cascade, so its children
            // were never gone — re-inserting them would duplicate them.
            if (a.getNode?.(entry.node.id)) continue;
            a.insertNode(entry.node, entry.index);
          }
        },
        invert: () =>
          createDeleteOp<TNode>({ node, label, slot: restoredSlot, descendants: subtree }),
      };
    },
  };
}

registerOpFactory<DeleteArgs<{ id: string }>>('delete', (args) => createDeleteOp(args));
