/** The `colorAt` dep `<SceneCanvas>` sources: its `sampleLayers`, or its scene's own layers. */
import type { RefObject } from 'react';
import type { RenderLayer } from 'core/layers/render';
import { annotationLayerIds } from 'core/scene/annotation';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { resolveDpr } from '../canvasRenderer';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useColorAtDepSource } from '../deps/colorAt';
import type { SceneSlotLayers } from '../layerSlots';
import { sceneLayerKey } from '../sceneLayerPaint';

/** The scene slot's layers the canvas shows as the document: not hidden by
 *  `layerVisibility`, and not annotation layers. */
export function documentLayersOf(
  slot: SceneSlotLayers | null | undefined,
  scene: Pick<Scene<unknown, string, unknown>, 'layers'>,
  layerVisibility: Record<string, boolean> | undefined,
): RenderLayer<unknown>[] {
  const annotations = new Set([...annotationLayerIds(scene.layers)].map(sceneLayerKey));
  return (slot?.layers ?? [])
    .filter(({ key }) => layerVisibility?.[key] !== false && !annotations.has(key))
    .map(({ layer }) => layer);
}

export function useSceneColorAt(args: {
  sampleLayers: readonly RenderLayer<unknown>[] | undefined;
  sceneSlot: SceneSlotLayers | null | undefined;
  scene: Scene<unknown, string, unknown>;
  layerVisibility: Record<string, boolean> | undefined;
  viewRef: RefObject<View>;
  apiRef: RefObject<CanvasExtensionApi | null>;
  dpr: number | undefined;
}): void {
  const { sampleLayers, sceneSlot, scene, layerVisibility, viewRef, apiRef, dpr } = args;
  useColorAtDepSource({
    layers: () => sampleLayers ?? documentLayersOf(sceneSlot, scene, layerVisibility),
    view: () => viewRef.current,
    dims: () => {
      const api = apiRef.current;
      if (!api?.element) return null;
      const { width, height } = api.getSurfaceRect();
      return { width, height, dpr: resolveDpr(dpr) };
    },
  });
}
