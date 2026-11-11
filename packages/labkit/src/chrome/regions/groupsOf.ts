import type { ContributionBase } from '../types';

/** One run of a region's contributions: a group, or one ungrouped contribution. */
export interface ContributionGroup<T extends ContributionBase> {
  /** The group's name, or the ungrouped contribution's id. */
  key: string;
  /** Unlike `key`, never the same for two runs: a group may share its name with an ungrouped contribution's id. */
  id: string;
  end: boolean;
  entries: T[];
}

/** Bucket by group, preserving first-appearance order. Ungrouped
 *  contributions each become their own bucket so they stay in place. */
export function groupsOf<T extends ContributionBase>(
  contributions: readonly T[],
): ContributionGroup<T>[] {
  const groups: ContributionGroup<T>[] = [];
  const byKey = new Map<string, ContributionGroup<T>>();
  for (const c of contributions) {
    if (c.group == null) {
      groups.push({ key: c.id, id: `entry:${c.id}`, end: c.end ?? false, entries: [c] });
      continue;
    }
    let g = byKey.get(c.group);
    if (!g) {
      g = { key: c.group, id: `group:${c.group}`, end: c.end ?? false, entries: [] };
      byKey.set(c.group, g);
      groups.push(g);
    }
    g.entries.push(c);
  }
  return groups;
}
