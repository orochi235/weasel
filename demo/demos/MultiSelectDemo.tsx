import { useState } from 'react';
import { Canvas } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 150, y: 70,  width: 60, height: 60, color: '#d4a574' },
  { id: 'c', x: 250, y: 50,  width: 80, height: 70, color: '#a48bd4' },
  { id: 'd', x: 90,  y: 170, width: 60, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 220, y: 180, width: 90, height: 60, color: '#d47a7a' },
];

export function MultiSelectDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);

  return (
    <Canvas<Rect, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      items={rects}
      setItems={setRects}
      toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
      selectionMode="multi"
      tool="select"
      handleHitRadius={HANDLE}
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

export const MULTI_SELECT_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);

// No explicit adapter — Canvas synthesizes one from items + setItems + toPose.
//
// selectionMode="multi" turns on shift-click extend, draws a single union
// AABB outline (with corner handles) when more than one item is selected,
// and routes drag / resize through that union — Canvas wires expandIds,
// boundsOf, hitBody, and resizeTarget for you.
return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    items={rects}
    setItems={setRects}
    toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
    selectionMode="multi"
    tool="select"
    handleHitRadius={HANDLE}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
