import type { SoftFalloff } from '@weasel-js/geom';

/** What a handle drag holds fixed: its direction from the anchor, or its length. */
export type HandleLock = 'angle' | 'length';

/** Which handle locks are held for every handle drag, on top of the modifiers.
 *  Both together freeze the handle. */
export interface HandleLocks {
  angle: boolean;
  length: boolean;
}

/** The locks a single {@link HandleLock}, or none, holds. */
export function locksOf(lock: HandleLock | null | undefined): HandleLocks {
  return { angle: lock === 'angle', length: lock === 'length' };
}

/** Soft selection for an anchor drag: anchors near the dragged ones, along the
 *  path, follow them by a falloff of their distance. */
export interface SoftSelectionParams {
  /** How far along the path the influence reaches, in screen pixels. */
  radiusPx: number;
  /** How the influence fades over the radius. Default `'smooth'`. */
  falloff?: SoftFalloff;
}

/** Angle snapping for a control-handle drag. */
export interface HandleSnapParams {
  /** Snap to every multiple of this many degrees. Default 45; 0 turns the
   *  steps off and leaves only the opposite handle. */
  stepDeg?: number;
  /** How near, in degrees, the handle must come to an angle to snap. Default 6. */
  toleranceDeg?: number;
  /** Also snap onto the line through the anchor's other handle. Default true. */
  opposite?: boolean;
}

/**
 * The params `editAnchors` reads, through `<SceneCanvas tune>` or a binding.
 * Soft selection is read when the drag starts; the rest on every move, so a
 * change mid-drag reaches the drag.
 */
export type EditAnchorsParams = {
  /** Soft selection, off when absent or null. The wheel scrubs the radius while
   *  an anchor drag is in flight. */
  soft?: SoftSelectionParams | null;
  /** Told each radius the wheel scrubs to, so a host can keep it for the next drag. */
  onSoftRadius?: (radiusPx: number) => void;
  /** Angle snapping for handle drags, off when absent or null. A held angle
   *  lock wins over it. */
  handleSnap?: HandleSnapParams | null;
  /** A lock held for every handle drag without a modifier: Shift holds the
   *  angle, Mod (Cmd or Ctrl) the length. Under `<SceneCanvas>` this is where
   *  the `handleLock.angle` and `handleLock.length` toggles start from; once
   *  one is pressed, the locks the `editAnchors` dep holds decide. */
  handleLock?: HandleLock | null;
};
