import type { IndexEntry } from '../story/types';

/**
 * What `check:forge-titles` prints: each story file whose title's last segment holds whitespace, then each story
 * id two stories share. That segment names the component in the Components view, so a phrase there is a story
 * filed as a component of its own; it belongs under the component it shows, named for what it adds. Files that
 * share a title share its ids too, so two of them exporting one name collide.
 */
export function titleReport(entries: readonly IndexEntry[], root = ''): { lines: string[]; ok: boolean } {
  const under = (file: string) => (file.startsWith(root) ? file.slice(root.length).replace(/^\//, '') : file);
  const spaced = new Map<string, string>();
  const files = new Map<string, string[]>();
  for (const entry of entries) {
    if (/\s/.test(entry.title.split('/').pop() ?? '')) spaced.set(under(entry.file), entry.title);
    files.set(entry.id, [...(files.get(entry.id) ?? []), under(entry.file)]);
  }
  const shared = [...files].filter(([, of]) => of.length > 1);
  const width = Math.max(0, ...[...spaced.keys()].map((file) => file.length));
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
