import { useState } from 'react';
import { Canvas } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect = { id: 'r', x: 100, y: 80, width: 180, height: 130, color: '#7fb069' };

export function ResizeDemo() {
  const [rects, setRects] = useState<Rect[]>([INITIAL]);

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      items={rects}
      setItems={setRects}
      toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
      handleHitRadius={HANDLE}
      selectionOptions={{ initial: [INITIAL.id] }}
      onTapEmpty={() => {}}
      layers={{
        scene: {
          drawOne: (cx, r, p) => {
            cx.fillStyle = r.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  );
}

export const RESIZE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>([INITIAL]);

// No explicit adapter — Canvas synthesizes one from items + setItems + toPose.
//
// <Canvas> owns useResize internally. selectionOptions seeds the rect as
// pre-selected so the corner handles are visible from the start;
// onTapEmpty is overridden to keep selection on empty-canvas clicks.
return (
  <Canvas
    width={W} height={H}
    items={rects}
    setItems={setRects}
    toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
    handleHitRadius={HANDLE}
    selectionOptions={{ initial: ['r'] }}
    onTapEmpty={() => {}}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
