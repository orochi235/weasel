import type { View } from './view';

/** Optional clamp bounds for `zoomAt`. Defaults: min=0.1, max=8. */
export interface ZoomClampOpts {
  min?: number;
  max?: number;
}

/**
 * Pure zoom primitive. Returns a new `View` whose `scale` is `view.scale *
 * factor` (clamped) and whose translation is adjusted so that the world
 * point currently under `anchor` (screen coords relative to the canvas
 * top-left) stays under the same screen pixel after the zoom.
 */
export function zoomAt(
  view: View,
  anchor: { x: number; y: number },
  factor: number,
  opts?: ZoomClampOpts,
): View {
  const min = opts?.min ?? 0.1;
  const max = opts?.max ?? 8;
  const nextScale = Math.min(max, Math.max(min, view.scale * factor));
  const worldX = anchor.x / view.scale + view.x;
  const worldY = anchor.y / view.scale + view.y;
  return {
    scale: nextScale,
    x: worldX - anchor.x / nextScale,
    y: worldY - anchor.y / nextScale,
  };
}
