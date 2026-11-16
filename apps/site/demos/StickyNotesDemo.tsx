import { SceneCanvas, asNodeId, solid, stickyData, useScene, useSelection, editPreset, movePreset, pickPreset, resizePreset, WeaselProvider } from '@weasel-js/core';
import { usePencilTool } from '@weasel-js/path-tools';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

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
  note('c', 30, 188, 'A note cuts its text at its edge. Double-click this one and scroll, or move the caret down, to reach the rest of a sentence that runs on well past the bottom of the paper.', '#ffd6e0ff'),
];

export function StickyNotesDemo() {
  const pencil = usePencilTool();
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <ToolPalette orientation="horizontal" />
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            backgroundFill={{ color: '#f4f1ea' }}
            scene={scene}
            selection={selection}
            features={[pickPreset, movePreset, resizePreset, editPreset]}
            defaultTools={['sticky', 'text']}
            tools={{ pencil }}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
