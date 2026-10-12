import type { NodeId, PoseHold, PoseOverride, PoseOverrides } from './types';

/** The table methods a hold writes through. */
type HoldTable<TPose> = Pick<PoseOverrides<TPose>, 'set' | 'get' | 'ids' | 'clear' | 'commit'>;

/** Build the {@link PoseHold} a table hands out from `hold()`. */
export function createPoseHold<TPose>(table: HoldTable<TPose>): PoseHold<TPose> {
  /** The entry published per id, held by reference so a frame mutates it in place. */
  const held = new Map<NodeId, PoseOverride<TPose>>();
  const seen = new Set<NodeId>();

  return {
    set(poses) {
      seen.clear();
      for (const [id, pose] of poses) {
        seen.add(id);
        const existing = held.get(id);
        if (existing) {
          existing.pose = pose;
          continue;
        }
        const entry: PoseOverride<TPose> = { pose };
        held.set(id, entry);
        // `table.set` notifies per call, so an id is set once and mutated after.
        table.set(id, entry);
      }
      for (const [id, entry] of held) {
        if (seen.has(id)) continue;
        held.delete(id);
        if (table.get(id) === entry) table.clear(id);
      }
      table.commit();
    },
    others() {
      const out = new Map<NodeId, TPose>();
      for (const id of table.ids()) {
        const entry = table.get(id);
        if (entry === undefined || entry === held.get(id) || entry.pose === undefined) continue;
        out.set(id, entry.pose);
      }
      return out;
    },
    drop() {
      if (held.size === 0) return;
      for (const [id, entry] of held) {
        if (table.get(id) === entry) table.clear(id);
      }
      held.clear();
      table.commit();
    },
  };
}
