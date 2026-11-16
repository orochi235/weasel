// #region gem-editor
import { IconRegistryProvider, SceneCanvas, useSelection, type FeaturePreset, type RectPose, type Scene, type SceneCanvasHit, type ToolsApi } from '@weasel-js/core';
import { SelectionPanel } from '@weasel-js/ui';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { gemFeature } from './index.js';
import { drawPreset } from '@weasel-js/editing';

const FEATURES: readonly FeaturePreset[] = [drawPreset, gemFeature];

/** A canvas and a properties panel given the same presets, over one scene and one selection. */
export function GemEditor({ scene, features = FEATURES, onToolsCreated, onClick }: {
  scene: Scene<unknown, 'default', RectPose>;
  features?: readonly FeaturePreset[];
  onToolsCreated?: (tools: ToolsApi) => void;
  onClick?: (hit: SceneCanvasHit | null) => void;
}) {
  // Kept in the scene, so the canvas, the panel, and undo all read one selection.
  const selection = useSelection({ scene });
  return (
    <IconRegistryProvider icons={kitIcons}>
      <SceneCanvas
        scene={scene} selection={selection} width={640} height={480} features={features}
        onToolsCreated={onToolsCreated} onClick={onClick}
      />
      <SelectionPanel scene={scene} selection={selection} features={features} />
    </IconRegistryProvider>
  );
}
// #endregion gem-editor
