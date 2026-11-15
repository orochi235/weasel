import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas, movePreset, pickPreset, transformPreset,
} from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import type { PoseDescriptor, RotatedPose, UnitSystem } from '@weasel-js/core';
import sceneJson from './data/transform.scene.json';
import { DemoStage } from './DemoStage';

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;
const GRID = createGridLayer({ spacing: CELL, unitSystem: UNITS, accentEvery: 5 });
const SNAP = { sources: [gridSnapSource({ spacing: CELL, unitSystem: UNITS })] };

export function TransformDemo() {
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={sceneJson}
        features={[pickPreset, movePreset, transformPreset]}
        poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose>}
        snap={SNAP}
        selectionOptions={{ mode: 'multi', initial: [asNodeId('b')] }}
        layers={{
          grid: { layer: GRID },
          selectionOverlay: { rotationHandle: true },
        }}
      />
    </DemoStage>
  );
}
