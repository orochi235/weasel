/**
 * Facts about the device the canvas is running on.
 *
 * One object, recomputed when the underlying media queries change, read by
 * two consumers: the chrome-caps rule layer (via `RuleCtx.device`) and the
 * handle-sizing constants (via `targetScale`).
 *
 * Deliberately NOT a form-factor concept. There is no `isPhone` here and
 * there should never be one: chrome layout is the consuming app's decision.
 * The kit's job is to stop assuming a mouse.
 */
export interface DeviceProfile {
  /** `matchMedia('(pointer: coarse)')` — the primary pointer is imprecise. */
  readonly coarsePointer: boolean;
  /** `matchMedia('(hover: hover)')` — the primary pointer can hover. */
  readonly canHover: boolean;
  /** Live device pixel ratio. */
  readonly dpr: number;
  /** Multiplier for handle sizes and hit radii. Derived from
   *  `coarsePointer` unless explicitly overridden. */
  readonly targetScale: number;
}

/**
 * Handle/hit multiplier applied on a coarse pointer.
 *
 * 8px handle → 14px; 24px rotation distance → 42px. Counting the
 * surrounding grab zone, that lands in the Apple HIG 44pt / Material 48dp
 * minimum-touch-target band. One constant so it is tunable in one place.
 */
export const COARSE_TARGET_SCALE = 1.75;

/**
 * Assumed when `matchMedia` is unavailable (SSR, jsdom) and used as the
 * absent-means value for `RuleCtx.device`.
 *
 * A mouse-like device is the safe default: it is what the kit has always
 * assumed, so an absent profile changes nothing for existing consumers.
 */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
  coarsePointer: false,
  canHover: true,
  dpr: 1,
  targetScale: 1,
};

/** The detected half of a profile — everything except the derived scale. */
export type DetectedDeviceFacts = Omit<DeviceProfile, 'targetScale'>;

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
