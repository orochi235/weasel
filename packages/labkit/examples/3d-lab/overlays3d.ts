/**
 * What the lab paints for a gesture that proposes chrome rather than a pose.
 *
 * The sibling of `collectGhosts`. A marquee sweep and a box-drag both publish
 * an `OngoingOverlay`, which used to reach paint only through core's own 2D
 * layer — so until `resolveOverlays` existed, both gestures were invisible in
 * this lab until they committed.
 *
 * The lab's `clientToWorld` is identity, so an overlay's world bounds are the
 * client rect the deps already work in, and the pane origin comes off exactly
 * once. Only the rectangular variants are drawn: the lab mounts no tool that
 * publishes a lasso, a pencil or a run of points, so a path renderer here
 * would be for nothing.
 */

import { resolveOverlays, type OngoingHandle } from '@weasel-js/core';
import type { ChromeBox } from './renderer3d';

/** Gesture chrome, in CSS pixels relative to the tile's top-left. */
export function collectOverlayBoxes(
  handles: Iterable<OngoingHandle>,
  origin: { x: number; y: number },
): ChromeBox[] {
  const overlays = [];
  for (const handle of handles) {
    const ov = handle.overlay?.();
    if (ov) overlays.push(ov);
  }

  const boxes: ChromeBox[] = [];
  for (const resolved of resolveOverlays(overlays)) {
    if (resolved.kind !== 'marquee' && resolved.kind !== 'insertPreview') continue;
    const { x, y, width, height } = resolved.bounds;
    boxes.push({ x: x - origin.x, y: y - origin.y, width, height, tint: 'gesture' });
  }
  return boxes;
}
