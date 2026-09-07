import type { Op } from './types';
import { createInsertOp } from './create';
import { registerOpFactory } from './registry';
import { captureSlot, parentOf, slotFromIndex, type OrderedReader, type Slot } from './slot';

interface DeleteAdapter<TNode> extends OrderedReader {
  removeNode(id: string): void;
  /** Subtree reads, used to snapshot the cascade before it runs. Optional
   *  — a flat adapter has neither, and a delete there is a single node. */
  getNode?(id: string): TNode | undefined;
  /** Every id `removeNode` would take with this one. Optional: a store whose
   *  removal cascades along nothing but the subtree needs no such answer, and
   *  `getChildren` is enough. A store that cascades further — the kit's scene
   *  takes a deleted node's dependents too — must answer here, or the nodes it
   *  cascades away are absent from the snapshot and undo brings back the named
   *  node alone. */
  getRemovalClosure?(ids: readonly string[]): readonly string[];
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
  /** Everything `removeNode` takes, `node` itself included — its subtree, and
   *  whatever else the adapter cascades. An inverse that re-inserts `node`
   *  alone brings a container back empty and leaves every dependent deleted.
   *  Ordered so a node's parent precedes it, which is the order they have to
   *  be re-inserted in. Captured on apply; mirrored into the serialized args so
   *  a rebuilt op can invert without having run. */
  cascaded?: Placed<TNode>[];
}

/** `id`'s ordinal among `parentId`'s children, or `-1` when unobservable. */
function indexIn(a: OrderedReader, parentId: string | null, id: string): number {
  return a.getChildren?.(parentId)?.indexOf(id) ?? -1;
}

/**
 * Snapshot everything removing `rootId` takes with it, `rootId` included.
 *
 * Returns `null` when the adapter can't enumerate, which leaves any previously
 * captured snapshot in place rather than clobbering it with an empty one.
 *
 * The order is the whole point. A cascade unlinks several disjoint subtrees, so
 * the captured set is walked as a forest: a node whose parent is not also going
 * is a detach root, and each one is emitted — ascending sibling index first, so
 * every slot still means what it meant — followed by its captured descendants
 * preorder. The closure's own order will not do: it reaches a dependent before
 * the parent it sits under whenever that parent is in the closure as a
 * dependent too, and re-inserting a child under a parent that is not back yet
 * puts it in the wrong place.
 */
function captureCascade<TNode extends { id: string }>(
  a: DeleteAdapter<TNode>,
  rootId: string,
): Placed<TNode>[] | null {
  const { getChildren, getNode } = a;
  if (!getChildren || !getNode) return null;

  const closure = a.getRemovalClosure?.([rootId]);
  const taken = new Map<string, TNode>();
  if (closure) {
    for (const id of closure) {
      const node = getNode.call(a, id);
      if (node) taken.set(id, node);
    }
  } else {
    // No closure read: the cascade is the subtree, discovered here.
    const walk = (id: string): void => {
      const node = getNode.call(a, id);
      if (!node) return;
      taken.set(id, node);
      for (const kid of getChildren.call(a, id)) walk(kid);
    };
    walk(rootId);
  }

  const detachRoots = [...taken.values()]
    .filter((n) => { const p = parentOf(n); return p === null || !taken.has(p); })
    .map((n) => ({ node: n, index: indexIn(a, parentOf(n), n.id) }))
    .sort((l, r) => l.index - r.index);

  const out: Placed<TNode>[] = [];
  const emitSubtree = (entry: Placed<TNode>): void => {
    out.push(entry);
    const kids = getChildren.call(a, entry.node.id);
    for (let i = 0; i < kids.length; i++) {
      const child = taken.get(kids[i]!);
      if (child) emitSubtree({ node: child, index: i });
    }
  };
  for (const entry of detachRoots) emitSubtree(entry);
  return out;
}

/** Op: remove `node` and everything the adapter cascades with it; inverts to a
 *  re-insert of the whole set at its captured slots. */
export function createDeleteOp<TNode extends { id: string }>(args: DeleteArgs<TNode>): Op {
  const { node, label } = args;
  let slot: Slot = args.slot ?? slotFromIndex(args.index);
  const argsForSerial: DeleteArgs<TNode> = { node, label, slot, cascaded: args.cascaded };
  let captured: Placed<TNode>[] = args.cascaded ?? [];
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
      const snapshot = captureCascade(a, node.id);
      if (snapshot) {
        captured = snapshot;
        argsForSerial.cascaded = snapshot;
      }
      a.removeNode(node.id);
    },
    invert() {
      const cascaded = captured;
      const restoredSlot = slot;
      // The root's own placement keeps the anchor-bearing slot; the rest have
      // only an ordinal, which is all `getChildren` can observe of them.
      const reinsertRoot = createInsertOp<TNode>({ node, label, slot: restoredSlot });
      if (cascaded.length === 0) return reinsertRoot;
      return {
        label,
        apply(adapter) {
          const a = adapter as InsertAdapter<TNode>;
          for (const entry of cascaded) {
            // A flat adapter's removeNode doesn't cascade, so its children
            // were never gone — re-inserting them would duplicate them.
            if (a.getNode?.(entry.node.id)) continue;
            if (entry.node.id === node.id) reinsertRoot.apply(adapter);
            else a.insertNode(entry.node, entry.index);
          }
        },
        invert: () =>
          createDeleteOp<TNode>({ node, label, slot: restoredSlot, cascaded }),
      };
    },
  };
}

registerOpFactory<DeleteArgs<{ id: string }>>('delete', (args) => createDeleteOp(args));
