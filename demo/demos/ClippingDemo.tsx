import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  polygonFromPoints,
  registerShapePainter,
  SceneCanvas,
  sceneFromJSON,
} from '@orochi235/weasel';
import type { Path } from '../../src/features/paths/types';
import sceneJson from './data/clipping.scene.json';

type Pose = { x: number; y: number; width: number; height: number };

const W = 400, H = 300;

function ellipsePath(pose: Pose, segments = 48): Path {
  const points: { x: number; y: number }[] = [];
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const rx = pose.width / 2;
  const ry = pose.height / 2;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return polygonFromPoints(points);
}

export function ClippingDemo() {
  // Register an ellipse painter for any node whose data carries
  // `shape: 'ellipse'`. The painter centralizes both the visual (paint)
  // and the silhouette (used by the kit for container clipping). With
  // this in place the scene no longer needs a `clipFromPose` registry
  // entry — `sceneFromJSON(json)` works without options.
  useEffect(() => {
    return registerShapePainter(
      {
        id: 'demo:ellipse',
        matches: (n) => (n.data as { shape?: string } | null)?.shape === 'ellipse',
        paint: (n, pose) => {
          const d = n.data as { color?: string } | null;
          return [{
            kind: 'path',
            path: ellipsePath(pose as Pose),
            fill: { color: d?.color ?? '#888' },
          }];
        },
        silhouette: (_n, pose) => ellipsePath(pose as Pose),
      },
      { priority: 'high' },
    );
  }, []);

  const [scene] = useState(() => sceneFromJSON(sceneJson as never, {}));
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
    />
  );
}
