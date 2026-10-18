import { SNAP_ANGLE_STEP, SNAP_ROLES, snapMods, type Action, type InvocationCtx, type NodeId, type OngoingHandle } from '@weasel-js/core';
import type { SymmetryChange, SymmetryController } from './controller';
import type { SymmetryHandlePress } from './guide';
import type { Point } from '@weasel-js/geom';

/** The id of the action that drags a guide handle. */
export const SYMMETRY_HANDLE_ACTION_ID = 'symmetry.dragHandle';

/** The change one frame of a handle drag makes, from where the press began. */
export function handleChange(
  press: SymmetryHandlePress,
  origin: { center: Point },
  from: Point,
  to: Point,
  stepped: boolean,
  snap: (p: Point) => Point,
): SymmetryChange {
  if (press.handle === 'center') {
    return { center: snap({ x: origin.center.x + to.x - from.x, y: origin.center.y + to.y - from.y }) };
  }
  const dx = to.x - origin.center.x;
  const dy = to.y - origin.center.y;
  let angle = Math.atan2(dy, dx);
  if (stepped) angle = Math.round(angle / SNAP_ANGLE_STEP) * SNAP_ANGLE_STEP;
  if (press.handle === 'angle') return { spec: { angle } };
  return { spec: { angle, spacing: Math.max(1, Math.hypot(dx, dy)) } };
}

/**
 * Drag a handle of the active group's guide: the center moves the group's
 * center, through a `point` session of the `snap` dep when there is one; the
 * knob turns the axis; a repeat's step handle sets both its direction and its
 * spacing. `snap.constrain` (Shift) holds the angle to 15° steps. The drag
 * lands as one undo step, and cancel puts the group back.
 */
export function handleDragAction(ctrl: SymmetryController): Action & { requires: string[] } {
  return {
    id: SYMMETRY_HANDLE_ACTION_ID,
    label: 'Move symmetry guide',
    modifierRoles: SNAP_ROLES,
    requires: ['snap'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const press = ctx.drag?.affordance?.payload as SymmetryHandlePress | undefined;
        if (!press) return {};
        const id = press.group as NodeId;
        const origin = ctrl.read(id);
        if (!origin) return {};
        const session = press.handle === 'center'
          ? ctx.deps.snap?.begin({ gesture: 'point', press: origin.center }) ?? null
          : null;
        const from = { x: ctx.world.x, y: ctx.world.y };
        let last: SymmetryChange | null = null;
        const back: SymmetryChange = { spec: origin.spec, center: origin.center };
        return {
          kind: 'symmetry-guide',
          onMove(move: InvocationCtx): void {
            const mods = snapMods(move);
            const snap = (p: Point) => (session ? session.at(p, mods).point : p);
            last = handleChange(press, origin, from, move.world, mods.constrain, snap);
            ctrl.preview(id, last);
          },
          onEnd(_end: InvocationCtx, reason: 'commit' | 'cancel'): void {
            try {
              ctrl.preview(id, back);
              if (reason === 'commit' && last) ctrl.update(id, last, 'Move symmetry guide');
            } finally {
              session?.end();
            }
          },
        };
      },
    },
  };
}
