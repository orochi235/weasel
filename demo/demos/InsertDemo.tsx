import { useRef } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function InsertDemo() {
  const scene = useScene<Rect>({ items: [] });
  const nextId = useRef(0);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      tool="insert"
      selectionMode="none"
      insertOptions={{ minBounds: { width: 4, height: 4 } }}
      commitInsert={(b) => {
        const id = `r${nextId.current++}`;
        const item: Rect = {
          id,
          x: b.x, y: b.y, width: b.width, height: b.height,
          color: COLORS[nextId.current % COLORS.length],
        };
        return { id, pose: item, data: item };
      }}
      layers={{
        scene: {
          drawOne: (cx, _node, p) => {
            cx.fillStyle = p.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: null,
        insertOverlay: {},
      }}
    />
  );
}

export const INSERT_DEMO_SOURCE = `// --- Scene (kit-owned via useScene shorthand) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const scene = useScene<Rect>({ items: [] });
const nextId = useRef(0);

// SceneCanvas's commitInsert factory packages the new object into a Scene
// add() against the configured layer (defaults to 'default').
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    tool="insert"
    selectionMode="none"
    insertOptions={{ minBounds: { width: 4, height: 4 } }}
    commitInsert={(b) => {
      const id = \`r\${nextId.current++}\`;
      const item = { id, ...b, color: COLORS[nextId.current % COLORS.length] };
      return { id, pose: item, data: item };
    }}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: null,
      insertOverlay: {},
    }}
  />
);
`;
