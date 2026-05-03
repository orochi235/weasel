import { SceneCanvas, useScene } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 150, y: 70,  width: 60, height: 60, color: '#d4a574' },
  { id: 'c', x: 250, y: 50,  width: 80, height: 70, color: '#a48bd4' },
  { id: 'd', x: 90,  y: 170, width: 60, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 220, y: 180, width: 90, height: 60, color: '#d47a7a' },
];

export function MultiSelectDemo() {
  const scene = useScene({ items: INITIAL });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectionMode="multi"
      tool="select"
      handleHitRadius={HANDLE}
      layers={{
        scene: {
          drawOne: (cx, _node, p) => {
            cx.fillStyle = p.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  );
}

export const MULTI_SELECT_DEMO_SOURCE = `// --- Scene (kit-owned via useScene shorthand) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const scene = useScene({ items: INITIAL });

// selectionMode="multi" turns on shift-click extend, draws a single union
// AABB outline (with corner handles) when more than one item is selected,
// and routes drag / resize through that union.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectionMode="multi"
    tool="select"
    handleHitRadius={HANDLE}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
