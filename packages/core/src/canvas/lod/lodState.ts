/** What one view drew each node as last frame, which hysteresis and picking both read. */
import type { RungId } from './ladder';

/** The rung a walk chose for a node, and whether it drew in place of the node's children. */
export interface LodPick {
  readonly rung: RungId;
  readonly skip: boolean;
}

/** A view's level-of-detail record: one map per walk key, replaced whole by each walk. */
export interface LodState {
  /** The rung this view drew `id` at in its last frame, or undefined for a node it did not visit
   *  or that has one rung. */
  rungOf(id: string): RungId | undefined;
  /** Whether `id` was drawn in its last frame at a rung that skips its children. */
  skips(id: string): boolean;
  /** The nearest of `ancestors` (innermost first) drawn at a rung that skips its children, or null. */
  collapsedAbove(ancestors: readonly { id: string }[]): string | null;
  /** How many entries are held: at most what the walks of the last frame visited. */
  size(): number;
  /** Start a walk under `key` (one per scene layer the view paints): the previous walk's picks
   *  stay readable as `prev` until `end`. */
  begin(key: string): LodWalkRecord;
}

/** One walk's writes into a {@link LodState}. */
export interface LodWalkRecord {
  /** What the previous walk under the same key chose for `id`. */
  prev(id: string): LodPick | undefined;
  record(id: string, pick: LodPick): void;
  /** Replace the key's map with this walk's, dropping every node it did not visit. */
  end(): void;
}

export function createLodState(): LodState {
  const walks = new Map<string, Map<string, LodPick>>();
  const find = (id: string): LodPick | undefined => {
    for (const m of walks.values()) {
      const p = m.get(id);
      if (p !== undefined) return p;
    }
    return undefined;
  };
  return {
    rungOf: (id) => find(id)?.rung,
    skips: (id) => find(id)?.skip === true,
    collapsedAbove(ancestors) {
      if (walks.size === 0) return null;
      // Outermost first: a collapsed group hides every collapsed group inside it.
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const id = ancestors[i]!.id;
        if (find(id)?.skip === true) return id;
      }
      return null;
    },
    size() {
      let n = 0;
      for (const m of walks.values()) n += m.size;
      return n;
    },
    begin(key) {
      const before = walks.get(key);
      const next = new Map<string, LodPick>();
      return {
        prev: (id) => before?.get(id),
        record: (id, pick) => { next.set(id, pick); },
        end: () => {
          if (next.size === 0) walks.delete(key);
          else walks.set(key, next);
        },
      };
    },
  };
}
