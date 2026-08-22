import { createDeleteOp } from 'core/ops/delete';
import type { Op } from 'core/ops/types';
import type { MoveBehavior } from '../../../gestures/types';
import {
  RECT_ORIGIN_PROJECTION,
  type OriginProjection,
} from '../../../gestures/shared/strategies';
import { scratchKey, getScratch, setScratch } from '../../../scratchKey';

const SNAPSHOTS = scratchKey<Map<string, { id: string }>>('snapBackOrDelete.snapshots');
const INDEXES = scratchKey<Map<string, number>>('snapBackOrDelete.indexes');

/**
 * Move behavior for a drag that is only meaningful near where it started:
 * release inside `radius` and the node returns to its original pose; release
 * outside it and the node either springs back anyway or is deleted, per
 * `onFreeRelease`. A deletion is recorded as an undoable op with paint order
 * preserved.
 */
export function snapBackOrDelete<TPose extends { x: number; y: number }>(args: {
  radius: number;
  onFreeRelease: 'snap-back' | 'delete';
  deleteLabel?: string;
}): MoveBehavior<TPose>;
/** As above, for a `TPose` that is not a rect: `origin` tells the behavior how
 *  to read and write the pose's origin. */
export function snapBackOrDelete<TPose>(args: {
  radius: number;
  onFreeRelease: 'snap-back' | 'delete';
  deleteLabel?: string;
  origin: OriginProjection<TPose>;
}): MoveBehavior<TPose>;
/** Snap back to the origin pose, or delete, depending on where the drag is
 *  released. */
export function snapBackOrDelete<TPose>(args: {
  radius: number;
  onFreeRelease: 'snap-back' | 'delete';
  deleteLabel?: string;
  origin?: OriginProjection<TPose>;
}): MoveBehavior<TPose> {
  const { radius, onFreeRelease, deleteLabel = 'Delete' } = args;
  const proj: OriginProjection<TPose> =
    args.origin ?? (RECT_ORIGIN_PROJECTION as unknown as OriginProjection<TPose>);
  const r2 = radius * radius;

  return {
    onStart(ctx) {
      // Snapshot the dragged objects + their z-indexes at gesture start so
      // delete can undo with paint order intact.
      const snapshots = new Map<string, { id: string }>();
      const indexes = new Map<string, number>();
      const nodes = ctx.adapter.getNodes();
      for (const id of ctx.draggedIds) {
        const obj = ctx.adapter.getNode(id) ?? { id };
        snapshots.set(id, obj);
        indexes.set(id, nodes.findIndex((n) => n.id === id));
      }
      setScratch(ctx.scratch, SNAPSHOTS, snapshots);
      setScratch(ctx.scratch, INDEXES, indexes);
    },

    onEnd(ctx) {
      if (ctx.snap) return;
      const id = ctx.draggedIds[0];
      const o0 = proj.getOrigin(ctx.origin.get(id)!);
      const o1 = proj.getOrigin(ctx.current.get(id)!);
      const dx = o1.x - o0.x;
      const dy = o1.y - o0.y;
      const within = dx * dx + dy * dy <= r2;
      if (within) {
        return null;
      }
      if (onFreeRelease === 'delete') {
        const snapshots = getScratch(ctx.scratch, SNAPSHOTS);
        const indexes = getScratch(ctx.scratch, INDEXES);
        const obj = snapshots?.get(id) ?? { id };
        const index = indexes?.get(id) ?? -1;
        const ops: Op[] = [createDeleteOp({ node: obj, label: deleteLabel, index })];
        return ops;
      }
      // `'snap-back'` — abort, same as a release inside the radius. Returning
      // `undefined` would defer to the default translate and leave the node
      // where it was dropped, which is the one thing this policy rules out.
      return null;
    },
  };
}
