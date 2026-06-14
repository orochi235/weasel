import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
} from '@weasel-js/core';
import type { PoseProjection, RotatedPose } from '@weasel-js/core';
import sceneJson from './data/rotate.scene.json';

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
      scene={sceneJson}
      selectTool={{ resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseProjection<RotatedPose> } }}
      selectionOptions={{ initial: [asNodeId('b')] }}
      layers={{ selectionOverlay: { rotationHandle: true } }}
    />
  );
}
