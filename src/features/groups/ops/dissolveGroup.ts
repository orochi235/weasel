import type { Op } from 'core/ops/types';
import type { Group, GroupAdapter } from '../types';
import { createCreateGroupOp } from './createGroup';

/**
 * Remove a group. Stores the full group snapshot for revert so
 * undo can restore the exact member list.
 */
export function createDissolveGroupOp(args: { group: Group; label?: string }): Op {
  const { group, label } = args;
  return {
    label,
    apply(adapter) {
      (adapter as GroupAdapter).removeGroup(group.id);
    },
    invert() {
      return createCreateGroupOp({ group, label });
    },
  };
}
