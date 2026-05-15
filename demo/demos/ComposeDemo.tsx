import { useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  useSceneAdapter,
  selectFromMarquee,
  useInsertTool,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;
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
  const nextId = useRef(1);

  // sceneToAdapter covers Move/Resize/Rotate AND AreaSelect — the marquee
  // hitTestArea/applyOps and selection get/set are kit-defaulted from the
  // scene + the selection passed in.
  const selectAdapter = useSceneAdapter(scene, { selection });

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

  const select = useSelectTool(selectAdapter, {
    pickEvery,
    boundsOf,
    getSelection: () => selection.current,
    // Marquee is opt-in at the kit level — restored here because the demo
    // description ("drag empty space to marquee-select") references it.
    areaSelect: { behaviors: [selectFromMarquee()] },
  });

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
    insertNode: () => {},
    setSelection: () => {},
    getSelection: () => [] as string[],
  }), [scene]);

  const insert = useInsertTool<Rect, Rect>(insertAdapter, { minBounds: { width: 4, height: 4 } });

  const tools = useTools({
    active: 'select',
    registry: { select, insert },
  });

  const activeOrEngaged = tools.hotkeyEngaged ?? tools.active;

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
      />
    </div>
  );
}
