import { createInsertOp } from 'core/ops/create';
import { createSetSelectionOp } from 'core/ops/select';
import type { NodeId } from 'core/scene/types';
import type { CloneBehavior } from '../../../gestures/types';

/** Clone-on-alt-drag behavior for `useClone`; activates when Alt/Option is held at drag start. */
export function cloneByAltDrag(): CloneBehavior {
  return {
    id: 'cloneByAltDrag',
    activates: (mods) => mods.alt === true,
    onEnd(pose, ctx) {
      if (!ctx.adapter.snapshotSelection || !ctx.adapter.commitPaste) return [];
      const snap = ctx.adapter.snapshotSelection(pose.ids);
      const created = ctx.adapter.commitPaste(snap, pose.offset, {
        dropPoint: { worldX: pose.worldX, worldY: pose.worldY },
      });
      if (created.length === 0) return [];
      const newIds = created.map((o: { id: string }) => o.id);
      const from = ctx.adapter.getSelection?.() ?? [];
      return [
        ...created.map((o) => createInsertOp({ node: o })),
        createSetSelectionOp({ from: from as NodeId[], to: newIds as NodeId[] }),
      ];
    },
  };
}
