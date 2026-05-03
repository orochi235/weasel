import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMove,
  useResize,
  createGridLayer,
  createSelectionOverlayLayer,
  runLayers,
  setupCanvasDpr,
  cornerResizeHandles,
  hitCornerHandle,
} from '@orochi235/weasel';
import type {
  MoveAdapter,
  ResizeAdapter,
  RenderLayer,
  Op,
} from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rectsRef = useRef(rects);
  rectsRef.current = rects;

  const moveAdapter: MoveAdapter<Rect, Pose> = {
    getObject: (id) => rectsRef.current.find((r) => r.id === id),
    getPose: (id) => {
      const r = rectsRef.current.find((x) => x.id === id)!;
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    getParent: () => null,
    setPose: (id, pose) => setRects((rs) => rs.map((r) => (r.id === id ? { ...r, ...pose } : r))),
    setParent: () => {},
    applyBatch: (ops: Op[]) => { for (const op of ops) op.apply(moveAdapter); },
  };

  const resizeAdapter: ResizeAdapter<Rect, Pose> = {
    getObject: (id) => rectsRef.current.find((r) => r.id === id),
    getPose: (id) => {
      const r = rectsRef.current.find((x) => x.id === id)!;
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    setPose: (id, pose) => setRects((rs) => rs.map((r) => (r.id === id ? { ...r, ...pose } : r))),
    applyBatch: (ops: Op[]) => { for (const op of ops) op.apply(resizeAdapter); },
  };

  const move = useMove<Rect, Pose>(moveAdapter, {
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  });
  const resize = useResize<Rect, Pose>(resizeAdapter, {});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragKind = useRef<'move' | 'resize' | null>(null);
  const dragId = useRef<string | null>(null);

  const hit = (wx: number, wy: number): Rect | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) return r;
    }
    return null;
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    if (selectedId) {
      const sel = rectsRef.current.find((r) => r.id === selectedId);
      if (sel) {
        for (const h of cornerResizeHandles(sel)) {
          if (hitCornerHandle(h, wx, wy, HANDLE)) {
            dragKind.current = 'resize';
            dragId.current = sel.id;
            e.currentTarget.setPointerCapture(e.pointerId);
            resize.start(sel.id, h.anchor, wx, wy);
            return;
          }
        }
      }
    }
    const target = hit(wx, wy);
    if (!target) { setSelectedId(null); return; }
    setSelectedId(target.id);
    dragKind.current = 'move';
    dragId.current = target.id;
    e.currentTarget.setPointerCapture(e.pointerId);
    move.start({ ids: [target.id], worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY });
  }, [move, resize, selectedId]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragKind.current) return;
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    const mods = { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey };
    if (dragKind.current === 'move') {
      move.move({ worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY, modifiers: mods });
    } else {
      resize.move(wx, wy, mods);
    }
  }, [move, resize]);

  const onPointerUp = useCallback(() => {
    if (!dragKind.current) return;
    if (dragKind.current === 'move') move.end();
    else resize.end();
    dragKind.current = null;
    dragId.current = null;
  }, [move, resize]);

  const moveOverlay = move.overlay;
  const resizeOverlay = resize.overlay;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    setupCanvasDpr(c, ctx, W, H);
    ctx.clearRect(0, 0, W, H);

    // Effective rects: for the quadtree to refresh live during a drag, fold in the
    // active overlay pose so the tree reflects the in-flight scene.
    const effective: Rect[] = rectsRef.current.map((r) => {
      if (moveOverlay && moveOverlay.draggedIds.includes(r.id)) {
        const p = moveOverlay.poses.get(r.id);
        if (p) return { ...r, ...p };
      }
      if (resizeOverlay && r.id === selectedId && resizeOverlay.currentPose) {
        return { ...r, ...resizeOverlay.currentPose };
      }
      return r;
    });

    const gridLayer = createGridLayer({
      spacing: 20,
      bounds: () => ({ x: 0, y: 0, width: W, height: H }),
      accentEvery: 5,
    });

    const baseLayer: RenderLayer<unknown> = {
      id: 'base', label: 'Rects',
      draw: (cx) => {
        const hide = new Set(moveOverlay?.hideIds ?? []);
        for (const r of effective) {
          if (hide.has(r.id)) continue;
          cx.fillStyle = r.color;
          cx.fillRect(r.x, r.y, r.width, r.height);
        }
      },
    };

    const ghostLayer: RenderLayer<unknown> = {
      id: 'ghost', label: 'Ghost',
      draw: (cx) => {
        if (!moveOverlay) return;
        cx.globalAlpha = 0.85;
        for (const id of moveOverlay.draggedIds) {
          const p = moveOverlay.poses.get(id);
          const src = rectsRef.current.find((r) => r.id === id);
          if (!p || !src) continue;
          cx.fillStyle = src.color;
          cx.fillRect(p.x, p.y, p.width, p.height);
        }
        cx.globalAlpha = 1;
      },
    };

    const quadtreeLayer = createQuadtreeLayer(() => effective);

    const selectionOverlay = createSelectionOverlayLayer<Pose>({
      getSelection: () => (selectedId ? [selectedId] : []),
      getPose: (id) => {
        const r = effective.find((x) => x.id === id);
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      },
      handles: { size: HANDLE },
    });

    runLayers(ctx, [gridLayer, baseLayer, ghostLayer, quadtreeLayer, selectionOverlay], undefined, {});
  }, [rects, moveOverlay, resizeOverlay, selectedId]);

  return (
    <canvas
      ref={canvasRef}
      className="ckd-canvas"
      width={W}
      height={H}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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

function createQuadtreeLayer(getRects: () => Rect[]): RenderLayer<unknown> {
  return {
    id: 'quadtree', label: 'Quadtree',
    draw: (ctx) => {
      const tree = buildTree({ x: 0, y: 0, width: W, height: H }, getRects());
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

// During a drag, fold overlay poses back into the rect list so the quadtree
// recomputes against the in-flight scene rather than the committed one.
const effective = rects.map((r) => {
  if (moveOverlay?.draggedIds.includes(r.id)) {
    const p = moveOverlay.poses.get(r.id);
    if (p) return { ...r, ...p };
  }
  if (resizeOverlay && r.id === selectedId && resizeOverlay.currentPose) {
    return { ...r, ...resizeOverlay.currentPose };
  }
  return r;
});

// Compose: the custom layer is just one entry in the stack.
runLayers(ctx, [
  gridLayer,         // weasel — background
  baseLayer,         // your app — committed rects
  ghostLayer,        // your app — drag preview
  quadtreeLayer,     // your custom analytical overlay
  selectionOverlay,  // weasel — outline + handles
], undefined, {});
`;
