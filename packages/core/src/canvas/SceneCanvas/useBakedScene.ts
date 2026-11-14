import { useState } from 'react';
import { sceneFromJSON } from 'core/scene/scene';
import { isSerializedScene } from 'core/scene/serialization';
import type { Scene } from 'core/scene/types';
import type { PoseComposition } from 'core/scene/composePose';
import type { SceneCanvasSceneProps } from './sceneProps';

/**
 * `scene` accepts either a live `Scene` or a `SerializedScene` JSON object. JSON is baked
 * once, under `composition` when given; later prop changes are ignored (use a `key` on
 * `<SceneCanvas>` to force a fresh canvas).
 */
export function useBakedScene<TData, TLayer extends string, TPose>(
  sceneInput: SceneCanvasSceneProps<TData, TLayer, TPose>['scene'],
  composition?: PoseComposition<TPose>,
): Scene<TData, TLayer, TPose> {
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => (isSerializedScene<TData, TLayer, TPose>(sceneInput) ? sceneFromJSON(sceneInput, { composition }) : null),
  );
  return bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);
}
