import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  useMove,
  useNestedGroup,
  useNestedUngroup,
  useSelection,
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
const INITIAL: Node[] = [
  { id: 'g1',  parent: null, pose: { x: 60, y: 60, width: 180, height: 110 }, color: '#3a2e22', isGroup: true },
  { id: 'a',   parent: 'g1', pose: { x: 10, y: 10, width: 70,  height: 50  }, color: '#7fb069' },
  { id: 'b',   parent: 'g1', pose: { x: 95, y: 45, width: 70,  height: 50  }, color: '#7fb069' },
  { id: 'c',   parent: null, pose: { x: 300, y: 110, width: 90, height: 60 }, color: '#d4a574' },
  { id: 'd',   parent: null, pose: { x: 200, y: 220, width: 70, height: 50 }, color: '#a48bd4' },
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
  const move = useMove<Node, Pose>(adapter, {
    cascadeWorldPose: worldPoseLookup(adapter, composeRectPose<Pose>),
  });

  useNestedGroup<Node, Pose>(adapter, {
    ...composeOpts,
    bindKeyboard: true,
    groupFactory: ({ id, localPose }) => ({
      id, parent: null, pose: localPose, color: '#3a2e22', isGroup: true,
    }),
  });
  useNestedUngroup<Node, Pose>(adapter, {
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

  const resolveTopLevel = (id: string): string => {
    let cur = id;
    while (true) {
      const p = adapter.getParent(cur);
      if (p === null) return cur;
      cur = p;
    }
  };

  // Hit-test: top-down on world bounds, skipping groups so a click in empty
  // group area is a miss. Hits resolve to the outermost group so a click
  // anywhere inside a group selects (and drags) the whole tree.
  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]; if (n.isGroup) continue;
      const w = worldPoseOf(n.id); if (!w) continue;
      if (wx >= w.x && wx <= w.x + w.width && wy >= w.y && wy <= w.y + w.height) {
        return resolveTopLevel(n.id);
      }
    }
    return null;
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
  // tracks ancestor moves correctly.
  const selectionPoseLookup = worldPoseLookup(adapter, composeRectPose<Pose>);

  return (
    <Canvas<Node, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      move={move}
      hitBody={hitBody}
      gestures={{ undoRedo: { adapter: history } }}
      layers={{
        scene: null,
        'scene-custom': { layer: sceneLayer, before: 'selectionOverlay' },
        'ghost': { layer: ghostLayer, before: 'selectionOverlay' },
        selectionOverlay: {
          handles: { size: 0 },
          // During a drag the move overlay carries the live world pose; fall
          // back to the world-pose composition for committed nodes.
          poseById: (id) => move.overlay?.poses.get(id) ?? selectionPoseLookup(id),
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

// <Canvas> owns the render loop, focus, dpr, selection, and undo wiring;
// we still own the custom move controller (needs cascadeWorldPose) and the
// custom layers (TPose is local so the standard scene drawOne can't be
// used directly — paint via a custom layer that walks ancestors).
return (
  <Canvas<Node, Pose>
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    move={move}
    hitBody={hitBody}        // skip groups, resolve top-level
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
