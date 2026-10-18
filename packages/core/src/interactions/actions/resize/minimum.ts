import { poseFrameOf } from '@weasel-js/geom';
import { minSizeOf, type MinSize } from 'core/scene/minSize';
import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/**
 * The smallest the resized box may go, from each written node's
 * `data.minSize`: a lone target's own, or, for a box several share, the box
 * at which the first of them reaches its own. A turned member is held on
 * both axes by the larger of its two ratios, since the box's axes are not
 * its own. `null` when nothing written has a minimum.
 */
export function boxMinimum(
  scene: Scene<unknown, string, unknown>,
  writeIds: readonly NodeId[],
  leafBounds: readonly Bounds[],
  startWorlds: ReadonlyMap<NodeId, unknown>,
  box: Bounds,
  sharedBox: boolean,
): MinSize | null {
  if (!sharedBox) return minSizeOf(scene.get(writeIds[0])?.data);
  let sx = 0;
  let sy = 0;
  writeIds.forEach((id, i) => {
    const min = minSizeOf(scene.get(id)?.data);
    const leaf = leafBounds[i];
    if (!min || !leaf) return;
    const rx = leaf.width > 0 ? min.width / leaf.width : 0;
    const ry = leaf.height > 0 ? min.height / leaf.height : 0;
    const turned = poseFrameOf(startWorlds.get(id)) !== null;
    sx = Math.max(sx, turned ? Math.max(rx, ry) : rx);
    sy = Math.max(sy, turned ? Math.max(rx, ry) : ry);
  });
  if (sx === 0 && sy === 0) return null;
  return { width: sx * box.width, height: sy * box.height };
}
