import type { View } from './view';

/**
 * The world-space rectangle a camera shows in a host `size` CSS pixels across.
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
  return {
    x: view.x,
    y: view.y,
    width: size.width / view.scale.x,
    height: size.height / view.scale.y,
  };
}
