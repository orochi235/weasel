import { useRef, useState } from 'react';
import { Canvas } from '@orochi235/weasel';
import type { RenderLayer, CanvasHelpers } from '@orochi235/weasel';

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

function createQuadtreeLayer(
  getRects: () => Rect[],
  helpersRef: React.RefObject<CanvasHelpers<Pose> | null>,
): RenderLayer<unknown> {
  return {
    id: 'quadtree',
    label: 'Quadtree',
    draw: (ctx) => {
      // Read live (overlay-aware) bounds so the tree follows in-flight drags.
      const live = helpersRef.current;
      const rects = getRects().map((r) => {
        const b = live?.getEffectiveBounds(r.id);
        return b ? { id: r.id, x: b.x, y: b.y, width: b.width, height: b.height, color: r.color } : r;
      });
      const tree = buildTree({ x: 0, y: 0, width: W, height: H }, rects);
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
  const helpersRef = useRef<CanvasHelpers<Pose> | null>(null);

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      items={rects}
      setItems={setRects}
      toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
      handleHitRadius={HANDLE}
      helpersRef={helpersRef}
      layers={{
        grid: {
          spacing: 20,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        scene: {
          drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); },
        },
        quadtree: { layer: createQuadtreeLayer(() => rects, helpersRef), after: 'scene' },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  );
}

export const QUADTREE_DEMO_SOURCE = `// A custom analytical RenderLayer composed alongside weasel's stock layers.
// The quadtree code is demo-local — weasel doesn't ship a quadtree, but any
// layer that takes a CanvasRenderingContext2D can slot into the layer map.

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

// <Canvas> owns the move/resize/selection hooks. The layers map names the
// standard slots and drops the quadtree in after 'scene'.
return (
  <Canvas
    width={W} height={H}
    items={rects}
    setItems={setRects}
    toPose={(r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })}
    handleHitRadius={HANDLE}
    layers={{
      grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      quadtree: { layer: createQuadtreeLayer(() => rects), after: 'scene' },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
