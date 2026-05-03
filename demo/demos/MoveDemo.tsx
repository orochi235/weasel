import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useMove,
  useSelection,
  arrayAdapter,
  snap,
  gridSnapStrategy,
  defaultLayers,
  Canvas,
  useZoom,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
// Passing { value: 1, unit: 'tile' } at API boundaries resolves to 20 internally.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

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

  const selection = useSelection();

  const adapter = arrayAdapter<Rect, Pose>({
    ref: rectsRef,
    setItems: setRects,
    toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
  });

  const move = useMove<Rect, Pose>(adapter, {
    behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))],
  });

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

  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) return r.id;
    }
    return null;
  };

  const overlay = move.overlay;
  const layers = useMemo(
    () =>
      defaultLayers<Rect, Pose>({
        grid: {
          spacing: CELL,
          unitSystem: UNITS,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        scene: {
          objects: rects,
          toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
          drawOne: (cx, r, p) => {
            cx.fillStyle = r.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        moveOverlay: overlay,
      }),
    [rects, overlay],
  );

  // Apply pan/zoom by wrapping clientToWorld for hit-testing/move math.
  const clientToWorld = (canvas: HTMLCanvasElement, cx: number, cy: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left - pan.x) / zoom;
    const y = (cy - rect.top - pan.y) / zoom;
    return [x, y];
  };

  return (
    <Canvas<Pose, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      layers={layers}
      move={move}
      hitBody={hitBody}
      selection={selection}
      clientToWorld={clientToWorld}
    />
  );
}

export const MOVE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);
const rectsRef = useRef(rects);
rectsRef.current = rects;

// --- Adapter + selection ---
const selection = useSelection();
const adapter = arrayAdapter<Rect, Pose>({
  ref: rectsRef,
  setItems: setRects,
  toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
});

const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

const move = useMove<Rect, Pose>(adapter, {
  behaviors: [snap(gridSnapStrategy<Pose>(CELL, UNITS))],
});

// Layer stack — defaultLayers folds in overlay poses + hideIds for free.
const layers = defaultLayers<Rect, Pose>({
  grid: { spacing: CELL, unitSystem: UNITS, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
  scene: {
    objects: rects,
    toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
  },
  moveOverlay: move.overlay,
});

// <Canvas> wires DPR setup, clearRect, runLayers, and pointer gestures.
return (
  <Canvas<Pose, Pose>
    width={W}
    height={H}
    layers={layers}
    move={move}
    hitBody={hitBody}
    selection={selection}
  />
);
`;
