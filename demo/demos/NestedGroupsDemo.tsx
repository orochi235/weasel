import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMove,
  useNestedGroup,
  useNestedUngroup,
  useUndoRedo,
  createHistory,
  createSelectionOverlayLayer,
  composeRectPose,
  decomposeRectPose,
  worldPoseLookup,
  runLayers,
  setupCanvasDpr,
} from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';
import type {
  MoveAdapter,
  Op,
  RenderLayer,
} from '@orochi235/weasel';

interface Node {
  id: string;
  parent: string | null;
  pose: { x: number; y: number; width: number; height: number };
  color: string;
  isGroup?: boolean;
}
type Pose = Node['pose'];

const W = 480, H = 320;
const INITIAL: Node[] = [
  { id: 'g1',  parent: null, pose: { x: 60, y: 60, width: 180, height: 110 }, color: '#3a2e22', isGroup: true },
  { id: 'a',   parent: 'g1', pose: { x: 10, y: 10, width: 70,  height: 50  }, color: '#7fb069' },
  { id: 'b',   parent: 'g1', pose: { x: 95, y: 45, width: 70,  height: 50  }, color: '#7fb069' },
  { id: 'c',   parent: null, pose: { x: 300, y: 110, width: 90, height: 60 }, color: '#d4a574' },
  { id: 'd',   parent: null, pose: { x: 200, y: 220, width: 70, height: 50 }, color: '#a48bd4' },
];

export function NestedGroupsDemo() {
  const [nodes, setNodes] = useState<Node[]>(INITIAL);
  const [selection, setSelection] = useState<string[]>([]);
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const selRef = useRef(selection); selRef.current = selection;
  const adapterRef = useRef<MoveAdapter<Node, Pose>>(null!);
  const historyRef = useRef(createHistory({
    setPose: (id: string, p: Pose) => adapterRef.current.setPose(id, p),
    setParent: (id: string, parent: string | null) => adapterRef.current.setParent(id, parent),
    insertObject: (n: Node) => (adapterRef.current as unknown as { insertObject: (n: Node) => void }).insertObject(n),
    removeObject: (id: string) => (adapterRef.current as unknown as { removeObject: (id: string) => void }).removeObject(id),
    setSelection: (ids: string[]) => setSelection(ids),
  }));

  const byId = (id: string) => nodesRef.current.find((n) => n.id === id);

  const adapter = {
    getObject: (id: string) => byId(id),
    getPose: (id: string) => byId(id)!.pose,
    getParent: (id: string) => byId(id)?.parent ?? null,
    getChildren: (id: string | null) => nodesRef.current.filter((n) => n.parent === id).map((n) => n.id),
    getSelection: () => selRef.current,
    setSelection: (ids: string[]) => setSelection(ids),
    setPose: (id: string, p: Pose) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, pose: { ...p } } : n))),
    setParent: (id: string, parent: string | null) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, parent } : n))),
    insertObject: (n: Node) => setNodes((ns) => [...ns, n]),
    removeObject: (id: string) => setNodes((ns) => ns.filter((n) => n.id !== id)),
    applyBatch: (ops: Op[], label: string) =>
      historyRef.current.applyBatch(ops, label),
  };
  adapterRef.current = adapter;

  const composeOpts = { composePose: composeRectPose<Pose>, decomposePose: decomposeRectPose<Pose> };

  const move = useMove<Node, Pose>(adapter, {
    cascadeWorldPose: worldPoseLookup(adapter, composeRectPose<Pose>),
  });

  useNestedGroup<Node, Pose>(adapter, {
    ...composeOpts,
    bindKeyboard: true,
    groupFactory: ({ id, localPose, childIds: _childIds }) => ({
      id, parent: null, pose: localPose, color: '#3a2e22', isGroup: true,
    }),
  });
  useNestedUngroup<Node, Pose>(adapter, {
    ...composeOpts,
    bindKeyboard: true,
    isGroup: (_id, obj) => obj?.isGroup === true,
  });
  useUndoRedo(historyRef.current, { bindKeyboard: true });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);

  const worldPoseOf = (id: string): Pose | null => {
    const n = byId(id); if (!n) return null;
    let world = { ...n.pose };
    let p = n.parent;
    while (p !== null) {
      const pn = byId(p); if (!pn) break;
      world = { ...world, x: world.x + pn.pose.x, y: world.y + pn.pose.y };
      p = pn.parent;
    }
    return world;
  };

  const hit = (wx: number, wy: number): string | null => {
    // Top-down hit-test on world bounds. Prefer leaves over their group parents
    // so single-clicking inside a group selects the whole group (resolved
    // below) but a click on an empty area of the group selects nothing.
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]; if (n.isGroup) continue;
      const w = worldPoseOf(n.id); if (!w) continue;
      if (wx >= w.x && wx <= w.x + w.width && wy >= w.y && wy <= w.y + w.height) return n.id;
    }
    return null;
  };

  const resolveTopLevel = (id: string): string => {
    let cur = id;
    while (true) {
      const p = adapter.getParent(cur);
      if (p === null) return cur;
      cur = p;
    }
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.focus();
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = hit(wx, wy);
    if (!target) { setSelection([]); return; }
    const top = resolveTopLevel(target);
    if (!selRef.current.includes(top)) setSelection([top]);
    dragging.current = true;
    move.start({ ids: [top], worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY });
  }, [move]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    if (e.buttons === 0) { dragging.current = false; move.cancel(); return; }
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    move.move({
      worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY,
      modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey },
    });
  }, [move]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    move.end();
  }, [move]);

  const moveOv = move.overlay;
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    setupCanvasDpr(c, ctx, W, H);
    ctx.clearRect(0, 0, W, H);

    const baseLayer: RenderLayer<unknown> = {
      id: 'base', label: 'Base',
      draw: (cx) => {
        const hide = new Set(moveOv?.hideIds ?? []);
        // Render parents first so children sit on top.
        const order = [...nodes].sort((a, b) => Number(!!b.isGroup) - Number(!!a.isGroup));
        for (const n of order) {
          if (hide.has(n.id)) continue;
          const w = worldPoseOf(n.id); if (!w) continue;
          if (n.isGroup) {
            cx.fillStyle = n.color; cx.globalAlpha = 0.35;
            cx.fillRect(w.x, w.y, w.width, w.height); cx.globalAlpha = 1;
            cx.strokeStyle = '#5a4a38'; cx.setLineDash([4, 3]);
            cx.strokeRect(w.x + 0.5, w.y + 0.5, w.width - 1, w.height - 1); cx.setLineDash([]);
          } else {
            cx.fillStyle = n.color;
            cx.fillRect(w.x, w.y, w.width, w.height);
          }
        }
      },
    };

    const ghostLayer: RenderLayer<unknown> = {
      id: 'ghost', label: 'Ghost',
      draw: (cx) => {
        if (!moveOv) return;
        cx.globalAlpha = 0.7;
        // overlay.poses includes both dragged ids AND cascaded descendants
        // (because cascadeWorldPose was supplied to useMove).
        for (const [id, p] of moveOv.poses) {
          const src = byId(id); if (!src) continue;
          if (src.isGroup) {
            cx.fillStyle = src.color; cx.globalAlpha = 0.25;
            cx.fillRect(p.x, p.y, p.width, p.height); cx.globalAlpha = 0.7;
            cx.strokeStyle = '#7fb069'; cx.setLineDash([4, 3]);
            cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1); cx.setLineDash([]);
          } else {
            cx.fillStyle = src.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          }
        }
        cx.globalAlpha = 1;
      },
    };

    const selectionLayer = createSelectionOverlayLayer<Pose>({
      getSelection: () => selection,
      // worldPoseLookup walks each id's parent chain via composeRectPose,
      // returning null safely if a selected id was just removed.
      getPose: worldPoseLookup(adapter, composeRectPose<Pose>),
      handles: { size: 0 }, // no resize hook in this demo — outlines only
    });

    runLayers(ctx, [baseLayer, ghostLayer, selectionLayer], undefined, {});
  }, [nodes, selection, moveOv]);

  return (
    <canvas
      ref={canvasRef} className="ckd-canvas" width={W} height={H} tabIndex={0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    />
  );
}

