import type { Path } from '@weasel-js/geom';
import type { RectPose } from '../scene/types';

/** Registry key for {@link pageClip}; every scene's registry carries it. */
export const PAGE_CLIP = 'core:pageClip';

/** A page's `clipFromPose`: its own rect, so what is on the page is cut at its edges. */
export function pageClip(pose: RectPose): Path {
  return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
}
