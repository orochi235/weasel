import { useCallback, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createSceneLayerGate, type ViewLayerPaint } from '../sceneLayerPaint';
import { useOptionalViewRegistry } from '../viewRegistry';

/**
 * Whether the surface's own view paints a scene layer, judged against the
 * stack `<Canvas>` composed and read at pick time, so a consumer slot anchored
 * between scene layers is weighed the way paint weighs it. Undefined when the
 * view hides nothing, so a pick walk skips the gate.
 */
export function useViewLayerGate(
  layerVisibility: ViewLayerPaint['layerVisibility'],
  layerOrder: ViewLayerPaint['layerOrder'],
): ((layerId: string) => boolean) | undefined {
  const surfaceViewRegistry = useOptionalViewRegistry();
  const layerPaintRef = useLatest<ViewLayerPaint>({ layerVisibility, layerOrder });
  const [sceneLayerGate] = useState(createSceneLayerGate);
  const layerIsPainted = useCallback((layerId: string): boolean => (
    sceneLayerGate(surfaceViewRegistry?.surface()?.layers() ?? [], layerPaintRef.current)(layerId)
  ), [surfaceViewRegistry, sceneLayerGate, layerPaintRef]);
  return layerVisibility !== undefined || layerOrder !== undefined ? layerIsPainted : undefined;
}
