import { useMemo, useRef, useState } from 'react';
import {
  useMove,
  useResize,
  useSelection,
  arrayAdapter,
  Canvas,
  defaultLayers,
} from '@orochi235/weasel';
import type { RenderLayer } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 480, H = 360, HANDLE = 8;

const INITIAL: Rect[] = [
  { id: 'a', x:  40, y:  40, width: 120, height:  90, color: '#7fb069' },
  { id: 'b', x: 220, y:  60, width:  60, height:  60, color: '#d4a574' },
  { id: 'c', x: 320, y:  40, width: 110, height: 130, color: '#a48bd4' },
  { id: 'd', x:  60, y: 200, width: 100, height:  80, color: '#6ab0c4' },
  { id: 'e', x: 220, y: 220, width:  60, height:  40, color: '#d47a7a' },
  { id: 'f', x: 320, y: 220, width:  90, height: 100, color: '#c4b06a' },
];

// --- Quadtree (demo-local; no scene-graph integration). Builds fresh on each
// draw from the current rect AABBs and renders the cell boundaries. ---

interface QuadNode { x: number; y: number; w: number; h: number; depth: number; children: QuadNode[] | null }

const MAX_DEPTH = 5;

function aabbIntersects(n: QuadNode, r: { x: number; y: number; width: number; height: number }): boolean {
  return r.x < n.x + n.w && r.x + r.width > n.x && r.y < n.y + n.h && r.y + r.height > n.y;
}

function buildTree(bounds: { x: number; y: number; width: number; height: number }, rects: Rect[]): QuadNode {
  const root: QuadNode = { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height, depth: 0, children: null };
  function visit(node: QuadNode) {
    if (node.depth >= MAX_DEPTH) return;
    let count = 0;
    for (const r of rects) if (aabbIntersects(node, r)) { count++; if (count > 1) break; }
    if (count <= 1) return;
    const hw = node.w / 2;
    const hh = node.h / 2;
    const d = node.depth + 1;
    node.children = [
      { x: node.x,      y: node.y,      w: hw, h: hh, depth: d, children: null },
      { x: node.x + hw, y: node.y,      w: hw, h: hh, depth: d, children: null },
      { x: node.x,      y: node.y + hh, w: hw, h: hh, depth: d, children: null },
      { x: node.x + hw, y: node.y + hh, w: hw, h: hh, depth: d, children: null },
    ];
    for (const c of node.children) visit(c);
  }
  visit(root);
  return root;
}

function createQuadtreeLayer(getRects: () => Rect[]): RenderLayer<unknown> {
  return {
    id: 'quadtree',
    label: 'Quadtree',
    draw: (ctx) => {
      const tree = buildTree({ x: 0, y: 0, width: W, height: H }, getRects());
      ctx.strokeStyle = 'rgba(0, 220, 240, 0.7)';
      function walk(n: QuadNode) {
        if (!n.children) return;
        ctx.lineWidth = Math.max(0.5, 2.5 - n.depth * 0.4);
        ctx.strokeRect(n.x, n.y, n.w, n.h);
        for (const c of n.children) walk(c);
      }
      walk(tree);
    },
  };
}

export function QuadtreeDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL);
  const rectsRef = useRef(rects);
  rectsRef.current = rects;

  const selection = useSelection();

  const adapter = arrayAdapter<Rect, Pose>({
    ref: rectsRef,
    setItems: setRects,
    toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
  });

  const move = useMove<Rect, Pose>(adapter);
  const resize = useResize<Rect, Pose>(adapter, {});

  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) return r.id;
    }
    return null;
  };

  const boundsOf = (id: string): Pose | null => {
    const ov = move.overlay?.poses.get(id);
    if (ov) return ov;
    if (resize.overlay && resize.overlay.id === id) return resize.overlay.currentPose;
    const r = rectsRef.current.find((x) => x.id === id);
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  };

  const moveOverlay = move.overlay;
  const resizeOverlay = resize.overlay;
  const selectedIds = selection.current;

  const layers = useMemo(() => {
    // Effective rects for the quadtree: fold in active overlay poses so the
    // tree reflects the in-flight scene during a drag.
    const effective: Rect[] = rectsRef.current.map((r) => {
      const moved = moveOverlay?.poses.get(r.id);
      if (moveOverlay && moveOverlay.draggedIds.includes(r.id) && moved) return { ...r, ...moved };
      if (resizeOverlay && resizeOverlay.id === r.id) return { ...r, ...resizeOverlay.currentPose };
      return r;
    });

    const stack = defaultLayers<Rect, Pose>({
      grid: {
        spacing: 20,
        bounds: () => ({ x: 0, y: 0, width: W, height: H }),
        accentEvery: 5,
      },
      scene: {
        objects: rects,
        toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
        drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
      },
      moveOverlay,
      resizeOverlay,
      additional: [createQuadtreeLayer(() => effective)],
      selection: {
        ids: selectedIds,
        poseById: (id) => {
          const r = effective.find((x) => x.id === id);
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
        },
        handles: { size: HANDLE },
      },
    });
    return stack;
  }, [rects, moveOverlay, resizeOverlay, selectedIds]);

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      layers={layers}
      move={move}
      resize={resize}
      hitBody={hitBody}
      selection={selection}
      boundsOf={boundsOf}
      handleHitRadius={HANDLE}
    />
  );
}

export const QUADTREE_DEMO_SOURCE = `// A custom analytical RenderLayer composed alongside weasel's stock layers.
// The quadtree code is demo-local — weasel doesn't ship a quadtree, but any
// layer that takes a CanvasRenderingContext2D can slot into runLayers.

interface QuadNode { x: number; y: number; w: number; h: number; depth: number; children: QuadNode[] | null }

function buildTree(bounds, rects): QuadNode {
  const root = { ...bounds, depth: 0, children: null };
  function visit(node) {
    if (node.depth >= MAX_DEPTH) return;
    let count = 0;
    for (const r of rects) if (intersects(node, r)) { count++; if (count > 1) break; }
    if (count <= 1) return;
    // ...subdivide into 4 quadrants and recurse
  }
  visit(root);
  return root;
}

// useSelection + <Canvas> + defaultLayers handle pointer wiring for us.
const selection = useSelection();
const move = useMove<Rect, Pose>(adapter);
const resize = useResize<Rect, Pose>(adapter, {});

const layers = defaultLayers<Rect, Pose>({
  grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
  scene: { objects: rects, toPose: ..., drawOne: ... },
  moveOverlay: move.overlay,
  resizeOverlay: resize.overlay,
  additional: [createQuadtreeLayer(() => effective)],
  selection: { ids: selection.current, poseById, handles: { size: HANDLE } },
});

return (
  <Canvas
    width={W} height={H}
    layers={layers}
    move={move}
    resize={resize}
    hitBody={hitBody}
    selection={selection}
    boundsOf={boundsOf}
    handleHitRadius={HANDLE}
  />
);
`;
