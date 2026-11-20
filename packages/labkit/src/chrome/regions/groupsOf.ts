import type { ContributionBase } from '../types';

/** One run of a region's contributions: a group, or one ungrouped contribution. */
export interface ContributionGroup<T extends ContributionBase> {
  /** The group's name, or the ungrouped contribution's id. */
  key: string;
  /** Unlike `key`, never the same for two runs: a group may share its name with an ungrouped contribution's id. */
  id: string;
  /** Whether a `group` named the run, rather than it standing for one ungrouped contribution. */
  named: boolean;
  /** Whether any of its entries asked for the far end. */
  end: boolean;
  entries: T[];
}

/** Bucket by group, preserving first-appearance order, then move every run marked `end` after the rest, keeping
 *  their order. Ungrouped contributions each become their own bucket so they stay in place. A group is `end` when
 *  any member says so. */
export function groupsOf<T extends ContributionBase>(
  contributions: readonly T[],
): ContributionGroup<T>[] {
  const groups: ContributionGroup<T>[] = [];
  const byKey = new Map<string, ContributionGroup<T>>();
  for (const c of contributions) {
    if (c.group == null) {
      groups.push({
        key: c.id,
        id: `entry:${c.id}`,
        named: false,
        end: c.end ?? false,
        entries: [c],
      });
      continue;
    }
    let g = byKey.get(c.group);
    if (!g) {
      g = { key: c.group, id: `group:${c.group}`, named: true, end: false, entries: [] };
      byKey.set(c.group, g);
      groups.push(g);
    }
    if (c.end) g.end = true;
    g.entries.push(c);
  }
  return [...groups.filter((g) => !g.end), ...groups.filter((g) => g.end)];
}

/** A region's contributions in the order its groups lay them out: each group's members together, end runs last. */
export function inLayoutOrder<T extends ContributionBase>(contributions: readonly T[]): T[] {
  return groupsOf(contributions).flatMap((g) => g.entries);
}
