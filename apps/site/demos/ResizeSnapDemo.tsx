import { asNodeId, SceneCanvas, solid, useScene, ROTATED_POSE_DESCRIPTOR } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import type { Fill, RotatedPose, PoseDescriptor } from '@weasel-js/core';
import { DemoStage } from './DemoStage';

interface Rect extends RotatedPose {
  id: string;
  fill: Fill;
}

const W = 400, H = 300;
const SNAP_GRID = 20;
const GRID = createGridLayer({
  spacing: SNAP_GRID,
  style: { line: { paint: { kind: 'solid', color: '#3a3020' }, width: 1 } },
});
const SNAP = { sources: [gridSnapSource({ spacing: SNAP_GRID })] };

const INITIAL: Rect[] = [
  { id: 'a', x: 160, y: 100, width: 100, height: 60, rotation: Math.PI / 6, fill: { paint: solid('#7fb069') } },
];

const SELECTED = { mode: 'multi', initial: [asNodeId('a')] } as const;

export function ResizeSnapDemo() {
  const scene = useScene({ items: INITIAL });

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={['select', 'resize']}
        className="ckd-canvas"
        scene={scene}
        selectionOptions={SELECTED}
        poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect>}
        snap={SNAP}
        layers={{
          grid: { layer: GRID },
        }}
      />
    </DemoStage>
  );
}
