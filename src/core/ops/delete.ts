import type { Op } from './types';
import { createInsertOp } from './create';
import { registerOpFactory } from './registry';

interface DeleteAdapter {
  removeNode(id: string): void;
}

interface DeleteArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
}

/** Op: remove `node` from the scene; inverts to a re-insert of the captured node. */
export function createDeleteOp<TNode extends { id: string }>(args: DeleteArgs<TNode>): Op {
  const { node, label } = args;
  return {
    name: 'delete',
    args: { node, label },
    label,
    apply(adapter) {
      (adapter as DeleteAdapter).removeNode(node.id);
    },
    invert() {
      return createInsertOp({ node, label });
    },
  };
}

registerOpFactory<DeleteArgs<{ id: string }>>('delete', (args) => createDeleteOp(args));
