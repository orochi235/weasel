import { SceneCanvas, asNodeId, solid, useScene, useSelection, WeaselProvider } from '@weasel-js/core';
import { stickyData, whiteboardPreset } from '@weasel-js/text-tools';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

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
            features={[whiteboardPreset]}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
