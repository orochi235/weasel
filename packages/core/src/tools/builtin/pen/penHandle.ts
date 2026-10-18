/** The pen's handle drag: the modifiers it reads, and where it puts the handle. */
import { roleReader, type ModifierRoles } from '@weasel-js/routing';
import { constrainTo45 } from '../../../util/constrainTo45';
import type { PenScratch } from './usePenTool';

/** The modifiers the pen's handle drag reads on the press, every move, and
 *  the release: Alt breaks the new anchor's mirror, Shift holds the handle to
 *  45-degree steps. */
export const PEN_HANDLE_ROLES = {
  'mirror.break': { label: "Break the handles' mirror", keys: ['alt'] },
  'handle.constrain': { label: 'Hold the handle to 45° steps', keys: ['shift'] },
} as const satisfies ModifierRoles;

export const penRole = roleReader(PEN_HANDLE_ROLES);

/** Point the anchor's outgoing handle at `target`, optionally snapped and
 *  optionally constrained to 45° steps. When `linked` and not Alt-broken,
 *  the in-handle follows as its mirror through the anchor. */
export function applyOutHandle<S extends PenScratch>(
  s: S,
  target: { x: number; y: number },
  shift: boolean,
  linked: boolean,
  snap?: (p: { x: number; y: number }) => { x: number; y: number },
): void {
  if (s.current === null || s.draggingHandleAt === null) return;
  const anchor = s.current.anchors[s.draggingHandleAt];
  const to = snap ? snap(target) : target;
  let dx = to.x - anchor.x;
  let dy = to.y - anchor.y;
  if (shift) {
    const c = constrainTo45(dx, dy);
    dx = c.dx;
    dy = c.dy;
  }
  anchor.outHandle = { x: anchor.x + dx, y: anchor.y + dy };
  if (linked && !anchor.altBroken) anchor.inHandle = { x: anchor.x - dx, y: anchor.y - dy };
}
