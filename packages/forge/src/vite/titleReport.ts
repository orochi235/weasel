import { relative } from 'node:path';
import type { Logger } from 'vite';
import type { IndexEntry } from '../story/types';
import { warnOnce } from './warnOnce.ts';

/** A story id two or more entries share: the files declaring it, each once, and the exports that do. */
interface SharedId {
  id: string;
  files: string[];
  exports: string[];
}

/** Each story id two or more entries share. Files that share a title share its ids too, so two of them exporting one
 *  name collide; one file collides with itself on two exports its id sanitizes alike (`Primary`, `primary`). */
export function sharedIds(entries: readonly IndexEntry[], under = (file: string) => file): SharedId[] {
  const byId = new Map<string, IndexEntry[]>();
  for (const entry of entries) byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry]);
  return [...byId]
    .filter(([, of]) => of.length > 1)
    .map(([id, of]) => ({ id, files: [...new Set(of.map((e) => under(e.file)))], exports: of.map((e) => e.exportName) }));
}

/** Who declares a shared id, and what to change: one file's exports are renamed, two files' either way. */
function sharedText({ files, exports }: SharedId): { by: string; fix: string } {
  if (files.length > 1) return { by: files.join(', '), fix: 'Rename one of the exports, or retitle one file.' };
  return { by: `${files[0]} as ${exports.join(', ')}`, fix: 'Rename one of the exports.' };
}

/** `entries` with only the first of each story id two of them share, after warning once through `logger` of each. */
export function warnShared(entries: IndexEntry[], root: string, logger: Logger | undefined): IndexEntry[] {
  const shared = sharedIds(entries, (file) => relative(root, file));
  if (shared.length === 0) return entries;
  for (const one of shared) {
    const { by, fix } = sharedText(one);
    warnOnce(logger, `[forge] story id ${one.id} is declared by ${by}; the workshop shows only the first. ${fix}`);
  }
  const seen = new Set<string>();
  return entries.filter((entry) => !seen.has(entry.id) && seen.add(entry.id));
}

/**
 * What `check:forge-titles` prints: each story file whose title's last segment holds whitespace, then each story
 * id two stories share. That segment names the component in the Components view, so a phrase there is a story
 * filed as a component of its own; it belongs under the component it shows, named for what it adds.
 */
export function titleReport(entries: readonly IndexEntry[], root: string): { lines: string[]; ok: boolean } {
  const under = (file: string) => relative(root, file);
  const spaced = new Map<string, string>();
  for (const entry of entries) {
    if (/\s/.test(entry.title.split('/').pop() ?? '')) spaced.set(under(entry.file), entry.title);
  }
  const shared = sharedIds(entries, under);
  const width = [...spaced.keys()].reduce((most, file) => Math.max(most, file.length), 0);
  const lines = [
    ...[...spaced].map(([file, title]) => `${file.padEnd(width)}  '${title}'`),
    ...shared.map((one) => `${one.id}  declared by ${sharedText(one).by}`),
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
