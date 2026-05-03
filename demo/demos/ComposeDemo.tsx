import { useRef, useState } from 'react';
import { Canvas } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];
const INITIAL: Rect[] = [
  { id: 'a', x: 40, y: 50, width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 200, y: 140, width: 90, height: 70, color: '#d4a574' },
];

type Tool = 'select' | 'insert';

export function ComposeDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
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
      <Canvas
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
        selectionMode="multi"
        tool={tool}
        gestures={{ delete: true }}
        insertOptions={{ minBounds: { width: 4, height: 4 } }}
        layers={{
          scene: {
            drawOne: (cx, r, p) => {
              cx.fillStyle = r.color;
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

export const COMPOSE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);
const [tool, setTool]   = useState<'select' | 'insert'>('select');
const nextId   = useRef(1);

// No explicit adapter — Canvas synthesizes one (via the kit's arrayAdapter)
// from items + setItems + toPose. createDefault wires insert. For groups,
// custom history, or non-array scenes, pass an explicit \`adapter\` instead.
//
// Canvas owns useMove / useResize / useSelection / useInsert / useAreaSelect.
// \`tool\` switches the empty-space drag between insert and area-select;
// \`selectionMode="multi"\` turns on shift-extend + union-AABB drag/resize;
// \`gestures\` opts the canvas into Delete/Backspace removal of the selection.
return (
  <Canvas
    width={W} height={H}
    items={rects}
    setItems={setRects}
    toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
    createDefault={(b) => ({
      id: \`r\${nextId.current++}\`, ...b,
      color: COLORS[nextId.current % COLORS.length],
    })}
    selectionMode="multi"
    tool={tool}
    gestures={{ delete: true }}
    insertOptions={{ minBounds: { width: 4, height: 4 } }}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
      insertOverlay: {},
      areaSelectOverlay: {},
    }}
  />
);
`;
