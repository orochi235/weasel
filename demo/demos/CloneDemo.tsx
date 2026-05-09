import { useRef, useState } from 'react';
import {
  arrayAdapter,
  Canvas,
  cloneByAltDrag,
  useCloneTool,
  useTools,
} from '@orochi235/weasel';
import type { ClipboardSnapshot } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

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

  const drawRect = (r: Rect, p: Pose): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color: r.color },
  }];

  const clone = useCloneTool(adapter, {
    behaviors: [cloneByAltDrag()],
    drawOne: drawRect,
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
          drawOne: (r, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: r.color },
          }],
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

// pointerdown when a behavior activates for the current modifiers AND a
// hit-test lands on a body — plain drags pass through. With \`drawOne\`
// supplied, the tool synthesizes the ghost by translating each item's
// source pose; with no \`pickBest\` supplied, it walks adapter.getObjects()
// back-to-front via the same AUTO_POSE_DESCRIPTOR Canvas uses internally.
const drawRect = (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); };

const clone = useCloneTool(adapter, {
  behaviors: [cloneByAltDrag()],
  drawOne: drawRect,
});

const tools = useTools({ active: 'clone', registry: { clone } });

return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    tools={tools}
    selectionMode="none"
    layers={{
      scene: { drawOne: drawRect },
      selectionOverlay: null,
    }}
  />
);
`;
