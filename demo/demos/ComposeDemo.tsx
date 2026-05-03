import { useRef, useState } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];
const INITIAL: Rect[] = [
  { id: 'a', x: 40, y: 50, width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 200, y: 140, width: 90, height: 70, color: '#d4a574' },
];

type Tool = 'select' | 'insert';

export function ComposeDemo() {
  const scene = useScene({ items: INITIAL });
  const [tool, setTool] = useState<Tool>('select');
  const nextId = useRef(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['select', 'insert'] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            style={{
              padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              background: tool === t ? '#7fb069' : '#2a2018',
              color: tool === t ? '#1a130d' : '#d4c4a8',
              border: '1px solid #4a3c2e', borderRadius: 3,
            }}
          >{t}</button>
        ))}
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectionMode="multi"
        tool={tool}
        gestures={{ delete: true }}
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
          selectionOverlay: { handles: { size: HANDLE } },
          insertOverlay: {},
          areaSelectOverlay: {},
        }}
      />
    </div>
  );
}

export const COMPOSE_DEMO_SOURCE = `// --- Scene (kit-owned via useScene shorthand) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const scene = useScene({ items: INITIAL });
const [tool, setTool] = useState<'select' | 'insert'>('select');
const nextId = useRef(1);

// SceneCanvas owns useMove / useResize / useSelection / useInsert / useAreaSelect.
// \`tool\` switches the empty-space drag between insert and area-select;
// \`selectionMode="multi"\` turns on shift-extend + union-AABB drag/resize;
// \`gestures\` opts the canvas into Delete/Backspace removal of the selection.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectionMode="multi"
    tool={tool}
    gestures={{ delete: true }}
    insertOptions={{ minBounds: { width: 4, height: 4 } }}
    commitInsert={(b) => {
      const id = \`r\${nextId.current++}\`;
      const item = { id, ...b, color: COLORS[nextId.current % COLORS.length] };
      return { id, pose: item, data: item };
    }}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
      insertOverlay: {},
      areaSelectOverlay: {},
    }}
  />
);
`;
