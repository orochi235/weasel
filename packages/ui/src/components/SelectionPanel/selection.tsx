import { createContext } from 'react';
import { prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { GroupTabs, type GroupTab } from '../Prefs/GroupTabs';
import { pathWithin, useHeldTab, type PrefMarks } from '../Prefs/selection';
import { pairRows, panelLeafKey, type PanelRow, type PanelSection } from './model';

/** What a panel marks while it draws, and the one of those it brings into view. */
export interface PanelMarks extends PrefMarks {
  lead?: string | null;
}

/** The marks of the panel a leaf is drawn in, for a leaf that draws rows of its own. */
export const PanelMarksContext = createContext<PanelMarks>({});

/**
 * The path a panel draws a row for when asked for `path`: one of `rows`, a field of an object leaf among them, or
 * the nearest of those `path` lies inside. Null when `rows` holds none.
 */
export function panelShownPath(rows: Iterable<readonly [path: string, leaf: PrefLeaf]>, path: string): string | null {
  let best: readonly [string, PrefLeaf] | undefined;
  for (const row of rows) {
    if (pathWithin(row[0], path) && (best === undefined || row[0].length > best[0].length)) best = row;
  }
  if (best === undefined) return null;
  const [at, leaf] = best;
  if (at === path || leaf.kind !== 'object') return at;
  const fields = prefSectionLeaves((leaf as PrefObject).children).map(([key, field]) => [`${at}.${key}`, field] as const);
  return panelShownPath(fields, path) ?? at;
}

/**
 * Each leaf that shares its row with others, by the leaf that row is drawn for: its first, as a cell a bar fuses
 * from several leaves stands for its first.
 */
function sharedRows(rows: readonly PanelRow[], out = new Map<string, string>()): Map<string, string> {
  for (const row of rows) {
    const first = panelLeafKey(row.leaves[0]!);
    for (const item of row.leaves) {
      if (row.leaves.length > 1) out.set(panelLeafKey(item), first);
      if (item.leaf.kind !== 'object') continue;
      const fields = prefSectionLeaves((item.leaf as PrefObject).children);
      sharedRows(pairRows(fields.map(([key, leaf]) => ({ path: `${panelLeafKey(item)}.${key}`, leaf }))), out);
    }
  }
  return out;
}

/**
 * What a panel of `sections` marks for `selected`, as the paths its elements carry: a row for a leaf, the one row
 * a pair's leaves share for any of them, and a top-level section for its own key. A path it draws nothing for is
 * left out, a section nested in another among them.
 */
export function panelMarkedPaths(sections: readonly PanelSection[], selected: readonly string[]): string[] {
  const rows = sections.flatMap((section) => section.rows);
  const drawn = rows.flatMap((row) => row.leaves.map((item) => [panelLeafKey(item), item.leaf] as const));
  // A bar draws a cell a leaf, and no row for a pair to share.
  const shared = sharedRows(sections.filter((section) => section.as !== 'bar').flatMap((section) => section.rows));
  const keys = new Set(sections.map((section) => section.key));
  const out = selected.flatMap((path) => {
    const at = panelShownPath(drawn, path);
    if (at !== null) return [shared.get(at) ?? at];
    return path !== '' && keys.has(path) ? [path] : [];
  });
  return [...new Set(out)];
}

/** One tab of a {@link PanelTabs} strip, and whether the panel's lead mark lies in it. */
export interface PanelTab extends GroupTab {
  holds: boolean;
}

/** A run of tab sections that opens the one holding the panel's lead mark. */
export function PanelTabs({ tabs, lead, className }: { tabs: readonly PanelTab[]; lead: string | null | undefined; className?: string }) {
  const [open, pick] = useHeldTab(tabs.map((t) => t.id), tabs.find((t) => t.holds)?.id, lead);
  return <GroupTabs className={className} tabs={tabs} picked={open} onPick={pick} />;
}
