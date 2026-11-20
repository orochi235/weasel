import { useMemo, useSyncExternalStore } from 'react';
import { normalizeView, type PoseDescriptor, type Scene, type View } from '@weasel-js/core';
import { computeFitView, type ComputeFitViewOptions, type MinimapFit } from './minimapMath';

const NEVER = (): (() => void) => () => {};
const ZERO = (): number => 0;

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
  const live = fit === 'live';
  const overrideGeneration = useSyncExternalStore(
    live ? scene.overrides.subscribe : NEVER,
    live ? scene.overrides.getGeneration : ZERO,
    live ? scene.overrides.getGeneration : ZERO,
  );
  const scrollGeneration = useSyncExternalStore(
    live ? scene.scroll.subscribe : NEVER,
    live ? scene.scroll.getGeneration : ZERO,
    live ? scene.scroll.getGeneration : ZERO,
  );
  return useMemo<View>(() => {
    // A `fit` function's result is the caller's; pointer math divides by its scale.
    return normalizeView(computeFitView(scene, { width, height }, fit, descriptor, { layers }));
    // The counters are what say the scene's contents moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sceneVersion, overrideGeneration, scrollGeneration, width, height, fit, descriptor, layersKey]);
}
