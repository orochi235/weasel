import { useState } from 'react';
import {
  Canvas,
  pointInRotatedRect,
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
  const [rects, setRects] = useState<Rect[]>(INITIAL);

  // Override hitBody so a click inside the rotated rect — not the AABB —
  // selects the object.
  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = rects.length - 1; i >= 0; i--) {
      if (pointInRotatedRect(rects[i], wx, wy)) return rects[i].id;
    }
    return null;
  };

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      items={rects}
      setItems={setRects}
      handleHitRadius={HANDLE}
      hitBody={hitBody}
      selectionOptions={{ initial: ['b'] }}
      onTapEmpty={() => {}}
      layers={{
        scene: {
          drawOne: (cx, r, p) => {
            const cxw = p.x + p.width / 2;
            const cyw = p.y + p.height / 2;
            cx.save();
            cx.translate(cxw, cyw);
            cx.rotate(p.rotation);
            cx.translate(-cxw, -cyw);
            cx.fillStyle = r.color;
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

const [rects, setRects] = useState<Rect[]>(INITIAL);

// Override hitBody so clicks land on the rotated body, not the AABB.
const hitBody = (wx, wy) => {
  for (let i = rects.length - 1; i >= 0; i--) {
    if (pointInRotatedRect(rects[i], wx, wy)) return rects[i].id;
  }
  return null;
};

// Canvas owns useRotate internally. Opt the selection overlay into a rotation
// handle (rendered above the rotated top-center of the AABB).
//
// v1 limitation: resize on a rotated object operates on the AABB, so the
// resize-in-rotated-frame behavior is non-intuitive. Out of scope here.
return (
  <Canvas
    width={W} height={H}
    items={rects}
    setItems={setRects}
    hitBody={hitBody}
    layers={{
      scene: {
        drawOne: (cx, r, p) => {
          const cxw = p.x + p.width / 2, cyw = p.y + p.height / 2;
          cx.save();
          cx.translate(cxw, cyw); cx.rotate(p.rotation); cx.translate(-cxw, -cyw);
          cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height);
          cx.restore();
        },
      },
      selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
    }}
  />
);
`;
