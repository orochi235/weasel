import { useRef } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';
import type { RenderLayer, CanvasHelpers } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

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
  helpersRef: React.RefObject<CanvasHelpers<Rect> | null>,
): RenderLayer<unknown> {
  const buildLiveTree = () => {
    const live = helpersRef.current;
    const rects = getRects().map((r) => {
      const b = live?.getEffectiveBounds(r.id);
      return b ? { id: r.id, x: b.x, y: b.y, width: b.width, height: b.height, color: r.color } : r;
    });
    return buildTree({ x: 0, y: 0, width: W, height: H }, rects);
  };
  return {
    id: 'quadtree',
    label: 'Quadtree',
    draw: (_data, view) => {
      const tree = buildLiveTree();
      const cmds: DrawCommand[] = [];
      function walk(n: QuadNode) {
        if (!n.children) return;
        const width = Math.max(0.5, 2.5 - n.depth * 0.4);
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x: n.x, y: n.y, width: n.w, height: n.h },
          stroke: { paint: { color: 'rgba(0, 220, 240, 0.7)' }, width },
        });
        for (const c of n.children) walk(c);
      }
      walk(tree);
      return cmds.length === 0 ? [] : [{ kind: 'group', transform: viewToMat3(view), children: cmds }];
    },
  };
}

export function QuadtreeDemo() {
  const scene = useScene({ items: INITIAL });
  const helpersRef = useRef<CanvasHelpers<Rect> | null>(null);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{ handleHitRadius: HANDLE }}
      helpersRef={helpersRef}
      layers={{
        grid: {
          spacing: 20,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        scene: {
          drawOne: (_node, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: p.color },
          }],
          // drawOne: the quadtree-cell overlay (createQuadtreeLayer) is a
          // separate RenderLayer, not a scene slot — remains 2D-only; defer
          // to v2.
        },
        quadtree: {
          layer: createQuadtreeLayer(
            () => [...scene.renderOrder()].map((id) => scene.get(id)!.data),
            helpersRef,
          ),
          after: 'scene',
        },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  );
}

export const QUADTREE_DEMO_SOURCE = `// A custom analytical RenderLayer composed alongside weasel's stock layers.
// The quadtree code is demo-local — weasel doesn't ship a quadtree, but any
// layer that takes a CanvasRenderingContext2D can slot into the layer map.

interface QuadNode { x: number; y: number; w: number; h: number; depth: number; children: QuadNode[] | null }

function buildTree(bounds, rects): QuadNode { /* subdivide into 4 quadrants and recurse */ }

const scene = useScene({ items: INITIAL });

return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectTool={{ handleHitRadius: HANDLE }}
    layers={{
      grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
      scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      quadtree: { layer: createQuadtreeLayer(() => sceneRectsLive()), after: 'scene' },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
