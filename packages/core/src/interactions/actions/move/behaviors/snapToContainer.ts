import { createTransformOp } from 'core/ops/transform';
import { createReparentOp } from 'core/ops/reparent';
import type { Op } from 'core/ops/types';
import type { SnapTarget } from 'core/adapters/types';
import type { MoveBehavior, GestureContext } from '../../../gestures/types';
import { scratchKey, getScratch, setScratch } from '@weasel-js/routing';

interface SnapState<TPose> {
  pendingTargetId: string | null;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  committedSnap: SnapTarget<TPose> | null;
}

// The slot is generic over TPose; we keep the unknown-pose key at module
// scope and project it through `as` at the read site (each consumer call
// of `snapToContainer<TPose>` is the only writer of its own SnapState
// instance, so the cast is safe at runtime).
const STATE = scratchKey<SnapState<unknown>>('snapToContainer');

function getState<TPose>(ctx: GestureContext<TPose>): SnapState<TPose> {
  let s = getScratch(ctx.scratch, STATE) as SnapState<TPose> | undefined;
  if (!s) {
    s = { pendingTargetId: null, pendingTimer: null, committedSnap: null };
    setScratch(ctx.scratch, STATE, s as SnapState<unknown>);
  }
  return s;
}

function clearTimer<TPose>(s: SnapState<TPose>) {
  if (s.pendingTimer !== null) {
    clearTimeout(s.pendingTimer);
    s.pendingTimer = null;
  }
  s.pendingTargetId = null;
}

/**
 * Move behavior that drops the dragged nodes into a container the pointer
 * hovers over for `dwellMs`, reparenting each and giving it the slot
 * `findTarget` answers for its id. The first dragged node's slot is what the
 * drag previews; a node `findTarget` has no slot for in that container lands
 * where the preview drew it.
 *
 * The dwell is what keeps a drag that merely passes over a container from
 * being captured by it.
 */
export function snapToContainer<TPose>(args: {
  dwellMs: number;
  findTarget: (
    draggedId: string,
    worldX: number,
    worldY: number,
  ) => SnapTarget<TPose> | null;
  isInstant?: (target: SnapTarget<TPose>) => boolean;
  moveLabel?: string;
  reparentLabel?: string;
}): MoveBehavior<TPose> {
  const { dwellMs, findTarget, isInstant, moveLabel = 'Move', reparentLabel = 'Move and reparent' } = args;

  return {
    onMove(ctx, _proposed) {
      const s = getState<TPose>(ctx);
      const target = findTarget(ctx.draggedIds[0], ctx.pointer.worldX, ctx.pointer.worldY);

      if (s.committedSnap) {
        if (target && target.parentId === s.committedSnap.parentId) {
          return { pose: s.committedSnap.slotPose, snap: s.committedSnap };
        }
        s.committedSnap = null;
      }

      if (!target) {
        clearTimer(s);
        return;
      }

      if (isInstant?.(target)) {
        clearTimer(s);
        s.committedSnap = target;
        return { pose: target.slotPose, snap: target };
      }

      if (s.pendingTargetId === target.parentId) {
        return;
      }
      clearTimer(s);
      s.pendingTargetId = target.parentId;
      s.pendingTimer = setTimeout(() => {
        s.committedSnap = target;
        s.pendingTimer = null;
      }, dwellMs);
      return;
    },

    onCancel(ctx) { clearTimer(getState<TPose>(ctx)); },

    onEnd(ctx) {
      const s = getState<TPose>(ctx);
      clearTimer(s);
      const snap = s.committedSnap ?? ctx.snap;
      if (!snap) return;
      const ops: Op[] = [];
      const [primary, ...rest] = ctx.draggedIds;
      // The primary takes the snapped slot. Each other node asks for its own
      // in the same container, and lands where the preview drew it if it has none.
      const slots = new Map<string, TPose>([[primary, snap.slotPose]]);
      for (const id of rest) {
        const own = findTarget(id, ctx.pointer.worldX, ctx.pointer.worldY);
        slots.set(id, own?.parentId === snap.parentId ? own.slotPose : ctx.current.get(id)!);
      }
      for (const [id, to] of slots) {
        ops.push(createTransformOp<TPose>({ id, from: ctx.origin.get(id)!, to, label: moveLabel }));
        const oldParent = ctx.adapter.getParent?.(id) ?? null;
        if (oldParent !== snap.parentId) {
          ops.push(createReparentOp({
            id,
            fromParentId: oldParent,
            toParentId: snap.parentId,
            label: reparentLabel,
          }));
        }
      }
      return ops;
    },
  };
}
