import type { Op } from './types';
import { registerOpFactory } from './registry';

interface SetTextAdapter {
  setText(id: string, text: string): void;
}

/** @internal */
interface SetTextArgs {
  id: string;
  from: string;
  to: string;
  label?: string;
  coalesceKey?: string;
}

/** Op: set a text node's text content, inverting back to `from`. `coalesceKey`
 *  defaults to `setText:${id}` so successive edits to the same node (typing)
 *  merge into one undo entry within the history's coalesce window. Pass an
 *  explicit key to opt out. */
export function createSetTextOp(args: SetTextArgs): Op {
  const { id, from, to, label, coalesceKey = `setText:${id}` } = args;
  return {
    name: 'setText',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as SetTextAdapter).setText(id, to);
    },
    invert() {
      return createSetTextOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerOpFactory<SetTextArgs>('setText', (args) => createSetTextOp(args));
