import { createTransformOp } from 'core/ops/transform';
import { definesFrame } from 'core/scene/effectivePose';
import { createReparentOp } from 'core/ops/reparent';
import type { Op } from 'core/ops/types';
import type { SnapTarget } from 'core/adapters/types';
import type { BehaviorResult, MoveBehavior, GestureContext } from '../../../gestures/types';
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
 * `findTarget` answers for its id. A node `findTarget` has no slot for in
 * that container rides along with the first, at its offset from it.
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

  /** Each dragged node's slot in the snapped container: the snapped slot for
   *  the first, and for each other node the one `findTarget` answers for it. */
  const slotsFor = (ctx: GestureContext<TPose>, snap: SnapTarget<TPose>): Map<string, TPose> => {
    const [primary, ...rest] = ctx.draggedIds;
    const slots = new Map<string, TPose>([[primary, snap.slotPose]]);
    for (const id of rest) {
      const own = findTarget(id, ctx.pointer.worldX, ctx.pointer.worldY);
      if (own?.parentId === snap.parentId) slots.set(id, own.slotPose);
    }
    return slots;
  };
  // A slot is a world pose; a preview shows it in the frame the node is stored in now.
  const snapped = (ctx: GestureContext<TPose>, snap: SnapTarget<TPose>): BehaviorResult<TPose> => {
    const id = ctx.draggedIds[0];
    const start = ctx.origin.get(id);
    const startWorld = start === undefined ? undefined : ctx.frames?.toWorld(id, start) ?? start;
    const toSlot = startWorld !== undefined ? ctx.offset?.(startWorld, snap.slotPose) : undefined;
    const poses = new Map<string, TPose>();
    for (const [at, slot] of slotsFor(ctx, snap)) poses.set(at, ctx.frames?.toLocal(at, slot) ?? slot);
    return {
      ...(toSlot ? { transform: { kind: 'translate' as const, ...toSlot } } : {}),
      poses,
      snap,
    };
  };

  return {
    onMove(ctx, _proposed) {
      const s = getState<TPose>(ctx);
      const target = findTarget(ctx.draggedIds[0], ctx.pointer.worldX, ctx.pointer.worldY);

      if (s.committedSnap) {
        if (target && target.parentId === s.committedSnap.parentId) {
          return snapped(ctx, s.committedSnap);
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
        return snapped(ctx, target);
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

    onEnd(ctx, end) {
      const s = getState<TPose>(ctx);
      clearTimer(s);
      const snap = s.committedSnap ?? ctx.snap;
      if (!snap) return;
      const ops: Op[] = [];
      const reparent = (id: string): void => {
        const oldParent = ctx.adapter.getParent(id);
        if (oldParent !== snap.parentId) {
          ops.push(createReparentOp({
            id,
            fromParentId: oldParent,
            toParentId: snap.parentId,
            label: reparentLabel,
          }));
        }
      };
      const slots = slotsFor(ctx, snap);
      for (const [id, slot] of slots) {
        const to = ctx.frames?.toLocalUnder(snap.parentId, slot) ?? slot;
        ops.push(createTransformOp<TPose>({ id, from: ctx.origin.get(id)!, to, label: moveLabel }));
        reparent(id);
      }
      // A node with no slot of its own lands where the preview drew it.
      const rest = ctx.draggedIds.filter((id) => !slots.has(id));
      const moved = end.translateOps(rest);
      ops.push(...moved);
      for (const id of rest) {
        const was = ctx.adapter.getParent(id);
        reparent(id);
        if (was !== snap.parentId) ops.push(...keptInPlace(ctx, snap.parentId, id, moved, reparentLabel));
      }
      return ops;
    },
  };
}

/**
 * The ops that keep `id`, reparented into `parentId`, where `moved` left it:
 * its pose made local to the new frame, and through an envelope, the poses of
 * what shares its frame.
 */
function keptInPlace<TPose>(
  ctx: GestureContext<TPose>,
  parentId: string,
  id: string,
  moved: readonly Op[],
  label: string,
): Op[] {
  const frames = ctx.frames;
  if (frames === undefined) return [];
  const translated = new Map(moved.filter((op) => op.name === 'transform')
    .map((op) => [(op.args as { id: string }).id, (op.args as { to: TPose }).to]));
  const ops: Op[] = [];
  const keep = (at: string): void => {
    const from = translated.get(at) ?? ctx.adapter.getPose(at);
    ops.push(createTransformOp<TPose>({ id: at, from, to: frames.toLocalUnder(parentId, frames.toWorld(at, from)), label }));
    const node = ctx.adapter.getNode(at) as { dependsOn?: unknown; derivePose?: unknown } | undefined;
    if (node === undefined || definesFrame(node)) return;
    for (const child of ctx.adapter.getNodes()) {
      if ((child as { parent?: string | null }).parent === at) keep(child.id);
    }
  };
  keep(id);
  return ops;
}
