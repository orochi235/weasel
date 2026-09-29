import type { Path } from 'features/paths/types';
import { transformPath } from 'features/paths/transformPath';
import { planeMatrix, planeToPlane, type PlaneMap } from 'core/viewport/parallax';

/**
 * Carries a container's clip into the world a descendant is drawn or picked
 * in. A clip is built from the container's pose, so it is in the container's
 * plane; a child on another plane reads it in its own. Null `planeOf` means no
 * layer is a plane, and every clip passes through untouched.
 *
 * Memoized per clip path and target plane, so a container with many children
 * on one other plane maps its clip once.
 */
export function clipCarrier(
  planeOf: ((layer: string) => PlaneMap | null) | null,
): (clip: Path, fromLayer: string | undefined, toLayer: string | undefined) => Path {
  if (planeOf === null) return (clip) => clip;
  const mapOf = (layer: string | undefined) => (layer === undefined ? null : planeOf(layer));
  const cache = new WeakMap<Path, Map<PlaneMap | null, Path>>();
  return (clip, fromLayer, toLayer) => {
    const to = mapOf(toLayer);
    const m = planeToPlane(mapOf(fromLayer), to);
    if (m === null) return clip;
    let byTarget = cache.get(clip);
    if (byTarget === undefined) cache.set(clip, byTarget = new Map());
    let out = byTarget.get(to);
    if (out === undefined) byTarget.set(to, out = transformPath(clip, planeMatrix(m)));
    return out;
  };
}
