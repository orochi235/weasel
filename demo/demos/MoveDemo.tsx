import { useEffect, useRef, useState } from 'react';
import {
  arrayAdapter,
  snap,
  gridSnapStrategy,
  Canvas,
  useZoom,
  useSelection,
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
  };

  useDuplicate<Pose>(adapter);

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
    <Canvas<Rect, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      moveOptions={{ behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))] }}
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

// --- Adapter (with selection methods + cloneObject for useDuplicate) ---
const adapter = {
  ...arrayAdapter<Rect, Pose>({ ref: rectsRef, setItems: setRects, toPose: (r) => ({...}) }),
  ...selection.adapterMethods,
  insertObject: (obj) => setRects((rs) => [...rs, obj]),
  cloneObject: (id, offset) => /* mint a fresh id, copy fields, translate by offset */,
};

useDuplicate<Pose>(adapter); // Cmd/Ctrl+D -> clone selection (offset 8,8 by default)

const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

// <Canvas> owns useMove / useResize internally. Pass moveOptions to configure
// the internal move controller — here we plug in a snap-to-grid behavior.
// Pass selection so the duplicate hook and Canvas share the same selection.
return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    moveOptions={{ behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))] }}
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
