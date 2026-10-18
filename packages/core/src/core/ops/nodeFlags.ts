import type { Op } from './types';
import { registerOpFactory } from './registry';

interface NodeFlagAdapter {
  setHidden(id: string, hidden: boolean): void;
  setLocked(id: string, locked: boolean): void;
}

/** Arguments to {@link createSetHiddenOp} and {@link createSetLockedOp}: set
 *  node `id`'s flag `from` → `to`. */
export interface NodeFlagArgs {
  id: string;
  from: boolean;
  to: boolean;
  label?: string;
  coalesceKey?: string;
}

function flagOp(name: 'setHidden' | 'setLocked', args: NodeFlagArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name,
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as NodeFlagAdapter)[name](id, to);
    },
    invert() {
      return flagOp(name, { id, from: to, to: from, label, coalesceKey });
    },
  };
}

/** Op: hide or show a node and its subtree (`SceneNode.hidden`), inverting back to `from`. */
export function createSetHiddenOp(args: NodeFlagArgs): Op {
  return flagOp('setHidden', args);
}

/** Op: lock or unlock a node and its subtree (`SceneNode.locked`), inverting back to `from`. */
export function createSetLockedOp(args: NodeFlagArgs): Op {
  return flagOp('setLocked', args);
}

registerOpFactory<NodeFlagArgs>('setHidden', (args) => createSetHiddenOp(args));
registerOpFactory<NodeFlagArgs>('setLocked', (args) => createSetLockedOp(args));
