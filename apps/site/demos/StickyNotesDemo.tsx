import { useState } from 'react';
import { SceneCanvas, asNodeId, solid, stickyData, useScene, useSelection, type ToolsApi } from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';

const W = 520, H = 340;

const note = (id: string, x: number, y: number, text: string, color?: string) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  parent: null,
  pose: { x, y, width: 150, height: 150 },
  // The tool's own node: a text node with a background.
  data: stickyData({ text, ...(color ? { background: { paint: solid(color) } } : {}) }),
});

const INITIAL = [
  note('a', 30, 30, 'Drag to draw a note, or click to place one'),
  note('b', 200, 60, 'Double-click to edit', '#c8ecffff'),
  note('c', 30, 188, 'A note cuts its text at its edge, so this sentence, which runs on well past the bottom of the paper, is clipped there.', '#ffd6e0ff'),
];

export function StickyNotesDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ mode: 'multi' });
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
          features={['pick', 'move', 'resize', 'edit']}
          defaultTools={['sticky', 'pencil', 'text']}
          initialActiveTool="sticky"
          onToolsCreated={setTools}
        />
      </div>
    </div>
  );
}
