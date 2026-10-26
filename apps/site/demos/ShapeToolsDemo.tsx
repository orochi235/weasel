import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  type ToolsApi,
  BUILTIN_TOOL_IDS,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

const W = 600, H = 400;

// Text and sticky notes need a text editor wired to the canvas; each has a demo of its own that does.
const TOOLS = BUILTIN_TOOL_IDS.filter((id) => id !== 'sticky' && id !== 'text');

export function ShapeToolsDemo() {
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          features={['pick']}
          defaultTools={TOOLS}
          onToolsCreated={setTools}
        />
      </DemoStage>
    </div>
  );
}
