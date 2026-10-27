import { worldCoords, type Path, type PathSnapTarget } from '@weasel-js/geom';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { poseOutline } from 'core/geometry/regionHit';
import type { Node } from 'core/scene/types';
import { findNodeShape } from 'canvas/NodeShape';
import { nodeOutline } from '../strokeOutline';

/** What a node offers path snapping: the outline it is drawn with, in world
 *  coords, and any point of its own that the outline does not carry. */
export interface NodeSnapGeometry {
  path: Path;
  /** Targets beside the outline's, with `paths` left for the index to fill. */
  points: Omit<PathSnapTarget, 'paths'>[];
}

/**
 * The geometry `node` snaps to. A painter that `snapsToBox` — text, an image
 * — gives its pose box through the pose's frame, and the box's center. Any
 * other node gives its `nodeOutline`. Null for a node with neither.
 */
export function nodeSnapGeometry(node: Node<unknown, string, unknown>): NodeSnapGeometry | null {
  const pose = node.pose;
  if (findNodeShape(node)?.snapsToBox && isRectPose(pose)) {
    const path = poseOutline(pose, pose);
    const c = boxCenter(path);
    return { path, points: c ? [{ kind: 'center', ...c }] : [] };
  }
  const path = nodeOutline(node);
  return path ? { path, points: [] } : null;
}

/** The center of a box outline: a rect, or the four corners a turned one has. */
function boxCenter(path: Path): { x: number; y: number } | null {
  if (path.kind === 'rect') return { x: path.x + path.width / 2, y: path.y + path.height / 2 };
  const c = worldCoords(path);
  if (c.length < 8) return null;
  return { x: (c[0] + c[4]) / 2, y: (c[1] + c[5]) / 2 };
}
