import type { Path } from '@weasel-js/geom';
import { findNodeShape, findShapeSilhouette } from 'canvas/NodeShape';
import { RECT_FALLBACK_PAINTER } from 'canvas/nodeShapes/rectFallbackPainter';
import type { ClipFromPoseFn, Node, NodeClip } from 'core/scene/types';

/** What {@link ownClipOf} reads of a node. */
export interface ClipBearing<TPose> {
  clipFromPose?: ClipFromPoseFn<TPose>;
  clip?: NodeClip;
}

/**
 * What a node declaring `clip: 'outline'` clips its children to, in world
 * coordinates: the silhouette of the painter that claims it, or `null`. A
 * node only the last-resort rect painter claims clips to nothing, as a
 * version 1 container did; `nodeOutline`, where a stroke is cut, does count
 * that painter's box. `derived` supplies a derived path when there is one.
 */
export function clipOutline<TPose>(
  node: Node<unknown, string, TPose>,
  pose: TPose,
  derived?: () => Path | null | undefined,
): Path | null {
  if (findNodeShape(node) === (RECT_FALLBACK_PAINTER as unknown)) return null;
  return findShapeSilhouette(node, pose, { derivedPath: derived?.() ?? null });
}

/** The clip a node imposes on its children, or null when it imposes none:
 *  its `clipFromPose` when it has one, else its {@link clipOutline} when it
 *  declares `clip: 'outline'`. */
export function ownClipOf<TPose>(
  node: ClipBearing<TPose>,
  pose: TPose,
  derived?: () => Path | null | undefined,
): Path | null {
  if (typeof node.clipFromPose === 'function') return node.clipFromPose(pose);
  if (node.clip !== 'outline') return null;
  return clipOutline(node as unknown as Node<unknown, string, TPose>, pose, derived);
}
