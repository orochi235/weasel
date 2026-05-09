import { useRef, useState } from 'react';
import {
  arrayAdapter,
  asNodeId,
  Canvas,
  useEscape,
  useSelectAll,
  useDuplicate,
  useNudge,
  useReorder,
  useSelection,
  useSelectTool,
  useTools,
  type NodeId,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];
const INITIAL: Rect[] = [
  { id: 'a', x: 50,  y: 60,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 170, y: 90,  width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 290, y: 160, width: 60, height: 50, color: '#a48bd4' },
];

export function ActionsDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const [focused, setFocused] = useState(false);
  const rectsRef = useRef(rects); rectsRef.current = rects;
  const nextId = useRef(1);

  const selection = useSelection();

  const adapter = {
    ...arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    }),
    ...selection.adapterMethods,
    listAll: (): NodeId[] => rectsRef.current.map((r) => asNodeId(r.id)),
    insertObject: (obj: Rect) => setRects((rs) => [...rs, obj]),
    removeObject: (id: string) => setRects((rs) => rs.filter((r) => r.id !== id)),
    getParent: (_id: string) => null,
    getChildren: (_parent: string | null) => rectsRef.current.map((r) => r.id),
    setChildOrder: (_parent: string | null, ids: string[]) => {
      const byId = new Map(rectsRef.current.map((r) => [r.id, r]));
      setRects(ids.map((id) => byId.get(id)!).filter(Boolean));
    },
    cloneObject: (id: NodeId, offset: { dx: number; dy: number }): { id: NodeId } => {
      const src = rectsRef.current.find((r) => r.id === id)!;
      return {
        id: asNodeId(`r${nextId.current++}`),
        x: src.x + offset.dx,
        y: src.y + offset.dy,
        width: src.width,
        height: src.height,
        color: COLORS[(nextId.current + 2) % COLORS.length],
      } as Rect & { id: NodeId };
    },
  };

  useEscape(adapter, { enableKeyboard: focused });
  useSelectAll(adapter, { enableKeyboard: focused });
  useDuplicate<Pose>(adapter, { enableKeyboard: focused });
  useNudge<Pose>(adapter, { enableKeyboard: focused, step: 2, shiftStep: 20 });
  useReorder(adapter, { enableKeyboard: focused });

  const select = useSelectTool<Rect, Pose>(adapter, {
    pickEvery: (wx, wy) =>
      rectsRef.current
        .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
        .map((r) => r.id),
    boundsOf: (id) => {
      const r = rectsRef.current.find((x) => x.id === id);
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    },
    drawGhost: (rect, pose): DrawCommand[] => rect == null ? [] : [{
      kind: 'path',
      path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
      fill: { color: rect.color },
    }],
    getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  return (
    <div
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, outline: 'none' }}
    >
      <div style={{ fontSize: 11, color: focused ? '#7fb069' : '#7a6a52' }}>
        {focused
          ? 'Keys live: Esc / Cmd-A / Cmd-D / arrows (shift = bigger step) / Cmd-[ / Cmd-]'
          : 'Click the canvas to enable keyboard shortcuts'}
      </div>
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        selection={selection}
        tools={tools}
        layers={{
          scene: {
            drawOne: (r, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: r.color },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
