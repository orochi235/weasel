import type { NodeId, PoseHold, PoseOverride, PoseOverrides, ShownOverride } from './types';

/** The table methods a hold writes through. */
type HoldTable<TPose, TData> = Pick<PoseOverrides<TPose, TData>, 'set' | 'has' | 'ids' | 'clear' | 'commit'>;

/** Build the {@link PoseHold} a table hands out from `hold()`. `pliesOf`
 *  answers a node's plies, bottom first. */
export function createPoseHold<TPose, TData = unknown>(
  table: HoldTable<TPose, TData>,
  pliesOf: (id: NodeId) => readonly PoseOverride<TPose, TData>[] | undefined,
): PoseHold<TPose, TData> {
  /** The entry published per id, held by reference so a frame mutates it in place. */
  const held = new Map<NodeId, PoseOverride<TPose, TData>>();
  const seen = new Set<NodeId>();

  const publish = (frame: Iterable<readonly [NodeId, ShownOverride<TPose, TData>]>): void => {
    seen.clear();
    for (const [id, shown] of frame) {
      seen.add(id);
      const existing = held.get(id);
      if (existing) {
        existing.pose = shown.pose;
        existing.data = shown.data;
        // The table drops a node's plies on its own when the node goes; put back the node, and the frame goes back too.
        if (!table.has(id, existing)) table.set(id, existing);
        continue;
      }
      const entry: PoseOverride<TPose, TData> = { pose: shown.pose, data: shown.data };
      held.set(id, entry);
      // `table.set` notifies per call, so an id is set once and mutated after.
      table.set(id, entry);
    }
    for (const [id, entry] of held) {
      if (seen.has(id)) continue;
      held.delete(id);
      table.clear(id, entry);
    }
    table.commit();
  };

  return {
    set(poses) {
      publish(mapped(poses));
    },
    show: publish,
    others() {
      const out = new Map<NodeId, TPose>();
      for (const id of table.ids()) {
        const stack = pliesOf(id) ?? [];
        const mine = held.get(id);
        for (let k = stack.length - 1; k >= 0; k--) {
          const entry = stack[k]!;
          if (entry === mine || entry.pose === undefined) continue;
          out.set(id, entry.pose);
          break;
        }
      }
      return out;
    },
    drop() {
      if (held.size === 0) return;
      for (const [id, entry] of held) table.clear(id, entry);
      held.clear();
      table.commit();
    },
  };
}

function* mapped<TPose, TData>(poses: Iterable<readonly [NodeId, TPose]>): Iterable<readonly [NodeId, ShownOverride<TPose, TData>]> {
  for (const [id, pose] of poses) yield [id, { pose }];
}
