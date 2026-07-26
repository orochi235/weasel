import type { Op } from './types';
import { registerOpFactory } from './registry';

interface SetLayerAdapter {
  setLayer(id: string, layer: string): void;
}

/** @internal */
interface SetLayerArgs {
  id: string;
  from: string;
  to: string;
  label?: string;
  coalesceKey?: string;
}

/** Op: set a node's `layer` tag, inverting back to `from`. `coalesceKey`
 *  defaults to `setLayer:${id}` so successive layer changes to the same node
 *  merge into one undo entry within the history's coalesce window. Pass an
 *  explicit key to opt out. */
export function createSetLayerOp(args: SetLayerArgs): Op {
  const { id, from, to, label, coalesceKey = `setLayer:${id}` } = args;
  return {
    name: 'setLayer',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as SetLayerAdapter).setLayer(id, to);
    },
    invert() {
      return createSetLayerOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerOpFactory<SetLayerArgs>('setLayer', (args) => createSetLayerOp(args));
