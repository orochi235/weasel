import {
  SceneCanvas,
  useScene,
  useSelection,
  BUILTIN_TOOL_IDS, pickPreset, WeaselProvider,
} from '@weasel-js/core';
import { usePencilTool, usePenTool, useSliceTool } from '@weasel-js/path-tools';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

const W = 600, H = 400;

// Text and sticky notes need a text editor wired to the canvas; each has a demo of its own that does.
const TOOLS = BUILTIN_TOOL_IDS.filter((id) => id !== 'sticky' && id !== 'text');

export function ShapeToolsDemo() {
  const pen = usePenTool();
  const pencil = usePencilTool();
  const slice = useSliceTool();
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
            defaultTools={TOOLS}
            tools={{ pen, pencil, slice }}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
