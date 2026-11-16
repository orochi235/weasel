import { solid } from '@weasel-js/paint';
import { asNodeId, SceneCanvas, useScene, rectPath, viewPreset, WeaselProvider } from '@weasel-js/core';
import { alignmentSnapSource, spacingSnapSource } from '@weasel-js/guides';
import type { Fill, Path, RectPose } from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';
import { movePreset, pickPreset, shapeToolKitPreset, useSelection } from '@weasel-js/editing';

// The same `{ path, fill }` shape the rect tool's insert dep mints, so the
// kit's path painter draws both without a custom drawOne.
interface NodeData { path: Path; fill: Fill }
type LayerId = 'default';

const W = 460, H = 320;
const COLOR = '#e0397f';
const SNAP = {
  sources: [
    alignmentSnapSource({ page: { x: 0, y: 0, width: W, height: H }, color: COLOR }),
    spacingSnapSource({ color: COLOR }),
  ],
};

const rect = (id: string, pose: RectPose, color: string) => ({
  id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: { paint: solid(color) } },
});

export function AlignmentGuidesDemo() {
  const scene = useScene<NodeData, LayerId, RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      rect('a', { x: 30, y: 50, width: 70, height: 60 }, '#7fb069'),
      rect('d', { x: 140, y: 40, width: 50, height: 60 }, '#d9c36f'),
      rect('b', { x: 300, y: 130, width: 80, height: 80 }, '#d98f6f'),
      rect('c', { x: 150, y: 230, width: 120, height: 50 }, '#6f9fd9'),
      rect('drag', { x: 240, y: 60, width: 70, height: 70 }, '#b07fd0'),
    ],
  });
  // Multi-select so Cmd-clicking several rects and dragging snaps the
  // selection's union box, not just one rect.
  const selection = useSelection({ scene, mode: 'multi' });

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <ToolPalette orientation="horizontal" />
        <DemoStage width={W} height={H}>
          <SceneCanvas features={[viewPreset, pickPreset, movePreset, shapeToolKitPreset]}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            defaultTools={['rect']}
            viewport={{}}
            snap={SNAP}
          />
        </DemoStage>
      </div>
    </WeaselProvider>
  );
}
