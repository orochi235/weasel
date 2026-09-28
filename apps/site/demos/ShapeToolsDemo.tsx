import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  type ToolsApi,
  BUILTIN_TOOL_IDS,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui';

const W = 600, H = 400;

export function ShapeToolsDemo() {
  // Empty scene; `defaultTools={BUILTIN_TOOL_IDS}` materializes the
  // full shape toolset (rect / ellipse / line / polygon / star / pencil +
  // lasso / text / clone) with default `create` callbacks that produce
  // leaf nodes shaped for the kit's PATH_PAINTER.
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        features={['pick']}
        defaultTools={BUILTIN_TOOL_IDS}
        onToolsCreated={setTools}
      />
    </div>
  );
}
