import { createDeleteOp } from '../../../../../core/ops/delete';
import type { Op } from '../../../../../core/ops/types';
import type { MoveBehavior } from '../../types';
import {
  RECT_ORIGIN_PROJECTION,
  type OriginProjection,
} from '../../shared/strategies';

export function snapBackOrDelete<TPose extends { x: number; y: number }>(args: {
  radius: number;
  onFreeRelease: 'snap-back' | 'delete';
  deleteLabel?: string;
}): MoveBehavior<TPose>;
export function snapBackOrDelete<TPose>(args: {
  radius: number;
  onFreeRelease: 'snap-back' | 'delete';
  deleteLabel?: string;
  origin: OriginProjection<TPose>;
}): MoveBehavior<TPose>;
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
      // Snapshot the dragged objects at gesture start so delete can undo.
      const snapshots = new Map<string, { id: string }>();
      for (const id of ctx.draggedIds) {
        const obj = ctx.adapter.getObject(id) ?? { id };
        snapshots.set(id, obj);
      }
      ctx.scratch['snapBackOrDelete.snapshots'] = snapshots;
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
        const snapshots = ctx.scratch['snapBackOrDelete.snapshots'] as
          | Map<string, { id: string }>
          | undefined;
        const obj = snapshots?.get(id) ?? { id };
        const ops: Op[] = [createDeleteOp({ object: obj, label: deleteLabel })];
        return ops;
      }
      return;
    },
  };
}
