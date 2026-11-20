import { useMemo, useSyncExternalStore } from 'react';
import { normalizeView, type PoseDescriptor, type Scene, type View } from '@weasel-js/core';
import { computeFitView, type ComputeFitViewOptions, type MinimapFit } from './minimapMath';

const NEVER = (): (() => void) => () => {};

/**
 * The minimap's fit view, recomputed when what it frames changes: the scene's
 * version always, and the overrides and scroll offsets only under a `"live"`
 * fit, the one policy that reads them. `layers` is the minimap's own layer map, compared by value.
 */
export function useFitView<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  width: number,
  height: number,
  fit: MinimapFit<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
  layers: ComputeFitViewOptions['layers'] = {},
): View {
  const layersKey = JSON.stringify([layers.layerVisibility ?? null, layers.layerOrder ?? null]);
  const sceneVersion = useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  const overrideGeneration = useSyncExternalStore(
    fit === 'live' ? scene.overrides.subscribe : NEVER,
    scene.overrides.getGeneration,
    scene.overrides.getGeneration,
  );
  const scrollGeneration = useSyncExternalStore(
    fit === 'live' ? scene.scroll.subscribe : NEVER,
    scene.scroll.getGeneration,
    scene.scroll.getGeneration,
  );
  return useMemo<View>(() => {
    // A `fit` function's result is the caller's; pointer math divides by its scale.
    return normalizeView(computeFitView(scene, { width, height }, fit, descriptor, { layers }));
    // The counters are what say the scene's contents moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sceneVersion, overrideGeneration, scrollGeneration, width, height, fit, descriptor, layersKey]);
}
