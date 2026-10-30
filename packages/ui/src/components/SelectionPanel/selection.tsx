import { createContext } from 'react';
import { prefAsBox, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { GroupTabs, type GroupTab } from '../Prefs/GroupTabs';
import { pathWithin, useHeldTab, type PrefMarks } from '../Prefs/selection';
import { isFlagLeaf } from './cells';
import { isPanelSection, pairRows, panelLeafKey, panelOwnRows, type PanelRow, type PanelSection } from './model';
import type { PropertyRenderer } from './renderContext';

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

/** Each flag a bar fuses into a cell with the flags before it, by the flag that cell is drawn for: the run's first. */
function fusedFlags(rows: readonly PanelRow[], renderers: Record<string, PropertyRenderer> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    if (row.pair === undefined) continue;
    let first: string | null = null;
    for (const item of row.leaves) {
      if (!isFlagLeaf(item.leaf, item.path, renderers)) first = null;
      else if (first === null) first = panelLeafKey(item);
      else out.set(panelLeafKey(item), first);
    }
  }
  return out;
}

/** Whether a panel draws `section` under a heading of its own. */
export const sectionHeaded = (section: PanelSection): boolean =>
  section.name !== '' && section.as !== 'tab' && section.as !== 'fragment' && section.as !== 'bar';

/** Whether `selected` can name `section` by its key: it draws a heading, a tab, or a panel to carry the mark. */
export const sectionNamed = (section: PanelSection): boolean =>
  section.key !== '' && (section.as === 'tab' || prefAsBox(section.as) || sectionHeaded(section));

/** Every section of `sections`, those nested in them included, and whether it is drawn on a bar's line. */
function everySection(sections: readonly PanelSection[], inBar = false): Array<{ section: PanelSection; inBar: boolean }> {
  return sections.flatMap((section) => {
    const bar = inBar || section.as === 'bar';
    return [{ section, inBar: bar }, ...everySection(section.items.filter(isPanelSection), bar)];
  });
}

/**
 * What a panel of `sections` marks for `selected`, as the paths its elements carry: a row for a leaf, the one row
 * a pair's leaves share for any of them, the one cell a bar fuses from a run of flags, and a section
 * {@link sectionNamed} holds for its own key, at any depth. A path it draws nothing for is left out, a section on a
 * bar's line among them. `renderers` are the panel's, since a flag one of them draws joins no run.
 */
export function panelMarkedPaths(
  sections: readonly PanelSection[], selected: readonly string[], renderers?: Record<string, PropertyRenderer>,
): string[] {
  const all = everySection(sections);
  const rowsIn = (bar: boolean): PanelRow[] => all.filter((at) => at.inBar === bar).flatMap((at) => panelOwnRows(at.section));
  const drawn = all.flatMap((at) => panelOwnRows(at.section)).flatMap((row) => row.leaves.map((item) => [panelLeafKey(item), item.leaf] as const));
  // A bar draws a cell a leaf, and no row for a pair to share.
  const shared = sharedRows(rowsIn(false));
  const fused = fusedFlags(rowsIn(true), renderers);
  const keys = new Set(all.filter((at) => !at.inBar && sectionNamed(at.section)).map((at) => at.section.key));
  const out = selected.flatMap((path) => {
    const at = panelShownPath(drawn, path);
    if (at !== null) return [shared.get(at) ?? fused.get(at) ?? at];
    return keys.has(path) ? [path] : [];
  });
  return [...new Set(out)];
}

/** Whether `section` holds `lead`: as its own key, a nested section's, or a leaf inside it. */
export function sectionHolds(section: PanelSection, lead: string | null | undefined): boolean {
  if (lead == null) return false;
  return section.key === lead || section.items.some((item) =>
    isPanelSection(item) ? sectionHolds(item, lead) : item.leaves.some((leaf) => pathWithin(panelLeafKey(leaf), lead)));
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
