import type { Op } from '../types';
import { registerOpFactory } from '../registry';
import {
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  moveToIndex,
} from './algorithms';

export { canBringForward, canSendBackward } from './algorithms';

interface ReorderAdapter {
  getParent?(id: string): string | null;
  getChildren?(parentId: string | null): string[];
  setChildOrder?(parentId: string | null, ids: string[]): void;
}

type ReorderFn = (list: string[], ids: string[]) => string[];

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

interface RestoreEntry {
  parentId: string | null;
  before: string[];
}

/**
 * Build an op that, on apply, partitions `ids` by their current parent,
 * runs `fn(currentChildren, idsForParent)` per parent, and writes the
 * result back via setChildOrder. Records before-state per parent so invert
 * is exact.
 */
function createPartitionedReorderOp(args: {
  ids: string[];
  fn: ReorderFn;
  label?: string;
}): Op {
  const { ids, fn, label } = args;
  let restore: RestoreEntry[] | null = null;

  return {
    label,
    apply(adapter) {
      const a = adapter as ReorderAdapter;
      if (!a.getChildren || !a.setChildOrder) return false; // graceful no-op
      // Partition ids by current parent.
      const byParent = new Map<string | null, string[]>();
      for (const id of ids) {
        const parent = a.getParent ? a.getParent(id) : null;
        const list = byParent.get(parent) ?? [];
        list.push(id);
        byParent.set(parent, list);
      }
      const snapshots: RestoreEntry[] = [];
      let mutated = false;
      for (const [parentId, parentIds] of byParent) {
        const before = a.getChildren(parentId);
        const after = fn(before, parentIds);
        if (arraysEqual(before, after)) continue; // already at the desired order
        snapshots.push({ parentId, before: before.slice() });
        a.setChildOrder(parentId, after);
        mutated = true;
      }
      restore = snapshots;
      return mutated;
    },
    invert() {
      const captured = restore;
      return {
        label,
        apply(adapter) {
          if (!captured) return;
          const a = adapter as ReorderAdapter;
          if (!a.setChildOrder) return;
          for (const entry of captured) {
            a.setChildOrder(entry.parentId, entry.before.slice());
          }
        },
        invert() {
          // Inverting twice should reapply the original; we don't support
          // this round-trip beyond two levels — the kit's history layer
          // doesn't need it. Return a no-op for safety.
          return { apply() {}, invert() { return this; } };
        },
      };
    },
  };
}

/** Direction of a sibling z-order reorder. */
export type ReorderDirection = 'forward' | 'backward' | 'front' | 'back';

const REORDER_DIRECTIONS: Record<ReorderDirection, { fn: ReorderFn; defaultLabel: string }> = {
  forward:  { fn: bringForward,  defaultLabel: 'Bring forward' },
  backward: { fn: sendBackward,  defaultLabel: 'Send backward' },
  front:    { fn: bringToFront,  defaultLabel: 'Bring to front' },
  back:     { fn: sendToBack,    defaultLabel: 'Send to back' },
};

/**
 * Op: shift each id within its parent's child order per `direction`:
 *   - `'forward'`  — bump one step toward the top
 *   - `'backward'` — bump one step toward the bottom
 *   - `'front'`    — move to the top, preserving relative order
 *   - `'back'`     — move to the bottom, preserving relative order
 */
export function createReorderOp(args: {
  ids: string[];
  direction: ReorderDirection;
  label?: string;
}): Op {
  const { ids, direction, label } = args;
  const { fn, defaultLabel } = REORDER_DIRECTIONS[direction];
  return createPartitionedReorderOp({ ids, fn, label: label ?? defaultLabel });
}

interface MoveToIndexArgs {
  ids: string[];
  parentId: string | null;
  index: number;
  label?: string;
  /** Optional pre-mutation child order for the parent. When present, the op
   *  uses it as the invert target instead of capturing at apply time — this
   *  is how a deserialized op (whose original `apply` already ran in a prior
   *  session) restores its invert behavior across an IDB round-trip. */
  prevPositions?: string[];
}

/** Op: move all `ids` to a contiguous block starting at `index` within `parentId`'s child order. */
export function createMoveToIndexOp(args: MoveToIndexArgs): Op {
  const { ids, parentId, index, label } = args;
  // Outer args record we'll mutate so the captured `before` lands in the
  // serialized form. `prevPositions` arrives populated when reconstructed
  // from a snapshot; otherwise it's filled in on first apply.
  const argsForSerial: MoveToIndexArgs = {
    ids,
    parentId,
    index,
    label,
    prevPositions: args.prevPositions ? args.prevPositions.slice() : undefined,
  };
  let before: string[] | null = args.prevPositions ? args.prevPositions.slice() : null;

  return {
    name: 'moveToIndex',
    args: argsForSerial,
    label: label ?? 'Move to index',
    apply(adapter) {
      const a = adapter as ReorderAdapter;
      if (!a.getChildren || !a.setChildOrder) return;
      // Filter to ids whose current parent matches target parent.
      const eligible = ids.filter((id) => {
        const p = a.getParent ? a.getParent(id) : null;
        return p === parentId;
      });
      const current = a.getChildren(parentId);
      // Only overwrite `before` the first time we apply; redo (a second
      // apply) must not clobber the originally-captured order, otherwise
      // invert would replay the post-move state and undo nothing.
      if (before === null) {
        before = current.slice();
        argsForSerial.prevPositions = before.slice();
      }
      const after = moveToIndex(current, eligible, index);
      a.setChildOrder(parentId, after);
    },
    invert() {
      const captured = before;
      return {
        label,
        apply(adapter) {
          if (!captured) return;
          const a = adapter as ReorderAdapter;
          a.setChildOrder?.(parentId, captured.slice());
        },
        invert() { return { apply() {}, invert() { return this; } }; },
      };
    },
  };
}

registerOpFactory<MoveToIndexArgs>('moveToIndex', (args) => createMoveToIndexOp(args));
