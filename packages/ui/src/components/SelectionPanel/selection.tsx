import { createContext } from 'react';
import { prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { GroupTabs, type GroupTab } from '../Prefs/GroupTabs';
import { pathWithin, useHeldTab, type PrefMarks } from '../Prefs/selection';

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

/** One tab of a {@link PanelTabs} strip, and whether the panel's lead mark lies in it. */
export interface PanelTab extends GroupTab {
  holds: boolean;
}

/** A run of tab sections that opens the one holding the panel's lead mark. */
export function PanelTabs({ tabs, lead, className }: { tabs: readonly PanelTab[]; lead: string | null | undefined; className?: string }) {
  const [open, pick] = useHeldTab(tabs.map((t) => t.id), tabs.find((t) => t.holds)?.id, lead);
  return <GroupTabs className={className} tabs={tabs} picked={open} onPick={pick} />;
}