export const NESTED_GROUPS_DEMO_SOURCE = `// --- Scene with real parent/child hierarchy ---
interface Node {
  id: string; parent: string | null;
  pose: { x: number; y: number; width: number; height: number };
  color: string; isGroup?: boolean;
}

// Adapter exposes getChildren so the kit can walk the hierarchy for
// cascade + ungroup. Poses are LOCAL — relative to the direct parent.
const adapter = {
  getObject, getPose, getParent,
  getChildren: (id) => nodes.filter((n) => n.parent === id).map((n) => n.id),
  getSelection, setSelection,
  setPose, setParent, insertObject, removeObject,
  applyBatch: (ops, label) => history.applyBatch(ops, adapter, label),
};

const composeOpts = { composePose: composeRectPose, decomposePose: decomposeRectPose };

// Move with auto-cascade: children visually follow the dragged parent.
const move = useMove(adapter, {
  cascadeWorldPose: worldPoseLookup(adapter, composeRectPose),
});

// Group / ungroup actions (Mod+G, Mod+Shift+G).
useNestedGroup(adapter, {
  ...composeOpts,
  bindKeyboard: true,
  groupFactory: ({ id, localPose }) => ({
    id, parent: null, pose: localPose, color: '#3a2e22', isGroup: true,
  }),
});
useNestedUngroup(adapter, {
  ...composeOpts,
  bindKeyboard: true,
  isGroup: (_id, obj) => obj?.isGroup === true,
});
useUndoRedo(history, { bindKeyboard: true });

// Selection overlay reads world poses via worldPoseLookup — no per-id
// composeWorldPose call site.
const selectionLayer = createSelectionOverlayLayer({
  getSelection: () => selection,
  getPose: worldPoseLookup(adapter, composeRectPose),
});
`;
