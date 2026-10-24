import { useMemo } from 'react';
import type { Scene } from 'core/scene/types';
import {
  sceneToAdapter,
  type SceneCanvasAdapter,
  type SceneToAdapterOptions,
} from './sceneAdapter';

/**
 * React-hook wrapper around `sceneToAdapter`. Memoizes on every option, so
 * the adapter keeps its identity across renders unless one of them changes.
 */
export function useSceneAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
  const {
    selection, commitInsert, insertLayer, poseDescriptor, pasteInto,
  } = options;
  return useMemo(
    () => sceneToAdapter(scene, {
      selection, commitInsert, insertLayer, poseDescriptor, ...(pasteInto ? { pasteInto } : {}),
    }),
    [scene, selection, commitInsert, insertLayer, poseDescriptor, pasteInto],
  );
}
