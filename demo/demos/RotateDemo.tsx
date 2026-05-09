import {
  SceneCanvas,
  pointInRotatedRect,
  useScene,
  ROTATED_POSE_DESCRIPTOR,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useBackend } from '../BackendContext';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect[] = [
  { id: 'a', x: 50,  y: 80,  width: 90, height: 60, rotation: 0,            color: '#7fb069' },
  { id: 'b', x: 180, y: 60,  width: 80, height: 80, rotation: Math.PI / 6,  color: '#d4a574' },
  { id: 'c', x: 270, y: 170, width: 100, height: 50, rotation: -Math.PI / 4, color: '#a48bd4' },
];

export function RotateDemo() {
  const backend = useBackend();
  const scene = useScene({ items: INITIAL });

  // Override pickEvery so a click inside the rotated rect — not the AABB —
  // selects the object. Reads live pose from the scene.
  const pickEvery = (wx: number, wy: number): string | null => {
    const ordered = [...scene.renderOrder()];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const n = scene.get(ordered[i]);
      if (n && pointInRotatedRect(n.pose, wx, wy)) return n.id;
    }
    return null;
  };

  return (
    <SceneCanvas
backend={backend}
            width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{ handleHitRadius: HANDLE, resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect> } }}
      geometry={{ pickEvery }}
      selectionOptions={{ initial: ['b'] }}
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
        selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
      }}
    />
  );
}

export const ROTATE_DEMO_SOURCE = `// --- Scene: pose carries rotation (radians, pivot=AABB center) ---
interface Rect extends RotatedPose { id: string; color: string }

const scene = useScene({ items: INITIAL });

// Override pickEvery so clicks land on the rotated body, not the AABB.
const pickEvery = (wx, wy) => {
  const ordered = [...scene.renderOrder()];
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = scene.get(ordered[i]);
    if (n && pointInRotatedRect(n.pose, wx, wy)) return n.id;
  }
  return null;
};

return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectTool={{ handleHitRadius: HANDLE, resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect> } }}
    geometry={{ pickEvery }}
    selectionOptions={{ initial: ['b'] }}
    layers={{
      scene: {
        drawOne: (cx, _node, p) => {
          const cxw = p.x + p.width / 2, cyw = p.y + p.height / 2;
          cx.save();
          cx.translate(cxw, cyw); cx.rotate(p.rotation); cx.translate(-cxw, -cyw);
          cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height);
          cx.restore();
        },
      },
      selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
    }}
  />
);
`;
