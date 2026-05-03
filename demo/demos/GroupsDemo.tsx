import { useRef, useState } from 'react';
import {
  arrayAdapter,
  resolveToOutermostGroup,
  expandToLeaves,
  composeSelectionPose,
  Canvas,
  useSelection,
  useGroup,
  useUngroup,
} from '@orochi235/weasel';
import type {
  Group,
  GroupAdapter,
  MoveAdapter,
  ResizeAdapter,
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

  // Adapter shares selection with <Canvas> via useSelection so Cmd-G / Cmd-Shift-G
  // see the same ids as click-to-select.
  const baseAdapter = arrayAdapter<Rect, Pose>({
    ref: rectsRef,
    setItems: setRects,
    toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
  });
  const adapter: Adapter = {
    ...baseAdapter,
    ...selection.adapterMethods,
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

  useGroup(adapter, { bindKeyboard: true });
  useUngroup(adapter, { bindKeyboard: true });

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

  const boundsOf = (id: string): Pose | null => {
    return adapter.getGroup(id) ? groupBounds(id) : adapter.getPose(id);
  };

  const hitBody = (wx: number, wy: number): string | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (wx >= r.x && wx <= r.x + r.width && wy >= r.y && wy <= r.y + r.height) {
        return resolveToOutermostGroup(r.id, adapter);
      }
    }
    return null;
  };

  return (
    <Canvas<Rect, Pose>
      width={W}
      height={H}
      className="ckd-canvas"
      adapter={adapter}
      selection={selection}
      moveOptions={{ expandIds: (ids) => expandToLeaves(ids, adapter) }}
      resizeOptions={{
        expandIds: (ids) => {
          if (ids.length === 1 && adapter.getGroup(ids[0]) === undefined) return ids;
          return expandToLeaves(ids, adapter);
        },
      }}
      hitBody={hitBody}
      boundsOf={boundsOf}
      handleHitRadius={HANDLE}
      layers={{
        scene: {
          drawOne: (cx, r, p) => {
            cx.fillStyle = r.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: {
          groupAdapter: adapter,
          handles: { size: HANDLE },
          // Pose lookup composes move/resize overlays + the group-aware union
          // AABB, matching what composeSelectionPose offers. Required because
          // the auto-wired pose lookup goes through boundsOf which already
          // returns rect AABBs but doesn't know about overlay state for
          // per-leaf resize.
          poseById: composeSelectionPose<Pose>({
            getStoredPose: (id) => {
              const r = rects.find((x) => x.id === id);
              return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : ({} as Pose);
            },
            groupAdapter: adapter,
          }),
        },
      }}
    />
  );
}

export const GROUPS_DEMO_SOURCE = `// --- Scene (your app owns this) ---
interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
interface Pose { x: number; y: number; width: number; height: number }

const [rects, setRects]   = useState<Rect[]>(INITIAL_RECTS);
const [groups, setGroups] = useState<Group[]>([{ id: 'g1', members: ['a', 'b', 'c'] }]);
const selection = useSelection();

// --- Adapter implements MoveAdapter & ResizeAdapter & GroupAdapter ---
const adapter: Adapter = {
  ...arrayAdapter({...}),
  ...selection.adapterMethods,
  // GroupAdapter methods (getGroup, addToGroup, removeFromGroup, ...)
};

// Cmd-G / Cmd-Shift-G group/ungroup the current selection (virtual groups).
useGroup(adapter, { bindKeyboard: true });
useUngroup(adapter, { bindKeyboard: true });

// hitBody resolves leaf hits to their outermost group so click-to-select
// grabs the whole group. boundsOf computes group bounds for resize handles.
const hitBody = (wx, wy) => {
  const leaf = leafHit(wx, wy);
  return leaf ? resolveToOutermostGroup(leaf.id, adapter) : null;
};
const boundsOf = (id) =>
  adapter.getGroup(id) ? groupBounds(id) : adapter.getPose(id);

// <Canvas> wires its internal move/resize via {move,resize}Options and uses
// the layers map to drive rendering. The selection overlay's poseById uses
// composeSelectionPose for group-aware union AABB resolution.
return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    moveOptions={{ expandIds: (ids) => expandToLeaves(ids, adapter) }}
    resizeOptions={{ expandIds: (ids) => /* leaf-or-group */ }}
    hitBody={hitBody}
    boundsOf={boundsOf}
    handleHitRadius={HANDLE}
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      selectionOverlay: {
        groupAdapter: adapter,
        handles: { size: HANDLE },
        poseById: composeSelectionPose({...}),
      },
    }}
  />
);
`;
