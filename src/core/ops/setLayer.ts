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

/** Op: set a node's `layer` tag, inverting back to `from`. */
export function createSetLayerOp(args: SetLayerArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
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
