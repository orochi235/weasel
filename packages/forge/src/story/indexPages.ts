import { sanitize } from './ids';
import type { IndexEntry } from './types';

const SUFFIX = ':index';

/** The name an index page goes by in the sidebar and in its trial's title. */
export const INDEX_NAME = 'Index';

/** The id of `title`'s index page. A colon never survives `sanitize`, so no story id can collide with it. */
export function indexId(title: string): string {
  return `${sanitize(title)}${SUFFIX}`;
}

export function isIndexId(id: string): boolean {
  return id.endsWith(SUFFIX);
}

/**
 * One index-page entry per title in `stories`, in the order titles first appear. It routes and runs like a story:
 * its `file` is the title's first story file, and its descriptions are the title's own.
 */
export function indexEntries(stories: readonly IndexEntry[]): IndexEntry[] {
  const byTitle = new Map<string, IndexEntry>();
  for (const entry of stories) {
    if (byTitle.has(entry.title)) continue;
    byTitle.set(entry.title, {
      id: indexId(entry.title),
      title: entry.title,
      name: INDEX_NAME,
      exportName: '',
      file: entry.file,
      ...(entry.componentDescription === undefined ? {} : { componentDescription: entry.componentDescription }),
      ...(entry.componentName === undefined ? {} : { componentName: entry.componentName }),
    });
  }
  return [...byTitle.values()];
}
