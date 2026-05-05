import { useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  useInsertTool,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { Op } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300, HANDLE = 8;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];
const INITIAL: Rect[] = [
  { id: 'a', x: 40, y: 50, width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 200, y: 140, width: 90, height: 70, color: '#d4a574' },
];

const TOOL_ORDER: { id: 'select' | 'insert'; label: string }[] = [
  { id: 'select', label: 'select' },
  { id: 'insert', label: 'insert' },
];

export function ComposeDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const selRef = useRef(selection);
  selRef.current = selection;
  const nextId = useRef(1);

  // Select-tool adapter: sceneToAdapter handles getObject/getPose/setPose/...
  // Add the AreaSelect pieces (selection get/set + applyOps + hitTestArea)
  // so useSelectTool's marquee gesture works.
  const selectAdapter = useMemo(() => {
    const base = sceneToAdapter(scene);
    return {
      ...base,
      getSelection: () => selRef.current.get(),
      setSelection: (ids: string[]) => selRef.current.set(ids),
      applyOps: (ops: Op[]) => {
        for (const op of ops) op.apply(base as unknown as Parameters<Op['apply']>[0]);
      },
      hitTestArea: (rect: { x: number; y: number; width: number; height: number }) => {
        const hits: string[] = [];
        for (const id of scene.renderOrder()) {
          const n = scene.get(id);
          if (!n) continue;
          const p = n.pose as Rect;
          if (p.x < rect.x + rect.width && p.x + p.width > rect.x
              && p.y < rect.y + rect.height && p.y + p.height > rect.y) {
            hits.push(id);
          }
        }
        return hits;
      },
    };
  }, [scene]);

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      if (worldX >= p.x && worldX <= p.x + p.width
          && worldY >= p.y && worldY <= p.y + p.height) {
        hits.push(id);
      }
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  };

  const select = useSelectTool(selectAdapter, { pickEvery, boundsOf });

  // Insert-tool adapter: only commitInsert is exercised; the rest are stubs.
  // commitInsert appends a leaf to the scene and returns the rect so the
  // gesture's commit path has something to hand back.
  const insertAdapter = useMemo(() => ({
    commitInsert: (b: { x: number; y: number; width: number; height: number }): Rect | null => {
      const id = `r${nextId.current++}`;
      const item: Rect = {
        id,
        x: b.x, y: b.y, width: b.width, height: b.height,
        color: COLORS[nextId.current % COLORS.length],
      };
      scene.add({ kind: 'leaf', layer: 'default', pose: item, data: item, id: asNodeId(id) });
      return item;
    },
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
    insertObject: () => {},
    setSelection: () => {},
    getSelection: () => [] as string[],
  }), [scene]);

  const insert = useInsertTool<Rect, Rect>(insertAdapter, { minBounds: { width: 4, height: 4 } });

  const tools = useTools({
    active: 'select',
    registry: { select, insert },
  });

  const activeOrEngaged = tools.modifierEngaged ?? tools.active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {TOOL_ORDER.map((t) => (
          <button
            key={t.id}
            onClick={() => tools.setActive(t.id)}
            style={{
              padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              background: activeOrEngaged === t.id ? '#7fb069' : '#2a2018',
              color: activeOrEngaged === t.id ? '#1a130d' : '#d4c4a8',
              border: '1px solid #4a3c2e', borderRadius: 3,
            }}
          >{t.label}</button>
        ))}
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
        gestures={{ delete: true }}
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
    </div>
  );
}

export const COMPOSE_DEMO_SOURCE = `// --- Scene (kit-owned via useScene shorthand) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const scene = useScene<Rect>({ items: INITIAL });
const selection = useSelection({ mode: 'multi' });
const nextId = useRef(1);

// useSelectTool needs MoveAdapter + ResizeAdapter + RotateAdapter + AreaSelectAdapter.
// sceneToAdapter covers the first three; we layer on selection get/set,
// applyOps, and a pose-based hitTestArea for the marquee.
const selectAdapter = {
  ...sceneToAdapter(scene),
  getSelection: () => selection.get(),
  setSelection: (ids) => selection.set(ids),
  applyOps: (ops) => { for (const op of ops) op.apply(base); },
  hitTestArea: (rect) => /* aabb-vs-aabb scan over scene.renderOrder() */,
};
const select = useSelectTool(selectAdapter, { pickEvery, boundsOf });

// useInsertTool needs InsertAdapter; only commitInsert is exercised here.
const insertAdapter = {
  commitInsert: (b) => {
    const id = \`r\${nextId.current++}\`;
    const item = { id, ...b, color: COLORS[nextId.current % COLORS.length] };
    scene.add({ kind: 'leaf', layer: 'default', pose: item, data: item, id: asNodeId(id) });
    return item;
  },
  commitPaste: () => [], snapshotSelection: () => ({ items: [] }),
  insertObject: () => {}, setSelection: () => {}, getSelection: () => [],
};
const insert = useInsertTool(insertAdapter, { minBounds: { width: 4, height: 4 } });

const tools = useTools({ active: 'select', registry: { select, insert } });

// Toggle button reads tools.modifierEngaged ?? tools.active so press-and-hold
// modifier engagement (e.g. spacebar) lights up the right button.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selection={selection}
    selectionMode="multi"
    tools={tools}
    gestures={{ delete: true }}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
