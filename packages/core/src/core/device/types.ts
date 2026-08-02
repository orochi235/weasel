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

/** The detected half of a profile — everything except the derived scale. */
export type DetectedDeviceFacts = Omit<DeviceProfile, 'targetScale'>;
