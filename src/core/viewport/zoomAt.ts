import type { View, ZoomFactor, ZoomBound } from './view';

/** Optional clamp bounds for `zoomAt`. Defaults: min=0.1, max=8 (per axis). */
export interface ZoomClampOpts {
  min?: ZoomBound;
  max?: ZoomBound;
}

/**
 * Pure zoom primitive. Returns a new `View` whose `scale` is multiplied
 * by `factor` (per-axis, clamped) and whose translation is adjusted so
 * that the world point currently under `anchor` (screen coords relative
 * to the canvas top-left) stays under the same screen pixel after the
 * zoom — independently on each axis.
 *
 * `factor: number` means "apply uniformly to both axes". `factor: {x, y}`
 * applies per-axis factors. Likewise for `opts.min` / `opts.max`.
 */
export function zoomAt(
  view: View,
  anchor: { x: number; y: number },
  factor: ZoomFactor,
  opts?: ZoomClampOpts,
): View {
  const fx = typeof factor === 'number' ? factor : factor.x;
  const fy = typeof factor === 'number' ? factor : factor.y;
  const minX = typeof opts?.min === 'number' ? opts.min : opts?.min?.x ?? 0.1;
  const minY = typeof opts?.min === 'number' ? opts.min : opts?.min?.y ?? 0.1;
  const maxX = typeof opts?.max === 'number' ? opts.max : opts?.max?.x ?? 8;
  const maxY = typeof opts?.max === 'number' ? opts.max : opts?.max?.y ?? 8;

  const nextX = Math.min(maxX, Math.max(minX, view.scale.x * fx));
  const nextY = Math.min(maxY, Math.max(minY, view.scale.y * fy));

  const worldX = anchor.x / view.scale.x + view.x;
  const worldY = anchor.y / view.scale.y + view.y;
  return {
    scale: { x: nextX, y: nextY },
    x: worldX - anchor.x / nextX,
    y: worldY - anchor.y / nextY,
  };
}
