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
      // Self-report no-op when from and to are set-equal (compared as
      // ordered sequences here, since the kit treats selection order as
      // meaningful — first-selected stays primary). Same rationale as
      // the reorder/transform self-report: history skips no-op entries.
      if (sequenceEqual(from, to)) return false;
      (adapter as SelectionAdapter).setSelection([...to]);
      return undefined;
    },
    invert() {
      return createSetSelectionOp({ from: to, to: from, label });
    },
  };
}

function sequenceEqual(a: readonly NodeId[], b: readonly NodeId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
