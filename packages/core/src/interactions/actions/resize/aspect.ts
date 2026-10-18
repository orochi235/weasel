import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { ResizeAnchor } from '../../gestures/types';

/** `b` with the axis an edge handle leaves free scaled to keep `origin`'s
 *  aspect, centered on `origin`. A corner keeps its aspect through the snap
 *  session's input subspace instead, so it comes back unchanged. */
export function edgeAspect(b: Bounds, origin: Bounds, anchor: ResizeAnchor): Bounds {
  if ((anchor.x === 'free') === (anchor.y === 'free') || origin.width === 0 || origin.height === 0) return b;
  const ratio = origin.width / origin.height;
  if (anchor.x === 'free') {
    const width = Math.abs(b.height * ratio);
    return { ...b, x: origin.x + origin.width / 2 - width / 2, width };
  }
  const height = Math.abs(b.width / ratio);
  return { ...b, y: origin.y + origin.height / 2 - height / 2, height };
}
