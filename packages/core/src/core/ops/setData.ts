import type { Op } from './types';
import { registerOpFactory } from './registry';

interface SetDataAdapter<TData> {
  setData(id: string, data: TData): void;
}

/** @internal */
interface SetDataArgs<TData> {
  id: string;
  from: TData;
  to: TData;
  label?: string;
  coalesceKey?: string;
}

/** Op: set a node's app-defined `data` payload, inverting back to `from`. */
export function createSetDataOp<TData>(args: SetDataArgs<TData>): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name: 'setData',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as SetDataAdapter<TData>).setData(id, to);
    },
    invert() {
      return createSetDataOp<TData>({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerOpFactory<SetDataArgs<unknown>>('setData', (args) => createSetDataOp(args));
