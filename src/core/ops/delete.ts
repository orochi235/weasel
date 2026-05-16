import type { Op } from './types';
import { createInsertOp } from './create';
import { registerOpFactory } from './registry';

interface DeleteAdapter {
  removeNode(id: string): void;
}

/** @internal */
interface DeleteArgs<TNode extends { id: string }> {
  node: TNode;
  label?: string;
  /** Z-index the node occupies in its host array at the moment of delete.
   *  Forwarded through `invert()` to the re-insert so undo restores paint
   *  order — without this, undo of a multi-delete batch fully reverses
   *  the stack. Required: every delete callsite knows where the node sits
   *  (it has to, to remove it), so there's no good reason to drop the
   *  data on the floor. */
  index: number;
}

/** Op: remove `node` from the scene; inverts to a re-insert of the captured node. */
export function createDeleteOp<TNode extends { id: string }>(args: DeleteArgs<TNode>): Op {
  const { node, label, index } = args;
  return {
    name: 'delete',
    args: { node, label, index },
    label,
    apply(adapter) {
      (adapter as DeleteAdapter).removeNode(node.id);
    },
    invert() {
      return createInsertOp({ node, label, index });
    },
  };
}

registerOpFactory<DeleteArgs<{ id: string }>>('delete', (args) => createDeleteOp(args));
