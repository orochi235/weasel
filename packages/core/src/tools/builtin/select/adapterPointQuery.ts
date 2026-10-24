import { applyToPoint, boundsOfPath, meanScale, pathContainsPoint } from '@weasel-js/geom';
import { shapeCoversPoint } from 'canvas/NodeShape';
import { ownClipOf } from 'canvas/ownClip';
import type { PickQuery } from 'canvas/pickWalk';
import { poseDescriptorForNode, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Node } from 'core/scene/types';
import { toPlane } from 'core/viewport/parallax';

/**
 * The point query `useSelectTool`'s default `pickEvery` asks of a bare adapter:
 * a point at (px, py) with `t` world units of slop. AABB first (cheap), then
 * the painter's ink when `preciseLeaves` asks for it and it is available. A
 * painter with no `silhouette` — or one that returns null, as `kit:text` does
 * for an empty node — keeps the AABB answer.
 *
 * The AABB pre-filter is grown by the slop: a shape's outline, and the slop
 * around it, reach outside the shape's own bounds.
 *
 * A node that derives its path is tested against that path's box: its own pose
 * is a placeholder, and the box of a straight route has no area to land in
 * without the slop.
 */
export function adapterPointQuery<TPose>(
  d: PoseDescriptor<TPose>,
  preciseLeaves: boolean,
): (px: number, py: number, t: number) => PickQuery<TPose> {
  const pointQuery = (px: number, py: number, t: number): PickQuery<TPose> => ({
    hits: (node, pose, derived, inherited) => {
      const b = derived ? boundsOfPath(derived) : poseDescriptorForNode(d, node).getBounds(pose);
      if (node.kind !== 'group') {
        const slop = preciseLeaves || derived ? t : 0;
        if (!(px >= b.x - slop && px <= b.x + b.width + slop
              && py >= b.y - slop && py <= b.y + b.height + slop)) {
          return false;
        }
        if (!preciseLeaves) return true;
        return shapeCoversPoint(
          node as Node<unknown, string, TPose>, pose, px, py, { tolerance: t, derivedPath: derived, inherited },
        );
      }
      // A group paints nothing and is hit across its box, within its own clip
      // when it declares one, since only what shows there is its. Ancestor
      // clips are the walk's business.
      const inAabb = px >= b.x && px <= b.x + b.width
        && py >= b.y && py <= b.y + b.height;
      if (!inAabb) return false;
      const own = ownClipOf(node, pose, () => derived);
      return own === null || pathContainsPoint(own, px, py);
    },
    clipAdmits: (clip) => pathContainsPoint(clip, px, py),
    inPlane: (m) => {
      const p = toPlane(m, { x: px, y: py });
      return pointQuery(p.x, p.y, t * meanScale(m.scale));
    },
    inCopy: (m) => {
      const [x, y] = applyToPoint(m, px, py);
      return pointQuery(x, y, t * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
    },
  });
  return pointQuery;
}
