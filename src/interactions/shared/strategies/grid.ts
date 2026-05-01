import type { SnapStrategy } from '../../types';
import { resolveUnit, type UnitSystem, type UnitValue } from '../../../units';

/** Snap-strategy that rounds `x`/`y` to the nearest multiple of `spacing` (resolved through `unitSystem`). */
export function gridSnapStrategy<TPose extends { x: number; y: number }>(
  spacing: UnitValue,
  unitSystem?: UnitSystem,
): SnapStrategy<TPose> {
  const c = resolveUnit(spacing, unitSystem);
  return {
    snap(pose) {
      return {
        ...pose,
        x: Math.round(pose.x / c) * c,
        y: Math.round(pose.y / c) * c,
      };
    },
  };
}
