import { SNAP_ANGLE_STEP, SNAP_ROLES, snapMods, type Action, type InvocationCtx, type NodeId, type OngoingHandle } from '@weasel-js/core';
import type { SymmetryChange, SymmetryController } from './controller';
import type { SymmetryHandlePress } from './guide';
import type { Point } from '@weasel-js/geom';

/** The id of the action that drags a guide handle. */
export const SYMMETRY_HANDLE_ACTION_ID = 'symmetry.dragHandle';

/** Where a handle drag's point and angle land. */
export interface SymmetryHandleSnap {
  /** Where the center lands at `p`. */
  point(p: Point): Point;
  /** Where the axis lands at `theta`, radians about the center. */
  angle(theta: number): number;
}

/** The change one frame of a handle drag makes, from where the press began. */
export function handleChange(
  press: SymmetryHandlePress,
  origin: { center: Point },
  from: Point,
  to: Point,
  snap: SymmetryHandleSnap,
): SymmetryChange {
  if (press.handle === 'center') {
    return { center: snap.point({ x: origin.center.x + to.x - from.x, y: origin.center.y + to.y - from.y }) };
  }
  const dx = to.x - origin.center.x;
  const dy = to.y - origin.center.y;
  const angle = snap.angle(Math.atan2(dy, dx));
  if (press.handle === 'angle') return { spec: { angle } };
  return { spec: { angle, spacing: Math.max(1, Math.hypot(dx, dy)) } };
}

/**
 * Drag a handle of the active group's guide: the center moves the group's
 * center, through a `point` session of the `snap` dep; the knob turns the
 * axis, and a repeat's step handle sets both its direction and its spacing,
 * through a `rotate` session about the center, so the axis meets the
 * canvas's angle targets and `snap.constrain` (Shift) holds it to 15° steps.
 * Without a `snap` dep nothing snaps. The drag lands as one undo step, and
 * cancel puts the group back.
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
        const from = { x: ctx.world.x, y: ctx.world.y };
        const c = origin.center;
        const session = ctx.deps.snap?.begin(press.handle === 'center'
          ? { gesture: 'point', press: c }
          : {
            gesture: 'rotate', press: from, pivot: c, ids: [id],
            theta0: Math.atan2(from.y - c.y, from.x - c.x), constrain: { step: SNAP_ANGLE_STEP },
          }) ?? null;
        let last: SymmetryChange | null = null;
        const back: SymmetryChange = { spec: origin.spec, center: origin.center };
        return {
          kind: 'symmetry-guide',
          onMove(move: InvocationCtx): void {
            const mods = snapMods(move);
            last = handleChange(press, origin, from, move.world, {
              point: (p) => (session ? session.at(p, mods).point : p),
              angle: (theta) => (session ? session.angle(theta, mods).theta : theta),
            });
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
