/** Registry key for {@link clipNothing}; every scene's registry carries it. */
export const CLIP_NOTHING = 'kit:clipNothing';

/**
 * A container's `clipFromPose` that clips nothing, for a container whose
 * children may draw outside it. A container without one clips its children to
 * its painter's silhouette.
 */
export const clipNothing = (): null => null;
