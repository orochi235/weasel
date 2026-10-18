import {
  asNodeId,
  SceneCanvas,
  useScene,
  ROTATED_POSE_DESCRIPTOR,
  useResizePolicy,
} from '@weasel-js/core';
import { createGridLayer, pointSnapToGrid } from '@weasel-js/guides';
import type { RotatedPose, PoseDescriptor } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { DemoStage } from './DemoStage';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 400, H = 300;
const SNAP_GRID = 20;
const GRID = createGridLayer({
  spacing: SNAP_GRID,
  style: { line: { paint: { kind: 'solid', color: '#3a3020' }, width: 1 } },
});

const INITIAL: Rect[] = [
  { id: 'a', x: 160, y: 100, width: 100, height: 60, rotation: Math.PI / 6, color: '#7fb069' },
];

// Point snapping is dispatcher-driven via the `resizePolicy` dep, so this is
// mounted as a child of `<SceneCanvas>`, where `<DepRegistryProvider>` is in
// scope. The pose shape itself comes from `<SceneCanvas poseDescriptor>`.
function ResizePolicyBridge() {
  useResizePolicy<Rect>({
    pointSnap: [pointSnapToGrid({ spacing: SNAP_GRID })],
  });
  return null;
}

const SELECTED = { mode: 'multi', initial: [asNodeId('a')] } as const;

export function PointSnapDemo() {
  const scene = useScene({ items: INITIAL });

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={['select', 'resize']}
        className="ckd-canvas"
        scene={scene}
        selectionOptions={SELECTED}
        poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect>}
        layers={{
          grid: { layer: GRID },
          scene: {
            // drawOne returns unrotated geometry; SceneCanvas wraps the
            // output in a rotation transform when `pose.rotation` is set
            // (see `wrapWithPoseRotation` in `src/canvas/poseRotation.ts`).
            drawOne: (_node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { paint: { color: p.color } },
            }],
          },
        }}
      >
        <ResizePolicyBridge />
      </SceneCanvas>
    </DemoStage>
  );
}
