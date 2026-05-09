import { useMemo, useRef, useState } from 'react';
import {
  Canvas,
  nestedGroupHitTester,
  useNestedGroup,
  useNestedUngroup,
  useSelectTool,
  useSelection,
  useTools,
  createHistory,
  composeRectPose,
  decomposeRectPose,
  worldPoseLookup,
} from '@orochi235/weasel';
import type { MoveAdapter, Op, SelectionApi } from '@orochi235/weasel';
import { useBackend } from '../BackendContext';

interface Node {
  id: string;
  parent: string | null;
  pose: { x: number; y: number; width: number; height: number };
  color: string;
  isGroup?: boolean;
}
type Pose = Node['pose'];

const W = 480, H = 320;
// g1 contains g2 (a sub-group) + a free leaf `a`; g2 in turn contains
// b1, b2. Two free leaves (c, d) sit alongside for ad-hoc grouping with
// Cmd+G. The data path supports arbitrary depth.
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
  const backend = useBackend();
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
    setParent: (id: string, parent: string | null) => adapterRef.current.setParent!(id, parent),
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
    applyOps: (ops: Op[]) => history.applyBatch(ops, 'select'),
    hitTestArea: (rect: Pose) =>
      nodesRef.current
        .filter((n) => {
          const w = worldPoseOfRef.current(n.id);
          if (!w) return false;
          return w.x < rect.x + rect.width && w.x + w.width > rect.x &&
                 w.y < rect.y + rect.height && w.y + w.height > rect.y;
        })
        .map((n) => n.id),
  };
  adapterRef.current = adapter;

  const composeOpts = { composePose: composeRectPose<Pose>, decomposePose: decomposeRectPose<Pose> };

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

  // Nested-group hit resolution lives in the kit. `pickOutermost` is the
  // chrome-level body hit (casual click → whole top-level group).
  // `pickBest` is the alt-aware variant the select tool consults: without
  // Alt → outermost ancestor; with Alt → one level deeper per click,
  // drilling group → subgroup → leaf.
  const hitter = useMemo(
    () => nestedGroupHitTester(adapter, {
      composePose: composeRectPose<Pose>,
      isGroup: (_id, obj) => obj?.isGroup === true,
    }),
    // adapter is rebuilt every render but reads via nodesRef — closures stay live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // World-pose lookup composes a node's pose by walking its parent chain.
  // Used both as the scene's `toPose` (so we render committed nodes in
  // world space) and as the selection-overlay `poseById` (so the outline
  // tracks ancestor moves). Live overlay poses during a cascade drag flow
  // through the select tool's `previewPose`.
  const worldPoseOf = useMemo(
    () => worldPoseLookup(adapter, composeRectPose<Pose>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const worldPoseOfRef = useRef(worldPoseOf);
  worldPoseOfRef.current = worldPoseOf;

  const select = useSelectTool<Node, Pose>(adapter, {
    pickEvery: () => [], // unused — pickBest takes over the body branch
    pickBest: (wx, wy, alt, sel) => hitter.pickBest(wx, wy, alt, sel),
    boundsOf: (id) => worldPoseOf(id),
    drawGhost: (cx, _o, p) => {
      cx.fillStyle = 'rgba(127, 176, 105, 0.35)';
      cx.fillRect(p.x, p.y, p.width, p.height);
    },
    getObject: (id) => adapter.getObject(id) ?? null,
    move: { cascadeWorldPose: worldPoseOf },
  });
  const tools = useTools({ active: 'select', registry: { select } });

  return (
    <Canvas
backend={backend}
            width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      tools={tools}
      pickEvery={hitter.pickOutermost}
      gestures={{ undoRedo: { adapter: history } }}
      layers={{
        scene: {
          // Render every node at its world pose. The select tool's previewPose
          // replaces this with the live overlay during a cascade drag, and
          // previewIds suppresses dragged + descendant ids whose ghosts sit
          // in the overlay.
          toPose: (n) => worldPoseOf(n.id) ?? n.pose,
          drawOne: (cx, n, p) => {
            if (n.isGroup) {
              cx.fillStyle = n.color; cx.globalAlpha = 0.35;
              cx.fillRect(p.x, p.y, p.width, p.height); cx.globalAlpha = 1;
              cx.strokeStyle = '#5a4a38'; cx.setLineDash([4, 3]);
              cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1); cx.setLineDash([]);
            } else {
              cx.fillStyle = n.color;
              cx.fillRect(p.x, p.y, p.width, p.height);
            }
          },
        },
        selectionOverlay: {
          handles: { size: 0 },
          poseById: (id) => worldPoseOf(id),
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

// Group / ungroup actions (Mod+G, Mod+Shift+G).
useNestedGroup(adapter, { ...composeOpts, bindKeyboard: true,
  groupFactory: ({ id, localPose }) => ({ id, parent: null, pose: localPose, color: '#3a2e22', isGroup: true }),
});
useNestedUngroup(adapter, { ...composeOpts, bindKeyboard: true,
  isGroup: (_id, obj) => obj?.isGroup === true,
});

// Nested-group hit resolution lives in the kit. pickOutermost is the
// chrome-level body hit; pickBest is the alt-aware variant the select tool
// consults (drills one level per Alt-click: group → subgroup → leaf).
const hitter = nestedGroupHitTester(adapter, {
  composePose: composeRectPose,
  isGroup: (_id, obj) => obj?.isGroup === true,
});

// World-pose composition — used both as the scene's toPose and as the
// move tool's cascadeWorldPose so descendants follow their dragged ancestor.
const worldPoseOf = worldPoseLookup(adapter, composeRectPose);

// useSelectTool drives both pick and cascade-aware move. previewIds
// (auto-exposed) suppresses committed-pose render of dragged ids during
// a gesture; previewPose feeds overlay world poses into the scene.
const select = useSelectTool(adapter, {
  pickEvery: () => [],                  // unused — pickBest covers the body branch
  pickBest:  hitter.pickBest,
  boundsOf:  (id) => worldPoseOf(id),
  drawGhost,
  getObject: (id) => adapter.getObject(id),
  move: { cascadeWorldPose: worldPoseOf },
});
const tools = useTools({ active: 'select', registry: { select } });

return (
  <Canvas
    adapter={adapter}
    selection={selection}
    tools={tools}
    pickEvery={hitter.pickOutermost}      // chrome hit-test: outermost group
    gestures={{ undoRedo: { adapter: history } }}
    layers={{
      scene: {
        toPose:  (n) => worldPoseOf(n.id) ?? n.pose,
        drawOne: (cx, n, world) => { /* ...render at world coords... */ },
      },
      selectionOverlay: {
        handles: { size: 0 },
        poseById: (id) => worldPoseOf(id),
      },
    }}
  />
);
`;
