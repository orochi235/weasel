import { useState, useSyncExternalStore } from 'react';
import {
  asNodeId,
  ROTATED_POSE_DESCRIPTOR,
  SceneCanvas,
  sceneFromJSON,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose, SerializedScene } from '@orochi235/weasel';
import sceneJson from './data/rotate.scene.json';

interface RectData { color: string }

const W = 400, H = 300;

export function RotateDemo() {
  // Pose carries `rotation`; SceneCanvas's defaultDrawOne wraps painter
  // output in a rotation transform around the AABB center automatically,
  // so neither this demo nor the scene file needs to encode rotation
  // geometry — just the angle on each pose.
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<RectData, 'default', RotatedPose>, {}),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{ resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose> } }}
      selectionOptions={{ initial: [asNodeId('b')] }}
      layers={{ selectionOverlay: { rotationHandle: true } }}
    />
  );
}
