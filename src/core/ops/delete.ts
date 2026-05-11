import type { Op } from './types';
import { createInsertOp } from './create';

interface DeleteAdapter {
  removeNode(id: string): void;
}

/** Op: remove `node` from the scene; inverts to a re-insert of the captured node. */
export function createDeleteOp<TNode extends { id: string }>(args: {
  node: TNode;
  label?: string;
}): Op {
  const { node, label } = args;
  return {
    label,
    apply(adapter) {
      (adapter as DeleteAdapter).removeNode(node.id);
    },
    invert() {
      return createInsertOp({ node, label });
    },
  };
}
