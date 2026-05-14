import type { Op } from './types';
import { registerOpFactory } from './registry';

interface ReparentAdapter {
  setParent(id: string, parentId: string | null): void;
}

interface ReparentArgs {
  id: string;
  fromParentId: string | null;
  toParentId: string | null;
  label?: string;
  coalesceKey?: string;
}

/**
 * Op: change `id`'s parent, inverting back to the prior parent.
 *
 * `coalesceKey` defaults to `reparent:${id}` so successive reparents of the
 * same id batch-merge cleanly.
 */
export function createReparentOp(args: ReparentArgs): Op {
  const { id, fromParentId, toParentId, label = 'Reparent', coalesceKey = `reparent:${id}` } = args;
  return {
    name: 'reparent',
    args: { id, fromParentId, toParentId, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as ReparentAdapter).setParent(id, toParentId);
    },
    invert() {
      return createReparentOp({
        id,
        fromParentId: toParentId,
        toParentId: fromParentId,
        label,
        coalesceKey,
      });
    },
  };
}

registerOpFactory<ReparentArgs>('reparent', (args) => createReparentOp(args));
