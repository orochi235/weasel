/** The pen's handle drag: the modifiers it reads, and where it puts the handle. */
import { roleReader, type InvocationCtx, type ModifierRoles } from '@weasel-js/routing';
import { SNAP_ROLES, snapMods } from 'features/snap/roles';
import { inputSession } from 'features/snap/session2d';
import type { SnapBegin } from 'interactions/actions/snapDep';
import type { PenScratch } from './usePenTool';

/** The step `snap.constrain` (Shift) holds a pen handle's direction to: 45 degrees. */
export const PEN_HANDLE_STEP = Math.PI / 4;

/** The modifiers the pen's handle drag reads on the press, every move, and
 *  the release: Alt breaks the new anchor's mirror, Shift holds the handle to
 *  45-degree steps, and Ctrl suspends snapping. */
export const PEN_HANDLE_ROLES = {
  'mirror.break': { label: "Break the handles' mirror", keys: ['alt'] },
  ...SNAP_ROLES,
} as const satisfies ModifierRoles;

const penRole = roleReader(PEN_HANDLE_ROLES);

/** A pen handle drag in flight. */
export interface PenHandlePull {
  /** Point the outgoing handle at where `ctx`'s pointer snaps. */
  to(ctx: InvocationCtx): void;
  /** The drag is over: clears its snap marks. */
  end(): void;
}

/**
 * Drag the outgoing handle of the anchor `s.draggingHandleAt` names. The
 * pointer snaps through a `point` session about the anchor, so Shift turns
 * it about the anchor in 45-degree steps. When `linked` and not Alt-broken,
 * the in-handle follows as its mirror through the anchor.
 */
export function pullHandle(s: PenScratch, ctx: InvocationCtx, linked: boolean): PenHandlePull {
  const at = s.current!.anchors[s.draggingHandleAt!];
  const anchor = { x: at.x, y: at.y };
  const req: SnapBegin = { gesture: 'point', press: anchor, origin: anchor, constrain: { step: PEN_HANDLE_STEP } };
  const session = ctx.deps.snap?.begin?.(req) ?? inputSession(req);
  return {
    to(c) {
      if (s.current === null || s.draggingHandleAt === null) return;
      const a = s.current.anchors[s.draggingHandleAt];
      if (penRole(c, 'mirror.break')) a.altBroken = true;
      const p = session.at(c.world, snapMods(c)).point;
      a.outHandle = { x: p.x, y: p.y };
      if (linked && !a.altBroken) a.inHandle = { x: 2 * a.x - p.x, y: 2 * a.y - p.y };
    },
    end: () => session.end(),
  };
}
