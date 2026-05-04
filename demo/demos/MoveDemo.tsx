import { useEffect, useRef, useState } from 'react';
import {
  arrayAdapter,
  gridSnapStrategy,
  snap,
  Canvas,
  useZoom,
  useSelection,
  useSelectTool,
  useTools,
  useDuplicate,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
// Passing { value: 1, unit: 'tile' } at API boundaries resolves to 20 internally.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];
const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 60, height: 40, color: '#7fb069' },
  { id: 'b', x: 160, y: 100, width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 260, y: 60,  width: 60, height: 60, color: '#a48bd4' },
];

export function MoveDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const rectsRef = useRef(rects);
  rectsRef.current = rects;
  const nextId = useRef(1);
  const selection = useSelection();

  const adapter = {
    ...arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    }),
    ...selection.adapterMethods,
    insertObject: (obj: Rect) => setRects((rs) => [...rs, obj]),
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
    // useSelectTool's adapter intersection requires AreaSelectAdapter members.
    hitTestArea: (r: Pose) =>
      rectsRef.current
        .filter((o) => o.x < r.x + r.width && o.x + o.width > r.x && o.y < r.y + r.height && o.y + o.height > r.y)
        .map((o) => o.id),
    applyOps: () => {},
    snapshotSelection: () => ({ items: [] }),
  };

  useDuplicate<Pose>(adapter);

  const select = useSelectTool<Rect, Pose>(adapter, {
    hitBody: (wx, wy) =>
      rectsRef.current
        .filter((r) => wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height)
        .map((r) => r.id),
    boundsOf: (id) => {
      const r = rectsRef.current.find((x) => x.id === id);
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    },
    move: {
      behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))],
    },
    drawGhost: (ctx, rect, pose) => {
      if (!rect) return;
      ctx.fillStyle = rect.color;
      ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
    },
    getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  const zoomCtl = useZoom({
    zoom, setZoom, pan, setPan,
    viewport: { width: W, height: H },
    sources: { wheel: true, keys: true, doubleClick: true, pinch: true },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => zoomCtl.onKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomCtl]);

  const clientToWorld = (canvas: HTMLCanvasElement, cx: number, cy: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left - pan.x) / zoom;
    const y = (cy - rect.top - pan.y) / zoom;
    return [x, y];
  };

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      tools={tools}
      clientToWorld={clientToWorld}
      layers={{
        grid: {
          spacing: CELL,
          unitSystem: UNITS,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        scene: {
          drawOne: (cx, r, p) => {
            cx.fillStyle = r.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: { handles: false },
      }}
    />
  );
}

export const MOVE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);
const rectsRef = useRef(rects);
rectsRef.current = rects;
const selection = useSelection();

// --- Adapter (with selection methods + cloneObject for useDuplicate +
//     hitTestArea/applyOps/snapshotSelection for useSelectTool) ---
const adapter = {
  ...arrayAdapter<Rect, Pose>({ ref: rectsRef, setItems: setRects, toPose: (r) => ({...}) }),
  ...selection.adapterMethods,
  insertObject: (obj) => setRects((rs) => [...rs, obj]),
  cloneObject: (id, offset) => /* mint a fresh id, copy fields, translate by offset */,
  hitTestArea: (rect) => rectsRef.current.filter(aabbOverlap(rect)).map((r) => r.id),
  applyOps: () => {},
  snapshotSelection: () => ({ items: [] }),
};

useDuplicate<Pose>(adapter); // Cmd/Ctrl+D -> clone selection (offset 8,8 by default)

const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

// Build the select tool with the snap behavior folded into move.behaviors.
// The Tool publishes its own move/resize/rotate ghosts via the overlay channel.
const select = useSelectTool<Rect, Pose>(adapter, {
  hitBody: (wx, wy) => rectsRef.current.filter(hitOf(wx, wy)).map((r) => r.id),
  boundsOf: (id) => boundsOfRect(rectsRef.current.find((r) => r.id === id)),
  move: { behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))] },
  drawGhost: (ctx, rect, pose) => {
    if (!rect) return;
    ctx.fillStyle = rect.color;
    ctx.fillRect(pose.x, pose.y, pose.width, pose.height);
  },
  getObject: (id) => rectsRef.current.find((r) => r.id === id) ?? null,
});
const tools = useTools({ active: 'select', registry: { select } });

return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    tools={tools}
    layers={{
      grid: { spacing: CELL, unitSystem: UNITS, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
      scene: {
        drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
      },
      selectionOverlay: { handles: false },
    }}
  />
);
`;
