import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose, SerializedScene } from '@orochi235/weasel';
import sceneJson from './data/rotate.scene.json';

interface RectData { color: string }

const W = 400, H = 300;

export function RotateDemo() {
  // SceneCanvas's `scene` prop accepts a SerializedScene JSON object
  // directly — no consumer-side `useScene` + `sceneFromJSON` needed.
  // SceneCanvas's defaultDrawOne also auto-rotates poses with a non-zero
  // `rotation` field, so neither the demo nor the JSON encodes geometry
  // beyond the angle on each pose.
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={sceneJson as unknown as SerializedScene<RectData, 'default', RotatedPose>}
      selectTool={{ resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose> } }}
      selectionOptions={{ initial: [asNodeId('b')] }}
      layers={{ selectionOverlay: { rotationHandle: true } }}
    />
  );
}
