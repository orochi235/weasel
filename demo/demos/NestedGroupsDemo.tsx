import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  defineTool,
  useMove,
  useNestedGroup,
  useNestedUngroup,
  useSelection,
  useTools,
  createHistory,
  composeRectPose,
  decomposeRectPose,
  worldPoseLookup,
} from '@orochi235/weasel';
import type {
  MoveAdapter,
  Op,
  RenderLayer,
  SelectionApi,
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
// Three levels of nesting out of the box: g1 contains g2 (a sub-group) +
// a free leaf `a`; g2 in turn contains leaves `b1` and `b2`. Two free
// leaves (c, d) sit alongside for ad-hoc grouping with Cmd+G. The data
// path supports arbitrary depth — INITIAL just has to demonstrate it.
const INITIAL: Node[] = [
  { id: 'g1',  parent: null, pose: { x:  40, y:  40, width: 230, height: 150 }, color: '#3a2e22', isGroup: true },
  { id: 'a',   parent: 'g1', pose: { x:  10, y:  10, width:  60, height:  50 }, color: '#7fb069' },
  { id: 'g2',  parent: 'g1', pose: { x:  85, y:  45, width: 130, height:  90 }, color: '#2e3a22', isGroup: true },
  { id: 'b1',  parent: 'g2', pose: { x:   8, y:   8, width:  50, height:  35 }, color: '#a8d469' },
  { id: 'b2',  parent: 'g2', pose: { x:  68, y:  45, width:  50, height:  35 }, color: '#a8d469' },
  { id: 'c',   parent: null, pose: { x: 320, y: 110, width:  90, height:  60 }, color: '#d4a574' },
  { id: 'd',   parent: null, pose: { x: 220, y: 230, width:  70, height:  50 }, color: '#a48bd4' },
];

export function NestedGroupsDemo() {
  const [nodes, setNodes] = useState<Node[]>(INITIAL);
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const selection: SelectionApi = useSelection();
  const selRef = useRef(selection); selRef.current = selection;
  const adapterRef = useRef<MoveAdapter<Node, Pose> & {
    insertObject: (n: Node) => void;
    removeObject: (id: string) => void;
  }>(null!);

  const history = useMemo(() => createHistory({
    setPose: (id: string, p: Pose) => adapterRef.current.setPose(id, p),
    setParent: (id: string, parent: string | null) => adapterRef.current.setParent(id, parent),
    insertObject: (n: Node) => adapterRef.current.insertObject(n),
    removeObject: (id: string) => adapterRef.current.removeObject(id),
    setSelection: (ids: string[]) => selRef.current.set(ids),
  }), []);

  const byId = (id: string) => nodesRef.current.find((n) => n.id === id);

  const adapter = {
    getObject: (id: string) => byId(id),
    getObjects: () => nodesRef.current,
    getPose: (id: string) => byId(id)!.pose,
    getParent: (id: string) => byId(id)?.parent ?? null,
    getChildren: (id: string | null) => nodesRef.current.filter((n) => n.parent === id).map((n) => n.id),
    getSelection: () => selRef.current.get(),
    setSelection: (ids: string[]) => selRef.current.set(ids),
    setPose: (id: string, p: Pose) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, pose: { ...p } } : n))),
    setParent: (id: string, parent: string | null) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, parent } : n))),
    insertObject: (n: Node) => setNodes((ns) => [...ns, n]),
    removeObject: (id: string) => setNodes((ns) => ns.filter((n) => n.id !== id)),
    applyBatch: (ops: Op[], label: string) => history.applyBatch(ops, label),
  };
  adapterRef.current = adapter;

  const composeOpts = { composePose: composeRectPose<Pose>, decomposePose: decomposeRectPose<Pose> };

  // Move with auto-cascade — overlay.poses includes both dragged ids AND
  // their descendants in world coordinates.
  const move = useMove(adapter, {
    cascadeWorldPose: worldPoseLookup(adapter, composeRectPose<Pose>),
  });

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

  // Compose a node's world-space pose by walking ancestors.
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

  // Walk root → leaf so the chain reads outermost-first.
  const ancestorChain = (id: string): string[] => {
    const chain: string[] = [];
    let cur: string | null = id;
    while (cur !== null) { chain.unshift(cur); cur = adapter.getParent(cur); }
    return chain;
  };

  // Find the leaf under the cursor (top-down z-order, skipping group bodies).
  const hitLeaf = (wx: number, wy: number): string | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]; if (n.isGroup) continue;
      const w = worldPoseOf(n.id); if (!w) continue;
      if (wx >= w.x && wx <= w.x + w.width && wy >= w.y && wy <= w.y + w.height) {
        return n.id;
      }
    }
    return null;
  };

  // Default Canvas hit-test (used by built-in chrome): resolve to the
  // outermost group so a casual click selects the whole tree.
  const hitBody = (wx: number, wy: number): string | null => {
    const leaf = hitLeaf(wx, wy);
    return leaf === null ? null : ancestorChain(leaf)[0];
  };

  // Alt-aware hit resolution used by the move tool's pointer.onDown.
  // Without Alt: outermost ancestor (Figma's "select group" default).
  // With Alt: drill one level deeper than the deepest currently-selected
  // ancestor in the chain (repeated Alt-clicks step from group → subgroup
  // → leaf). With Alt and nothing in the chain selected, jump straight to
  // the leaf so users always have a fast path to the deepest object.
  const hitForClick = (wx: number, wy: number, alt: boolean): string | null => {
    const leaf = hitLeaf(wx, wy);
    if (leaf === null) return null;
    const chain = ancestorChain(leaf);
    if (!alt) return chain[0];
    const sel = selRef.current.get();
    for (let i = chain.length - 1; i >= 0; i--) {
      if (sel.includes(chain[i])) {
        return chain[Math.min(i + 1, chain.length - 1)];
      }
    }
    return chain[chain.length - 1];
  };

  // Custom scene layer — the standard scene slot calls drawOne with TPose,
  // but our TPose is local while we render in world coords. Painting in a
  // single custom layer lets us hide overlay-driven ids and use overlay
  // world poses where present.
  const sceneLayer: RenderLayer<unknown> = {
    id: 'scene', label: 'Scene',
    draw: (cx) => {
      const overlay = move.overlay;
      const hide = new Set(overlay?.hideIds ?? []);
      // Render parents first so children sit on top.
      const order = [...nodesRef.current].sort((a, b) => Number(!!b.isGroup) - Number(!!a.isGroup));
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
      const overlay = move.overlay;
      if (!overlay) return;
      cx.globalAlpha = 0.7;
      for (const [id, p] of overlay.poses) {
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

  // Selection overlay reads world poses via worldPoseLookup so the outline
  // tracks ancestor moves correctly. The live ghost is rendered by the
  // move tool's own overlay channel (via `ghostLayer` reading `move.overlay`),
  // so the selection chrome stays committed-state-only.
  const selectionPoseLookup = worldPoseLookup(adapter, composeRectPose<Pose>);

  // Custom move tool — wraps the cascade-aware `useMove` controller. We can't
  // use `useSelectTool` here because the kit's bundled move/area-select
  // semantics don't know about nested-group hit resolution (clicks on group
  // bodies should resolve to the outermost group, and the area-select adapter
  // hooks aren't wired). Routing pointer/drag events here keeps the existing
  // `useMove` cascade behaviour and lets the demo's custom layers keep
  // reading `move.overlay` for hide-ids and ghost rendering.
  const moveRef = useRef(move);
  moveRef.current = move;
  const hitRef = useRef(hitForClick);
  hitRef.current = hitForClick;
  const moveTool = useMemo(() => defineTool<{ ids: string[] | null }>({
    id: 'move',
    cursor: 'default',
    initScratch: () => ({ ids: null }),
    pointer: {
      onDown: (_e, ctx) => {
        const id = hitRef.current(ctx.worldX, ctx.worldY, ctx.modifiers.alt);
        if (id === null) {
          ctx.selection.set([]);
          ctx.scratch = { ids: null };
          return 'claim';
        }
        ctx.selection.applyClick(id, ctx.modifiers);
        const sel = ctx.selection.current;
        ctx.scratch = { ids: sel.length > 0 ? sel : [id] };
        return 'claim';
      },
    },
    drag: {
      onStart: (e, ctx) => {
        const ids = ctx.scratch.ids;
        if (!ids || ids.length === 0) return 'pass';
        moveRef.current.start({
          ids, worldX: ctx.worldX, worldY: ctx.worldY,
          clientX: e.clientX, clientY: e.clientY,
        });
        return 'claim';
      },
      onMove: (e, ctx) => {
        if (!ctx.scratch.ids) return 'pass';
        moveRef.current.move({
          worldX: ctx.worldX, worldY: ctx.worldY,
          clientX: e.clientX, clientY: e.clientY,
          modifiers: ctx.modifiers,
        });
        return 'claim';
      },
      onEnd: (_e, ctx) => {
        if (!ctx.scratch.ids) return 'pass';
        moveRef.current.end();
        return 'claim';
      },
      onCancel: (ctx) => {
        if (!ctx.scratch.ids) return;
        moveRef.current.cancel();
      },
    },
  }), []);

  const tools = useTools({ active: 'move', registry: { move: moveTool } });

  return (
    <Canvas
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      tools={tools}
      hitBody={hitBody}
      gestures={{ undoRedo: { adapter: history } }}
      layers={{
        scene: null,
        'scene-custom': { layer: sceneLayer, before: 'selectionOverlay' },
        'ghost': { layer: ghostLayer, before: 'selectionOverlay' },
        selectionOverlay: {
          handles: { size: 0 },
          poseById: (id) => selectionPoseLookup(id),
        },
      }}
    />
  );
}

export const NESTED_GROUPS_DEMO_SOURCE = `// --- Scene with real parent/child hierarchy (LOCAL poses) ---
interface Node {
  id; parent: string | null;
  pose: { x; y; width; height };
  color; isGroup?: boolean;
}

// Adapter exposes getChildren so the kit can walk the hierarchy for
// cascade + ungroup. Poses are LOCAL — relative to the direct parent.
const adapter = {
  getObject, getPose, getParent, getChildren,
  getSelection, setSelection,
  setPose, setParent, insertObject, removeObject,
  applyBatch: (ops, label) => history.applyBatch(ops, label),
};

const composeOpts = { composePose: composeRectPose, decomposePose: decomposeRectPose };

// Move with auto-cascade: descendants visually follow the dragged parent.
const move = useMove(adapter, {
  cascadeWorldPose: worldPoseLookup(adapter, composeRectPose),
});

// Group / ungroup actions (Mod+G, Mod+Shift+G).
useNestedGroup(adapter, { ...composeOpts, bindKeyboard: true,
  groupFactory: ({ id, localPose }) => ({ id, parent: null, pose: localPose, color: '#3a2e22', isGroup: true }),
});
useNestedUngroup(adapter, { ...composeOpts, bindKeyboard: true,
  isGroup: (_id, obj) => obj?.isGroup === true,
});

// Custom move tool wraps the cascade-aware controller. useSelectTool can't
// be used here because of the bespoke top-level group hit resolution; this
// inline tool routes pointer/drag through the move controller and lets the
// custom scene/ghost layers keep reading move.overlay.
const moveTool = defineTool({
  id: 'move', cursor: 'default',
  initScratch: () => ({ ids: null }),
  pointer: { onDown: (_e, ctx) => { /* hitBody → selection.applyClick → scratch.ids */ } },
  drag: {
    onStart: (e, ctx) => move.start({ ids: ctx.scratch.ids, ... }),
    onMove:  (e, ctx) => move.move({ ... }),
    onEnd:   (_e, ctx) => move.end(),
    onCancel: (ctx) => move.cancel(),
  },
});
const tools = useTools({ active: 'move', registry: { move: moveTool } });

return (
  <Canvas
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    tools={tools}
    hitBody={hitBody}        // chrome hit-test: outermost group
    /* the move tool uses an alt-aware variant in pointer.onDown that
       drills one level deeper per Alt-click (group → subgroup → leaf) */
    gestures={{ undoRedo: { adapter: history } }}
    layers={{
      scene: null,
      'scene-custom': { layer: sceneLayer, before: 'selectionOverlay' },
      'ghost':        { layer: ghostLayer, before: 'selectionOverlay' },
      selectionOverlay: {
        handles: { size: 0 },
        poseById: (id) => worldPoseLookup(adapter, composeRectPose)(id),
      },
    }}
  />
);
`;
