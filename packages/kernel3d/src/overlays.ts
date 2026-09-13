/**
 * What a host paints for a gesture that proposes chrome rather than a pose.
 *
 * A marquee sweep and a box-drag both publish an `OngoingOverlay`, which used
 * to reach paint only through core's own 2D layer. `resolveOverlays` hands back
 * world geometry with no renderer in it, so the same call `<SceneCanvas>` makes
 * serves a consumer-owned 3D renderer.
 *
 * A 3D host's `clientToWorld` is identity, so an overlay's world bounds are the
 * client rect the deps already work in, and the pane origin comes off exactly
 * once. Only the rectangular variants resolve here: a lasso, a pencil and a run
 * of points are paths, and a path is geometry this cannot flatten to a box.
 */

import { resolveOverlays, type OngoingHandle } from '@weasel-js/core';
import type { ChromeBox } from './screen';

/** Gesture chrome, in CSS pixels relative to the pane's top-left. */
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
