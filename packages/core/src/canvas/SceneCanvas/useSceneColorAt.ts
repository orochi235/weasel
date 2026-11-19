/** The `colorAt` dep `<SceneCanvas>` sources: its `sampleLayers`, or its scene's own layers. */
import type { RefObject } from 'react';
import { paintedLayers, type RenderLayer } from 'core/layers/render';
import { annotationLayerIds } from 'core/scene/annotation';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { resolveDpr } from '../canvasRenderer';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useColorAtDepSource } from '../deps/colorAt';
import type { SceneSlotLayers } from '../layerSlots';
import { sceneLayerKey } from '../sceneLayerPaint';

/** The scene slot's layers the canvas shows as the document, in the order it paints them:
 *  as `layerVisibility` and `layerOrder` leave them, less the annotation layers. */
export function documentLayersOf(
  slot: SceneSlotLayers | null | undefined,
  scene: Pick<Scene<unknown, string, unknown>, 'layers'>,
  layerVisibility: Record<string, boolean> | undefined,
  layerOrder?: readonly string[],
): RenderLayer<unknown>[] {
  const annotations = new Set([...annotationLayerIds(scene.layers)].map(sceneLayerKey));
  const document = (slot?.layers ?? []).filter(({ key }) => !annotations.has(key)).map(({ layer }) => layer);
  return paintedLayers(document, layerVisibility ?? {}, layerOrder);
}

export function useSceneColorAt(args: {
  sampleLayers: readonly RenderLayer<unknown>[] | undefined;
  sceneSlot: SceneSlotLayers | null | undefined;
  scene: Scene<unknown, string, unknown>;
  layerVisibility: Record<string, boolean> | undefined;
  layerOrder: readonly string[] | undefined;
  viewRef: RefObject<View>;
  apiRef: RefObject<CanvasExtensionApi | null>;
  dpr: number | undefined;
}): void {
  const { sampleLayers, sceneSlot, scene, layerVisibility, layerOrder, viewRef, apiRef, dpr } = args;
  useColorAtDepSource({
    layers: () => sampleLayers ?? documentLayersOf(sceneSlot, scene, layerVisibility, layerOrder),
    view: () => viewRef.current,
    dims: () => {
      const api = apiRef.current;
      if (!api?.element) return null;
      const { width, height } = api.getSurfaceRect();
      return { width, height, dpr: resolveDpr(dpr) };
    },
  });
}
