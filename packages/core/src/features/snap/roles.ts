import { roleReader, type ModifierState } from '@weasel-js/routing';
import type { SnapMods } from 'interactions/actions/snapDep';

/** The modifier roles a snapping action declares. */
export const SNAP_ROLES = {
  'snap.suspend': { label: 'Suspend snapping', keys: ['ctrl'] },
  'snap.constrain': { label: 'Constrain', keys: ['shift'] },
} as const;

/** The angle step `snap.constrain` (Shift) holds a direction to: a line, a
 *  measurement, a rotate, a symmetry axis. 15 degrees. */
export const SNAP_ANGLE_STEP = Math.PI / 12;

/** The step an `'axis'` lock holds a move to: the axes and the diagonals. */
export const SNAP_AXIS_STEP = Math.PI / 4;

const held = roleReader(SNAP_ROLES);

/** The snap roles `ctx` holds. */
export function snapMods(ctx: { roles?: Readonly<Record<string, boolean>>; modifiers: ModifierState }): SnapMods {
  return { suspend: held(ctx, 'snap.suspend'), constrain: held(ctx, 'snap.constrain') };
}
