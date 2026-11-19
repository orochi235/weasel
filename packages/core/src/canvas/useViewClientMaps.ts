/** Where a client point lands in a `<CanvasView>`: its world, and its own screen space; and where a world point of
 *  its sits on the canvas. */
import { useCallback } from 'react';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { ViewRect } from './canvasViewProps';
import { surfaceLocal, type ViewRegistry } from './viewRegistry';

type Point = { x: number; y: number };

/** The view's client maps, and `toCanvas`, a world point in the canvas's CSS px. Its rect moves with the outer
 *  camera, so each reads it per call. */
export function useViewClientMaps(
  registry: ViewRegistry | null,
  rectNow: () => ViewRect,
  camera: () => View,
): {
  toWorld: (cx: number, cy: number) => Point;
  toLocal: (cx: number, cy: number) => Point;
  toCanvas: (wx: number, wy: number) => Point;
} {
  const toWorld = useCallback((cx: number, cy: number): Point => {
    const local = surfaceLocal(registry?.surface() ?? null, cx, cy);
    const rect = rectNow();
    const [x, y] = clientToWorld(local.x, local.y, { left: rect.x, top: rect.y }, camera());
    return { x, y };
  }, [registry, rectNow, camera]);
  // CSS px from the view's top-left: where its camera anchors, and a multitouch centroid is reported.
  const toLocal = useCallback((cx: number, cy: number): Point => {
    const local = surfaceLocal(registry?.surface() ?? null, cx, cy);
    const rect = rectNow();
    return { x: local.x - rect.x, y: local.y - rect.y };
  }, [registry, rectNow]);
  const toCanvas = useCallback((wx: number, wy: number): Point => {
    const rect = rectNow();
    const [sx, sy] = worldToScreen(wx, wy, viewToTransform(camera()));
    return { x: rect.x + sx, y: rect.y + sy };
  }, [rectNow, camera]);
  return { toWorld, toLocal, toCanvas };
}
