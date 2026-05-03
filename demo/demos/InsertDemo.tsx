import { useCallback, useRef, useState } from 'react';
import { Canvas, useInsert } from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';
import type { InsertAdapter, ClipboardSnapshot, RenderLayer } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function InsertDemo() {
  const [rects, setRects] = useState<Rect[]>([]);
  const rectsRef = useRef(rects);
  rectsRef.current = rects;
  const nextId = useRef(0);

  const adapter: InsertAdapter<Rect> = {
    commitInsert: (b) => ({
      id: `r${nextId.current++}`,
      x: b.x, y: b.y, width: b.width, height: b.height,
      color: COLORS[nextId.current % COLORS.length],
    }),
    commitPaste: () => [],
    snapshotSelection: (): ClipboardSnapshot => ({ items: [] }),
    insertObject: (obj) => setRects((rs) => [...rs, obj]),
    setSelection: () => {},
  };

  const insert = useInsert<Rect, Pose>(adapter, { minBounds: { width: 4, height: 4 } });
  const drawing = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    insert.start(wx, wy, { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
  }, [insert]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    insert.move(wx, wy, { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
  }, [insert]);

  const onPointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    insert.end();
  }, [insert]);

  const overlay = insert.overlay;
  const sceneLayer: RenderLayer<unknown> = {
    id: 'scene', label: 'Scene',
    draw: (cx) => {
      for (const r of rects) {
        cx.fillStyle = r.color;
        cx.fillRect(r.x, r.y, r.width, r.height);
      }
    },
  };
  const marqueeLayer: RenderLayer<unknown> = {
    id: 'marquee', label: 'Marquee',
    draw: (cx) => {
      if (!overlay) return;
      const x = Math.min(overlay.start.x, overlay.current.x);
      const y = Math.min(overlay.start.y, overlay.current.y);
      const w = Math.abs(overlay.current.x - overlay.start.x);
      const h = Math.abs(overlay.current.y - overlay.start.y);
      cx.fillStyle = 'rgba(127, 176, 105, 0.25)';
      cx.fillRect(x, y, w, h);
      cx.strokeStyle = '#7fb069';
      cx.lineWidth = 1;
      cx.setLineDash([4, 4]);
      cx.strokeRect(x, y, w, h);
      cx.setLineDash([]);
    },
  };

  return (
    <Canvas<Rect>
      width={W}
      height={H}
      className="ckd-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      layers={{
        rects: { layer: sceneLayer },
        marquee: { layer: marqueeLayer },
      }}
    />
  );
}

export const INSERT_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const [rects, setRects] = useState<Rect[]>([]);
const nextId = useRef(0);

// --- Adapter ---
const adapter: InsertAdapter<Rect> = {
  commitInsert: (b) => ({
    id: \`r\${nextId.current++}\`,
    ...b,
    color: COLORS[nextId.current % COLORS.length],
  }),
  commitPaste: () => [],
  snapshotSelection: () => ({ items: [] }),
  insertObject: (obj) => setRects((rs) => [...rs, obj]),
  setSelection: () => {},
};

const insert = useInsert<Rect, Pose>(adapter, { minBounds: { width: 4, height: 4 } });

// <Canvas> renders the scene + a custom marquee layer; pointer handlers are
// overridden to drive the insert gesture (Canvas's auto move/resize wiring
// doesn't apply here — there's no adapter prop).
return (
  <Canvas<Rect>
    width={W} height={H}
    onPointerDown={(e) => { ... insert.start(...) }}
    onPointerMove={(e) => insert.move(...)}
    onPointerUp={() => insert.end()}
    layers={{
      rects:   { layer: sceneLayer },
      marquee: { layer: marqueeLayer },
    }}
  />
);
`;
