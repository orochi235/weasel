import type { ShortcutGroup, ShortcutRow, ShortcutsDescription } from '@weasel-js/core';
import { detectPlatform, formatShortcutParts, type Platform } from '@weasel-js/gestures';
import { foldText } from '@weasel-js/registry';
import { keySpecsFromLegend } from '../Keycaps/keySpecsFromLegend';

/** The platform whose keys a sheet writes: macOS for `apple`, else this one, or Linux when this one is a Mac. */
export function sheetPlatform(apple: boolean): Platform {
  if (apple) return 'macos';
  const here = detectPlatform();
  return here === 'macos' ? 'linux' : here;
}

/** The keys of each of `row`'s shortcuts, every one under each name it goes by: as shown (`⇧`, `⌘`) and spelled out
 *  (`Shift`, `Cmd`), folded for comparing. */
function keyNames(row: ShortcutRow, platform: Platform): Set<string>[] {
  return row.shortcuts.map((s) => {
    const names = (['auto', 'text'] as const).flatMap((legend) =>
      formatShortcutParts(s, { platform, legend })?.keys.map((k) => foldText(k.label)) ?? []);
    return new Set(names);
  });
}

/** A query as the keys it names: split at spaces and `+`, a run of modifier glyphs split one per key (`⇧⌘Z`). */
function queryKeys(query: string): string[] {
  return query.trim().split(/\s+/).flatMap((part) => keySpecsFromLegend(part).map((k) => foldText(k.label)));
}

/** Whether `row` answers `query`: by its label, or by one of its keys naming every key the query names. */
export function rowMatches(row: ShortcutRow, query: string, platform: Platform): boolean {
  const q = foldText(query.trim());
  if (q === '') return true;
  if (foldText(row.label).includes(q)) return true;
  const wanted = queryKeys(query);
  return wanted.length > 0 && keyNames(row, platform).some((names) => wanted.every((k) => names.has(k)));
}

/** `groups` holding only the rows `query` finds, and only the groups left with a row. */
export function filterGroups(groups: readonly ShortcutGroup[], query: string, platform: Platform): ShortcutGroup[] {
  return groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => rowMatches(r, query, platform)) }))
    .filter((g) => g.rows.length > 0);
}

/** A sheet's parts, each a run of groups, narrowed to `query`. The held keys are one group with no heading of its own. */
export function sheetParts(
  description: ShortcutsDescription, query: string, platform: Platform,
): { id: string; label: string; groups: ShortcutGroup[] }[] {
  const held: ShortcutGroup[] = description.held.length > 0 ? [{ id: 'held', label: '', rows: description.held }] : [];
  return [
    { id: 'tools', label: 'Tools', groups: filterGroups(description.tools, query, platform) },
    { id: 'commands', label: 'Commands', groups: filterGroups(description.commands, query, platform) },
    { id: 'held', label: 'Held keys', groups: filterGroups(held, query, platform) },
  ].filter((p) => p.groups.length > 0);
}
