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

/**
 * The params `editAnchors` reads, through `<SceneCanvas tune>` or a binding.
 * Read on every move, so a change mid-drag reaches the drag.
 */
export type EditAnchorsParams = {
  /** A lock held for every handle drag without a modifier: Shift holds the
   *  angle, Mod (Cmd or Ctrl) the length. Under `<SceneCanvas>` this is where
   *  the `handleLock.angle` and `handleLock.length` toggles start from; once
   *  one is pressed, the locks the `editAnchors` dep holds decide. */
  handleLock?: HandleLock | null;
};
