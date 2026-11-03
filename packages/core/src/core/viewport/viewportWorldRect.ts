import type { View } from './view';

/**
 * The world-space rectangle a camera shows in a host `size` CSS pixels across,
 * with a positive size whichever way its axes run: a flipped axis (y-up) shows
 * the span ending at the camera's corner.
 *
 * One formula, because two callers need it against different hosts: the
 * canvas element for view zero, and a view's own rect for a panel. Paste
 * placement centers on it, so the two disagreeing puts pasted content in a
 * view the user is not looking at.
 */
export function viewportWorldRect(
  view: View,
  size: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const width = size.width / Math.abs(view.scale.x);
  const height = size.height / Math.abs(view.scale.y);
  return {
    x: view.scale.x < 0 ? view.x - width : view.x,
    y: view.scale.y < 0 ? view.y - height : view.y,
    width,
    height,
  };
}
