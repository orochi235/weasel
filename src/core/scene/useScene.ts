import { useRef, useSyncExternalStore } from 'react';
import { createScene } from './scene';
import type { Scene, UseSceneOptions } from './types';

/** React hook returning a kit-owned `Scene`. The Scene is constructed once
 *  per host component and tracked via `useSyncExternalStore`, so React re-
 *  renders on every Scene mutation (including undo/redo). */
export function useScene<TData, TLayer extends string, TPose = import('../../features/groups/composePose').RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose> {
  const sceneRef = useRef<Scene<TData, TLayer, TPose> | null>(null);
  if (sceneRef.current === null) {
    sceneRef.current = createScene<TData, TLayer, TPose>(options);
  }
  const scene = sceneRef.current;
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  return scene;
}
