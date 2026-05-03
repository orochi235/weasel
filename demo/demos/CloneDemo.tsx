import { useCallback, useRef, useState } from 'react';
import { arrayAdapter, Canvas, useClone, cloneByAltDrag } from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';
import type { ClipboardSnapshot, RenderLayer } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 60,  y: 80,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 220, y: 140, width: 80, height: 60, color: '#d4a574' },
];

interface OverlayItem { id: string; x: number; y: number }

export function CloneDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const rectsRef = useRef(rects); rectsRef.current = rects;
  const nextId = useRef(0);
  const [overlay, setOverlay] = useState<OverlayItem[] | null>(null);

  const adapter = {
    ...arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    }),
    commitPaste: (clip: ClipboardSnapshot, offset: { dx: number; dy: number }) =>
      (clip.items as Rect[]).map((src) => ({
        ...src,
        id: `clone-${nextId.current++}`,
        x: src.x + offset.dx,
        y: src.y + offset.dy,
      })),
  };

  const clone = useClone(adapter, {
    behaviors: [cloneByAltDrag()],
    setOverlay: (_layer, objects) => setOverlay(objects as OverlayItem[]),
    clearOverlay: () => setOverlay(null),
  });

  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.altKey) return;
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    const list = rectsRef.current;
    let hit: Rect | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) { hit = r; break; }
    }
    if (!hit) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    clone.start(wx, wy, [hit.id], 'structures', { alt: true, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey });
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
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selectionMode="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      layers={{
        scene: {
          drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
        },
        selectionOverlay: null,
        ghost: { layer: ghostLayer },
      }}
    />
  );
}

export const CLONE_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

// arrayAdapter provides snapshotSelection / insertObject for clone; the
// consumer overrides commitPaste to mint the new id + offset the position.
const adapter = {
  ...arrayAdapter<Rect, Pose>({ ref: rectsRef, setItems: setRects, toPose: (r) => ({...}) }),
  commitPaste: (clip, offset) => clip.items.map((src) => ({
    ...src, id: \`clone-\${nextId.current++}\`,
    x: src.x + offset.dx, y: src.y + offset.dy,
  })),
};

const clone = useClone<Rect>(adapter, {
  behaviors: [cloneByAltDrag()],
  setOverlay: (_layer, objects) => setOverlay(objects),
  clearOverlay: () => setOverlay(null),
});

// Override Canvas's pointer handlers to drive the clone gesture (alt-hit-test
// → clone.start). The default scene + a custom ghost layer paint the rest.
return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    selectionMode="none"
    onPointerDown={(e) => /* alt-hit-test → clone.start */}
    onPointerMove={(e) => clone.move(...)}
    onPointerUp={() => clone.end()}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: null,
      ghost: { layer: ghostLayer },
    }}
  />
);
`;
