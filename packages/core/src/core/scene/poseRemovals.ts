/**
 * The removal half of a scene's pose-write report: each node a change takes
 * off screen, read as it was shown just before it went.
 */
import type { PoseRemoval, PoseWrite, RemovedNode } from './poseWrites';
import type { NodeId } from './types';

interface Parented { id: NodeId; parent: NodeId | null }

export interface RemovalLog<TPose, TNode> {
  /** Read what removing `roots` and their descendants among `nodes` takes off
   *  screen, before the removal runs; the returned call records it once it
   *  has. A node `pending` holds as added by this change is dropped from it
   *  and goes unreported. Each node's `pose` is the one it stores. */
  seeOff(
    roots: readonly Parented[],
    nodes: readonly (Parented & { pose: TPose })[],
    how: Pick<PoseRemoval<TPose, TNode>, 'origin' | 'label'>,
    pending: Map<NodeId, PoseWrite<TPose>>,
  ): () => void;
  /** Forget `id`'s removal — it is back — and answer the pose it stored before this change. */
  takeBack(id: NodeId): TPose | undefined;
  /** The removals since the last drain, a child removed with its parent
   *  carried beneath it. */
  drain(): PoseRemoval<TPose, TNode>[];
  /** Whether any removal waits for a drain. */
  held(): boolean;
}

/** A removed node while its change runs: `up` is the removal it rides
 *  beneath, if any, and `how` stamps it should it become a root. */
interface Gone<TPose, TNode> {
  id: NodeId;
  parent: NodeId | null;
  node: TNode;
  pose: TPose;
  /** The pose it stored before this change, override left out. */
  before: TPose;
  children: Gone<TPose, TNode>[];
  up: Gone<TPose, TNode> | undefined;
  how: Pick<PoseRemoval<TPose, TNode>, 'origin' | 'label'>;
}

function asRemoved<TPose, TNode>(g: Gone<TPose, TNode>): RemovedNode<TPose, TNode> {
  return { node: g.node, pose: g.pose, children: g.children.map(asRemoved) };
}

export function createRemovalLog<TPose, TNode>(
  shown: (id: NodeId) => { node: TNode; pose: TPose } | undefined,
): RemovalLog<TPose, TNode> {
  /** Each removal's root, and every node removed, root or nested. */
  const roots = new Map<NodeId, Gone<TPose, TNode>>();
  const gone = new Map<NodeId, Gone<TPose, TNode>>();

  function asRoot(g: Gone<TPose, TNode>): void {
    g.up = undefined;
    roots.set(g.id, g);
  }

  return {
    seeOff(removedRoots, nodes, how, pending) {
      const under = new Map<NodeId | null, Parented[]>();
      const stored = new Map<NodeId, TPose>();
      for (const n of nodes) {
        stored.set(n.id, n.pose);
        const list = under.get(n.parent);
        if (list) list.push(n);
        else under.set(n.parent, [n]);
      }
      const see = (n: Parented): Gone<TPose, TNode> | null => {
        const s = shown(n.id);
        if (!s) return null;
        const before = pending.get(n.id)?.from ?? stored.get(n.id) ?? s.pose;
        const g: Gone<TPose, TNode> = { id: n.id, parent: n.parent, node: s.node, pose: s.pose, before, children: [], up: undefined, how };
        for (const c of under.get(n.id) ?? []) {
          const child = see(c);
          if (child) g.children.push(child);
        }
        return g;
      };
      const seen = removedRoots.map(see).filter((g) => g !== null);
      return () => {
        const added = new Set<NodeId>();
        for (const n of nodes) {
          const w = pending.get(n.id);
          if (w && w.from === undefined) added.add(n.id);
          pending.delete(n.id);
        }
        // A node this change added goes unreported; what it held rides on in its place.
        const keep = (g: Gone<TPose, TNode>): Gone<TPose, TNode>[] => {
          const kids = g.children.flatMap(keep);
          if (added.has(g.id)) {
            for (const k of kids) k.parent = g.parent;
            return kids;
          }
          g.children = kids;
          for (const k of kids) k.up = g;
          gone.set(g.id, g);
          return [g];
        };
        for (const g of seen.flatMap(keep)) asRoot(g);
      };
    },
    takeBack(id) {
      const g = gone.get(id);
      if (!g) return undefined;
      gone.delete(id);
      if (g.up) g.up.children.splice(g.up.children.indexOf(g), 1);
      else roots.delete(id);
      // What it took along and is not back yet is still removed, now from it.
      for (const c of g.children) asRoot(c);
      return g.before;
    },
    drain() {
      if (roots.size === 0) return [];
      // Undoing a group's add takes its children first, each its own root.
      const out: PoseRemoval<TPose, TNode>[] = [];
      for (const r of roots.values()) {
        const up = r.parent !== null ? gone.get(r.parent) : undefined;
        if (up) up.children.push(r);
      }
      for (const r of roots.values()) {
        if (r.parent !== null && gone.has(r.parent)) continue;
        out.push({ id: r.id, parent: r.parent, ...asRemoved(r), ...r.how });
      }
      roots.clear();
      gone.clear();
      return out;
    },
    held: () => roots.size > 0,
  };
}
