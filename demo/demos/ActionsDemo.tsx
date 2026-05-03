import { useRef, useState } from 'react';
import {
  arrayAdapter,
  Canvas,
  useEscape,
  useSelectAll,
  useDuplicate,
  useNudge,
  useReorder,
  useSelection,
} from '@orochi235/weasel';

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
    listAll: () => rectsRef.current.map((r) => r.id),
    insertObject: (obj: Rect) => setRects((rs) => [...rs, obj]),
    removeObject: (id: string) => setRects((rs) => rs.filter((r) => r.id !== id)),
    getParent: (_id: string) => null,
    getChildren: (_parent: string | null) => rectsRef.current.map((r) => r.id),
    setChildOrder: (_parent: string | null, ids: string[]) => {
      const byId = new Map(rectsRef.current.map((r) => [r.id, r]));
      setRects(ids.map((id) => byId.get(id)!).filter(Boolean));
    },
    cloneObject: (id: string, offset: { dx: number; dy: number }) => {
      const src = rectsRef.current.find((r) => r.id === id)!;
      return {
        id: `r${nextId.current++}`,
        x: src.x + offset.dx,
        y: src.y + offset.dy,
        width: src.width,
        height: src.height,
        color: COLORS[(nextId.current + 2) % COLORS.length],
      } as Rect;
    },
  };

  useEscape(adapter, { enableKeyboard: focused });
  useSelectAll(adapter, { enableKeyboard: focused });
  useDuplicate<Pose>(adapter, { enableKeyboard: focused });
  useNudge<Pose>(adapter, { enableKeyboard: focused, step: 2, shiftStep: 20 });
  useReorder(adapter, { enableKeyboard: focused });

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
      <Canvas<Rect, Pose>
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        selection={selection}
        layers={{
          scene: {
            drawOne: (cx, r, p) => {
              cx.fillStyle = r.color;
              cx.fillRect(p.x, p.y, p.width, p.height);
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}

export const ACTIONS_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);
const selection = useSelection();

// --- Adapter (selection methods come from useSelection) ---
const adapter = {
  ...arrayAdapter({...}),
  ...selection.adapterMethods,
  listAll, insertObject, removeObject, cloneObject,
  // For useReorder: getParent/getChildren/setChildOrder over flat array
  getParent: () => null,
  getChildren: () => rectsRef.current.map((r) => r.id),
  setChildOrder: (_p, ids) => setRects(reorderByIds(rectsRef.current, ids)),
};

// Five standalone "action" hooks bind their default keybindings on the
// document. Each hook takes a tiny adapter that knows how to read selection,
// look up poses, and apply an op batch — no gesture state, no overlays.

useEscape(adapter);              // Esc        -> clear selection
useSelectAll(adapter);           // Cmd/Ctrl+A -> select all
useDuplicate<Pose>(adapter);     // Cmd/Ctrl+D -> clone selection
useNudge<Pose>(adapter, { step: 2, shiftStep: 20 });  // arrow keys
useReorder(adapter);             // Cmd/Ctrl+] / [ (+Shift = to front/back)

// <Canvas> handles selection (click-to-select) and renders the selection
// outline; the action hooks above operate on the same selection state.
return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: { handles: false },
    }}
  />
);
`;
