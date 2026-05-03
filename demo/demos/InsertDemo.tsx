import { useRef, useState } from 'react';
import { Canvas } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function InsertDemo() {
  const [rects, setRects] = useState<Rect[]>([]);
  const nextId = useRef(0);

  return (
    <Canvas<Rect, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      items={rects}
      setItems={setRects}
      toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
      createDefault={(b) => ({
        id: `r${nextId.current++}`,
        x: b.x, y: b.y, width: b.width, height: b.height,
        color: COLORS[nextId.current % COLORS.length],
      })}
      tool="insert"
      selectionMode="none"
      insertOptions={{ minBounds: { width: 4, height: 4 } }}
      layers={{
        scene: {
          drawOne: (cx, r, p) => {
            cx.fillStyle = r.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: null,
        insertOverlay: {},
      }}
    />
  );
}

export const INSERT_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const [rects, setRects] = useState<Rect[]>([]);
const nextId = useRef(0);

// No explicit adapter — Canvas synthesizes one from items + setItems + toPose.
// createDefault wires the insert gesture's new-object factory.
//
// Canvas owns useInsert internally; \`tool="insert"\` routes empty-space
// pointer-down to it. The default insertOverlay slot draws the live
// drag-rectangle; pass {} to use defaults, or override fill/stroke/dash.
return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    items={rects}
    setItems={setRects}
    toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
    createDefault={(b) => ({
      id: \`r\${nextId.current++}\`, ...b,
      color: COLORS[nextId.current % COLORS.length],
    })}
    tool="insert"
    selectionMode="none"
    insertOptions={{ minBounds: { width: 4, height: 4 } }}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: null,
      insertOverlay: {},
    }}
  />
);
`;
