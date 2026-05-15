import type { NodeId } from '../scene/types';
import type { Op } from './types';
import { registerOpFactory } from './registry';

interface SelectionAdapter {
  setSelection(ids: NodeId[]): void;
}

/** @internal */
interface SetSelectionArgs {
  from: readonly NodeId[];
  to: readonly NodeId[];
  label?: string;
}

/** Op: replace the current selection with `to`; inverts back to `from`. */
export function createSetSelectionOp(args: SetSelectionArgs): Op {
  const { from, to, label } = args;
  return {
    name: 'setSelection',
    args: { from, to, label },
    label,
    apply(adapter) {
      // Always call setSelection so consumers that inspect op behavior
      // (tests, overlays) see a consistent "this op writes `to`" signal.
      // When from and to are sequence-equal, additionally report a no-op
      // to history so the entry can be skipped from the undo stack.
      // setSelection with the same value is idempotent.
      (adapter as SelectionAdapter).setSelection([...to]);
      if (sequenceEqual(from, to)) return false;
      return undefined;
    },
    invert() {
      return createSetSelectionOp({ from: to, to: from, label });
    },
  };
}

registerOpFactory<SetSelectionArgs>('setSelection', (args) => createSetSelectionOp(args));

function sequenceEqual(a: readonly NodeId[], b: readonly NodeId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
