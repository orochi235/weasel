/** Registry key for {@link clipNothing}; every scene's registry carries it. */
export const CLIP_NOTHING = 'kit:clipNothing';

/**
 * A `clipFromPose` that clips nothing. A node no longer clips unless it
 * declares a clip, so this is kept registered only so that saves naming it
 * still load.
 */
export const clipNothing = (): null => null;
