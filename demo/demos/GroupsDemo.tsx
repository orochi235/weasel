import { useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  resolveToOutermostGroup,
  expandToLeaves,
  composeSelectionPose,
  SceneCanvas,
  useScene,
  useSceneAdapter,
  useSelection,
  useGroup,
  useUngroup,
  useSelectTool,
  useResizeTool,
  useRotateTool,
  useTools,
  useResizePolicy,
} from '@orochi235/weasel';
import type { Group } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
const INITIAL_RECTS: Rect[] = [
  { id: 'a', x: 60,  y: 60,  width: 60, height: 50, color: '#7fb069' },
  { id: 'b', x: 140, y: 90,  width: 70, height: 60, color: '#7fb069' },
  { id: 'c', x: 100, y: 170, width: 80, height: 50, color: '#7fb069' },
  { id: 'd', x: 270, y: 130, width: 60, height: 60, color: '#d4a574' },
];
const INITIAL_GROUP: Group = { id: 'g1', members: ['a', 'b', 'c'] };

export function GroupsDemo() {
  const scene = useScene<Rect, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL_RECTS.map((r) => ({
      kind: 'leaf' as const,
      layer: 'default' as const,
      id: asNodeId(r.id),
      pose: { x: r.x, y: r.y, width: r.width, height: r.height },
      data: r,
      parent: null,
    })),
  });
  const selection = useSelection();

  // Lasso-style groups live in parallel React state — independent of scene
  // parenting. The group adapter wraps the kit's scene adapter with the
  // four group-mutation methods useGroup / useUngroup need.
  const [groups, setGroups] = useState<Group[]>([INITIAL_GROUP]);
  const groupsRef = useRef(groups); groupsRef.current = groups;

  const sceneAdapter = useSceneAdapter(scene, { selection });
  const adapter = useMemo(() => ({
    ...sceneAdapter,
    // useGroup / useUngroup want branded NodeId[]; sceneAdapter exposes the
    // looser string[] form. Re-publish through the selection api.
    getSelection: (): import('@orochi235/weasel').NodeId[] => [...selection.current],
    getGroup: (id: string) => groupsRef.current.find((g) => g.id === id),
    getGroupsForMember: (id: string) =>
      groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g: Group) => setGroups((gs) => [...gs, g]),
    removeGroup: (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id)),
    addToGroup: (gid: string, ids: string[]) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: [...g.members, ...ids] } : g))),
    removeFromGroup: (gid: string, ids: string[]) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: g.members.filter((m) => !ids.includes(m)) } : g))),
    // sceneAdapter.getNode / getNodes return Node objects; select/resize/rotate
    // tools want the per-node TData (Rect) for drawGhost / hit-test payloads.
    getNode: (id: string): Rect | undefined => {
      const n = scene.get(asNodeId(id));
      return n ? n.data : undefined;
    },
    getNodes: (): Rect[] => {
      const out: Rect[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n) out.push(n.data);
      }
      return out;
    },
  }), [sceneAdapter, scene, selection]);

  useGroup(adapter);
  useUngroup(adapter);

  const groupBounds = (groupId: string): Pose | null => {
    const leaves = expandToLeaves([groupId], adapter);
    if (leaves.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const lid of leaves) {
      const n = scene.get(asNodeId(lid));
      if (!n) continue;
      const r = n.pose as Pose;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.width > maxX) maxX = r.x + r.width;
      if (r.y + r.height > maxY) maxY = r.y + r.height;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const boundsOf = (id: string): Pose | null => {
    return adapter.getGroup(id) ? groupBounds(id) : (sceneAdapter.getPose(id) as Pose | null);
  };

  const pickOne = (wx: number, wy: number): string | null => {
    const order = [...scene.renderOrder()];
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const n = scene.get(id);
      if (!n) continue;
      const r = n.pose as Pose;
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
        return resolveToOutermostGroup(id, adapter);
      }
    }
    return null;
  };

  const getNode = (id: string): Rect | null => {
    const n = scene.get(asNodeId(id));
    return n ? n.data : null;
  };

  const select = useSelectTool<Rect, Pose>(adapter, {
    pickEvery: (wx, wy) => {
      const id = pickOne(wx, wy);
      return id ? [id] : [];
    },
    boundsOf,
    move: { expandIds: (ids: string[]) => expandToLeaves(ids, adapter) },
    drawGhost: (rect, pose): DrawCommand[] => rect == null ? [] : [{
      kind: 'path',
      path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
      fill: { color: rect.color },
    }],
    getNode,
  });
  const expandResizeIds = (ids: string[]) => {
    if (ids.length === 1 && adapter.getGroup(ids[0]) === undefined) return ids;
    return expandToLeaves(ids, adapter);
  };
  const resizeTool = useResizeTool<Rect, Pose>(adapter, {
    resize: { expandIds: expandResizeIds },
    boundsOf,
    getSelection: () => selection.current,
    poseBounds: (p) => p,
    getNode,
  });
  // Mirror `expandIds` through the dispatcher-path `resizePolicy` dep
  // so the dispatcher's resize action group-expands identically.
  function ResizePolicyBridge() {
    useResizePolicy<Pose>({ expandIds: expandResizeIds });
    return null;
  }
  const rotateTool = useRotateTool<Rect, Pose>(adapter, {
    boundsOf,
    getSelection: () => [...selection.current],
    getNode,
  });
  const tools = useTools({
    active: 'select',
    registry: { select },
    ambient: [resizeTool, rotateTool],
  });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      tools={tools}
      geometry={{
        pickEvery: pickOne,
        boundsOf,
      }}
      layers={{
        selectionOverlay: {
          groupAdapter: adapter,
          // Pose lookup composes move/resize overlays + the group-aware union
          // AABB, matching what composeSelectionPose offers. Required because
          // the auto-wired pose lookup goes through boundsOf which already
          // returns rect AABBs but doesn't know about overlay state for
          // per-leaf resize.
          poseById: composeSelectionPose<Pose>({
            getStoredPose: (id) => {
              const n = scene.get(asNodeId(id));
              const p = n?.pose as Pose | undefined;
              return p ? { x: p.x, y: p.y, width: p.width, height: p.height } : ({} as Pose);
            },
            groupAdapter: adapter,
          }),
        },
      }}
    >
      <ResizePolicyBridge />
    </SceneCanvas>
  );
}
