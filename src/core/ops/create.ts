import type { Op } from './types';
import { createDeleteOp } from './delete';

interface InsertAdapter<TNode> {
  insertNode(node: TNode): void;
}

/** Type alias for ops produced by `createInsertOp`. Carries no extra type info today;
 *  exists so consumers can name the op type when needed. */
export type InsertOp = Op;

/** Op: insert `node` into the scene; inverts to a delete of the same id. */
export function createInsertOp<TNode extends { id: string }>(args: {
  node: TNode;
  label?: string;
}): InsertOp {
  const { node, label } = args;
  return {
    label,
    apply(adapter) {
      (adapter as InsertAdapter<TNode>).insertNode(node);
    },
    invert() {
      return createDeleteOp({ node, label });
    },
  };
}
