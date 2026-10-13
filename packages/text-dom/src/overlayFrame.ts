import type { TextEditScreenPose } from './textEditTypes';

/**
 * The overlay's CSS `transform`, for an origin of `0 0`: the pose's `zoom`,
 * its `frame` about the box center, and the pull back by `anchor` of the
 * overlay's own width that aligns an unwrapped line. `left` and `top` are
 * where the overlay's origin sits before any of it, in container pixels.
 */
export function overlayTransform(pose: TextEditScreenPose, left: number, top: number, anchor: number): string {
  const zoom = pose.zoom ?? 1;
  const parts: string[] = [];
  if (pose.frame) {
    const [a, b, c, d] = pose.frame;
    // The origin's offset from the box center, which the frame turns with
    // everything else.
    const dx = left - (pose.x + (pose.width * zoom) / 2);
    const dy = top - (pose.y + (pose.height * zoom) / 2);
    const m = [a * zoom, b * zoom, c * zoom, d * zoom, (a - 1) * dx + c * dy, b * dx + (d - 1) * dy];
    parts.push(`matrix(${m.join(', ')})`);
  } else if (zoom !== 1) {
    parts.push(`scale(${zoom})`);
  }
  if (anchor !== 0) parts.push(`translateX(${-anchor * 100}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}
