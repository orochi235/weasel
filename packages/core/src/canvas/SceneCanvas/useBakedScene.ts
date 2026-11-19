import { useEffect, useState } from 'react';
import { loadScene } from 'core/scene/scene';
import { isSerializedScene } from 'core/scene/serialization';
import type { Scene } from 'core/scene/types';
import type { PoseComposition } from 'core/scene/composePose';
import type { SceneCanvasSceneProps } from './sceneProps';

/**
 * `scene` accepts either a live `Scene` or a `SerializedScene` JSON object. JSON is baked
 * once, under `composition` when given; later prop changes are ignored (use a `key` on
 * `<SceneCanvas>` to force a fresh canvas). A live scene may be swapped for another live
 * scene; one swapped for JSON keeps the last live scene, with a warning.
 */
export function useBakedScene<TData, TLayer extends string, TPose>(
  sceneInput: SceneCanvasSceneProps<TData, TLayer, TPose>['scene'],
  composition?: PoseComposition<TPose>,
): Scene<TData, TLayer, TPose> {
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => (isSerializedScene<TData, TLayer, TPose>(sceneInput) ? loadScene(sceneInput, { composition }) : null),
  );
  const live = bakedScene || isSerializedScene<TData, TLayer, TPose>(sceneInput) ? null : (sceneInput as Scene<TData, TLayer, TPose>);
  const [lastLive, setLastLive] = useState(live);
  if (live && live !== lastLive) setLastLive(live);
  const ignored = !bakedScene && !live;
  useEffect(() => {
    if (ignored) console.warn('[SceneCanvas] `scene` changed from a live Scene to serialized JSON, which is ignored; give the canvas a new `key` to load it');
  }, [ignored]);
  return bakedScene ?? live ?? lastLive!;
}
