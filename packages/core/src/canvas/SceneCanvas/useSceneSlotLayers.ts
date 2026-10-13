/**
 * The scene slot, built: the caller's config wired to the scene, and the
 * canvas layers it paints as. A hierarchical scene gets one canvas layer per
 * scene layer, so the list follows the scene's layers after mount.
 */
import { useMemo } from 'react';
import type { ColorOverrideRegistry } from '@weasel-js/animator';
import type { Node, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { buildSceneLayers, type CanvasAdapter, type SceneSlotConfig } from '../buildSceneLayer';
import { isCustomEntry, type LayersMap, type SceneSlotLayers } from '../layerSlots';
import { wireSceneSlotToScene } from '../sceneSlotWiring';
import { useSceneLayerList } from '../useSceneLayerList';

type SceneSlot<TData, TLayer extends string, TPose> =
  LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];

export function useSceneSlotLayers<TData, TLayer extends string, TPose>(args: {
  /** The slot after `mergeLayersWithDefaults`. */
  slot: SceneSlot<TData, TLayer, TPose>;
  scene: Scene<TData, TLayer, TPose>;
  adapter: CanvasAdapter<Node<TData, TLayer, TPose>, TPose>;
  alphaFor: ((id: string) => number) | undefined;
  colorOverrides: ColorOverrideRegistry | undefined;
  /** Committed bounds of a node, for the debug overlay's record of it. */
  boundsOf: (id: string) => Bounds | null;
  /** Ids an in-flight gesture is ghosting; their committed paint is left out
   *  so the source does not show through the ghost. */
  previewIds: () => Iterable<string> | null;
}): {
  /** The scene-wired config, for whatever else paints with its `drawOne`. */
  config: SceneSlot<TData, TLayer, TPose>;
  /** Absent when the slot is empty or carries no `drawOne`. */
  layers: SceneSlotLayers | undefined;
} {
  const { slot, scene, adapter, alphaFor, colorOverrides, boundsOf, previewIds } = args;

  const config = useMemo(() => {
    if (!slot || isCustomEntry(slot)) return slot;
    return wireSceneSlotToScene(
      slot as SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
      scene,
      alphaFor,
      colorOverrides,
    );
  }, [slot, alphaFor, scene, colorOverrides]);

  const sceneLayersKey = useSceneLayerList(adapter);
  const layers = useMemo<SceneSlotLayers | undefined>(() => {
    if (!config || isCustomEntry(config) || !config.drawOne) return undefined;
    return {
      layers: buildSceneLayers(config, adapter, boundsOf, () => {
        const ids = new Set(previewIds() ?? []);
        return ids.size > 0 ? ids : null;
      }),
    };
    // `sceneLayersKey` stands for `adapter.getLayers()`, which `buildSceneLayers` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, adapter, boundsOf, previewIds, sceneLayersKey]);

  return { config, layers };
}
