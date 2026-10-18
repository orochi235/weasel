import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import type { RenderLayer } from 'core/layers/render';
import { createSceneLayerGate, type ViewLayerPaint } from './sceneLayerPaint';

/**
 * Whether a surface's own view paints a scene layer, judged against the stack
 * `surfaceLayers` returns, read at ask time, so a consumer slot anchored
 * between scene layers is weighed the way paint weighs it. Undefined when the
 * view hides nothing, so a pick walk or a chrome pass skips the gate.
 */
export function useViewLayerGate(
  layerVisibility: ViewLayerPaint['layerVisibility'],
  layerOrder: ViewLayerPaint['layerOrder'],
  surfaceLayers: () => readonly RenderLayer<unknown>[],
): ((layerId: string) => boolean) | undefined {
  const layerPaintRef = useLatest<ViewLayerPaint>({ layerVisibility, layerOrder });
  const surfaceLayersRef = useLatest(surfaceLayers);
  const [sceneLayerGate] = useState(createSceneLayerGate);
  const layerIsPainted = useCallback((layerId: string): boolean => (
    sceneLayerGate(surfaceLayersRef.current(), layerPaintRef.current)(layerId)
  ), [sceneLayerGate, surfaceLayersRef, layerPaintRef]);
  return layerVisibility !== undefined || layerOrder !== undefined ? layerIsPainted : undefined;
}
