import {
  asNodeId,
  gridSnapStrategy,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
} from '@weasel-js/core';
import type { PoseProjection, RotatedPose, UnitSystem } from '@weasel-js/core';
import sceneJson from './data/transform.scene.json';

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

/**
 * The select tool's full transform surface on one canvas — no per-gesture
 * wiring. Body-drag moves (snapping to the 20px grid via `gridSnapStrategy`),
 * corner handles resize in each leaf's local frame (`ROTATED_POSE_DESCRIPTOR`
 * keeps the diagonal corner pinned even when the rect is rotated), the handle
 * above a selection rotates it, and Alt+drag clones (the select tool's default
 * alt-drag binding → `cloneAction`). `toolBundle="exhaustive"` registers the
 * select/rotate tools and the clone action; no tool palette is rendered, so
 * select stays the active tool throughout.
 */
export function TransformDemo() {
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={sceneJson}
      selectionMode="multi"
      toolBundle="exhaustive"
      selectTool={{
        snap: gridSnapStrategy<RotatedPose>(CELL, UNITS),
        resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseProjection<RotatedPose> },
      }}
      selectionOptions={{ initial: [asNodeId('b')] }}
      layers={{
        grid: {
          spacing: CELL,
          unitSystem: UNITS,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        selectionOverlay: { rotationHandle: true },
      }}
    />
  );
}
