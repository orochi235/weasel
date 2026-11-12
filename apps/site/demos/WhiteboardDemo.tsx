import { useState } from 'react';
import { SceneCanvas, asNodeId, solid, stickyData, useScene, useSelection, type ToolsApi } from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';

const W = 560, H = 360;

const note = (id: string, x: number, y: number, text: string, color: string) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  parent: null,
  pose: { x, y, width: 150, height: 150 },
  data: stickyData({ text, background: { paint: solid(color) } }),
});

const INITIAL = [
  note('a', 40, 40, 'Ideas', '#fff1a6ff'),
  note('b', 230, 90, 'Questions', '#c8ecffff'),
];

export function WhiteboardDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);
  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          backgroundFill={{ color: '#f4f1ea' }}
          scene={scene}
          selection={selection}
          features={['whiteboard']}
          onToolsCreated={setTools}
        />
      </div>
    </div>
  );
}
