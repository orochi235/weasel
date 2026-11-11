import { createTransformOp } from 'core/ops/transform';
import { definesFrame } from 'core/scene/effectivePose';
import { createReparentOp } from 'core/ops/reparent';
import type { Op } from 'core/ops/types';
import type { SnapTarget } from 'core/adapters/types';
import type { BehaviorResult, CloneBehavior, MoveBehavior, GestureContext } from '../../../gestures/types';
import { scratchKey, getScratch, setScratch } from '@weasel-js/routing';
import { holderOf } from '@weasel-js/select';

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

/** Whether `snap` would put a dragged node inside itself: its container is one of them or under one. */
function intoDragged<TPose>(ctx: GestureContext<TPose>, snap: SnapTarget<TPose>): boolean {
  return holderOf(new Set(ctx.draggedIds), snap.parentId, (id) => ctx.adapter.getParent(id)) !== null;
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
 * being captured by it. On an Alt-drag clone the copies drop in the same way
 * and the originals stay put.
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
  // A move's origin is as stored and a clone's is in world.
  const snapped = (ctx: GestureContext<TPose>, snap: SnapTarget<TPose>, originInWorld: boolean): BehaviorResult<TPose> => {
    const id = ctx.draggedIds[0];
    const start = ctx.origin.get(id);
    const startWorld = start === undefined || originInWorld ? start : ctx.frames?.toWorld(id, start) ?? start;
    const toSlot = startWorld !== undefined ? ctx.offset?.(startWorld, snap.slotPose) : undefined;
    const poses = new Map<string, TPose>();
    for (const [at, slot] of slotsFor(ctx, snap)) poses.set(at, ctx.frames?.toLocal(at, slot) ?? slot);
    return {
      ...(toSlot ? { transform: { kind: 'translate' as const, ...toSlot } } : {}),
      poses,
      snap,
    };
  };

  const track = (ctx: GestureContext<TPose>, originInWorld: boolean): BehaviorResult<TPose> | undefined => {
    const s = getState<TPose>(ctx);
    const found = findTarget(ctx.draggedIds[0], ctx.pointer.worldX, ctx.pointer.worldY);
    const target = found && !intoDragged(ctx, found) ? found : null;

    // Leaving a container withdraws the target it announced, which the commit reads.
    let left: BehaviorResult<TPose> | undefined;
    if (s.committedSnap) {
      if (target && target.parentId === s.committedSnap.parentId) {
        return snapped(ctx, s.committedSnap, originInWorld);
      }
      s.committedSnap = null;
      left = { snap: null };
    }

    if (!target) {
      clearTimer(s);
      return left;
    }

    if (isInstant?.(target)) {
      clearTimer(s);
      s.committedSnap = target;
      return snapped(ctx, target, originInWorld);
    }

    if (s.pendingTargetId === target.parentId) {
      return left;
    }
    clearTimer(s);
    s.pendingTargetId = target.parentId;
    s.pendingTimer = setTimeout(() => {
      s.committedSnap = target;
      s.pendingTimer = null;
    }, dwellMs);
    return left;
  };
  const cancel = (ctx: GestureContext<TPose>): void => { clearTimer(getState<TPose>(ctx)); };

  const clone: CloneBehavior<TPose> = {
    onMove: (ctx) => track(ctx, true),
    onCancel: cancel,
    onEnd(ctx, end) {
      const s = getState<TPose>(ctx);
      clearTimer(s);
      const snap = s.committedSnap ?? ctx.snap;
      if (!snap || intoDragged(ctx, snap)) return;
      return end.copyOps({ parentId: snap.parentId, poses: slotsFor(ctx, snap) });
    },
  };

  return {
    clone,
    onMove: (ctx) => track(ctx, false),
    onCancel: cancel,

    onEnd(ctx, end) {
      const s = getState<TPose>(ctx);
      clearTimer(s);
      const snap = s.committedSnap ?? ctx.snap;
      if (!snap || intoDragged(ctx, snap)) return;
      const ops: Op[] = [];
      const landed = new Map<string, string | null>();
      const reparent = (id: string): void => {
        const oldParent = ctx.adapter.getParent(id);
        if (oldParent !== snap.parentId) {
          landed.set(id, snap.parentId);
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
      if (landed.size > 0 && ctx.followerOps) ops.push(...ctx.followerOps(landed, reparentLabel));
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
