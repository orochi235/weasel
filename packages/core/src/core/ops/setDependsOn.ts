import type { Op } from './types';
import { sameDependsOn } from '../scene/dependents';
import { alreadyHolds } from './alreadyHolds';
import { registerOpFactory } from './registry';

type DependsOn = readonly string[] | 'children' | undefined;
type Sources = Parameters<typeof sameDependsOn>[0];

interface SetDependsOnAdapter {
  setDependsOn(id: string, dependsOn: DependsOn): void;
}

/** Arguments to {@link createSetDependsOnOp}: retarget node `id`'s derivation
 *  from the sources `from` to `to`. `undefined` is no derivation. */
export interface SetDependsOnArgs {
  id: string;
  from: DependsOn;
  to: DependsOn;
  label?: string;
  coalesceKey?: string;
}

/** Op: set what a derived node's geometry derives from, inverting back to
 *  `from`. */
export function createSetDependsOnOp(args: SetDependsOnArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name: 'setDependsOn',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      const held = alreadyHolds(adapter, id, (node) => sameDependsOn(node.dependsOn as Sources, to as Sources));
      (adapter as SetDependsOnAdapter).setDependsOn(id, to);
      return held ? false : undefined;
    },
    invert() {
      return createSetDependsOnOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

registerOpFactory<SetDependsOnArgs>('setDependsOn', (args) => createSetDependsOnOp(args));
