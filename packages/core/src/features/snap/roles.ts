import { roleReader, type ModifierState } from '@weasel-js/routing';
import type { SnapMods } from 'interactions/actions/snapDep';

/** The modifier roles a snapping action declares. */
export const SNAP_ROLES = {
  'snap.suspend': { label: 'Suspend snapping', keys: ['ctrl'] },
  'snap.constrain': { label: 'Constrain', keys: ['shift'] },
} as const;

const held = roleReader(SNAP_ROLES);

/** The snap roles `ctx` holds. */
export function snapMods(ctx: { roles?: Readonly<Record<string, boolean>>; modifiers: ModifierState }): SnapMods {
  return { suspend: held(ctx, 'snap.suspend'), constrain: held(ctx, 'snap.constrain') };
}
