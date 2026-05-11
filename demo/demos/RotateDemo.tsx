import {
  SceneCanvas,
  asNodeId,
  useScene,
  ROTATED_POSE_DESCRIPTOR,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 50,  y: 80,  width: 90, height: 60, rotation: 0,            color: '#7fb069' },
  { id: 'b', x: 180, y: 60,  width: 80, height: 80, rotation: Math.PI / 6,  color: '#d4a574' },
  { id: 'c', x: 270, y: 170, width: 100, height: 50, rotation: -Math.PI / 4, color: '#a48bd4' },
];

export function RotateDemo() {
  const scene = useScene({ items: INITIAL });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{ resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect> } }}
      selectionOptions={{ initial: [asNodeId('b')] }}
      layers={{
        scene: {
          drawOne: (_node, p): DrawCommand[] => {
            // Rotate around the rect's AABB center via a group transform.
            // Compose T(cx,cy) · R(θ) · T(-cx,-cy) into a single column-major
            // 3×3 affine. (a, b, c, d, tx, ty) for [a c tx; b d ty; 0 0 1].
            const cxw = p.x + p.width / 2;
            const cyw = p.y + p.height / 2;
            const cs = Math.cos(p.rotation);
            const sn = Math.sin(p.rotation);
            const a = cs, b = sn, c = -sn, d = cs;
            const tx = cxw - a * cxw - c * cyw;
            const ty = cyw - b * cxw - d * cyw;
            const transform = new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
            return [{
              kind: 'group',
              transform,
              children: [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: p.color },
              }],
            }];
          },
        },
        selectionOverlay: { rotationHandle: true },
      }}
    />
  );
}
