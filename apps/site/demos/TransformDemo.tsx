import { useMemo, useState } from 'react';
import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
} from '@weasel-js/core';
import { createGridLayer, gridSnapStrategy } from '@weasel-js/guides';
import type { PoseDescriptor, RotatedPose, UnitSystem } from '@weasel-js/core';
import sceneJson from './data/transform.scene.json';
import { DemoStage } from './DemoStage';

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

/**
 * The select tool's full transform surface on one canvas — no per-gesture
 * wiring. Body-drag moves (snapping to the 20px grid via `gridSnapStrategy`),
 * corner handles resize in each leaf's local frame (the `poseDescriptor` prop
 * supplies `ROTATED_POSE_DESCRIPTOR`, which keeps the diagonal corner pinned
 * even when the rect is rotated), the handle
 * above a selection rotates it, and Alt+drag clones (the `move` preset's
 * alt-drag binding → `cloneAction`). `pick` brings the select tool, `move`
 * the move and clone bindings, `transform` the handles; no other tool is
 * registered, so select stays the active tool throughout.
 */
export function TransformDemo() {
  // The view never moves, so the canvas's own size is the world the grid covers.
  const [size, setSize] = useState({ width: W, height: H });
  const grid = useMemo(() => createGridLayer({
    spacing: CELL,
    unitSystem: UNITS,
    bounds: () => ({ x: 0, y: 0, ...size }),
    accentEvery: 5,
  }), [size]);
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        onResize={setSize}
        scene={sceneJson}
        features={['pick', 'move', 'transform']}
        poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose>}
        selectTool={{
          snap: gridSnapStrategy<RotatedPose>(CELL, UNITS),
        }}
        selectionOptions={{ mode: 'multi', initial: [asNodeId('b')] }}
        layers={{
          grid: { layer: grid },
          selectionOverlay: { rotationHandle: true },
        }}
      />
    </DemoStage>
  );
}
