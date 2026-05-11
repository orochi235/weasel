import { useState, useSyncExternalStore } from 'react';
import { polygonFromPoints, SceneCanvas, sceneFromJSON } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { Path } from '../../src/features/paths/types';
import sceneJson from './data/clipping.scene.json';

interface Item { id: string; label: string; color: string; }
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
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as never, {
      registry: { clipFromPose: { ellipse: ellipsePath } },
    }),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      layers={{
        scene: {
          drawOne: (node, p): DrawCommand[] => {
            const data = node.data as Item;
            return [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: data.color },
            }];
          },
        },
      }}
    />
  );
}
