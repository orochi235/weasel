/** Registry key for {@link clipNothing}; every scene's registry carries it. */
export const CLIP_NOTHING = 'kit:clipNothing';

/** A `clipFromPose` that clips nothing, registered in every scene so a save
 *  naming {@link CLIP_NOTHING} loads. */
export const clipNothing = (): null => null;
