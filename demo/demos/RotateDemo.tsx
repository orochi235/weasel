import {
  SceneCanvas,
  pointInRotatedRect,
  useScene,
} from '@orochi235/weasel';
import type { RotatedPose } from '@orochi235/weasel';

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
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      handleHitRadius={HANDLE}
      pickEvery={pickEvery}
      selectionOptions={{ initial: ['b'] }}
      layers={{
        scene: {
          drawOne: (cx, _node, p) => {
            const cxw = p.x + p.width / 2;
            const cyw = p.y + p.height / 2;
            cx.save();
            cx.translate(cxw, cyw);
            cx.rotate(p.rotation);
            cx.translate(-cxw, -cyw);
            cx.fillStyle = p.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
            cx.restore();
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
    pickEvery={pickEvery}
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
