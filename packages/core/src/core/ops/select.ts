import type { Op } from './types';
import { registerKitOpFactory } from './registry';
import { sameList } from '@weasel-js/registry';

interface SelectionAdapter {
  setSelection(ids: string[]): void;
  getSelection?(): readonly string[];
}

/** Arguments to {@link createSetSelectionOp}: replace the selection `from` → `to`. */
export interface SetSelectionArgs {
  from: readonly string[];
  to: readonly string[];
  label?: string;
}

/** Op: replace the current selection with `to`; inverts back to `from`.
 *  Reports a no-op when the selection is already `to`, read through the
 *  adapter's `getSelection` where it has one and from `from` otherwise. */
export function createSetSelectionOp(args: SetSelectionArgs): Op {
  const { from, to, label } = args;
  return {
    name: 'setSelection',
    args: { from, to, label },
    label,
    apply(adapter) {
      // Always call setSelection so consumers that inspect op behavior
      // (tests, overlays) see a consistent "this op writes `to`" signal, and
      // report a no-op to history when the selection is already `to`. The
      // live selection is the answer where it can be read: a stated `from`
      // can be stale.
      const a = adapter as SelectionAdapter;
      const held = typeof a.getSelection === 'function' ? sameList(a.getSelection(), to) : sameList(from, to);
      a.setSelection([...to]);
      return held ? false : undefined;
    },
    invert() {
      return createSetSelectionOp({ from: to, to: from, label });
    },
  };
}

registerKitOpFactory<SetSelectionArgs>('setSelection', (args) => createSetSelectionOp(args));

