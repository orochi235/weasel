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
   *  and goes unreported. */
  seeOff(
    roots: readonly Parented[],
    nodes: readonly Parented[],
    how: Pick<PoseRemoval<TPose, TNode>, 'origin' | 'label'>,
    pending: Map<NodeId, PoseWrite<TPose>>,
  ): () => void;
  /** Forget `id`'s removal — it is back — and answer where it was shown. */
  takeBack(id: NodeId): TPose | undefined;
  /** The removals since the last drain, a child removed with its parent
   *  carried beneath it. */
  drain(): PoseRemoval<TPose, TNode>[];
}

export function createRemovalLog<TPose, TNode>(
  shown: (id: NodeId) => { node: TNode; pose: TPose } | undefined,
): RemovalLog<TPose, TNode> {
  const removals = new Map<NodeId, PoseRemoval<TPose, TNode>>();
  return {
    seeOff(roots, nodes, how, pending) {
      const under = new Map<NodeId | null, Parented[]>();
      for (const n of nodes) {
        const list = under.get(n.parent);
        if (list) list.push(n);
        else under.set(n.parent, [n]);
      }
      const removedNode = (n: Parented): RemovedNode<TPose, TNode> | null => {
        const s = shown(n.id);
        if (!s) return null;
        const children = (under.get(n.id) ?? []).map(removedNode).filter((c) => c !== null);
        return { node: s.node, pose: s.pose, children };
      };
      const seen = roots.map((r) => [r, removedNode(r)] as const);
      return () => {
        const added = new Set<NodeId>();
        for (const n of nodes) {
          const w = pending.get(n.id);
          if (w && w.from === undefined) added.add(n.id);
          pending.delete(n.id);
        }
        for (const [r, removed] of seen) {
          if (removed && !added.has(r.id)) removals.set(r.id, { id: r.id, parent: r.parent, ...removed, ...how });
        }
      };
    },
    takeBack(id) {
      const gone = removals.get(id);
      removals.delete(id);
      return gone?.pose;
    },
    drain() {
      // Undoing a group's add takes its children first, each its own root.
      const out: PoseRemoval<TPose, TNode>[] = [];
      for (const r of removals.values()) {
        const up = r.parent !== null ? removals.get(r.parent) : undefined;
        if (up) (up.children as RemovedNode<TPose, TNode>[]).push(r);
        else out.push(r);
      }
      removals.clear();
      return out;
    },
  };
}
