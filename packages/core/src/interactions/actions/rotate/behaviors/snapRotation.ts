import type { ModifierState, RotateBehavior } from '../../../gestures/types';

/** The step {@link snapRotationWithModifier} snaps to by default: 15 degrees. */
export const DEFAULT_ROTATION_SNAP_STEP = Math.PI / 12;

/**
 * Angle snap: rotate with `key` (default `'shift'`) held to land on a multiple
 * of `step` radians. What snaps is the angle the first rotated node ends at,
 * so a node already at 10 degrees goes to 15, 30, 45; the rest of a
 * multi-selection turns by the same amount. `key: null` snaps every move.
 */
export function snapRotationWithModifier<TPose>(opts: {
  key?: keyof ModifierState | null;
  step?: number;
} = {}): RotateBehavior<TPose> {
  const { key = 'shift', step = DEFAULT_ROTATION_SNAP_STEP } = opts;
  return {
    onMove(ctx, { rotation }) {
      if (key !== null && !ctx.modifiers[key]) return;
      if (!(step > 0)) return;
      return { rotation: Math.round(rotation / step) * step };
    },
  };
}
