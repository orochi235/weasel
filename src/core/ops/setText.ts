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

/** Op: set a text node's text content, inverting back to `from`. */
export function createSetTextOp(args: SetTextArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
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
