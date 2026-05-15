// TODO(visual-regression): baseline PNG deferred — run `npm run test:visual` manually
// after the dev server is up to capture the initial snapshot.
import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  type ToolsApi,
} from '@orochi235/weasel';
// ToolPalette is a Swillustrator-side specialization
// (apps/swillustrator/src/ui/) — see the kit/app split.
import { ToolPalette } from '../../apps/swillustrator/src/ui/ToolPalette';

const W = 600, H = 400;

export function ShapeToolsDemo() {
  // Empty scene; SceneCanvas's `toolBundle="exhaustive"` materializes the
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
        selectionMode="multi"
        toolBundle="exhaustive"
        onToolsCreated={setTools}
      />
    </div>
  );
}
