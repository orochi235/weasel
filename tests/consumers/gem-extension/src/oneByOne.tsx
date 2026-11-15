// #region gem-one-by-one
import { useEffect } from 'react';
import {
  SceneCanvas, drawPreset, registerNodeShape,
  type RectPose, type Scene, type ToolsApi,
} from '@weasel-js/core';
import { gemInsert, gemShape, gemTool } from './gem.js';

const FEATURES = [drawPreset];
const TOOLS = { gem: gemTool };
const FACTORIES = { gem: gemInsert };

/** The gem's painter and tool installed one by one rather than as a preset. `registerNodeShape` is process-wide,
 *  so the canvas that registers it releases it when it unmounts. */
export function OneByOneGemCanvas({ scene, onToolsCreated }: {
  scene: Scene<unknown, 'default', RectPose>;
  onToolsCreated?: (tools: ToolsApi) => void;
}) {
  useEffect(() => registerNodeShape(gemShape), []);
  return (
    <SceneCanvas
      scene={scene} width={200} height={200}
      features={FEATURES} tools={TOOLS} insertNodeFactories={FACTORIES}
      onToolsCreated={onToolsCreated}
    />
  );
}
// #endregion gem-one-by-one
