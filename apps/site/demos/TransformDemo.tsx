import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
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

/**
 * The select tool's full transform surface on one canvas — no per-gesture
 * wiring. Body-drag moves (snapping to the 20px grid through `gridSnapSource`, which
 * snaps a dragged corner too), corner handles resize in each leaf's local frame (the `poseDescriptor` prop
 * supplies `ROTATED_POSE_DESCRIPTOR`, which keeps the diagonal corner pinned
 * even when the rect is rotated), the handle
 * above a selection rotates it, and Alt+drag clones (the `move` preset's
 * alt-drag binding → `cloneAction`). `pick` brings the select tool, `move`
 * the move and clone bindings, `transform` the handles; no other tool is
 * registered, so select stays the active tool throughout.
 */
export function TransformDemo() {
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={sceneJson}
        features={['pick', 'move', 'transform']}
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
