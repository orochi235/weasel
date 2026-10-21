import { useState } from 'react';
import { SceneCanvas, useScene, useSelection, rectPath, solid } from '@weasel-js/core';
import { alignmentSnapSource, spacingSnapSource } from '@weasel-js/guides';
import type { NodeId, Path, ToolsApi, Fill } from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';

// The same `{ path, fill }` shape the rect tool's insert dep mints, so the
// kit's path painter draws both without a custom drawOne.
interface NodeData { path: Path; fill: Fill }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const COLOR = '#e0397f';
const SNAP = {
  sources: [
    alignmentSnapSource({ page: { x: 0, y: 0, width: W, height: H }, color: COLOR }),
    spacingSnapSource({ color: COLOR }),
  ],
};

const rect = (id: string, pose: Pose, color: string) => ({
  id: id as NodeId, kind: 'leaf' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: solid(color) } },
});

export function AlignmentGuidesDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      rect('a', { x: 30, y: 50, width: 70, height: 60 }, '#7fb069'),
      rect('d', { x: 140, y: 40, width: 50, height: 60 }, '#d9c36f'),
      rect('b', { x: 300, y: 130, width: 80, height: 80 }, '#d98f6f'),
      rect('c', { x: 150, y: 230, width: 120, height: 50 }, '#6f9fd9'),
      rect('drag', { x: 240, y: 60, width: 70, height: 70 }, '#b07fd0'),
    ],
  });
  // Multi-select so shift-clicking several rects and dragging snaps the
  // selection's union box, not just one rect.
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <DemoStage width={W} height={H}>
        <SceneCanvas features={['pick', 'move']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          defaultTools={['rect']}
          onToolsCreated={setTools}
          viewport={{}}
          snap={SNAP}
        />
      </DemoStage>
    </div>
  );
}
