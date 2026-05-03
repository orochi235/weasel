import { useCallback, useRef, useState } from 'react';
import { Canvas, useClone, cloneByAltDrag } from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';
import type { InsertAdapter, ClipboardSnapshot, RenderLayer } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 60,  y: 80,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 220, y: 140, width: 80, height: 60, color: '#d4a574' },
];

interface OverlayItem { id: string; x: number; y: number }

export function CloneDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const rectsRef = useRef(rects);
  rectsRef.current = rects;
  const nextId = useRef(0);

  const [overlay, setOverlay] = useState<OverlayItem[] | null>(null);

  const adapter: InsertAdapter<Rect> = {
    commitInsert: () => null,
    commitPaste: (clip: ClipboardSnapshot, offset) => {
      const items = clip.items as Rect[];
      return items.map((src) => ({
        ...src,
        id: `clone-${nextId.current++}`,
        x: src.x + offset.dx,
        y: src.y + offset.dy,
      }));
    },
    snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
      items: ids
        .map((id) => rectsRef.current.find((r) => r.id === id))
        .filter((r): r is Rect => !!r),
    }),
    insertObject: (obj) => setRects((rs) => [...rs, obj]),
    setSelection: () => {},
    getSelection: () => [],
  };

  const clone = useClone<Rect>(adapter, {
    behaviors: [cloneByAltDrag()],
    setOverlay: (_layer, objects) => setOverlay(objects as OverlayItem[]),
    clearOverlay: () => setOverlay(null),
  });

  const dragging = useRef(false);

  const hit = (wx: number, wy: number): Rect | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) return r;
    }
    return null;
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.altKey) return;
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    const h = hit(wx, wy);
    if (!h) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    clone.start(wx, wy, [h.id], 'structures', { alt: true, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
  }, [clone]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    clone.move(wx, wy, { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
  }, [clone]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    clone.end();
  }, [clone]);

  const sceneLayer: RenderLayer<unknown> = {
    id: 'scene', label: 'Scene',
    draw: (cx) => {
      for (const r of rects) {
        cx.fillStyle = r.color;
        cx.fillRect(r.x, r.y, r.width, r.height);
      }
    },
  };

  const ghostLayer: RenderLayer<unknown> = {
    id: 'clone-ghost', label: 'Clone ghost',
    draw: (cx) => {
      if (!overlay) return;
      cx.globalAlpha = 0.5;
      for (const item of overlay) {
        const src = rects.find((r) => r.id === item.id);
        if (!src) continue;
        cx.fillStyle = src.color;
        cx.fillRect(item.x, item.y, src.width, src.height);
      }
      cx.globalAlpha = 1;
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
        ghost: { layer: ghostLayer },
      }}
    />
  );
}

export const CLONE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface OverlayItem { id: string; x: number; y: number }

const [rects, setRects] = useState<Rect[]>(INITIAL);
const [overlay, setOverlay] = useState<OverlayItem[] | null>(null);

// --- Adapter (clone reuses InsertAdapter's commitPaste / snapshotSelection) ---
const adapter: InsertAdapter<Rect> = {
  commitInsert: () => null,
  commitPaste: (clip, offset) => clip.items.map((src) => ({
    ...src, id: \`clone-\${nextId.current++}\`,
    x: src.x + offset.dx, y: src.y + offset.dy,
  })),
  snapshotSelection: (ids) => ({ items: /* selected rects */ }),
  insertObject: (obj) => setRects((rs) => [...rs, obj]),
  setSelection: () => {},
  getSelection: () => [],
};

const clone = useClone<Rect>(adapter, {
  behaviors: [cloneByAltDrag()],
  setOverlay: (_layer, objects) => setOverlay(objects),
  clearOverlay: () => setOverlay(null),
});

// <Canvas> renders the scene + clone-ghost layers; pointer handlers are
// overridden to drive the clone gesture. The ghost layer reads from React
// state populated by the clone hook's setOverlay callback.
return (
  <Canvas<Rect>
    width={W} height={H}
    onPointerDown={(e) => /* alt-hit-test → clone.start */}
    onPointerMove={(e) => clone.move(...)}
    onPointerUp={() => clone.end()}
    layers={{
      rects: { layer: sceneLayer },
      ghost: { layer: ghostLayer },
    }}
  />
);
`;
