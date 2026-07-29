import type { DetectedDeviceFacts, DeviceProfile } from './types';

/**
 * Handle/hit multiplier applied on a coarse pointer.
 *
 * 8px handle → 14px; 24px rotation distance → 42px. Counting the
 * surrounding grab zone, that lands in the Apple HIG 44pt / Material 48dp
 * minimum-touch-target band. One constant so it is tunable in one place.
 */
export const COARSE_TARGET_SCALE = 1.75;

/**
 * Fold consumer overrides over detected facts and derive `targetScale`.
 *
 * `targetScale` is re-derived AFTER the merge, so an override of
 * `coarsePointer` alone scales the chrome as expected. An explicit
 * `targetScale` override wins over the derivation.
 */
export function resolveDeviceProfile(
  detected: DetectedDeviceFacts,
  overrides?: Partial<DeviceProfile>,
): DeviceProfile {
  const coarsePointer = overrides?.coarsePointer ?? detected.coarsePointer;
  const canHover = overrides?.canHover ?? detected.canHover;
  const dpr = overrides?.dpr ?? detected.dpr;
  const targetScale =
    overrides?.targetScale ?? (coarsePointer ? COARSE_TARGET_SCALE : 1);
  return { coarsePointer, canHover, dpr, targetScale };
}

/**
 * Assumed when `matchMedia` is unavailable (SSR, jsdom) and used as the
 * absent-means value for `RuleCtx.device`.
 *
 * Derived from `resolveDeviceProfile` rather than hand-written, so it can
 * never drift from what the function would compute for the same facts. A
 * mouse-like device is the safe default: it is what the kit has always
 * assumed, so an absent profile changes nothing for existing consumers.
 */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = resolveDeviceProfile({
  coarsePointer: false,
  canHover: true,
  dpr: 1,
});
