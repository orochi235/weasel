import { createMoveToIndexOp } from 'core/ops/reorder';
import type { Op } from 'core/ops/types';
import type { BooleanZOrder } from './booleans';

/**
 * The ops that put each result where its source was. Results are grouped by
 * their source's parent, and each group lands as one block, in result order,
 * in the slot of the topmost source in that parent.
 *
 * `sourceSlots` holds every source's slot, read before anything is deleted.
 * The sources below a slot in the same parent are deleted before the reorder
 * runs, so the block goes that many places lower. A result whose source has
 * no slot is left wherever the insert put it.
 */
export function placementOps(
  results: readonly { id: string; slot: BooleanZOrder | undefined }[],
  sourceSlots: readonly (BooleanZOrder | undefined)[],
): Op[] {
  const groups = new Map<string | null, string[]>();
  for (const r of results) {
    if (!r.slot) continue;
    const group = groups.get(r.slot.parentId);
    if (group) group.push(r.id);
    else groups.set(r.slot.parentId, [r.id]);
  }
  const ops: Op[] = [];
  for (const [parentId, ids] of groups) {
    const indices = sourceSlots.flatMap((s) => (s && s.parentId === parentId ? [s.index] : []));
    const top = Math.max(...indices);
    ops.push(createMoveToIndexOp({ ids, parentId, index: top - (indices.length - 1) }));
  }
  return ops;
}
