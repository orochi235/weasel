import type { NodeId } from '../scene/types';
import type { Op } from './types';

interface SelectionAdapter {
  setSelection(ids: NodeId[]): void;
}

/** Op: replace the current selection with `to`; inverts back to `from`. */
export function createSetSelectionOp(args: {
  from: readonly NodeId[];
  to: readonly NodeId[];
  label?: string;
}): Op {
  const { from, to, label } = args;
  return {
    label,
    apply(adapter) {
      (adapter as SelectionAdapter).setSelection([...to]);
    },
    invert() {
      return createSetSelectionOp({ from: to, to: from, label });
    },
  };
}
