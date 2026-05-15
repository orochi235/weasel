import type { Op } from './types';
import { createDeleteOp } from './delete';
import { registerOpFactory } from './registry';

interface InsertAdapter<TNode> {
  insertNode(node: TNode): void;
}

/** Type alias for ops produced by `createInsertOp`. Carries no extra type info today;
 *  exists so consumers can name the op type when needed. */
export type InsertOp = Op;

/** @internal */
interface InsertArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
}

/** Op: insert `node` into the scene; inverts to a delete of the same id. */
export function createInsertOp<TNode extends { id: string }>(args: InsertArgs<TNode>): InsertOp {
  const { node, label } = args;
  return {
    name: 'insert',
    args: { node, label },
    label,
    apply(adapter) {
      (adapter as InsertAdapter<TNode>).insertNode(node);
    },
    invert() {
      return createDeleteOp({ node, label });
    },
  };
}

registerOpFactory<InsertArgs<{ id: string }>>('insert', (args) => createInsertOp(args));
