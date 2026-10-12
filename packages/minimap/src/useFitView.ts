import { useMemo, useSyncExternalStore } from 'react';
import { normalizeView, type PoseDescriptor, type Scene, type View } from '@weasel-js/core';
import { computeFitView, type MinimapFit } from './minimapMath';

const NEVER = (): (() => void) => () => {};

/**
 * The minimap's fit view, recomputed when what it frames changes: the scene's
 * version always, and the overrides only under a `"live"` fit, the one policy
 * that reads them.
 */
export function useFitView<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  width: number,
  height: number,
  fit: MinimapFit<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
): View {
  const sceneVersion = useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  const overrideGeneration = useSyncExternalStore(
    fit === 'live' ? scene.overrides.subscribe : NEVER,
    scene.overrides.getGeneration,
    scene.overrides.getGeneration,
  );
  return useMemo<View>(() => {
    // A `fit` function's result is the caller's; pointer math divides by its scale.
    return normalizeView(computeFitView(scene, { width, height }, fit, descriptor));
    // The two counters are what say the scene's contents moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sceneVersion, overrideGeneration, width, height, fit, descriptor]);
}
