import { createContext } from 'react';
import { isPrefLeaf, pairRuns, prefDrawsAsBox, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { GroupTabs, type GroupTab } from '../Prefs/GroupTabs';
import { pathWithin, useHeldTab, type PrefMarks } from '../Prefs/selection';
import { isFlagLeaf } from './cells';
import { isPanelSection, panelLeafKey, panelOwnRows, type PanelRow, type PanelSection } from './model';
import type { LeafRenderer } from './renderContext';

/** What a panel marks while it draws, and the one of those it brings into view. */
export interface PanelMarks extends PrefMarks {
  lead?: string | null;
}

/** The marks of the panel a leaf is drawn in, for a leaf that draws rows of its own. */
export const PanelMarksContext = createContext<PanelMarks>({});

/**
 * The path a panel draws a row for when asked for `path`: one of `rows`, a field of an object leaf among them, or
 * the nearest of those `path` lies inside. Null when `rows` holds none. A row's `fields` is the path its fields are
 * drawn under, where that is not its own (an alias's target); a field is named under either.
 */
export function panelShownPath(
  rows: Iterable<readonly [path: string, leaf: PrefLeaf, fields?: string]>, path: string,
): string | null {
  let best: { at: string; leaf: PrefLeaf; fields: string; by: string } | undefined;
  for (const [at, leaf, fields = at] of rows) {
    const by = pathWithin(at, path) ? at : pathWithin(fields, path) ? fields : undefined;
    if (by !== undefined && (best === undefined || by.length > best.by.length)) best = { at, leaf, fields, by };
  }
  if (best === undefined) return null;
  const { at, leaf, fields, by } = best;
  if (by === path || leaf.kind !== 'object') return at;
  const inner = (leaf as PrefObject).children;
  return panelShownPath(prefSectionLeaves(inner).map(([key, field]) => [`${fields}.${key}`, field] as const), fields + path.slice(by.length)) ?? at;
}

/** A run of `items` sharing one pair, as a bar draws it: each flag after the first of a run of them is drawn in the
 *  first's cell, and any other item in a cell of its own. */
function fuseFlags(
  items: readonly { key: string; path: string; leaf: PrefLeaf }[], renderers: Record<string, LeafRenderer> | undefined, out: Map<string, string>,
): void {
  let first: string | null = null;
  for (const item of items) {
    if (!isFlagLeaf(item.leaf, item.path, renderers)) first = null;
    else if (first === null) first = item.key;
    else out.set(item.key, first);
  }
}

/**
 * Each field of the object leaf at `base` drawn in a row or a cell for another, by that other, as `ObjectLeaf`
 * draws them: a pair shares a row only within one run of neighboring fields, and in a bar only a run of paired
 * flags shares a cell.
 */
function sharedFields(
  leaf: PrefObject, base: string, renderers: Record<string, LeafRenderer> | undefined, out: Map<string, string>,
): void {
  const walk = (members: PrefObject['children'], inBar: boolean): void => {
    let run: Array<readonly [string, PrefLeaf]> = [];
    const flush = (): void => {
      for (const { items, pair } of pairRuns(run, (field) => field)) {
        if (pair === undefined) continue;
        if (inBar) fuseFlags(items.map(([path, field]) => ({ key: path, path, leaf: field })), renderers, out);
        else for (const [path] of items) out.set(path, items[0]![0]);
      }
      for (const [path, field] of run) if (field.kind === 'object') sharedFields(field as PrefObject, path, renderers, out);
      run = [];
    };
    for (const [key, child] of Object.entries(members)) {
      if (isPrefLeaf(child)) {
        run.push([`${base}.${key}`, child]);
        continue;
      }
      flush();
      walk(child.members, inBar || child.as === 'bar');
    }
    flush();
  };
  walk(leaf.children, false);
}

/**
 * Each leaf that shares its row with others, by the leaf that row is drawn for: its first, as a cell a bar fuses
 * from several leaves stands for its first.
 */
function sharedRows(rows: readonly PanelRow[], renderers: Record<string, LeafRenderer> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    const first = panelLeafKey(row.leaves[0]!);
    for (const item of row.leaves) {
      if (row.leaves.length > 1) out.set(panelLeafKey(item), first);
      if (item.leaf.kind === 'object') sharedFields(item.leaf as PrefObject, item.path, renderers, out);
    }
  }
  return out;
}

/** Each flag a bar fuses into a cell with the flags before it, by the flag that cell is drawn for: the run's first. */
function fusedFlags(rows: readonly PanelRow[], renderers: Record<string, LeafRenderer> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) {
    if (row.pair !== undefined) fuseFlags(row.leaves.map((item) => ({ key: panelLeafKey(item), path: item.path, leaf: item.leaf })), renderers, out);
  }
  return out;
}

/** Whether a panel draws `section` under a heading of its own. */
export const sectionHeaded = (section: PanelSection): boolean =>
  section.name !== '' && section.as !== 'tab' && section.as !== 'fragment' && section.as !== 'bar';

/** Whether `selected` can name `section` by its key: it draws a heading, a tab, or a panel to carry the mark. */
export const sectionNamed = (section: PanelSection): boolean =>
  section.key !== '' && (section.as === 'tab' || prefDrawsAsBox(section.as) || sectionHeaded(section));

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
  sections: readonly PanelSection[], selected: readonly string[], renderers?: Record<string, LeafRenderer>,
): string[] {
  const all = everySection(sections);
  const rowsIn = (bar: boolean): PanelRow[] => all.filter((at) => at.inBar === bar).flatMap((at) => panelOwnRows(at.section));
  const drawn = all.flatMap((at) => panelOwnRows(at.section)).flatMap((row) => row.leaves.map((item) => [panelLeafKey(item), item.leaf, item.path] as const));
  // A bar draws a cell a leaf, and no row for a pair to share.
  const shared = sharedRows(rowsIn(false), renderers);
  const fused = fusedFlags(rowsIn(true), renderers);
  const keys = new Set(all.filter((at) => !at.inBar && sectionNamed(at.section)).map((at) => at.section.key));
  const out = selected.flatMap((path) => {
    const at = panelShownPath(drawn, path);
    if (at !== null) return [shared.get(at) ?? fused.get(at) ?? at];
    return keys.has(path) ? [path] : [];
  });
  return [...new Set(out)];
}

/** Whether `section` holds `lead`: as its own key, a nested section's, a leaf inside it, or a field of one. */
export function sectionHolds(section: PanelSection, lead: string | null | undefined): boolean {
  if (lead == null) return false;
  return section.key === lead || section.items.some((item) =>
    isPanelSection(item) ? sectionHolds(item, lead) : item.leaves.some((leaf) => pathWithin(panelLeafKey(leaf), lead) || lead.startsWith(`${leaf.path}.`)));
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
