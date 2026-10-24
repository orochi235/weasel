import type { NodeId, PoseHold, PoseOverride, PoseOverrides } from './types';


/** The table methods a hold writes through. */
type HoldTable<TPose, TData> = Pick<PoseOverrides<TPose, TData>, 'set' | 'get' | 'ids' | 'clear' | 'commit'>;

type Shown<TPose, TData> = Pick<PoseOverride<TPose, TData>, 'pose' | 'data'>;

/** Build the {@link PoseHold} a table hands out from `hold()`. */
export function createPoseHold<TPose, TData = unknown>(table: HoldTable<TPose, TData>): PoseHold<TPose, TData> {
  /** The entry published per id, held by reference so a frame mutates it in place. */
  const held = new Map<NodeId, PoseOverride<TPose, TData>>();
  const seen = new Set<NodeId>();

  /** Publish `frame`; with `yields`, an id another writer holds is left to it. */
  const publish = (frame: Iterable<readonly [NodeId, Shown<TPose, TData>]>, yields: boolean): void => {
    seen.clear();
    for (const [id, shown] of frame) {
      const existing = held.get(id);
      if (yields && table.get(id) !== undefined && table.get(id) !== existing) continue;
      seen.add(id);
      if (existing) {
        existing.pose = shown.pose;
        existing.data = shown.data;
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
      if (table.get(id) === entry) table.clear(id);
    }
    table.commit();
  };

  return {
    set(poses) {
      publish(mapped(poses), false);
    },
    show(frame) {
      publish(frame, true);
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

function* mapped<TPose, TData>(poses: Iterable<readonly [NodeId, TPose]>): Iterable<readonly [NodeId, Shown<TPose, TData>]> {
  for (const [id, pose] of poses) yield [id, { pose }];
}
