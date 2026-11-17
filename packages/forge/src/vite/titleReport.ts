import { relative } from 'node:path';
import type { Logger } from 'vite';
import type { IndexEntry } from '../story/types';
import { warnOnce } from './warnOnce.ts';

/** Each story id two or more entries share, with the files declaring it. Files that share a title share its ids too,
 *  so two of them exporting one name collide. */
export function sharedIds(entries: readonly IndexEntry[], under = (file: string) => file): [string, string[]][] {
  const files = new Map<string, string[]>();
  for (const entry of entries) files.set(entry.id, [...(files.get(entry.id) ?? []), under(entry.file)]);
  return [...files].filter(([, of]) => of.length > 1);
}

/** `entries` with only the first of each story id two of them share, after warning once through `logger` of each. */
export function warnShared(entries: IndexEntry[], root: string, logger: Logger | undefined): IndexEntry[] {
  const shared = sharedIds(entries, (file) => relative(root, file));
  if (shared.length === 0) return entries;
  for (const [id, of] of shared) {
    const files = of.join(', ');
    warnOnce(logger, `[forge] story id ${id} is declared by ${files}; the workshop shows only the first. Rename one of the exports, or retitle one file.`);
  }
  const seen = new Set<string>();
  return entries.filter((entry) => !seen.has(entry.id) && seen.add(entry.id));
}

/**
 * What `check:forge-titles` prints: each story file whose title's last segment holds whitespace, then each story
 * id two stories share. That segment names the component in the Components view, so a phrase there is a story
 * filed as a component of its own; it belongs under the component it shows, named for what it adds.
 */
export function titleReport(entries: readonly IndexEntry[], root = ''): { lines: string[]; ok: boolean } {
  const under = (file: string) => (file.startsWith(root) ? file.slice(root.length).replace(/^\//, '') : file);
  const spaced = new Map<string, string>();
  for (const entry of entries) {
    if (/\s/.test(entry.title.split('/').pop() ?? '')) spaced.set(under(entry.file), entry.title);
  }
  const shared = sharedIds(entries, under);
  const width = [...spaced.keys()].reduce((most, file) => Math.max(most, file.length), 0);
  const lines = [
    ...[...spaced].map(([file, title]) => `${file.padEnd(width)}  '${title}'`),
    ...shared.map(([id, of]) => `${id}  declared by ${of.join(', ')}`),
  ];
  if (spaced.size > 0) {
    lines.push(
      `${spaced.size} story ${spaced.size === 1 ? 'file is' : 'files are'} titled for something other than a component. Give each the title of the component it shows, and name the story for what the file adds.`,
    );
  }
  if (shared.length > 0) lines.push(`${shared.length} story ${shared.length === 1 ? 'id is' : 'ids are'} declared twice. Rename one of each pair's exports.`);
  const ok = spaced.size === 0 && shared.length === 0;
  if (ok) lines.push(`${new Set(entries.map((entry) => entry.title)).size} titles, each ending in a component name, and no story id declared twice`);
  return { lines, ok };
}
