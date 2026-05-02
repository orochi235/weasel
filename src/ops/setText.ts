import type { Op } from './types';

interface SetTextAdapter {
  setText(id: string, text: string): void;
}

/** Op: set a text node's text content, inverting back to `from`. */
export function createSetTextOp(args: {
  id: string;
  from: string;
  to: string;
  label?: string;
  coalesceKey?: string;
}): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
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
