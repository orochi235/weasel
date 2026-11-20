import type { Op } from './types';
import { alreadyHolds } from './alreadyHolds';
import { registerKitOpFactory } from './registry';

interface SetTextAdapter {
  setText(id: string, text: string): void;
}

/** Arguments to {@link createSetTextOp}: replace node `id`'s text `from` → `to`. */
export interface SetTextArgs {
  id: string;
  from: string;
  to: string;
  label?: string;
  coalesceKey?: string;
}

/** Op: set a text node's text content, inverting back to `from`. `coalesceKey`
 *  defaults to `setText:${id}` so successive edits to the same node (typing)
 *  merge into one undo entry within the history's coalesce window. Pass an
 *  explicit key to opt out. Reports a no-op when the node's `text`, read
 *  through the adapter's `getNode`, is already `to`; `from` stands in only
 *  where there is no `getNode`. */
export function createSetTextOp(args: SetTextArgs): Op {
  const { id, from, to, label, coalesceKey = `setText:${id}` } = args;
  return {
    name: 'setText',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      const held = alreadyHolds(adapter, id, (node) => node.text === to) ?? from === to;
      (adapter as SetTextAdapter).setText(id, to);
      return held ? false : undefined;
    },
    invert() {
      return createSetTextOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerKitOpFactory<SetTextArgs>('setText', (args) => createSetTextOp(args));
