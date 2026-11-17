/**
 * Moving the selection along one world axis, up included, from that axis's
 * handle.
 *
 * The action is core's `move` with its snap session held to the axis: every
 * frame previews through the scene's overrides, the release commits one batch
 * of pose ops, and undo takes it back. What makes it 3D is the session, which
 * casts the pointer onto the plane through the axis that faces the camera and
 * reports the world point it lands on, so the pose descriptor stores that point
 * rather than reading the drag as a move on the node's level.
 */

import { SNAP_ROLES, type SnapDep, type SnapSession } from '@weasel-js/core/engine';
import {
  roleMods, type Action, type AffordanceHit, type Contribution, type InvocationCtx, type NodeId, type OngoingHandle,
} from '@weasel-js/routing';
import { createSnap } from '../deps';
import { viewportOf, type World3d } from '../world';
import {
  AXIS_DIRECTIONS, WORLD_AXES, axisHandleAt, axisHandles, type AxisHandle, type AxisHandleOptions, type WorldAxis,
} from './handles';
import { moveAction } from '@weasel-js/editing/engine';

/** The axis move's action id. */
export const MOVE_AXIS_ACTION_ID = 'move3d.axis';
/** Id of the entry `createAxisMove` builds. */
export const AXIS_MOVE_CONTRIBUTION_ID = 'kernel3d.axisMove';
/** The prefix of an axis handle's hit `kind`; the axis follows it. */
export const AXIS_HANDLE_KIND = 'move3d.axis:';

/** Options for `createAxisMove`. */
export interface AxisMoveOptions extends AxisHandleOptions {
  /** Whose handles are drawn and hit: the selection, as the `selection` dep reads it. */
  selection: { get(): readonly NodeId[] };
  /** The view whose camera handles are hit through. Default the surface's. */
  viewId?: string | null;
  /** How near a handle a press takes it, in screen px. Default 6. */
  hitPx?: number;
}

/** An axis move over one world: its action, the entry binding drags on its handles to it, and the handles. */
export interface AxisMove {
  /** `move3d.axis`: an ongoing drag that moves the selection along the axis of the handle it was pressed on. */
  action: Action;
  /** An always-live entry binding a drag on any axis handle to {@link action}, and carrying it. */
  contribution: Contribution;
  /** The handle under a point in the space the dispatcher's points arrive in, as an exclusive claim on the press:
   *  what a host hands the dispatcher as `affordanceAt`. */
  handleAt(point: { x: number; y: number }): AffordanceHit | null;
  /** The selection's handles in `viewport`, for a host to draw. */
  handles(viewport: Parameters<typeof axisHandles>[2]): AxisHandle[];
}

/** The world axis an axis handle's hit names, or null for any other hit. */
export function axisOfHit(hit: unknown): WorldAxis | null {
  const kind = (hit as { kind?: unknown } | null | undefined)?.kind;
  if (typeof kind !== 'string' || !kind.startsWith(AXIS_HANDLE_KIND)) return null;
  const axis = kind.slice(AXIS_HANDLE_KIND.length);
  return (WORLD_AXES as readonly string[]).includes(axis) ? axis as WorldAxis : null;
}

/** A drag binding's target predicate matching any axis handle. */
const isAxisHandle = Object.assign((hit: unknown): boolean => axisOfHit(hit) !== null, { readsAffordance: true as const });

/**
 * An axis move over `world`. Register `contribution` beside the canvas's other
 * ambient entries, hand `handleAt` to the dispatcher, and draw `handles`. The
 * move snaps through the `snap` dep when that is `createSnap`'s: along the
 * axis, a box lines up with the boxes and planes it passes and, on the ground,
 * with the grid.
 */
export function createAxisMove<TData, TLayer extends string>(
  world: World3d<TData, TLayer>, opts: AxisMoveOptions,
): AxisMove {
  const handleOpts: AxisHandleOptions = {
    ...(opts.lengthPx !== undefined ? { lengthPx: opts.lengthPx } : {}),
    ...(opts.headPx !== undefined ? { headPx: opts.headPx } : {}),
    ...(opts.axes ? { axes: opts.axes } : {}),
  };
  const unsourced = createSnap(world, { viewId: opts.viewId ?? null });
  const inner = moveAction.invoker;

  const action: Action = {
    id: MOVE_AXIS_ACTION_ID,
    label: 'Move Along Axis',
    group: 'transform',
    activeCursor: 'move',
    modifierRoles: SNAP_ROLES,
    requires: moveAction.requires,
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, binding): OngoingHandle {
        const axis = axisOfHit(ctx.drag?.affordance);
        if (!axis || inner?.timing !== 'ongoing') return {};
        const snap = alongAxis(AXIS_DIRECTIONS[axis], ctx.deps.snap, unsourced);
        return inner.start({ ...ctx, deps: { ...ctx.deps, snap } }, binding);
      },
    },
    enabled: () => true,
  };

  const handlesIn = (viewport: Parameters<typeof axisHandles>[2]) =>
    axisHandles(world, opts.selection.get(), viewport, handleOpts);

  return {
    action,
    contribution: {
      id: AXIS_MOVE_CONTRIBUTION_ID,
      eligibility: { always: true },
      actions: [action],
      bindings: [{
        spec: { kind: 'drag', target: { kindOf: isAxisHandle }, mods: roleMods(SNAP_ROLES) },
        actionId: MOVE_AXIS_ACTION_ID,
        opts: { id: 'kernel3d.axisMove.handle' },
      }],
    },
    handleAt(point) {
      const hit = axisHandleAt(handlesIn(viewportOf(world, opts.viewId)), point, opts.hitPx);
      if (!hit) return null;
      return {
        kind: `${AXIS_HANDLE_KIND}${hit.axis}`,
        owner: AXIS_MOVE_CONTRIBUTION_ID,
        strength: 'exclusive',
        claimedKinds: ['pointer'],
        targetIds: [...opts.selection.get()],
        cursor: 'move',
      };
    },
    handles: handlesIn,
  };
}

/**
 * A snap dep whose move sessions run along `dir`. A session of `host` that
 * reports no landing, as one that is not `createSnap`'s does not, is passed
 * over for `unsourced`'s, which snaps to nothing but still lands on the axis.
 */
function alongAxis(dir: { x: number; y: number; z: number }, host: SnapDep | undefined, unsourced: SnapDep): SnapDep {
  const along = [dir.x, dir.y, dir.z];
  return {
    begin(req) {
      const own = unsourced.begin({ ...req, along });
      const theirs = host?.begin({ ...req, along });
      if (!theirs) return own;
      const session: SnapSession = {
        at(p, mods) {
          const out = theirs.at(p, mods);
          return out.landing !== undefined ? out : own.at(p, mods);
        },
        angle: (theta, mods) => theirs.angle(theta, mods),
        end() {
          theirs.end();
          own.end();
        },
      };
      return session;
    },
  };
}
