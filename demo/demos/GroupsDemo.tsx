import { useMemo, useRef, useState } from 'react';
import {
  arrayAdapter,
  useMove,
  useResize,
  useSelection,
  resolveToOutermostGroup,
  expandToLeaves,
  composeSelectionPose,
  createSelectionOverlayLayer,
  Canvas,
} from '@orochi235/weasel';
import type {
  Group,
  GroupAdapter,
  MoveAdapter,
  ResizeAdapter,
  RenderLayer,
} from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300, HANDLE = 8;
const INITIAL_RECTS: Rect[] = [
  { id: 'a', x: 60,  y: 60,  width: 60, height: 50, color: '#7fb069' },
  { id: 'b', x: 140, y: 90,  width: 70, height: 60, color: '#7fb069' },
  { id: 'c', x: 100, y: 170, width: 80, height: 50, color: '#7fb069' },
  { id: 'd', x: 270, y: 130, width: 60, height: 60, color: '#d4a574' },
];
const INITIAL_GROUP: Group = { id: 'g1', members: ['a', 'b', 'c'] };

type Adapter = MoveAdapter<Rect, Pose> & ResizeAdapter<Rect, Pose> & GroupAdapter & {
  getSelection: () => string[];
  setSelection: (ids: string[]) => void;
};

export function GroupsDemo() {
  const [rects, setRects] = useState<Rect[]>(INITIAL_RECTS);
  const [groups, setGroups] = useState<Group[]>([INITIAL_GROUP]);
  const rectsRef = useRef(rects); rectsRef.current = rects;
  const groupsRef = useRef(groups); groupsRef.current = groups;

  const selection = useSelection();

  const adapter: Adapter = {
    ...arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    }),
    ...selection.adapterMethods,
    // GroupAdapter
    getGroup: (id) => groupsRef.current.find((g) => g.id === id),
    getGroupsForMember: (id) =>
      groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g) => setGroups((gs) => [...gs, g]),
    removeGroup: (id) => setGroups((gs) => gs.filter((g) => g.id !== id)),
    addToGroup: (gid, ids) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: [...g.members, ...ids] } : g))),
    removeFromGroup: (gid, ids) =>
      setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, members: g.members.filter((m) => !ids.includes(m)) } : g))),
  };

  // Group-aware move: when a group id is in the dragged set, expand to leaves.
  const move = useMove<Rect, Pose>(adapter, {
    expandIds: (ids) => expandToLeaves(ids, adapter),
  });
  const resize = useResize<Rect, Pose>(adapter, {
    expandIds: (ids) => {
      const leaves = expandToLeaves(ids, adapter);
      if (ids.length === 1 && adapter.getGroup(ids[0]) === undefined) return ids;
      return leaves;
    },
  });

  // Compute group bounds for hit-testing the group's resize handles.
  const groupBounds = (groupId: string): Pose | null => {
    const leaves = expandToLeaves([groupId], adapter);
    if (leaves.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const lid of leaves) {
      const r = rectsRef.current.find((x) => x.id === lid);
      if (!r) continue;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.width > maxX) maxX = r.x + r.width;
      if (r.y + r.height > maxY) maxY = r.y + r.height;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  // bounds for the currently-selected id (group or leaf), for resize handles.
  const boundsOf = (id: string): Pose | null => {
    return adapter.getGroup(id) ? groupBounds(id) : adapter.getPose(id);
  };

  // hitBody: walk leaves top-down, then resolve to outermost group.
  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
        return resolveToOutermostGroup(r.id, adapter);
      }
    }
    return null;
  };

  const moveOv = move.overlay;
  const resizeOv = resize.overlay;
  const selectedIds = selection.current;

  const layers = useMemo<RenderLayer<unknown>[]>(() => {
    const byId = (id: string) => rects.find((r) => r.id === id);

    const resolvePose = composeSelectionPose<Pose>({
      moveOverlay: moveOv,
      resizeOverlay: resizeOv,
      getStoredPose: (id) => {
        const r = byId(id)!;
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      },
      groupAdapter: adapter,
    });

    const baseLayer: RenderLayer<unknown> = {
      id: 'base', label: 'Base',
      draw: (cx) => {
        const hide = new Set(moveOv?.hideIds ?? []);
        for (const r of rects) {
          if (hide.has(r.id)) continue;
          const leafResize = resizeOv?.leafPoses?.get(r.id);
          const p = leafResize ?? r;
          cx.fillStyle = r.color;
          cx.fillRect(p.x, p.y, p.width, p.height);
        }
      },
    };

    const ghostLayer: RenderLayer<unknown> = {
      id: 'ghost', label: 'Ghost',
      draw: (cx) => {
        if (!moveOv) return;
        cx.globalAlpha = 0.85;
        for (const id of moveOv.draggedIds) {
          const p = moveOv.poses.get(id);
          const src = byId(id);
          if (!p || !src) continue;
          cx.fillStyle = src.color;
          cx.fillRect(p.x, p.y, p.width, p.height);
        }
        cx.globalAlpha = 1;
      },
    };

    const selectionLayer = createSelectionOverlayLayer<Pose>({
      getSelection: () => selectedIds,
      getPose: (id) => (byId(id) ? resolvePose(id) : null),
      groupAdapter: adapter,
      handles: { size: HANDLE },
    });

    return [baseLayer, ghostLayer, selectionLayer];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rects, selectedIds, moveOv, resizeOv]);

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

export const GROUPS_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects]   = useState<Rect[]>(INITIAL_RECTS);
const [groups, setGroups] = useState<Group[]>([{ id: 'g1', members: ['a', 'b', 'c'] }]);
const selection           = useSelection();

// --- Adapter implements MoveAdapter & ResizeAdapter & GroupAdapter ---
const adapter: Adapter = {
  ...arrayAdapter({...}),
  ...selection.adapterMethods,         // satisfies the action-adapter contract
  // GroupAdapter methods (getGroup, addToGroup, removeFromGroup, ...)
};

const move = useMove<Rect, Pose>(adapter, {
  expandIds: (ids) => expandToLeaves(ids, adapter),
});
const resize = useResize<Rect, Pose>(adapter, {
  expandIds: (ids) => {
    if (ids.length === 1 && adapter.getGroup(ids[0]) === undefined) return ids;
    return expandToLeaves(ids, adapter);
  },
});

// hitBody resolves leaf hits to their outermost group so click-to-select
// grabs the whole group. <Canvas>'s promote-then-drag handles the rest.
const hitBody = (wx, wy) => {
  const leaf = leafHit(wx, wy);
  return leaf ? resolveToOutermostGroup(leaf.id, adapter) : null;
};

// boundsOf computes group bounds for resize-handle hit-testing.
const boundsOf = (id) =>
  adapter.getGroup(id) ? groupBounds(id) : adapter.getPose(id);

return (
  <Canvas
    width={W} height={H}
    layers={layers}
    move={move} resize={resize}
    hitBody={hitBody}
    selection={selection}
    boundsOf={boundsOf}
    handleHitRadius={HANDLE}
  />
);
`;
