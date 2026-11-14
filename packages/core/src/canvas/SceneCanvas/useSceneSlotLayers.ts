/**
 * The scene slot, built: the caller's config wired to the scene, and the
 * canvas layers it paints as. A hierarchical scene gets one canvas layer per
 * scene layer, so the list follows the scene's layers after mount.
 */
import { useMemo } from 'react';
import type { PaintOverrides } from '../paintOverrides';
import type { Node, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { buildSceneLayers, type SceneSlotConfig } from '../buildSceneLayer';
import type { HierarchicalAdapter } from '../buildSceneTree';
import { isCustomEntry, type LayersMap, type SceneSlotLayers } from '../layerSlots';
import { wireSceneSlotToScene } from '../sceneSlotWiring';
import { useSceneLayersKey } from '../useSceneLayersKey';

type SceneSlot<TData, TLayer extends string, TPose> =
  LayersMap<Node<TData, TLayer, TPose>, TPose>['scene'];

export function useSceneSlotLayers<TData, TLayer extends string, TPose>(args: {
  /** The slot after `mergeLayersWithDefaults`. */
  slot: SceneSlot<TData, TLayer, TPose>;
  scene: Scene<TData, TLayer, TPose>;
  adapter: HierarchicalAdapter<Node<TData, TLayer, TPose>, TPose>;
  alphaFor: ((id: string) => number) | undefined;
  paintOverrides: PaintOverrides | undefined;
  /** Committed bounds of a node, for the debug overlay's record of it. */
  boundsOf: (id: string) => Bounds | null;
  /** Ids an in-flight gesture is ghosting; their committed paint is left out
   *  so the source does not show through the ghost. */
  previewIds: () => Iterable<string> | null;
}): {
  /** The scene-wired config, for whatever else paints with its `drawOne`. */
  config: SceneSlot<TData, TLayer, TPose>;
  /** Absent when the slot is empty or carries no `drawOne`; a pre-built layer is the whole slot. */
  layers: SceneSlotLayers | undefined;
} {
  const { slot, scene, adapter, alphaFor, paintOverrides, boundsOf, previewIds } = args;

  const config = useMemo(() => {
    if (!slot || isCustomEntry(slot)) return slot;
    return wireSceneSlotToScene(
      slot as SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
      scene,
      alphaFor,
      paintOverrides,
    );
  }, [slot, alphaFor, scene, paintOverrides]);

  const sceneLayersKey = useSceneLayersKey(adapter);
  const layers = useMemo<SceneSlotLayers | undefined>(() => {
    if (isCustomEntry(config)) return { layers: [{ key: 'scene', layer: config.layer }] };
    if (!config || !config.drawOne) return undefined;
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
