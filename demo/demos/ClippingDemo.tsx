import { asNodeId, polygonFromPoints, SceneCanvas, useScene } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { Path } from '../../src/features/paths/types';

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
  const scene = useScene<Item, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        id: asNodeId('bed'),
        kind: 'container',
        layer: 'default',
        pose: { x: 80, y: 50, width: 240, height: 200 },
        data: { id: 'bed', label: 'bed', color: '#5a4a3a' },
        clipFromPose: (pose: Pose) => ellipsePath(pose),
      },
      {
        id: asNodeId('p1'),
        parent: asNodeId('bed'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 40, y: 100, width: 120, height: 80 },
        data: { id: 'p1', label: 'p1', color: '#7fb069' },
      },
      {
        id: asNodeId('p2'),
        parent: asNodeId('bed'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 240, y: 120, width: 140, height: 100 },
        data: { id: 'p2', label: 'p2', color: '#d4a574' },
      },
    ],
  });

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
