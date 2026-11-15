import { pathThroughPoseFrame, type Path } from '@weasel-js/geom';
import { findShapeSilhouette, type NodeShapes } from 'canvas/NodeShape';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { ClipFromPoseFn, Node, NodeClip } from 'core/scene/types';
import { groupBoxPath } from './nodeShapes/groupBoxPainter';

/** What {@link ownClipOf} reads of a node. */
export interface ClipBearing<TPose> {
  clipFromPose?: ClipFromPoseFn<TPose>;
  clip?: NodeClip;
}

/**
 * What a node declaring `clip: 'outline'` clips its children to, in world
 * coordinates: the silhouette of whichever painter claims it, the rect
 * fallback's box included, else for a group its box, or `null`. `derived`
 * supplies a derived path when there is one.
 */
export function clipOutline<TPose>(
  node: Node<unknown, string, TPose>,
  pose: TPose,
  derived?: () => Path | null | undefined,
  shapes?: NodeShapes,
): Path | null {
  const sil = findShapeSilhouette(node, pose, { derivedPath: derived?.() ?? null, shapes });
  if (sil !== null || node.kind !== 'group' || !isRectPose(pose)) return sil;
  return nodeMemo(node, 'shape:group-box-clip', pose, () => pathThroughPoseFrame(groupBoxPath(pose), pose));
}

/** The clip a node imposes on its children, or null when it imposes none:
 *  its `clipFromPose` when it has one, else its {@link clipOutline} when it
 *  declares `clip: 'outline'`. */
export function ownClipOf<TPose>(
  node: ClipBearing<TPose>,
  pose: TPose,
  derived?: () => Path | null | undefined,
  shapes?: NodeShapes,
): Path | null {
  if (typeof node.clipFromPose === 'function') return node.clipFromPose(pose);
  if (node.clip !== 'outline') return null;
  return clipOutline(node as unknown as Node<unknown, string, TPose>, pose, derived, shapes);
}
