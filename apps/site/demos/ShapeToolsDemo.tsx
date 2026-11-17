import { SceneCanvas, useScene, WeaselProvider } from '@weasel-js/core';
import { usePencilTool, usePenTool, useSliceTool } from '@weasel-js/path-tools';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';
import { pickPreset, BUILTIN_TOOL_IDS, shapeToolKitPreset, useSelection } from '@weasel-js/editing';

const W = 600, H = 400;

export function ShapeToolsDemo() {
  const pen = usePenTool();
  const pencil = usePencilTool();
  const slice = useSliceTool();
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ scene, mode: 'multiple' });

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <ToolPalette orientation="horizontal" />
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            features={[pickPreset, shapeToolKitPreset]}
            defaultTools={BUILTIN_TOOL_IDS}
            tools={{ pen, pencil, slice }}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
