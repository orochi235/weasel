import { useRef, useState } from 'react';
import {
  arrayAdapter,
  Canvas,
  cloneByAltDrag,
  useCloneTool,
  useTools,
} from '@orochi235/weasel';
import type { ClipboardSnapshot } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 60,  y: 80,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 220, y: 140, width: 80, height: 60, color: '#d4a574' },
];

export function CloneDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const rectsRef = useRef(rects); rectsRef.current = rects;
  const nextId = useRef(0);

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

  const clone = useCloneTool(adapter, {
    behaviors: [cloneByAltDrag()],
    hitBody: (wx, wy) => {
      const list = rectsRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) return r.id;
      }
      return null;
    },
    drawGhost: (cx, items) => {
      cx.globalAlpha = 0.5;
      for (const item of items) {
        const src = rectsRef.current.find((r) => r.id === item.id);
        if (!src) continue;
        cx.fillStyle = src.color;
        cx.fillRect(item.x, item.y, src.width, src.height);
      }
      cx.globalAlpha = 1;
    },
  });

  const tools = useTools({ active: 'clone', registry: { clone } });

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      tools={tools}
      selectionMode="none"
      layers={{
        scene: {
          drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
        },
        selectionOverlay: null,
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

// useCloneTool wraps useClone as a Tool record: the dispatcher only claims
// pointerdown when a behavior activates for the current modifiers AND
// hitBody finds a target — plain drags pass through to whatever else is
// in the active slot. The tool owns the ghost overlay internally.
const clone = useCloneTool(adapter, {
  behaviors: [cloneByAltDrag()],
  hitBody: (wx, wy) => /* return topmost rect id, or null */,
  drawGhost: (cx, items) => /* paint translucent rects at items[i].{x,y} */,
});

const tools = useTools({ active: 'clone', registry: { clone } });

return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    tools={tools}
    selectionMode="none"
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: null,
    }}
  />
);
`;
