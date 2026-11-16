import {
  SceneCanvas,
  useScene,
  useSelection,
  BUILTIN_TOOL_IDS, pickPreset, WeaselProvider,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

const W = 600, H = 400;

export function ShapeToolsDemo() {
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ scene, mode: 'multi' });

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <ToolPalette orientation="horizontal" />
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            features={[pickPreset]}
            defaultTools={BUILTIN_TOOL_IDS}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
