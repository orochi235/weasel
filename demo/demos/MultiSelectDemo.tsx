import { useMemo, useRef } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { Op } from '@orochi235/weasel';

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
  const selection = useSelection({ mode: 'multi' });
  const selRef = useRef(selection);
  selRef.current = selection;

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

  const hitBody = (worldX: number, worldY: number): string[] => {
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

  const select = useSelectTool(selectAdapter, { hitBody, boundsOf });
  const tools = useTools({ active: 'select', registry: { select } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      tools={tools}
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
const selection = useSelection({ mode: 'multi' });

// useSelectTool needs MoveAdapter + ResizeAdapter + RotateAdapter +
// AreaSelectAdapter. sceneToAdapter covers the first three; we layer on
// selection get/set, applyOps, and a pose-based hitTestArea for the marquee.
const selectAdapter = {
  ...sceneToAdapter(scene),
  getSelection: () => selection.get(),
  setSelection: (ids) => selection.set(ids),
  applyOps: (ops) => { for (const op of ops) op.apply(base); },
  hitTestArea: (rect) => /* aabb-vs-aabb scan over scene.renderOrder() */,
};
const select = useSelectTool(selectAdapter, { hitBody, boundsOf });
const tools = useTools({ active: 'select', registry: { select } });

// selectionMode="multi" turns on shift-click extend, draws a single union
// AABB outline (with corner handles) when more than one item is selected,
// and routes drag / resize through that union.
return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selection={selection}
    selectionMode="multi"
    tools={tools}
    handleHitRadius={HANDLE}
    layers={{
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
