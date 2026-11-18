import { SceneCanvas, useScene } from '@weasel-js/core';
import type { Fill } from '@weasel-js/core';
import { DemoStage } from './DemoStage';
import { insertPreset, useRectTool } from '@weasel-js/editing';

/** What the kit's `insert` dep mints for a rect. */
interface RectData { path: unknown; fill: Fill }
interface RectPose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

export function InsertDemo() {
  const scene = useScene<RectData, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
  const rect = useRectTool();
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={scene}
        features={[insertPreset]}
        tools={{ rect }}
        defaultActiveTool="rect"
      />
    </DemoStage>
  );
}
